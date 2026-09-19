# Stanley · 初山 —— 个人网站

> 线上地址：https://chushan2019.github.io/stanleyhome/
> 代码仓库：https://github.com/chushan2019/stanleyhome（gh 已建好，直接 clone 即可，无需再建仓库）

深色玻璃拟态风格的个人站点，视觉与动效复刻自 https://www.deepseek.com/harness/ 的设计体系（仅复刻设计语言，无原站素材）。内容形态：图文/音频/视频作品集、结构化读书笔记、博客长文、简历页。

---

## 一、整体架构

```
请求路径：浏览器 ──> GitHub Pages（静态 CDN）
内容路径：本地 Markdown ──git push──> GitHub Actions ──astro build──> dist/ ──> Pages
```

```
websitestylelesson/
├── astro.config.mjs            # Astro 5；site + base=/stanleyhome/（Pages 项目子路径）
├── package.json                # 零 UI 框架、零动效库——全部手写 CSS/WebGL
├── .github/workflows/deploy.yml# push→build→deploy-pages（Pages 源=workflow）
│
├── src/
│   ├── styles/                 # 设计体系三层
│   │   ├── tokens.css          #   全部色/间距/圆角/字体变量（dark 默认 + light 覆盖）
│   │   ├── base.css            #   字号阶(hero46/h1 36/…)、容器 1280px、玻璃卡片/按钮/正文排版
│   │   └── motion.css          #   入场/旋转描边/滚动显现/光标闪烁 + reduced-motion 降级
│   │
│   ├── components/
│   │   ├── Header.astro        # 玻璃吸顶导航 + 主题切换 + 移动端菜单
│   │   ├── Hero.astro          # STANLEY·初山 banner，CTA 组，错峰入场
│   │   ├── RippleBackground.astro # WebGL 层①：鼠标涟漪流场（拖尾FBO+fbm噪声扭曲）
│   │   ├── DotDrift.astro      # WebGL 层②：漫天雪花⇌世界地图 点阵粒子
│   │   ├── MediaCard / SectionHeading / CopyBar / GlassButton 等
│   │   └── Footer.astro
│   │
│   ├── content.config.ts       # 内容集合 schema（zod）：works / notes / posts
│   ├── content/
│   │   ├── works/**/*.md       # 作品集：type: text|audio|video，external 外链，featured 上首页
│   │   ├── notes/**/*.md       # 读书笔记：book/author/status/quotes + 正文（兼容 book-reading-notes 产出）
│   │   └── posts/**/*.md       # 博客：date/tags/draft
│   │
│   ├── data/profile.ts         # ★ 简历唯一数据源：姓名/简介/时间线/技能/社交/邮箱
│   ├── utils/                  # base.ts（withBase 子路径拼接）、labels.ts
│   ├── layouts/BaseLayout.astro# 字体自托管、主题防闪烁、滚动显现/主题切换脚本
│   └── pages/                  # index / works(/:slug) / notes(/:slug) / blog(/:slug) / about
│
└── public/
    ├── favicon.svg
    └── covers/                 # 占位渐变封面（上线后换真实图）
```

### 技术选型与理由

| 层 | 选型 | 理由 |
|---|---|---|
| 框架 | Astro 5（纯静态 output） | 内容驱动型站点最优解，零 JS 运行时成本，Markdown 一等公民 |
| 内容 | Content Collections + zod schema | 新增一篇内容 = 新建一个 .md 文件；类型校验防写错 frontmatter |
| 视觉 | 手写 CSS token 系统 | 不依赖 Tailwind/组件库，token 全部来自原站 CSS 逆向实测值 |
| 动效 | 手写 WebGL（无 three.js） | 两个特效层共 ~700 行自包含 GLSL+TS，站点无框架绑定 |
| 字体 | @fontsource 自托管 | 国内不走 Google Fonts CDN，Host Grotesk / DM Sans / JetBrains Mono |
| 部署 | GitHub Pages + Actions | 免费、git push 即上线、无外部平台依赖 |

### 已实现能力清单

**内容系统**
- [x] 作品集：图文/音频/视频三类型，列表页筛选、详情页、featured 精选上首页
- [x] 读书笔记：在读/读完状态、金句卡网格、正文结构（总结/概念摘录/结构图规划）
- [x] 博客：时间线列表、标签、draft 草稿开关、详情页
- [x] 简历页（关于我）：经历时间线、技能胶囊、复制邮箱条
- [x] RSS 就绪的 sitemap（@astrojs/sitemap 自动生成）

**设计体系**
- [x] 深色（默认）/ 浅色双主题，无闪烁切换，选择记忆在 localStorage
- [x] 响应式三档（375/768/1440 实测无横向溢出），移动端汉堡菜单
- [x] hero 错峰入场、旋转渐变描边、滚动显现、macOS 窗口壳、mono 标签排版

**动效层（全部手写 WebGL，机制逆向自原站源码）**
- [x] ① 鼠标涟漪流场：指针拖尾 FBO + 梯度扭曲 fbm 噪声 + 光晕/颗粒/暗角
- [x] ② 雪花⇌地图：悬停聚成世界地图、离开散作漫天雪、鼠标斥力空腔、滚动打散
- [x] `prefers-reduced-motion` / 无 WebGL / 移动端 完整降级

**后台管理（类公众号体验）**
- [x] Decap CMS 网页后台 `/stanleyhome/admin/`：作品/笔记/博客的 新建·编辑·删除·发布·草稿
- [x] GitHub OAuth 登录（Cloudflare Worker 中转 `workers/cms-oauth`，无自建账号体系）
- [x] editorial workflow：Save 草稿（浏览器本地持久化，退出重登不丢）+ Workflow 看板 + Publish 自动合并
- [x] 图片上传入 `public/covers/`；frontmatter 表单化（文件名正则校验防写坏）
- [x] `npm run qa:cms`（写入链路 E2E）/ `npm run qa:oauth`（登录握手 E2E）/ `npm run qa:draft`（草稿存活 E2E）

**工程**
- [x] `npm run qa`：puppeteer + 本机 Chrome 全页面截图回归（含动效交互态）
- [x] CI/CD：push → build → Pages 全自动；Pages 源已设为 GitHub Actions

---

## 二、日常使用

```bash
npm install
npm run dev        # 本地预览 http://localhost:4321/stanleyhome/
npm run build      # 静态构建到 dist/
npm run qa         # 截图回归（验证视觉改动）
git push           # 自动部署
```

### 内容管理 = 三套入口，同一批文件

| 入口 | 适合场景 | 开通 |
|---|---|---|
| 🌐 网页后台（Decap CMS）`/stanleyhome/admin/` | 手机/任何电脑，表单式增删改，类公众号体验；**GitHub OAuth 登录 + 草稿工作流已启用** | 已完成（GitHub OAuth App + Cloudflare Worker 中转，见 `docs/ADMIN.md`） |
| 📓 Obsidian 本地后台 | 沉浸式写作；官方 CLI（≥1.12.7）可命令行增删改查+套模板+发布 | 见 `docs/OBSIDIAN.md`（5 分钟配置） |
| ✍️ 直接编辑 Markdown + git push | 改 `src/data/profile.ts` 等单文件小改动 | 已可用，零配置 |

三者写的都是 `src/content/**` 与 `src/data/`，互不冲突（后提交的生效）。

### 手动方式速查（等价于内容操作 = 编辑文件）

| 操作 | 做法 |
|---|---|
| **新增**作品 | 复制 `src/content/works/glass-ui.md` 改 frontmatter + 正文，`git push` |
| **编辑**作品 | 直接改对应 .md 文件 |
| **删除**作品 | 删除该 .md 文件 |
| 音频/视频 | frontmatter 的 `external` 填 B站/小宇宙/YouTube 外链即可 |
| 改简历 | 只改 `src/data/profile.ts` 一个文件 |
| 封面图 | 放 `public/covers/`，frontmatter 写 `/covers/xxx.png` |
| 一键发布 | 改完后 `npm run pub "说明"`（自动 commit 内容目录 + push 上线） |

> ✅ **浏览器内后台已上线**：打开 `https://chushan2019.github.io/stanleyhome/admin/`，
> GitHub 授权后即可新建/编辑/删除/发布（含草稿 Save、图片上传）。方案调研记录见 `docs/admin-plan.md`。

## 三、部署与域名备忘

- Pages 子路径 `/stanleyhome/`：站内路径一律经 `src/utils/base.ts` 的 `withBase()` 拼接；
- 若换仓库名或绑自定义域名：改 `astro.config.mjs` 的 `base`/`site` 后重新 build 即可。
