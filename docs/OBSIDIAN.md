# Obsidian 本地后台

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
