# 在线管理后台方案（类微信公众号体验）

现状：内容管理 = 本地改 Markdown + git push。目标：打开一个网址，像公众号后台一样
**登录 → 列表 → 新建/编辑/删除 → 发布**，发布后自动重新部署。

## 方案 A（推荐）：Decap CMS —— 零后端改造，数据模型不变

GitHub 官方的"静态站内容管理系统"（前身 Netlify CMS），一个纯前端 SPA，
放在 `public/admin/` 即可，**现有 Astro 内容和 CI 一行都不用改**。

```
https://…/stanleyhome/admin/          ← 后台页面（只有你有 GitHub 账号能提交）
   │ 1. GitHub OAuth 登录
   │ 2. 表单编辑 → commit 回仓库 src/content/**
   ▼
现有 GitHub Actions 自动 rebuild + deploy
```

- 体验：左侧内容列表（works/notes/posts 三个 Collection），
  右上「New」新建，所见即所得 Markdown 编辑器（支持图片上传到 `public/covers/`），
  删除=点垃圾桶，保存=commit（可写 commit message），草稿用 `draft` 字段
- 成本：免费；只多一个 OAuth 中转（GitHub OAuth 回调需要服务端，见下）
- 需要的准备（一次性，约 15 分钟，需要你的参与）：
  1. 在 GitHub → Settings → Developer settings → OAuth Apps 建一个应用，
     拿 Client ID/Secret（回调地址指向下面的 Worker）
  2. 我写一个 ~30 行的 Cloudflare Worker 做 OAuth 中转（免费额度绰绰有余），
     或改用 Vercel/Netlify 的现成 proxy
- 局限：编辑权限 = 仓库写权限（对个人站正好）；无「预览链接」，
  但可以在表单里 Save 后到 staging 看效果

## 方案 B：Notion 当后台 —— 写作体验最好

把内容放进一个 Notion 数据库（字段 = frontmatter），
你在 Notion App 里新增/编辑/删除条目，Actions 定时/手动拉取 Notion API
生成 Markdown 后构建。**后台就是你手机上的 Notion，零新 UI。**
- 成本：免费（Notion + GitHub Actions）；需要一个 Notion Integration Token（建一次）
- 局限：内容主档在 Notion（仓库里是导出缓存）；图片走 Notion 外链

## 方案 C：维持 git 工作流 + 脚手架命令 —— 最简单

不引入任何服务：`npm run new:work` 交互式生成带模板的 .md 并打开编辑器；
配合 GitHub.dev（网页里直接改文件、网页提交）也能做到"不开本地环境就改网站"。
- 成本：零
- 局限：本质还是文件/git，不像后台

## 对比速览

| | A · Decap | B · Notion | C · 脚手架 |
|---|---|---|---|
| 手机可用 | ✅ 浏览器 | ✅ App | ❌ |
| 数据留在仓库 | ✅ | 导出缓存 | ✅ |
| 图片上传 | ✅ | Notion 外链 | 手动 |
| 需第三方账号 | Cloudflare/Vercel（免费） | Notion | 无 |
| 实施工作量（我来做） | ~1-2 小时 | ~2 小时 | ~20 分钟 |

**建议**：先 A（内容主权仍在 git，体验最接近公众号后台）；若你本来就重度使用
Notion，则 B 更顺手。选定后我直接实现，含 OAuth/Token 配置清单。
