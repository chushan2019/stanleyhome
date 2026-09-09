# Stanley · 初山 —— 个人网站

深色玻璃拟态风格的个人站点（设计语言致敬产品站的 token 体系）：作品集 / 读书笔记 / 博客 / 关于我。
构建：Astro 5 静态站 → GitHub Pages（`https://chushan2019.github.io/stanleyhome/`）。

## 日常命令

```bash
npm run dev       # 本地预览 http://localhost:4321/stanleyhome/
npm run build     # 构建到 dist/
npm run qa        # 无头浏览器全页面截图（输出 /tmp/qa-*.png，需本机 Chrome）
```

## 怎么发内容

| 想发 | 操作 |
|---|---|
| 图文/音频/视频作品 | 在 `src/content/works/` 新建 `xxx.md`，frontmatter 见 `src/content.config.ts`（`type: text/audio/video`，音视频填 `external` 外链） |
| 读书笔记 | `src/content/notes/xxx.md`：frontmatter 放书名/作者/状态/金句，正文放总结与摘录（兼容 book-reading-notes 的产出结构） |
| 博客长文 | `src/content/posts/xxx.md` |
| 简历/个人信息 | 改 `src/data/profile.ts` 一个文件 |
| 封面图 | 放进 `public/covers/`，frontmatter 写 `/covers/xxx.png` |

改完 `git push` 即自动部署（Actions 见 `.github/workflows/deploy.yml`）。

## 设计体系

- 全部颜色/间距/圆角变量：`src/styles/tokens.css`（深色为默认，浅色在 `[data-theme="light"]`，右上角可切换，选择记在 localStorage）
- 字体自托管（@fontsource）：Host Grotesk 标题 / DM Sans 正文 / JetBrains Mono 代码，中文回退 PingFang SC
- 动效：`src/styles/motion.css` —— hero 错峰入场、conic 旋转描边、滚动显现、macOS 窗口壳；`prefers-reduced-motion` 时全部关闭

## 部署域名备忘

站点位于仓库子路径 `/stanleyhome/`（`astro.config.mjs` 的 `base`）。若换仓库名或绑定自定义域名，改 `base` 与 `site` 后重新构建即可。
