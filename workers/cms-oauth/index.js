/**
 * GitHub OAuth 中转 —— Decap CMS 的 proxy_url 端点。
 * 部署在 Cloudflare Workers（免费）。仅做两件事：
 *   1. /auth 带 code 来时，用 GITHUB_CLIENT_SECRET 换 access_token
 *   2. 把 token 以 URL hash 回传给 CMS
 * 密钥通过 `wrangler secret put` 注入，不落仓库。
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/auth') return new Response('not found', { status: 404 });

    const params = url.searchParams;

    // 第一步：CMS → 这里 → GitHub 授权页
    if (!params.get('code')) {
      const github = new URL('https://github.com/login/oauth/authorize');
      github.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      github.searchParams.set('redirect_uri', url.origin + '/auth');
      github.searchParams.set('scope', params.get('scope') || 'public_repo');
      const state = params.get('state');
      if (state) github.searchParams.set('state', state);
      return Response.redirect(github, 302);
    }

    // 第二步：GitHub 带 code 回调 → 换 token → 送回 CMS
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code: params.get('code'),
        redirect_uri: url.origin + '/auth',
      }),
    });
    const data = await res.json();
    if (!data.access_token) {
      return new Response(JSON.stringify(data), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    const redirect = new URL(params.get('redirect_uri'));
    redirect.hash = new URLSearchParams({
      access_token: data.access_token,
      token_type: 'bearer',
      scope: data.scope || '',
    }).toString();
    if (params.get('state')) redirect.hash += '&state=' + params.get('state');
    return Response.redirect(redirect, 302);
  },
};
