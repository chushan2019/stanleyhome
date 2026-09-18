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
   - Authorization callback URL：先随便填 `https://placeholder.workers.dev/callback`，第 2 步拿到真实域名后回来改
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
**回到第 1 步把 OAuth App 的 callback URL 改成** `https://cms-oauth.<你的用户名>.workers.dev/callback`。

## 第 3 步：把 Worker 地址填进配置（我也可以代改，1 分钟）

编辑 `public/admin/config.yml`：

```yaml
backend:
  base_url: https://cms-oauth.<你的用户名>.workers.dev   # ← 替换这行
```

提交推送：`git add -A && git commit -m "admin: point oauth proxy" && git push`

## 本地先体验（不用等 OAuth，5 分钟见效）

Decap 支持本地后端直写仓库文件，无需 GitHub 授权即可完整体验增删改：

```bash
npm run dev                 # 终端①  :4321
npm run cms:local           # 终端②  本地写入代理 :8081
# 打开 http://localhost:4321/stanleyhome/admin/ → 按钮显示「Login」→ 免登录进入
```

已配好回归测试一键验证全链路（登录→读列表→新建→发布落盘→删除）：

```bash
npm run qa:cms              # 需上面两个服务在跑；输出 ALL-PASS 即通过
```

> 小知识：删除已发布条目时 Decap 弹的是浏览器原生确认框；自动化时要自动接受
> （qa-cms.mjs 里 `page.on('dialog')` 已处理）。

## OAuth 登录排障（重要）

Decap 的 github 后端**只读 `backend.base_url`** 来决定 OAuth 中转地址。这个键写错或缺失时，
它会静默回退到 `https://api.netlify.com/auth`，点登录的弹窗里显示一个 **404 Not Found**，
界面上没有任何报错——历史上这个坑排查了两轮。

两处日志可以快速定位：

1. **浏览器控制台**（打开 `admin/` 页即自动打印）：
   - `[admin] 点击「Login with GitHub」实际会打开的地址：…` —— 这就是登录时真正会打开的 URL。
     若它指向 `api.netlify.com`，说明 `base_url` 没生效（缺失/拼错/未部署）。
   - 若配置里有 `proxy_url` 或 `site_domain`，会额外打印告警。
2. **Worker 端**：`cd workers/cms-oauth && npx wrangler tail`，可看到 `[cms-oauth]` 各阶段日志
   （不打印 token 与 secret 本身，只打印长度，可安全贴出）。

回归测试（不需要真实 GitHub 账号，用本地假 OAuth 主机 + 请求拦截伪造 api.github.com）：

```bash
npm run qa:oauth            # Worker 单元 + 真机端到端握手；输出 ALL-PASS 即通过
```

### 保存/发布时报「API_ERROR: Bad credentials」

含义：本浏览器存的 GitHub OAuth token 已失效（GitHub 对「同一账号 × 同一 OAuth App」
只保留一个有效 token——**在另一台设备/浏览器重新登录会踢掉旧 token**；手动 Revoke
授权同理）。列表页看起来正常是因为渲染的是本地缓存，写入时才暴露。

解决：右上角头像 → Log out → 重新 Log in with GitHub 即可。未 Publish 的草稿存在
浏览器本地（条目标记为 Unpublished），重新登录后回到对应集合能找到并继续发布，不会丢。
建议固定一个主要设备登录后台；手机发布后回电脑用，电脑需重新登录一次。

## 日常使用

1. 打开后台地址，点「Log in with GitHub」授权
2. 左侧三个集合：**作品集 / 读书笔记 / 博客**，右上角 **+ New** 新增
3. 封面图直接在表单里上传（自动进 `public/covers/` 并 commit）
4. 「Publish」保存发布；「Draft」保存为草稿（博客条目 `draft: true` 时线上不显示）
5. 删除条目：列表页右上角垃圾桶图标
6. 保存后约 1-2 分钟 Actions 构建完；**Pages CDN 另有最长 10 分钟缓存**——线上没立刻变时先等
   2 分钟再**强制刷新**（Mac：⌘+Shift+R；手机：清该页缓存或换无痕窗口），
   别急着判定"没同步"。确认是否真的没发布，可看仓库提交列表里有没有对应的
   「Update … via 后台」commit。

> ⚠️ 编辑已有条目时，「文件名（英文）」字段会自动回填为当前文件名，**请不要改它**：
> 网址由仓库里的文件名决定，改了它既不会换网址，还会往文件里写入一个多余字段。
> 新建条目时才需要填写（小写英文+连字符）。

## 安全边界说明

- 只有你的 GitHub 账号能提交（OAuth scope 为 public_repo）；后台页面本身是公开的，
  但没有授权什么也做不了；若不想公开入口，把 `public/admin/index.html` 改名为随机串即可（obscurity）。
- 网页表单编辑与本地 Obsidian 编辑写同一批文件；**若两边同时改同一条目**，以先 push 的为准，
  后者会被要求刷新——单作者场景几乎不会遇到。
- `local_backend: true` 只在本地 `npm run dev` + 另开终端 `npx decap-server` 时生效，线上无副作用。
