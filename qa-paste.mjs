/**
 * 富文本粘贴防护 E2E（2026-09 两起事故的共同回归）
 *   事故①：粘贴网页 HTML → Decap 抓图管线产生畸形 image 节点 → 预览渲染崩溃
 *   事故②：拦截器用 execCommand 自行插入 → DOM 有字但 Slate 状态为空 → Save 报 Required
 * 现在的方案：捕获阶段把剪贴板就地改写为「仅 Markdown 纯文本」，交给编辑器原生纯文本粘贴。
 *
 * 本测试用 headful Chrome + 系统剪贴板 + 真实 Cmd+V（CDP 键事件）验证完整链路：
 *   粘贴落地 → 表单状态含正文（点 Save/Publish 无 Required 报错）→ 落盘文件带正文 → 无崩溃
 * 前置：astro dev :4321 + npm run cms:local :8081（local_backend 直写文件）
 */
import puppeteer from 'puppeteer-core';
import { execSync } from 'child_process';
import fs from 'fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ADMIN = 'http://localhost:4321/stanleyhome/admin/index.html';
const FILE = 'src/content/works/qa-paste-probe.md';

const ARTICLE_HTML = `
<h2>核心结论</h2>
<p>这是<strong>加粗</strong>与<em>斜体</em>，还有 <code>inline_code</code>。QA_PASTE_MARKER_9x7</p>
<pre><code>const a = 1;</code></pre>
<p><img src="https://real.example.com/img/a.png" alt="真实图"></p>
<p><img alt="懒占位无src" data-nimg="1"></p>
<p><svg width="12" height="12"><path d="M0 0h24v24H0z"/></svg></p>
<ul><li>项目一</li><li>项目二</li></ul>`;

fs.writeFileSync('/tmp/qa-paste-article.html', ARTICLE_HTML);
execSync('osascript -l JavaScript /tmp/pbset2.js /tmp/qa-paste-article.html');

const b = await puppeteer.launch({
  executablePath: CHROME, headless: false, protocolTimeout: 180000,
  args: ['--disable-gpu', '--window-size=1500,1000'],
});
const page = await b.newPage();
await page.setViewport({ width: 1440, height: 960 });
page.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 120)));
page.on('console', (m) => { const x = m.text(); if (x.includes('[admin]')) console.log('CONSOLE:', x.slice(0, 160)); });
page.on('dialog', async (d) => { await d.accept(); });

let pass = true;
const check = async (name, fn) => {
  try { await fn(); console.log('✓', name); }
  catch (e) { pass = false; console.log('✗', name, '::', String(e).slice(0, 200)); try { await page.screenshot({ path: '/tmp/qa-paste-fail.png' }); } catch {} }
};
const setv = (label, val) => page.evaluate((label, val) => {
  const l = [...document.querySelectorAll('label')].find((x) => x.textContent.trim().startsWith(label));
  let c = l.htmlFor ? document.getElementById(l.htmlFor) : null;
  if (!c) { let box = l; for (let i = 0; i < 6 && box; i++) { box = box.parentElement; c = box?.querySelector('input[type=text],input:not([type]),textarea'); if (c) break; } }
  const p = c.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(p, 'value').set.call(c, val);
  c.dispatchEvent(new Event('input', { bubbles: true }));
}, label, val);

await check('打开后台并新建作品（headful）', async () => {
  await page.goto(ADMIN, { waitUntil: 'networkidle2', timeout: 40000 });
  const l = await page.evaluateHandle(() => [...document.querySelectorAll('a,button')].find((e) => e.textContent.trim() === 'Login'));
  if (l.asElement()) await l.asElement().click();
  await page.waitForFunction(() => document.body.innerText.includes('作品集'), { timeout: 20000 });
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('a,button,div[role=button]')].find((e) => e.textContent.replace(/ /g, ' ').trim().startsWith('New 作品'));
    t && t.click();
  });
  await page.waitForFunction(() => !!document.querySelector('[role="textbox"]'), { timeout: 20000 });
});

await check('填齐必填字段', async () => {
  await setv('标题', '粘贴防护回归');
  await setv('文件名', 'qa-paste-probe');
  await setv('一句话简介', 'x');
  const cb = await page.evaluate(() => {
    const l = document.querySelector('label[for^="type-field"]');
    const c = l.closest('[class*=ControlContainer]');
    const r = c.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(cb.x, cb.y);
  await new Promise((r) => setTimeout(r, 600));
  const ob = await page.evaluate(() => {
    const o = [...document.querySelectorAll('*')].filter((e) => e.textContent.trim() === '图文' && e.children.length === 0 && e.offsetHeight > 0).pop();
    const r = o.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(ob.x, ob.y);
});

const cdpPaste = async () => {
  const cdp = await page.createCDPSession();
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86, nativeVirtualKeyCode: 9,
    modifiers: 4, commands: ['Paste'],
  });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86, modifiers: 4 });
  await cdp.detach().catch(() => {});
};
await check('第一次 Cmd+V：拦截网页格式、写回纯文本、不崩溃、弹提示', async () => {
  await page.bringToFront();
  await page.click('[role="textbox"]');
  await new Promise((r) => setTimeout(r, 400));
  await cdpPaste();
  await new Promise((r) => setTimeout(r, 2500));
  const st = await page.evaluate(() => ({
    crash: /There's been an error|Cannot destructure/.test(document.body.innerText),
    toast: /再粘贴一次/.test(document.body.innerText),
    ed: document.querySelector('[role="textbox"]')?.innerText || '',
  }));
  if (st.crash) throw new Error('第一次粘贴后页面崩溃（事故①回归失败）');
  if (!st.toast) throw new Error('未出现二次粘贴提示');
  if (st.ed.includes('QA_PASTE_MARKER')) throw new Error('第一次粘贴不该落地');
});
await check('第二次 Cmd+V：纯文本粘贴落地', async () => {
  await page.click('[role="textbox"]');
  await new Promise((r) => setTimeout(r, 300));
  await cdpPaste();
  await new Promise((r) => setTimeout(r, 3000));
  const st = await page.evaluate(() => ({
    crash: /There's been an error|Cannot destructure/.test(document.body.innerText),
    landed: (document.querySelector('[role="textbox"]')?.innerText || '').includes('QA_PASTE_MARKER_9x7'),
  }));
  if (st.crash) throw new Error('二次粘贴崩溃');
  if (!st.landed) throw new Error('二次粘贴未落地（检查系统剪贴板权限）');
});

await check('发布 → 落盘文件包含 Markdown 正文（证明表单状态非空）', async () => {
  if (fs.existsSync(FILE)) fs.rmSync(FILE);
  const pub = await page.evaluate(() => {
    const e = [...document.querySelectorAll('button,[role=button]')].find((x) => x.textContent.replace(/ /g, ' ').trim().startsWith('Publish') && x.offsetHeight > 0 && x.getBoundingClientRect().y < 70);
    const r = e.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(pub.x, pub.y);
  await new Promise((r) => setTimeout(r, 1200));
  const opt = await page.evaluate(() => {
    const o = [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && /^Publish now$/i.test(e.textContent.replace(/ /g, ' ').trim()) && e.offsetHeight > 0 && e.offsetHeight < 60).pop();
    if (!o) return null;
    const r = o.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (opt) await page.mouse.click(opt.x, opt.y);
  await new Promise((r) => setTimeout(r, 6000));
  const toast = await page.evaluate(() => (document.body.innerText.match(/missed a required[^\n]{0,40}/i) || [''])[0]);
  if (toast) throw new Error('发布被 Required 拦截（事故②回归失败）：' + toast);
  if (!fs.existsSync(FILE)) throw new Error('文件未落盘');
  const y = fs.readFileSync(FILE, 'utf8');
  const need = ['QA_PASTE_MARKER_9x7', '（图：真实图 https://real.example.com/img/a.png）', '## 核心结论'];
  const missing = need.filter((s) => !y.includes(s));
  if (missing.length) throw new Error('落盘正文缺结构: ' + JSON.stringify(missing));
  if (/!\[/.test(y)) throw new Error('落盘仍含图片语法（应已转文字占位）');
});

await check('纯文本粘贴含 ![图](url) → 也被净化不崩溃', async () => {
  execSync('osascript -l JavaScript /tmp/pbset3.js "前文 ![图](https://a.b/c.png) 空图 ![e]() 尾文"'.replace('"','"'));
  await page.goto(ADMIN + '#/collections/works/new', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
  await page.click('[role="textbox"]').catch(async () => {
    await page.evaluate(() => { const t = [...document.querySelectorAll('a,button,div[role=button]')].find((e) => e.textContent.replace(/\u00a0/g, ' ').trim().startsWith('New 作品')); t && t.click(); });
    await page.waitForFunction(() => !!document.querySelector('[role="textbox"]'), { timeout: 20000 });
    await page.click('[role="textbox"]');
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => { const eds = [...document.querySelectorAll('[role="textbox"]')]; eds[eds.length - 1].focus(); });
  await cdpPaste(); // 第一次：应被拦截并改写剪贴板
  await new Promise((r) => setTimeout(r, 2000));
  const mid = await page.evaluate(() => /There's been an error|Cannot destructure/.test(document.body.innerText));
  if (mid) throw new Error('纯 markdown 图片粘贴第一次崩溃');
  await page.evaluate(() => { const eds = [...document.querySelectorAll('[role="textbox"]')]; eds[eds.length - 1].focus(); });
  await cdpPaste(); // 第二次：净化文本落地
  await new Promise((r) => setTimeout(r, 3000));
  const st = await page.evaluate(() => ({
    crash: /There's been an error|Cannot destructure/.test(document.body.innerText),
    ed: (document.activeElement?.innerText || document.querySelector('[role="textbox"]')?.innerText || ''),
  }));
  if (st.crash) throw new Error('纯 markdown 图片粘贴二次崩溃');
  if (!st.ed.includes('（图：图 https://a.b/c.png）')) throw new Error('图片语法未转占位: ' + JSON.stringify(st.ed.slice(0, 150)));
});

try { await b.close(); } catch {}
try { if (fs.existsSync(FILE)) fs.rmSync(FILE); } catch {}
console.log(pass ? 'ALL-PASS' : 'SOME-FAIL');
process.exit(pass ? 0 : 1);
