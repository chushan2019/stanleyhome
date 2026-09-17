/**
 * qa-oauth.mjs —— Decap CMS GitHub OAuth 中转（workers/cms-oauth）系统性验证
 *
 * Part A  Worker 单元测试（无浏览器）：/auth 重定向参数、/callback 换 token 与 postMessage 载荷、各错误分支
 * Part B  真机端到端：真 Chrome + 真 Decap 3.8.0。本地起「假 OAuth 主机」复用生产 Worker 的同一份代码，
 *         验证「点登录 → 打开 <base_url>/auth → 回调 /callback → token 经 postMessage 回传 → CMS 拿到 token」
 *         整条链路；api.github.com 由请求拦截伪造，因此测试不依赖网络与真实 GitHub 账号。
 *
 * 这个测试防的正是历史上踩过的坑：Decap 的 github 后端只读 backend.base_url，
 * 该键缺失会静默回退到 https://api.netlify.com/auth 并 404。
 */
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './workers/cms-oauth/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DECAP_URL = 'https://unpkg.com/decap-cms@3.8.0/dist/decap-cms.js';
const DECAP_CACHE = '/tmp/decap-cms-3.8.0.js';
// 端口由系统动态分配（listen 0）：避免与机器上常驻服务（如 8787 的本地 router）撞端口
let PORT = 0;
let BASE = '';
const FAKE_TOKEN = 'gho_FAKE_TOKEN_FOR_QA';

const ENV = { GITHUB_CLIENT_ID: 'cid_from_test', GITHUB_CLIENT_SECRET: 'secret_from_test' };

let pass = true;
const results = [];
function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail });
  console.log(cond ? '✓' : '✗', name, cond ? '' : `:: ${detail}`);
  if (!cond) pass = false;
}

// ───────────────────────── 共用：给 worker 打桩的 fetch ─────────────────────────
const realFetch = globalThis.fetch;
let githubExchangeCalls = [];
function installFetchStub(tokenResponse) {
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url === 'https://github.com/login/oauth/access_token') {
      githubExchangeCalls.push({ url, body: JSON.parse(init.body || '{}') });
      return new Response(JSON.stringify(tokenResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return realFetch(input, init);
  };
}

// ───────────────────────────── Part A：Worker 单元测试 ─────────────────────────────
console.log('\n=== Part A：Worker 单元测试 ===');

// A0. 配置静态断言 —— 直接防住「proxy_url 顶替 base_url」这个历史 bug
const cfgText = fs.readFileSync(path.join(ROOT, 'public/admin/config.yml'), 'utf8');
const backendBlock = cfgText.slice(cfgText.indexOf('backend:'), cfgText.indexOf('local_backend:'));
const cfgBaseUrl = (backendBlock.match(/^\s*base_url:\s*(.+?)\s*$/m) || [])[1];
check('config.yml 的 backend 块包含非空 base_url', !!cfgBaseUrl, `实际：${cfgBaseUrl}`);
check(
  'config.yml 的 backend 块不含无效键 proxy_url',
  !/^\s*proxy_url\s*:/m.test(backendBlock),
  'proxy_url 只属于 proxy 后端，github 后端会静默忽略它'
);
check('config.yml 的 backend 块不含 site_domain', !/^\s*site_domain\s*:/m.test(backendBlock), 'site_domain 会造成回退');

installFetchStub({ access_token: FAKE_TOKEN, scope: 'repo', token_type: 'bearer' });

// Part A 用固定假域名，与 Part B 的动态端口解耦
const UNIT_ORIGIN = 'https://cms-oauth.test';

// A1. /auth 重定向参数
{
  const res = await worker.fetch(
    new Request(`${UNIT_ORIGIN}/auth?provider=github&scope=repo&site_id=demo.decapcms.org`),
    ENV
  );
  const loc = res.headers.get('location');
  const u = loc ? new URL(loc) : null;
  check('/auth 返回 302 跳转', res.status === 302, `实际 ${res.status}`);
  check('/auth 跳到 github.com/login/oauth/authorize', u?.origin === 'https://github.com' && u?.pathname === '/login/oauth/authorize', loc);
  check('/auth 带上 client_id', u?.searchParams.get('client_id') === ENV.GITHUB_CLIENT_ID, loc);
  check('/auth 的 redirect_uri 指向自己的 /callback', u?.searchParams.get('redirect_uri') === `${UNIT_ORIGIN}/callback`, loc);
  check('/auth 透传 scope', u?.searchParams.get('scope') === 'repo', loc);
}

// A2. 非 github provider 拒绝
{
  const res = await worker.fetch(new Request(`${UNIT_ORIGIN}/auth?provider=gitlab`), ENV);
  check('非 github provider 返回 400', res.status === 400, `实际 ${res.status}`);
}

// A3. 缺密钥时给出可读错误
{
  const res = await worker.fetch(new Request(`${UNIT_ORIGIN}/auth?provider=github`), {});
  const body = await res.text();
  check('缺密钥返回 500 且指出缺少的密钥名', res.status === 500 && body.includes('GITHUB_CLIENT_ID'), `${res.status} ${body}`);
}

// A4. /callback 换 token 并生成 Decap 握手 HTML
{
  githubExchangeCalls = [];
  const res = await worker.fetch(new Request(`${UNIT_ORIGIN}/callback?code=CODE123`), ENV);
  const html = await res.text();
  check('/callback 返回 200', res.status === 200, `实际 ${res.status}`);
  check('/callback 向 GitHub 发起 token 交换', githubExchangeCalls.length === 1, `实际 ${githubExchangeCalls.length} 次`);
  check(
    'token 交换带上了 client_secret 与 code',
    githubExchangeCalls[0]?.body.client_secret === ENV.GITHUB_CLIENT_SECRET && githubExchangeCalls[0]?.body.code === 'CODE123',
    JSON.stringify(githubExchangeCalls[0]?.body)
  );
  check('握手 HTML 包含 authorizing:github 信令', html.includes('authorizing:github'));
  // 载荷在 <script> 内是 JS 字符串字面量（引号被转义），这里解析回原值再比对
  const rawPayload = html.split('const payload = ')[1]?.split(';\n')[0]?.trim();
  let decodedPayload = null;
  try {
    decodedPayload = JSON.parse(rawPayload);
  } catch {}
  check(
    '握手 HTML 内嵌 authorization:github:success:{token} 载荷',
    decodedPayload === `authorization:github:success:${JSON.stringify({ token: FAKE_TOKEN })}`,
    `解析到：${decodedPayload}`
  );
  check('握手 HTML 通过 window.opener.postMessage 回传', html.includes('window.opener') && html.includes('postMessage'));
}

// A5. /callback 缺少 code
{
  const res = await worker.fetch(new Request(`${UNIT_ORIGIN}/callback`), ENV);
  check('/callback 缺 code 返回 400', res.status === 400, `实际 ${res.status}`);
}

// A6. token 交换失败
{
  installFetchStub({ error: 'bad_verification_code', error_description: 'The code passed is incorrect or expired.' });
  const res = await worker.fetch(new Request(`${UNIT_ORIGIN}/callback?code=EXPIRED`), ENV);
  check('token 交换失败返回 500', res.status === 500, `实际 ${res.status}`);
  installFetchStub({ access_token: FAKE_TOKEN, scope: 'repo' });
}

// A7. 未知路径
{
  const res = await worker.fetch(new Request(`${UNIT_ORIGIN}/whatever`), ENV);
  check('未知路径返回 404', res.status === 404, `实际 ${res.status}`);
}

// ───────────────────────── Part B：真机端到端握手 ─────────────────────────
console.log('\n=== Part B：真机端到端（真 Chrome + 真 Decap）===');

// 准备 Decap 产物（缓存到本地，避免测试依赖网络）
if (!fs.existsSync(DECAP_CACHE)) {
  console.log('[qa] 下载 Decap 3.8.0 产物到本地缓存…');
  const r = await realFetch(DECAP_URL);
  fs.writeFileSync(DECAP_CACHE, Buffer.from(await r.arrayBuffer()));
}
const decapBundle = fs.readFileSync(DECAP_CACHE);

// 测试用 config.yml：保留真实配置结构，只把 base_url 指向本地假 OAuth 主机
// （端口在 listen 后才知道，故这里用函数，等服务器起好再生成）
let testConfig = '';
const buildTestConfig = () =>
  cfgText
    .replace(/^(\s*)base_url:\s*.*$/m, `$1base_url: ${BASE}`)
    .replace(/^\s*local_backend:.*$/m, '');

// 假 GitHub API —— 供 Decap 登录后拉取用户/仓库/内容
const md = (title, filename) =>
  Buffer.from(`---\ntitle: ${title}\nfilename: ${filename}\ntype: text\nyear: 2025\nsummary: QA 夹具\nfeatured: false\norder: 1\n---\n\n正文。\n`).toString('base64');
const WORKS = [
  { name: 'glass-ui.md', path: 'src/content/works/glass-ui.md', sha: 'sha-glass', content: md('玻璃与梯度', 'glass-ui') },
  { name: 'reading-system.md', path: 'src/content/works/reading-system.md', sha: 'sha-read', content: md('阅读系统', 'reading-system') },
];
const UNMATCHED_API = [];
function fakeGitHub(urlStr) {
  const u = new URL(urlStr);
  const p = decodeURIComponent(u.pathname.replace(/^\/repos\/chushan2019\/stanleyhome/, ''));
  if (u.pathname === '/user') {
    return { login: 'chushan2019', id: 1, name: 'Stanley', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' };
  }
  if (u.pathname === '/repos/chushan2019/stanleyhome') {
    return {
      id: 1,
      name: 'stanleyhome',
      full_name: 'chushan2019/stanleyhome',
      default_branch: 'main',
      permissions: { admin: true, push: true, pull: true },
      owner: { login: 'chushan2019' },
    };
  }
  if (p === '/contents/src/content/works') {
    return WORKS.map(({ content, ...rest }) => ({ ...rest, type: 'file', size: 200 }));
  }
  const hit = WORKS.find((w) => p === `/contents/${w.path}`);
  if (hit) return { ...hit, type: 'file', size: 200, encoding: 'base64' };
  if (p.startsWith('/contents/')) return [];
  // Decap 拉目录用的是 Git Trees API（tree_sha 形如 main:src/content/works）
  if (p.startsWith('/git/trees/')) {
    const ref = p.slice('/git/trees/'.length);
    if (ref.endsWith('src/content/works')) {
      return {
        sha: 'tree-works',
        truncated: false,
        tree: WORKS.map((w) => ({ path: w.name, mode: '100644', type: 'blob', sha: w.sha, size: 200 })),
      };
    }
    return { sha: 'tree-empty', truncated: false, tree: [] };
  }
  if (p.startsWith('/git/blobs/')) {
    const sha = p.slice('/git/blobs/'.length);
    const hit2 = WORKS.find((w) => w.sha === sha);
    return hit2 ? { sha, content: hit2.content, encoding: 'base64', size: 200 } : { sha, content: '', encoding: 'base64', size: 0 };
  }
  UNMATCHED_API.push(u.pathname + u.search);
  return {};
}

// 本地假 OAuth 主机：/auth 与 /callback 直接复用生产 Worker 代码
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, BASE);

  if (u.pathname === '/admin/' || u.pathname === '/admin/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(ROOT, 'public/admin/index.html')));
    return;
  }
  if (u.pathname === '/admin/config.yml') {
    res.writeHead(200, { 'content-type': 'text/yaml; charset=utf-8' });
    res.end(testConfig);
    return;
  }
  if (u.pathname === '/auth') {
    const wres = await worker.fetch(new Request(u.toString()), ENV);
    const loc = wres.headers.get('location');
    console.log('[qa] Worker /auth 生成的 GitHub 授权地址：');
    console.log('     ' + loc);
    console.log('[qa] 模拟用户在 GitHub 完成授权 → 回调本地 /callback');
    res.writeHead(302, { location: `${BASE}/callback?code=FAKE_CODE` });
    res.end();
    return;
  }
  if (u.pathname === '/callback') {
    const wres = await worker.fetch(new Request(u.toString()), ENV);
    res.writeHead(wres.status, Object.fromEntries(wres.headers));
    res.end(Buffer.from(await wres.arrayBuffer()));
    return;
  }
  res.writeHead(404).end('not found');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
PORT = server.address().port;
BASE = `http://127.0.0.1:${PORT}`;
testConfig = buildTestConfig();
console.log(`[qa] 本地假 OAuth 主机已启动：${BASE}`);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  protocolTimeout: 180000,
  args: ['--no-sandbox', '--disable-gpu', '--disable-popup-blocking'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 950 });

const consoleLogs = [];
page.on('console', (m) => consoleLogs.push(m.text()));
page.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 160)));

const userRequestAuth = { value: null };
await page.setRequestInterception(true);
page.on('request', (req) => {
  const url = req.url();
  if (url.startsWith(DECAP_URL)) {
    return req.respond({ status: 200, contentType: 'application/javascript', body: decapBundle });
  }
  if (url.startsWith('https://api.github.com')) {
    if (req.method() === 'OPTIONS') {
      return req.respond({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': 'authorization, content-type, accept',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
        },
      });
    }
    if (new URL(url).pathname === '/user') {
      userRequestAuth.value = req.headers()['authorization'] || req.headers()['Authorization'];
      console.log(`[qa] 浏览器向 api.github.com/user 发起认证请求，Authorization: ${userRequestAuth.value}`);
    }
    return req.respond({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(fakeGitHub(url)),
    });
  }
  return req.continue();
});

try {
  await page.goto(`${BASE}/admin/`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Login with GitHub'), { timeout: 25000 });
  check('后台页渲染出「Login with GitHub」', true);

  // 新增的配置诊断日志应已输出，并给出真实会打开的登录地址
  const diag = consoleLogs.find((l) => l.includes('[admin] 点击「Login with GitHub」实际会打开的地址'));
  const diagUrl = consoleLogs.find((l) => l.includes(`${BASE}/auth?provider=github`));
  check('启动期诊断日志输出了登录地址', !!diag && !!diagUrl, `已捕获 ${consoleLogs.length} 条 console 日志`);

  // 点击登录 → 弹窗 → /auth → /callback → postMessage 回传 token
  const btn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button,a')].find((el) => el.textContent.trim().includes('Login with GitHub'))
  );
  const el = btn.asElement();
  if (!el) throw new Error('未找到登录按钮');
  await el.click();

  // 等待浏览器带上 token 访问 api.github.com/user —— 这是「握手成功」的铁证
  const t0 = Date.now();
  while (!userRequestAuth.value && Date.now() - t0 < 20000) await new Promise((r) => setTimeout(r, 200));
  check(
    '/callback 回传的 token 被浏览器用于调用 GitHub API（握手成功）',
    userRequestAuth.value === `token ${FAKE_TOKEN}`,
    `Authorization 头实际为：${userRequestAuth.value}`
  );

  // 认证通过后应离开登录页、进入集合列表
  try {
    await page.waitForFunction(() => document.body.innerText.includes('作品集'), { timeout: 25000 });
    check('认证后进入 CMS 主界面（可见「作品集」集合）', true);
  } catch (e) {
    const body = await page.evaluate(() => document.body.innerText.slice(0, 300));
    check('认证后进入 CMS 主界面（可见「作品集」集合）', false, `页面文本：${body.replace(/\n/g, ' | ')}`);
  }

  // token 还应能真正读回仓库内容（证明不只是拿到 token，而是可用）
  try {
    await page.waitForFunction(() => document.body.innerText.includes('玻璃与梯度'), { timeout: 20000 });
    check('用该 token 成功读回仓库作品列表', true);
  } catch (e) {
    const body = await page.evaluate(() => document.body.innerText.slice(0, 300));
    check('用该 token 成功读回仓库作品列表', false, `页面文本：${body.replace(/\n/g, ' | ')}`);
  }

  if (UNMATCHED_API.length) console.log('[qa] 未被伪造覆盖的 GitHub API 调用：', [...new Set(UNMATCHED_API)].join(', '));
} catch (e) {
  check('端到端流程未抛异常', false, String(e).slice(0, 300));
} finally {
  try {
    await page.screenshot({ path: '/tmp/qa-oauth-final.png' });
  } catch {}
  try {
    await browser.close();
  } catch {}
  server.close();
}

// ───────────────────────────── 汇总 ─────────────────────────────
const failed = results.filter((r) => !r.ok);
console.log(`\n=== 结果：${results.length - failed.length}/${results.length} 通过 ===`);
if (failed.length) console.log('失败项：' + failed.map((f) => f.name).join('；'));
console.log(pass ? 'ALL-PASS' : 'SOME-FAIL');
process.exit(pass ? 0 : 1);
