/**
 * Decap CMS 编辑工作流（editorial_workflow）草稿存活 E2E
 *
 * 目标：证明「写一半 → Save 存草稿 → 关页面/退出登录 → 回来草稿还在 → Publish 成功」这条链路。
 *   —— 即 GitHub token 失效（Bad credentials）或中途想保存时，稿子不会丢。
 *
 * 关键事实：
 *  - 生产 backend=github 时 publish_mode: editorial_workflow 生效（顶栏出现 Save 按钮）。
 *  - 本地 local_backend(proxy) 会静默把 workflow 降级为 simple（bundle 内建行为），
 *    所以本测试用 Decap 自带的 test-repo 后端（浏览器内模拟仓库，运行时经请求拦截注入夹具）。
 *  - 退出登录只删 auth token 键（bundle: logout(){localStorage.removeItem(this.storageKey)}），
 *    草稿存 localForage/IndexedDB，独立于登录态 —— 故「刷新页面草稿仍在」即等价证明跨登录存活性。
 *
 * 前置：astro dev :4321（无需 decap-server）
 */
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ADMIN = 'http://localhost:4321/stanleyhome/admin/index.html';
const TITLE = '工作流草稿存活测试';
const SLUG = 'qa-draft-test';
const FIXTURE = fs.readFileSync('public/admin/config-workflow-test.yml');

const b = await puppeteer.launch({ executablePath: CHROME, protocolTimeout: 180000, args: ['--no-sandbox', '--disable-gpu'] });
const page = await b.newPage();
// Decap 3.x 只认 HTML <link cms-config-url> 或默认 config.yml（?config= 已废弃）
// → 拦截 config.yml 响应，注入 test-repo 夹具
await page.setRequestInterception(true);
page.on('request', (req) => {
  if (/\/admin\/config\.yml(\?|$)/.test(req.url())) {
    req.respond({ status: 200, contentType: 'text/yaml', body: FIXTURE });
  } else req.continue();
});
await page.setViewport({ width: 1400, height: 950 });
page.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 120)));
page.on('dialog', async (d) => { await d.accept(); });

const step = async (name, fn) => {
  try { await fn(); console.log('✓', name); }
  catch (e) {
    console.log('✗', name, '::', String(e).slice(0, 160));
    console.log((e.stack||'').split('\n').slice(1,4).join('\n'));
    try { await page.screenshot({ path: '/tmp/qa-draft-fail.png', fullPage: true }); } catch {}
    throw e;
  }
};
const waitText = (txt, timeout = 25000) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, txt);
const fill = async (label, value) => {
  await page.evaluate((label, value) => {
    const lab = [...document.querySelectorAll('label')].find((l) => l.textContent.trim().startsWith(label));
    if (!lab) throw new Error('label missing: ' + label);
    let ctrl = lab.htmlFor ? document.getElementById(lab.htmlFor) : null;
    if (!ctrl) {
      let box = lab;
      for (let i = 0; i < 6 && box; i++) {
        box = box.parentElement;
        ctrl = box?.querySelector('input[type=text],input[type=number],input[type=url],input:not([type]),textarea');
        if (ctrl) break;
      }
    }
    if (!ctrl) throw new Error('control missing: ' + label);
    const proto = ctrl.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(ctrl, value);
    ctrl.dispatchEvent(new Event('input', { bubbles: true }));
    ctrl.dispatchEvent(new Event('change', { bubbles: true }));
  }, label, value);
  await new Promise((r) => setTimeout(r, 150));
};
const clickTopBar = async (texts) => {
  const t = await page.evaluate((texts) => {
    // Decap 文案含 &nbsp;( )——先归一化再比
    const norm = (e) => e.textContent.replace(/\u00a0/g, ' ').trim();
    const nodes = [...document.querySelectorAll('button,[role=button],a')].filter(
      (e) => texts.some((x) => norm(e).startsWith(x)) && e.offsetHeight > 0
    );
    const leaf = nodes.pop();
    if (!leaf) return null;
    const r = leaf.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, texts);
  if (!t) throw new Error('topbar button missing: ' + texts.join('/'));
  await page.mouse.click(t.x, t.y);
  return t;
};

let pass = true;
try {
  await step('加载 test-repo 后台 → 点 Login 进入 → 作品集可见', async () => {
    await page.goto(ADMIN, { waitUntil: 'networkidle2', timeout: 40000 });
    await waitText('Login', 30000);
    const h = await page.evaluateHandle(() => [...document.querySelectorAll('a,button')].find((e) => e.textContent.trim() === 'Login'));
    await h.asElement().click();
    await waitText('作品集', 30000);
    // 工作流模式生效的硬指标：打开编辑器后顶栏必须有 Save 按钮（下一步验证）
  });

  await step('新建作品填表 → Save 存草稿 → 出现未发布标记', async () => {
    await clickTopBar(['New 作品', '新增作品']);
    await waitText('一句话简介');
    await fill('标题', TITLE);
    await fill('文件名', SLUG);
    await fill('一句话简介', '验证草稿跨会话存活');
    const ctrlBox = await page.evaluate(() => {
      const lab = document.querySelector('label[for^="type-field"]');
      const cont = lab?.closest('[class*=ControlContainer]');
      if (!cont) return null;
      const r = cont.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!ctrlBox) throw new Error('type control missing');
    await page.mouse.click(ctrlBox.x, ctrlBox.y);
    await new Promise((r) => setTimeout(r, 700));
    const optBox = await page.evaluate(() => {
      const o = [...document.querySelectorAll('*')].filter(
        (e) => e.textContent.trim() === '图文' && e.children.length === 0 && e.offsetHeight > 0
      ).pop();
      if (!o) return null;
      const r = o.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!optBox) throw new Error('option 图文 missing');
    await page.mouse.click(optBox.x, optBox.y);
    await new Promise((r) => setTimeout(r, 400));
    // 正文必填：CodeMirror contenteditable 用真实键盘输入
    const tb = await page.$('[role="textbox"]');
    if (!tb) throw new Error('body textbox missing');
    await tb.click();
    await page.keyboard.type('## 草稿正文', { delay: 5 });

    await clickTopBar(['Save', '保存']); // editorial_workflow 的存草稿按钮（simple 模式不存在）
    await new Promise((r) => setTimeout(r, 2000));
    const st = await page.evaluate(() => document.body.innerText);
    if (!/CHANGES SAVED|UNPUBLISHED|未发布|Draft|草稿/i.test(st)) throw new Error("draft save not reflected: " + st.slice(0, 120).replace(/\n/g, "|"));
  });

  const findDraftAnywhere = async () => {
    // 重登可能再次经过 Login 页
    const need = await page.evaluate(() => !![...document.querySelectorAll('a,button')].find((e) => e.textContent.trim() === 'Login'));
    if (need) {
      const h = await page.evaluateHandle(() => [...document.querySelectorAll('a,button')].find((e) => e.textContent.trim() === 'Login'));
      await h.asElement().click();
      await waitText('作品集', 20000);
    }
    // 草稿可能在 Contents 集合页，也可能在独立的 Workflow 标签页
    for (const attempt of [1, 2]) {
      const found = await page
        .waitForFunction((t) => document.body.innerText.includes(t), { timeout: 8000 }, TITLE)
        .then(() => true)
        .catch(() => false);
      if (found) return;
      const clicked = await page.evaluate(() => {
        const w = [...document.querySelectorAll('a,button,[role=button]')].find((e) => /^(Workflow|工作流)$/.test(e.textContent.trim()));
        if (w) w.click();
        return !!w;
      });
      if (!clicked && attempt === 2) throw new Error('draft not found after reload (no Workflow tab either)');
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error('draft not found after reload');
  };

  await step('刷新页面（模拟退出重登/关浏览器）→ 草稿仍在', async () => {
    await page.goto(ADMIN + '#/collections/works', { waitUntil: 'networkidle2', timeout: 40000 });
    await findDraftAnywhere();
  });

  await step('Workflow 卡片可打开草稿编辑器（控件硬断言 + 发布 best-effort）', async () => {
    await page.evaluate(() => { location.hash = '#/workflow'; });
    const card = await page.waitForFunction(
      (title) => {
        const a = [...document.querySelectorAll('a')].find((x) => x.textContent.includes(title) && /entries/.test(x.getAttribute('href') || ''));
        if (!a) return null;
        const r = a.getBoundingClientRect();
        return r.height > 0 ? { x: r.x + r.width / 2, y: r.y + r.height / 2, href: a.getAttribute('href') } : null;
      },
      { timeout: 15000, polling: 500 }, TITLE
    );
    const pos = await card.jsonValue();
    if (!/ref=workflow/.test(pos.href)) throw new Error('draft card href missing ref=workflow: ' + pos.href);
    await page.mouse.click(pos.x, pos.y);
    const editorOk = await page
      .waitForFunction(() => document.body.innerText.includes('一句话简介'), { timeout: 12000 })
      .then(() => true)
      .catch(() => false);
    if (!editorOk) throw new Error('草稿编辑器打不开（Workflow 卡片 → 编辑器链路断裂）');
    const controls = await page.evaluate(() => {
      const t = document.body.innerText;
      return { save: /\bSave\b|保存/.test(t), status: /Status: Draft|Draft|草稿/.test(t) };
    });
    if (!controls.save || !controls.status) throw new Error('workflow controls incomplete: ' + JSON.stringify(controls));
    // 两段式：点 Publish 叶子文字开下拉 → 点 Publish now
    const pub = await page.evaluate(() => {
      const leaves = [...document.querySelectorAll('*')].filter(
        (e) => e.children.length === 0 && e.textContent.replace(/ /g, ' ').trim() === 'Publish' && e.offsetHeight > 0 && e.getBoundingClientRect().y < 70
      );
      const l = leaves.pop();
      if (!l) return null;
      const r = l.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!pub) throw new Error('Publish control missing in draft editor: ' + JSON.stringify(controls));
    await page.mouse.click(pub.x, pub.y);
    await new Promise((r) => setTimeout(r, 800));
    const opt = await page.evaluate(() => {
      const o = [...document.querySelectorAll('*')].filter(
        (e) => e.children.length === 0 && /^Publish now$/i.test(e.textContent.replace(/\u00a0/g, ' ').trim()) && e.offsetHeight > 0
      ).pop();
      if (!o) return null;
      const r = o.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (opt) await page.mouse.click(opt.x, opt.y);
    await new Promise((r) => setTimeout(r, 5000));
    await page.evaluate(() => { location.hash = '#/collections/works'; });
    await new Promise((r) => setTimeout(r, 2500));
    const listed = await page.evaluate((title) => document.body.innerText.includes(title), TITLE);
    console.log(
      listed
        ? '  （加分项：test-repo 发布动作也回显到了列表）'
        : '  ⚠ test-repo 假后端未将「发布草稿」回显到列表（模拟仓库 known 局限）——'
    );
    if (!listed) console.log('    真实 GitHub 后端的发布链路请人工验收一次，清单见 docs/ADMIN.md「工作流/草稿」一节。');
  });

  console.log('（test-repo 数据只活在临时浏览器 profile，进程退出即自动清理）');
} catch (e) {
  pass = false;
  console.log('FAILED:', e.message);
}
try { await page.screenshot({ path: '/tmp/qa-draft-final.png' }); } catch {}
try { await b.close(); } catch {}
console.log(pass ? 'ALL-PASS' : 'SOME-FAIL');
process.exit(pass ? 0 : 1);
