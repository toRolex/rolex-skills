# Issue tracker: 本地 Markdown

本仓库的 issue 和 spec 以 markdown 文件形式存放在 `.scratch/` 中。

## 惯例

- 每个功能一个目录：`.scratch/<feature-slug>/`
- spec 是 `.scratch/<feature-slug>/spec.md`
- 实现 issue 是每个 ticket 一个文件，位于 `.scratch/<feature-slug>/issues/<NN>-<slug>.md`，从 `01` 开始编号——绝不用单个合并的 tickets 文件
- triage 状态记录在每份 issue 文件靠近顶部的位置，格式为 `Status:` 行（角色字符串见 `triage-labels.md`）
- 评论和对话历史以 `## Comments` 标题追加到文件底部

## 当某个 skill 说“发布到 issue tracker”时

在 `.scratch/<feature-slug>/` 下创建新文件（必要时创建目录）。

## 当某个 skill 说“获取相关 ticket”时

读取引用路径处的文件。用户通常会直接传入路径或 issue 编号。

## Wayfinding 操作

由 `/wayfinder` 使用。**map** 是一个文件，每个 ticket 对应一个 **child** 文件。

- **Map**：`.scratch/<effort>/map.md`——Notes / Decisions-so-far / Fog 正文。
- **Child ticket**：`.scratch/<effort>/issues/NN-<slug>.md`，从 `01` 开始编号，正文包含问题。`Type:` 行记录 ticket 类型（`research`/`prototype`/`grilling`/`task`）；`Status:` 行记录 `claimed`/`resolved`。
- **Blocking**：靠近顶部的一行 `Blocked by: NN, NN`。当它列出的每个文件都处于 `resolved` 时，ticket 解除阻塞。
- **Frontier**：扫描 `.scratch/<effort>/issues/`，找出开放、未阻塞且未认领的文件；按编号最前者获胜。
- **Claim**：在任何工作开始前设置 `Status: claimed` 并保存。
- **Resolve**：在 `## Answer` 标题下追加答案，设置 `Status: resolved`，然后把 context 指针（gist + 链接）追加到 `map.md` 中 map 的 Decisions-so-far。
