# 网页后台（Decap CMS）开通指南

后台地址（部署并配好 OAuth 后）：**https://chushan2019.github.io/stanleyhome/admin/**

工作方式：浏览器登录 GitHub → 表单增/改/删内容 → 保存即 commit 回本仓库 main →
既有 GitHub Actions 自动重新构建上线。**内容仍是 Markdown，与本地/Obsidian 完全同库。**

一次性开通约 10 分钟，分三步，其中「创建 OAuth App」和「部署 Worker」需要你本人操作（涉及账号登录）。

## 第 1 步：创建 GitHub OAuth App（你操作，2 分钟）

1. 打开 https://github.com/settings/applications/new
2. 填写：
   - Application name：`stanleyhome-admin`
   - Homepage URL：`https://chushan2019.github.io/stanleyhome/`
   - Authorization callback URL：先随便填 `https://placeholder.workers.dev/auth`，第 2 步拿到真实域名后回来改
3. Create → 记下 **Client ID** → Generate a client secret → 记下 **Client Secret**（只显示一次）

## 第 2 步：部署 OAuth 中转 Worker（你操作，3 分钟）

Worker 代码已备好在本仓库 `workers/cms-oauth/`。在终端里跑：

```bash
cd /Users/stanley/vibecoding/websitestylelesson/workers/cms-oauth
npx wrangler secret put GITHUB_CLIENT_ID       # 粘贴第 1 步的 Client ID
npx wrangler secret put GITHUB_CLIENT_SECRET   # 粘贴 Client Secret
npx wrangler deploy                            # 首次会弹出浏览器登录 Cloudflare（免费账号即可）
```

部署成功会输出 `https://cms-oauth.<你的用户名>.workers.dev`。
**回到第 1 步把 OAuth App 的 callback URL 改成** `https://cms-oauth.<你的用户名>.workers.dev/auth`。

## 第 3 步：把 Worker 地址填进配置（我也可以代改，1 分钟）

编辑 `public/admin/config.yml`：

```yaml
backend:
  proxy_url: https://cms-oauth.<你的用户名>.workers.dev   # ← 替换这行
```

提交推送：`git add -A && git commit -m "admin: point oauth proxy" && git push`

## 日常使用

1. 打开后台地址，点「Log in with GitHub」授权
2. 左侧三个集合：**作品集 / 读书笔记 / 博客**，右上角 **+ New** 新增
3. 封面图直接在表单里上传（自动进 `public/covers/` 并 commit）
4. 「Publish」保存发布；「Draft」保存为草稿（博客条目 `draft: true` 时线上不显示）
5. 删除条目：列表页右上角垃圾桶图标
6. 保存后约 1-2 分钟 Actions 构建完，刷新线上站点即见

## 安全边界说明

- 只有你的 GitHub 账号能提交（OAuth scope 为 public_repo）；后台页面本身是公开的，
  但没有授权什么也做不了；若不想公开入口，把 `public/admin/index.html` 改名为随机串即可（obscurity）。
- 网页表单编辑与本地 Obsidian 编辑写同一批文件；**若两边同时改同一条目**，以先 push 的为准，
  后者会被要求刷新——单作者场景几乎不会遇到。
- `local_backend: true` 只在本地 `npm run dev` + 另开终端 `npx decap-server` 时生效，线上无副作用。
