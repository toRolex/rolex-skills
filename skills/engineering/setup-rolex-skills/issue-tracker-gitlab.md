# Issue tracker: GitLab

本仓库的 issue 和 spec 都以 GitLab issue 形式存在。所有操作使用 [`glab`](https://gitlab.com/gitlab-org/cli) CLI。

## 惯例

- **创建 issue**：`glab issue create --title "..." --description "..."`。多行 description 使用 heredoc。传入 `--description -` 打开编辑器。
- **读取 issue**：`glab issue view <number> --output json` 获取机器可读的 issue body 与字段；需要评论/活动时再单独执行 `glab issue view <number> --comments`。`--comments` 用于显示评论/活动，不可替代 JSON 正文读取。
- **列出 issue**：`glab issue list --output json`（或 `-O json`），配合适当的 `--label` 过滤器。`-F` 在 list 子命令中是 `--output-format`（`details`/`ids`/`urls`），不是 JSON 输出；不要混用不同子命令的短 flag。
- **在 issue 上评论**：`glab issue note <number> --message "..."`。GitLab 把评论称为 "notes"。
- **添加 / 移除 label**：`glab issue update <number> --label "..."` / `--unlabel "..."`。多个 label 可以用逗号分隔，也可以重复该标志。建立标签前用 `glab label list --output json` 核对现状，缺失项用 `glab label create --name "..."` 创建，避免重复创建。
- **关闭**：`glab issue close <number>`。`glab issue close` 不接受关闭评论，所以先用 `glab issue note <number> --message "..."` 发布说明，再关闭。
- **Merge requests**：GitLab 把 PR 称为 "merge requests"。使用 `glab mr create`、`glab mr view`、`glab mr note` 等；按各子命令的帮助使用参数，不要假设所有命令与 `gh pr ...` 完全同形。机器可读输出用 `glab mr view <number> --output json` 或 `glab mr list --output json`。

从 `git remote -v` 识别候选项目；自动解析不是写入授权。**每次写入前**运行 `glab repo view --output json`，核对输出的项目路径与用户确认的目标一致。没有指向目标项目的 remote、解析不唯一、CLI 未登录、不可达或目标不符时停止并询问；不得向上游技能来源项目写入，除非用户明确指定且确认拥有该目标。

## 将 Merge requests 作为 triage 请求面

**MRs as a request surface: no.** _（如果本仓库将外部 merge request 视为 feature request，请改为 `yes`；`/triage` 会读取此标志。）_

设为 `yes` 时，MR 与 issue 一样经历相同的 label 和状态流转，使用对应的 `glab mr` 命令：

- **读取 MR**：先用 `glab mr view <number> --output json` 获取 body 与元数据；需要评论/活动时再单独执行 `glab mr view <number> --comments`。diff 用 `glab mr diff <number>`。
- **列出待 triage 的外部 MR**：`glab mr list --output json`（或 `-O json`），然后只保留作者不是项目 member/owner 的 MR（贡献者的 MR，而非维护者进行中的工作）。
- **评论 / 打 label / 关闭**：`glab mr note`、`glab mr update --label`/`--unlabel`、`glab mr close`。

与 GitHub 不同，GitLab 为 issue 和 MR 分别编号，因此一旦你知道维护者指的是哪个请求面，`#42` 就没有歧义。

## 当某个 skill 说“发布到 issue tracker”时

创建一个 GitLab issue。

## 当某个 skill 说“获取相关 ticket”时

运行 `glab issue view <number> --output json` 读取正文；需要评论/活动时另行执行 `glab issue view <number> --comments`。

## Wayfinding 操作

由 `/wayfinder` 使用。**map** 是一个单独的 issue，**child** issue 作为 ticket。

- **Map**：一个标记为 `wayfinder:map` 的单独 issue，承载 Notes / Decisions-so-far / Fog 正文。`glab issue create --label wayfinder:map`。（在支持原生 epic 的 GitLab 版本上，map 也可能由 epic 承载；带 label 的 issue 在任何地方都可用。）
- **Child ticket**：创建时使用 `glab issue create --linked-issues <map-iid> --link-type relates_to`，并在 description 顶部保留 `Part of #<map>`、添加 label `wayfinder:<type>`（`research`/`prototype`/`grilling`/`task`）。CLI 当前文档支持上述关联 flags；若本机版本不支持，先查看 `glab issue create --help`，再按当前官方 CLI/API 文档处理，不猜 flag。一旦认领，ticket 会分配给主导开发的开发者。
- **Blocking**：GitLab 的**原生 blocking link**，规范且 UI 可见的表示方式。用 `/blocked_by #<n>` quick action 添加，以 note 形式发布（`glab issue note <child> --message "/blocked_by #<blocker>"`）。原生 blocking link 是 Premium/Ultimate 功能；在免费版（或不可用时）回退到在 description 顶部写一行 `Blocked by: #<n>, #<n>`。当所有 blocker 都关闭时，ticket 解除阻塞。
- **Frontier query**：用 `glab api projects/:fullpath/issues/<map-iid>/links` 获取 map 关联 issue，再核对 child 为 open 且带 `wayfinder:<type>` label。对每个 child 查询其 links，以 child 为关系视角：`is_blocked_by` 对应的关联 issue 才是其 blocker；`blocks` 表示 child 阻塞对方，不计入 child 的 blocker；`relates_to` 不构成阻塞。通过 link 响应中的 `state` 核对 blocker 是否仍为 `opened`；查询失败、关系不完整或状态无法核实时停止，不把未知状态当成无阻塞。也检查 description 的 `Blocked by` 行，并排除已分配的 child；按 map 顺序选最前者。`glab api` 的 `:fullpath` 是 CLI 项目占位符；若本机帮助/版本不接受，先查 `glab api --help` 和当前官方文档，不猜项目 ID 或 IID。
- **Claim**：`glab issue update <n> --assignee @me`，本次会话的第一次写入。
- **Resolve**：`glab issue note <n> --message "<answer>"`，然后 `glab issue close <n>`，再把 context 指针（gist + 链接）追加到 map 的 Decisions-so-far。
