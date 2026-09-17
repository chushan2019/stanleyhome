/**
 * GitHub OAuth 中转 —— Decap CMS GitHub 后端的 base_url 端点。
 * 部署在 Cloudflare Workers（免费）。实现 Decap 3.x 要求的「弹窗 + postMessage」协议：
 *   1. GET /auth?provider=github&scope=...   → 302 跳转到 GitHub 授权页
 *   2. GitHub 授权后回调 /callback?code=...   → 用 code 换 access_token
 *   3. 在弹窗里通过 window.postMessage 把 token 回传给 Decap 主窗口
 * 密钥通过 `wrangler secret put` 注入，不落仓库。
 * 参考实现：https://github.com/sterlingwes/decap-proxy
 *
 * 排障：`npx wrangler tail` 可实时看到下面的 [cms-oauth] 日志。
 * 日志里绝不会打印 token / client_secret 本身，只打印长度，便于安全地贴出来排查。
 */

// 结构化日志：统一前缀，便于 wrangler tail 过滤
function log(stage, data = {}) {
  console.log(`[cms-oauth] ${stage} ${JSON.stringify(data)}`);
}

// 密钥缺失时给出可执行的提示，而不是让 GitHub 返回难以理解的 invalid_client
function missingSecrets(env) {
  const missing = [];
  if (!env.GITHUB_CLIENT_ID) missing.push('GITHUB_CLIENT_ID');
  if (!env.GITHUB_CLIENT_SECRET) missing.push('GITHUB_CLIENT_SECRET');
  return missing;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    log('request', { path: url.pathname, origin: url.origin });

    // 第一步：CMS 点「Login with GitHub」→ 打开弹窗 → 这里重定向到 GitHub 授权页
    if (url.pathname === '/auth') {
      const provider = url.searchParams.get('provider');
      const scope = url.searchParams.get('scope') || 'repo';
      log('auth.received', { provider, scope, site_id: url.searchParams.get('site_id') });

      if (provider !== 'github') {
        log('auth.reject', { reason: 'provider 不是 github', provider });
        return new Response('Invalid provider', { status: 400 });
      }

      const missing = missingSecrets(env);
      if (missing.length) {
        log('auth.error', { reason: '缺少 Worker 密钥', missing });
        return new Response(`Missing Worker secret(s): ${missing.join(', ')}`, { status: 500 });
      }

      const redirectUri = url.origin + '/callback';
      const github = new URL('https://github.com/login/oauth/authorize');
      github.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      // 必须与 OAuth App 里注册的 Authorization callback URL 完全一致
      github.searchParams.set('redirect_uri', redirectUri);
      github.searchParams.set('scope', scope);

      log('auth.redirect', { to: 'github.com/login/oauth/authorize', redirect_uri: redirectUri, scope });
      return Response.redirect(github.toString(), 302);
    }

    // 第二步：GitHub 带 code 回调 → 换 token → 弹窗内 postMessage 回传 Decap
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      log('callback.received', { has_code: !!code });

      if (!code) {
        log('callback.reject', { reason: '缺少 code 参数' });
        return new Response('Missing code', { status: 400 });
      }

      const missing = missingSecrets(env);
      if (missing.length) {
        log('callback.error', { reason: '缺少 Worker 密钥', missing });
        return new Response(`Missing Worker secret(s): ${missing.join(', ')}`, { status: 500 });
      }

      const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });
      const data = await res.json();
      log('callback.exchange', {
        status: res.status,
        ok: !!data.access_token,
        scope: data.scope,
        error: data.error,
        error_description: data.error_description,
      });

      if (!data.access_token) {
        return new Response(JSON.stringify(data), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      }

      // Decap 握手协议：弹窗先发 authorizing:github，收到主窗口回执后再发 success + token
      const payload = 'authorization:github:success:' + JSON.stringify({ token: data.access_token });
      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Authorizing…</title>
  </head>
  <body>
    <p>Authorizing Decap CMS…</p>
    <script>
      const payload = ${JSON.stringify(payload)};
      const receiveMessage = (message) => {
        window.opener && window.opener.postMessage(payload, '*');
        window.removeEventListener('message', receiveMessage, false);
      };
      window.addEventListener('message', receiveMessage, false);
      window.opener && window.opener.postMessage('authorizing:github', '*');
    </script>
  </body>
</html>`;
      // 只打印 token 长度，绝不打印 token 本身
      log('callback.success', { token_length: data.access_token.length });
      return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    log('notfound', { path: url.pathname });
    return new Response('not found', { status: 404 });
  },
};
