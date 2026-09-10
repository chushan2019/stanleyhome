# Obsidian 本地后台

> 本文含两种用法：**GUI 手动流**（零门槛）与 **官方 CLI 流**（可脚本化，Claude Code 也能代操作）。
> CLI 要求 Obsidian ≥ 1.12.7，并在 设置→通用 中启用"命令行界面"（应用需在运行中）。

把**仓库根目录本身作为 Obsidian 库**（Vault）打开：写作界面用 Obsidian，
内容还是 `src/content/` 里的 Markdown，保存后由 Obsidian Git 插件自动
commit + push → 触发网站重新部署。**与 Decap 网页后台（docs/ADMIN.md）写同一批文件，二选一或混用。**

## 一次性开通（约 5 分钟）

1. **打开库**：Obsidian → Open folder as vault → 选择
   `/Users/stanley/vibecoding/websitestylelesson`
   （或终端跑 `npm run obsidian` 自动打开）
2. **启用模板**：设置 → 核心插件 →「模板」开启 → 模板文件夹填 `_templates`
3. **自动发布**：设置 → 第三方插件 → 关闭安全模式 → 浏览 →
   安装并启用 **Obsidian Git** → 插件设置里：
   - Enable pull on startup ✅
   - Enable auto save commit ✅ 间隔 `5` 分钟
   - Enable update（自动 push）✅ 间隔 `10` 分钟
   - Pull间隔 `30` 分钟（多设备编辑同一库时拉取别人/网页后台的改动）
4. **git 身份**（终端一次性）：
   ```bash
   cd /Users/stanley/vibecoding/websitestylelesson
   git config user.name "Stanley"
   git config user.email "chushan2019@users.noreply.github.com"
   ```

## 日常操作（都在 Obsidian 里完成）

| 操作 | 做法 |
|---|---|
| **新增**作品 | 模板插入「新作品」→ 编辑 → 文件移动到 `src/content/works/` → 等 10 分钟自动发布 |
| **编辑**任何内容 | 文件列表进 `src/content/` 直接改，自动提交 |
| **删除** | 删文件（建议用 Obsidian Git 的文件列表或终端 `git rm`），自动提交 |
| 预览效果 | 终端 `npm run dev`，浏览器开 http://localhost:4321/stanleyhome/ |
| 属性编辑 | 装 Dataview/Properties UI 后 frontmatter 可视化编辑；不加插件手填也可以 |

小技巧：给 `_templates` 和 `src/content` 加 Obsidian 书签（Bookmarks 核心插件），
一键直达；frontmatter 的 `featured/order/tags` 等字段含义看文件头部注释或 `src/content.config.ts`。

## 注意

- 同一篇内容**不要**同时在 Obsidian（未 push）和网页后台编辑，后 push 的会覆盖；
- 移动文件 = 网址变化，发布后想保留旧链接就不要改文件名；
- `.obsidian/` 工作区状态不入库（见 .gitignore），换设备只需重复本指南前 3 步。

---

## CLI 流：把 Obsidian 当命令行后台用（推荐装好后开启）

官方 CLI（`obsidian`）支持创建/读写/移动/删除/改属性/套模板/搜索——正好覆盖本站全部管理动作，
而且可以让 Claude Code 直接代你操作内容：

| 网站管理动作 | CLI 命令 |
|---|---|
| 用模板新建作品 | `obsidian create name="src/content/works/my-piece.md" template="_templates/新作品.md" open` |
| 用模板新建笔记/文章 | 同上，路径换 `notes/`、`posts/` |
| 读某篇内容 | `obsidian read file=my-piece` |
| 追加段落 | `obsidian append file=my-piece content="## 补充\n\n新段落"` |
| 改属性（发布/精选/换封面） | `obsidian property:set name=featured value=true file=my-piece` |
| 删草稿标记 | `obsidian property:remove name=draft file=my-piece` |
| 列出某集合全部文件 | `obsidian files folder=src/content/works ext=md` |
| 全站搜索 | `obsidian search:context query=关键词` |
| 重命名（网址会变） | `obsidian rename file=old-name name=new-name` |
| 删除内容 | `obsidian delete file=my-piece`（默认进回收站） |
| 在 GUI 里定位一篇 | `obsidian open file=my-piece` |
| 发布上线（git 提交推送） | `npm run pub "本次改动的说明"` |

示例——完整走一遍「发一篇新图文」：

```bash
obsidian create name="src/content/works/trip.md" template="_templates/新作品.md" open
# ……在 Obsidian 里写完……
obsidian property:set name=featured value=true file=trip
npm run pub "add: trip essay"
```

> 未装 Obsidian CLI 时：设置→通用→命令行界面→启用并允许注册 PATH；macOS 若提示缺软链，
> 按文档跑一次 `sudo ln -sf /Applications/Obsidian.app/Contents/MacOS/obsidian-cli /usr/local/bin/obsidian`。
