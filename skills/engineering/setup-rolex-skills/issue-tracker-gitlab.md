# Issue tracker: GitLab

本仓库的 issue 和 spec 都以 GitLab issue 形式存在。所有操作使用 [`glab`](https://gitlab.com/gitlab-org/cli) CLI。

## 惯例

- **创建 issue**：`glab issue create --title "..." --description "..."`。多行 description 使用 heredoc。传入 `--description -` 打开编辑器。
- **读取 issue**：`glab issue view <number> --comments`。机器可读输出使用 `-F json`。
- **列出 issue**：`glab issue list -F json`，配合适当的 `--label` 过滤器。
- **在 issue 上评论**：`glab issue note <number> --message "..."`。GitLab 把评论称为 "notes"。
- **添加 / 移除 label**：`glab issue update <number> --label "..."` / `--unlabel "..."`。多个 label 可以用逗号分隔，也可以重复该标志。
- **关闭**：`glab issue close <number>`。`glab issue close` 不接受关闭评论，所以先用 `glab issue note <number> --message "..."` 发布说明，再关闭。
- **Merge requests**：GitLab 把 PR 称为 "merge requests"。使用 `glab mr create`、`glab mr view`、`glab mr note` 等——与 `gh pr ...` 形状相同，只是用 `mr` 替换 `pr`，用 `note`/`--message` 替换 `comment`/`--body`。

从 `git remote -v` 推断仓库——在 clone 内部运行时 `glab` 会自动完成这一操作。

## 将 Merge requests 作为 triage 请求面

**MRs as a request surface: no.** _（如果本仓库将外部 merge request 视为 feature request，请改为 `yes`；`/triage` 会读取此标志。）_

设为 `yes` 时，MR 与 issue 一样经历相同的 label 和状态流转，使用对应的 `glab mr` 命令：

- **读取 MR**：`glab mr view <number> --comments`，diff 用 `glab mr diff <number>`。
- **列出待 triage 的外部 MR**：`glab mr list -F json`，然后只保留作者不是项目 member/owner 的 MR（贡献者的 MR，而非维护者进行中的工作）。
- **评论 / 打 label / 关闭**：`glab mr note`、`glab mr update --label`/`--unlabel`、`glab mr close`。

与 GitHub 不同，GitLab 为 issue 和 MR 分别编号，因此一旦你知道维护者指的是哪个请求面，`#42` 就没有歧义。

## 当某个 skill 说“发布到 issue tracker”时

创建一个 GitLab issue。

## 当某个 skill 说“获取相关 ticket”时

运行 `glab issue view <number> --comments`。

## Wayfinding 操作

由 `/wayfinder` 使用。**map** 是一个单独的 issue，**child** issue 作为 ticket。

- **Map**：一个标记为 `wayfinder:map` 的单独 issue，承载 Notes / Decisions-so-far / Fog 正文。`glab issue create --label wayfinder:map`。（在支持原生 epic 的 GitLab 版本上，map 也可能由 epic 承载；带 label 的 issue 在任何地方都可用。）
- **Child ticket**：在 description 顶部带有 `Part of #<map>` 以及 label `wayfinder:<type>`（`research`/`prototype`/`grilling`/`task`）的 issue。一旦认领，ticket 会分配给主导开发的开发者。
- **Blocking**：GitLab 的**原生 blocking link**——规范且 UI 可见的表示方式。用 `/blocked_by #<n>` quick action 添加，以 note 形式发布（`glab issue note <child> --message "/blocked_by #<blocker>"`）。原生 blocking link 是 Premium/Ultimate 功能；在免费版（或不可用时）回退到在 description 顶部写一行 `Blocked by: #<n>, #<n>`。当所有 blocker 都关闭时，ticket 解除阻塞。
- **Frontier query**：用 `glab issue list -F json` 限定到 map 的 child，丢弃任何有开放中 blocker——指向开放 issue 的原生 `blocked_by` 链接（`glab api projects/:id/issues/:iid/links`），或在 `Blocked by` 行有开放 issue——或有 assignee 的项；按 map 顺序排最前者获胜。
- **Claim**：`glab issue update <n> --assignee @me`——本次会话的第一次写入。
- **Resolve**：`glab issue note <n> --message "<answer>"`，然后 `glab issue close <n>`，再把 context 指针（gist + 链接）追加到 map 的 Decisions-so-far。
