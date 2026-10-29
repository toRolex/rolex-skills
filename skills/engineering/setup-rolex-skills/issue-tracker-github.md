# Issue tracker: GitHub

本仓库的 issue 和 spec 都以 GitHub issue 形式存在。所有操作使用 `gh` CLI。

## 惯例

- **创建 issue**：`gh issue create --title "..." --body "..."`。多行 body 使用 heredoc。
- **读取 issue**：`gh issue view <number> --json number,title,body,labels`。需要 issue-level comments 时另行运行 `gh issue view <number> --comments`；需要结构化评论时先查看本机 `gh issue view --help` 支持的 JSON 字段。
- **列出 issue**：`gh issue list --state open --json number,title,body,labels --jq '[.[] | {number, title, body, labels: [.labels[].name]}]'`，配合适当的 `--label` 和 `--state` 过滤器。若需要评论，按单个 issue 查询评论；不要把 issue list 的评论计数误当成评论正文。
- **在 issue 上评论**：`gh issue comment <number> --body "..."`
- **添加 / 移除 label**：`gh issue edit <number> --add-label "..."` / `--remove-label "..."`。创建 label 前查看本机 `gh label list --help` 与 `gh label create --help`，按当前文档核对目标仓库现状，仅补建缺失项。
- **关闭**：先用 `gh issue comment <number> --body "..."` 发布解释；确认评论命令成功后，再运行 `gh issue close <number>`。不要把 `gh issue close --comment` 当成可靠的评论步骤：对已关闭 issue 它可能丢弃评论却以成功状态退出。

从 `git remote -v` 识别候选仓库；不要把 Git remote 或 `gh` 自动推断当作写入授权。**每次写入前**运行 `gh repo view --json nameWithOwner`，核对输出与已由用户确认的目标 owner/repo 完全一致。fork 场景或 remote 指向不明确时，`gh issue` / `gh pr` 等命令显式加 `--repo <已确认的owner/repo>`；对 `gh api` 写入命令，将 `{owner}/{repo}` 占位符替换为已确认目标的字面 owner/repo 路径，不依赖 remote 自动展开。不能读取、无法访问或不一致时停止并询问；绝不向技能来源仓库或其上游 parent 写入，除非用户明确指定并确认拥有目标。

## 将 Pull requests 作为 triage 请求面

**PRs as a request surface: no.** _（如果本仓库将外部 PR 视为 feature request，请改为 `yes`；`/triage` 会读取此标志。）_

设为 `yes` 时，PR 与 issue 一样经历相同的 label 和状态流转，使用对应的 `gh pr` 命令：

- **读取 PR**：分开读取正文和评论：先用 `gh pr view <number> --json number,title,body,author,labels,url` 获取 PR body 与元数据，再用 `gh pr view <number> --comments` 获取 issue-level conversation comments；`--comments` 单独运行时不会包含 body。读取 diff 用 `gh pr diff <number>`。如需 review-thread comments，再单独读取 `gh api repos/{owner}/{repo}/pulls/<number>/comments`；这与 issue-level comments 是不同数据。
- **列出待 triage 的外部 PR**：`gh api --paginate 'repos/{owner}/{repo}/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`。
- **评论 / 打 label / 关闭**：`gh pr comment`、`gh pr edit --add-label`/`--remove-label`、`gh pr close`。

GitHub 的 issue 和 PR 共享同一编号空间，因此裸 `#42` 可能指其中任一：用 `gh pr view 42` 判定，失败则回退到 `gh issue view 42`。

## 当某个 skill 说“发布到 issue tracker”时

创建一个 GitHub issue。

## 当某个 skill 说“获取相关 ticket”时

运行 `gh issue view <number> --json number,title,body,labels`；需要评论时另行运行 `gh issue view <number> --comments`。

## Wayfinding 操作

由 `/wayfinder` 使用。**map** 是一个单独的 issue，**child** issue 作为 ticket。

- **Map**：一个标记为 `wayfinder:map` 的单独 issue，承载 Notes / Decisions-so-far / Fog 正文。`gh issue create --label wayfinder:map`。
- **Child ticket**：创建时优先使用 `gh issue create --parent <map> ...`；已有 issue 可用 `gh issue edit <map> --add-sub-issue <child>` 接线。较旧 `gh` 若不支持这些 flags，可用已核实的 REST fallback：`gh api --method POST repos/{owner}/{repo}/issues/<parent>/sub_issues -F sub_issue_id=<child-database-id>`（`sub_issue_id` 是 child 的数据库 ID，不是 issue number）。若项目未启用 sub-issues，才把 child 加入 map 正文 task list，并在 child 正文顶部加 `Part of #<map>`。label：`wayfinder:<type>`（`research`/`prototype`/`grilling`/`task`）。一旦认领，ticket 会分配给主导开发的开发者。
- **Blocking**：GitHub 的**原生 issue dependencies**是首选。创建 child 时可用 `gh issue create --blocked-by <n>,<n> ...`，已有 child 用 `gh issue edit <child> --add-blocked-by <blocker>`；可用 `gh issue edit --help` 检查本机版本。旧版 CLI 的已核实 API fallback：`gh api --method POST repos/{owner}/{repo}/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-database-id>`。`issue_id` 是 blocker 的数据库 ID，不是 issue number 或 Node ID。关系功能不可用时，回退到 child 正文顶部的 `Blocked by: #<n>, #<n>`。ticket 仅在所有 blocker 都关闭时解除阻塞。
- **统计开放 blocker / Frontier query**：`gh issue view <n> --json blockedBy` 返回 `blockedBy.nodes` 与 `totalCount`；逐个 blocker 用 `gh issue view <blocker> --json state` 核实状态，只把 open 项计入门控。`nodes` 可能被截断；若数量小于 `totalCount`，使用 `gh api --paginate repos/{owner}/{repo}/issues/<n>/dependencies/blocked_by` 取得完整列表，并逐项核实 issue state。列出 map 开放 child，剔除仍有开放 blocker 或已分配的项目；按 map 顺序选最前者。回退的 `Blocked by` 行也需逐项核对状态。
- **Claim**：`gh issue edit <n> --add-assignee @me`，本次会话的第一次写入。
- **Resolve**：`gh issue comment <n> --body "<answer>"`，确认评论发布成功后运行 `gh issue close <n>`，再把 context 指针（gist + 链接）追加到 map 的 Decisions-so-far。
