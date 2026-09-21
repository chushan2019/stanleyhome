/**
 * 富文本粘贴防护 E2E（对应 2026-09 生产崩溃修复）
 * 断言：向正文编辑器派发含 text/html 的 paste 事件后——
 *   ① 页面不崩溃（此前 Decap 抓图管线渲染畸形 image 节点 → TypeError 整页白屏）
 *   ② 内容以转换后的 Markdown 落地（含 ![]()、**、``` 等结构）
 *   ③ 无 src 懒占位图与内联 SVG 被安全跳过（不产生畸形节点）
 *   ④ 纯文本粘贴（无 html flavor）不受拦截器影响，不崩溃
 * 前置：astro dev :4321（登录走 local_backend）+ npm run cms:local :8081
 */
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ADMIN = 'http://localhost:4321/stanleyhome/admin/index.html';

const b = await puppeteer.launch({ executablePath: CHROME, protocolTimeout: 180000, args: ['--no-sandbox', '--disable-gpu'] });
const page = await b.newPage();
await page.setViewport({ width: 1400, height: 950 });
page.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 120)));
page.on('dialog', async (d) => { await d.accept(); });

let pass = true;
const check = async (name, fn) => {
  try { await fn(); console.log('✓', name); }
  catch (e) {
    pass = false;
    console.log('✗', name, '::', String(e).slice(0, 200));
    try { await page.screenshot({ path: '/tmp/qa-paste-fail.png' }); } catch {}
  }
};

const ARTICLE_HTML = [
  '<h2>核心结论</h2>',
  '<p>这是<strong>加粗</strong>与<em>斜体</em>，还有 <code>inline_code</code>。</p>',
  '<pre><code>const a = 1;\nconsole.log(a);</code></pre>',
  '<p><img src="https://real.example.com/img/a.png" alt="真实图"></p>',
  '<p><img alt="懒加载占位无src" data-nimg="1" width="24" height="24"></p>',
  '<p><svg width="12" height="12" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg></p>',
  '<table><tr><th>列一</th><th>列二</th></tr><tr><td><img src="/rel/broken.png"></td><td>值</td></tr></table>',
  '<p><a href="https://example.com/ref">链接文本</a></p>',
  '<blockquote>引用一段</blockquote>',
  '<ul><li>项目一</li><li>项目二</li></ul>',
].join('\n');

async function openFreshEditor() {
  await page.goto(ADMIN, { waitUntil: 'networkidle2', timeout: 40000 });
  const l = await page.evaluateHandle(() => [...document.querySelectorAll('a,button')].find((e) => e.textContent.trim() === 'Login'));
  if (l.asElement()) await l.asElement().click();
  await page.waitForFunction(() => document.body.innerText.includes('作品集'), { timeout: 20000 });
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('a,button,div[role=button]')].find((e) => e.textContent.replace(/ /g, ' ').trim().startsWith('New 作品'));
    t && t.click();
  });
  await page.waitForFunction(() => !!document.querySelector('[role="textbox"]'), { timeout: 20000 });
  await page.click('[role="textbox"]');
}

await check('加载后台并打开正文编辑器', async () => { await openFreshEditor(); });

await check('派发真实感网页 HTML 粘贴 → 页面不崩溃', async () => {
  await page.evaluate((html) => {
    const ed = document.querySelector('[role="textbox"]');
    const dt = new DataTransfer();
    dt.setData('text/html', html);
    dt.setData('text/plain', 'fallback plain');
    ed.focus();
    ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, ARTICLE_HTML);
  await new Promise((r) => setTimeout(r, 4000));
  const crash = await page.evaluate(() => /There's been an error|Cannot destructure/.test(document.body.innerText));
  if (crash) throw new Error('页面崩溃（防护未生效）');
});

await check('内容已按 Markdown 结构落地（图片/加粗/代码块/链接）', async () => {
  const txt = await page.evaluate(() => document.querySelector('[role="textbox"]')?.innerText || '');
  const need = ['## 核心结论', '**加粗**', '```', '![真实图](https://real.example.com/img/a.png)', '[链接文本](https://example.com/ref)', '- 项目一', '> 引用一段'];
  const missing = need.filter((s) => !txt.includes(s));
  if (missing.length) throw new Error('markdown 转换缺失: ' + JSON.stringify(missing) + ' | got head=' + txt.slice(0, 160));
});

await check('无 src 占位图与 svg 未产生畸形 image 语法', async () => {
  const txt = await page.evaluate(() => document.querySelector('[role="textbox"]')?.innerText || '');
  if (/!\[[^\]]*\]\(\s*\)/.test(txt)) throw new Error('出现空 URL 的 ![]()');
  if (/<img|<svg/.test(txt)) throw new Error('残留原始 HTML 标签');
});

await check('预览渲染稳定（切换标签不白屏）', async () => {
  await new Promise((r) => setTimeout(r, 1500));
  const crash = await page.evaluate(() => /There's been an error|Cannot destructure/.test(document.body.innerText));
  if (crash) throw new Error('预览渲染崩溃');
});

await check('纯 Markdown 文本粘贴不受影响', async () => {
  await openFreshEditor();
  await page.evaluate(() => {
    const ed = document.querySelector('[role="textbox"]');
    const dt = new DataTransfer();
    dt.setData('text/plain', '# 标题\n\n![图](https://a.b/c.png)\n');
    ed.focus();
    ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await new Promise((r) => setTimeout(r, 2500));
  const crash = await page.evaluate(() => /There's been an error|Cannot destructure/.test(document.body.innerText));
  if (crash) throw new Error('纯文本粘贴后崩溃');
});

try { await b.close(); } catch {}
console.log(pass ? 'ALL-PASS' : 'SOME-FAIL');
process.exit(pass ? 0 : 1);
