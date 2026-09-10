/**
 * Decap CMS 本地后端 E2E：登录 → 列表读取 → 新建作品 → 发布落盘 → 列表可见 → 删除
 * 前置：astro dev :4321 与 npx decap-server@3.6.0 :8081
 */
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ADMIN = 'http://localhost:4321/stanleyhome/admin/index.html';
const FILE = 'src/content/works/cms-e2e-test.md';

const b = await puppeteer.launch({ executablePath: CHROME, protocolTimeout: 180000, args: ['--no-sandbox', '--disable-gpu'] });
const page = await b.newPage();
await page.setViewport({ width: 1400, height: 950 });
page.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 120)));
// Decap 删除已发布条目走原生 window.confirm——必须自动接受，否则页面主线程被阻塞、CDP 超时
page.on('dialog', async (d) => { await d.accept(); });

const step = async (name, fn) => {
  try { await fn(); console.log('✓', name); }
  catch (e) {
    console.log('✗', name, '::', String(e).slice(0, 160));
    try { await page.screenshot({ path: '/tmp/cms-e2e-fail.png', fullPage: true }); } catch {}
    throw e;
  }
};
const waitText = (txt, timeout = 25000) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), {}, txt, { timeout });
const clickText = async (tag, txt) => {
  const h = await page.evaluateHandle((tag, txt) =>
    [...document.querySelectorAll(tag)].find((el) => el.textContent.trim().startsWith(txt)), tag, txt);
  const el = h.asElement();
  if (!el) throw new Error(`no ${tag} starting with "${txt}"`);
  await el.click();
};

let pass = true;
try {
  await step('打开 admin 页', async () => {
    await page.goto(ADMIN, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitText('Login');
  });

  await step('local_backend 登录（无 OAuth）', async () => {
    await clickText('a,button', 'Login');
    await waitText('作品集');
  });

  await step('作品集合读到 4 篇标题', async () => {
    await waitText('第一期播客');
    await waitText('玻璃与梯度');
  });

  await step('新建作品填表并发布 → 文件写回 src/content', async () => {
    await clickText('a,button,div[role=button]', 'New 作品');
    await waitText('标题');

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

    await fill('标题', 'CMS 端到端测试');
    await fill('文件名', 'cms-e2e-test');
    await fill('一句话简介', 'E2E 验证 CMS 写入链路');

    // 必填 select（react-select 风格）：真实鼠标点击控件 → 点击「图文」选项
    const ctrlBox = await page.evaluate(() => {
      const lab = document.querySelector('label[for^="type-field"]');
      const cont = lab?.closest('[class*=ControlContainer]');
      if (!cont) return null;
      const r = cont.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!ctrlBox) throw new Error('type control missing');
    await page.mouse.click(ctrlBox.x, ctrlBox.y);
    await new Promise((r) => setTimeout(r, 800));
    const optBox = await page.evaluate(() => {
      const cands = [...document.querySelectorAll('*')].filter(
        (e) => e.textContent.trim() === '图文' && e.children.length === 0 && e.offsetHeight > 0
      );
      const o = cands[cands.length - 1];
      if (!o) return null;
      const r = o.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!optBox) throw new Error('option 图文 missing');
    await page.mouse.click(optBox.x, optBox.y);
    await new Promise((r) => setTimeout(r, 400));

    // 正文：CodeMirror contenteditable
    const body = await page.$('[role="textbox"]');
    if (body) {
      await body.click();
      await page.keyboard.type('## E2E', { delay: 5 });
      await page.keyboard.press('Enter');
      await page.keyboard.type('正文内容。', { delay: 5 });
    }
    await new Promise((r) => setTimeout(r, 600));

    const pubBox = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('*')].filter(
        (e) => e.textContent.trim() === 'Publish' && e.children.length === 0
      );
      const leaf = nodes[nodes.length - 1];
      if (!leaf) throw new Error('Publish node missing');
      const r = leaf.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.click(pubBox.x, pubBox.y); // 打开 Publish 下拉
    await new Promise((r) => setTimeout(r, 700));
    const nowBox = await page.evaluate(() => {
      const o = [...document.querySelectorAll('*')].filter(
        (e) => e.textContent.trim().startsWith('Publish now') && e.children.length <= 2 && e.offsetHeight > 0 && e.offsetHeight < 60
      ).pop();
      if (!o) return null;
      const r = o.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!nowBox) throw new Error('Publish now missing');
    await page.mouse.click(nowBox.x, nowBox.y);
    await new Promise((r) => setTimeout(r, 2500));
    const diag = await page.evaluate(() => ({
      alert: [...document.querySelectorAll('[role=alert], [class*=Error]')].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 5),
      unsaved: document.body.innerText.includes('UNSAVED'),
    }));
    if (diag.alert.length || diag.unsaved) console.log('DIAG', JSON.stringify(diag));
    await new Promise((r) => setTimeout(r, 3000));
    if (!fs.existsSync(FILE)) throw new Error(FILE + ' not written');
    const y = fs.readFileSync(FILE, 'utf8');
    if (!y.includes('title: CMS 端到端测试')) throw new Error('frontmatter wrong');
    if (!y.includes('cms-e2e-test') && !y.includes('filename')) throw new Error('slug wrong');
  });

  await step('列表可见新条目（重载后从仓库读取）', async () => {
    await page.goto(ADMIN, { waitUntil: 'networkidle2' });
    await waitText('作品集');
    await waitText('CMS 端到端测试', 15000);
  });

  await step('删除条目 → 文件移除（trash + 原生 confirm 自动接受）', async () => {
    await page.goto(ADMIN + '#/collections/works/entries/cms-e2e-test', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => !![...document.querySelectorAll('button')].find((x) => /delete|trash/i.test(x.className)),
      { timeout: 25000 }
    );
    await page.evaluate(() => {
      [...document.querySelectorAll('button')].find((x) => /delete|trash/i.test(x.className)).click();
    });
    await new Promise((r) => setTimeout(r, 5000)); // dialog handler 自动接受 confirm
    if (fs.existsSync(FILE)) throw new Error('file still exists');
  });
} catch (e) {
  pass = false;
  console.log('FAILED:', e.message);
}
try {
  await page.screenshot({ path: '/tmp/cms-e2e-final.png' });
} catch {}
try { await b.close(); } catch {}
if (fs.existsSync(FILE)) fs.rmSync(FILE);
console.log(pass ? 'ALL-PASS' : 'SOME-FAIL');
process.exit(pass ? 0 : 1);
