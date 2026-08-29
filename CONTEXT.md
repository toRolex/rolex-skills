# Rolex Skills

mattpocock/skills 的中文改编版：一套 agent skill 集合，按 bucket 组织在 `skills/` 下。

## Language

**Skill**:
一个 `SKILL.md` + 可选附属文件的目录，通过 frontmatter 的 `disable-model-invocation` 区分 user-invoked 与 model-invoked。

**Bucket**:
`skills/` 下的分组目录。已推广 bucket（`engineering/`、`productivity/`、`personal/`）必须出现在顶层 README 与 plugin.json；`misc/` 不推广。

### afk-issue-loop 编排

**控制者**:
运行 afk-issue-loop 的主 Claude 会话，扮演编排器：分派角色、切片 DAG、验证、异常处置，不写实现代码。
_Avoid_: 主 agent、orchestrator

**角色**:
afk-issue-loop 的四种分派单元：Planner（一次，出 DAG）、Implementer（每 issue 一个，TDD 实现）、Reviewer（同 worktree 同 branch 直接自改）、Merger（拓扑 merge + 统一关 issue）。

**载体**:
角色的运行方式——`subagent`（Agent 工具）或 `herdr`（独立 pane）。与角色语义正交。

**DAG**:
Planner 开头一次性输出的完整 issue 依赖图（含 `blocked_by`），控制者按拓扑序逐轮切 unblocked 集合，耗尽即停。
_Avoid_: 分轮 plan

**watchdog**:
每次分派挂起的后台脚本（`scripts/watchdog.sh`），盯 worktree 文件系统活性（文件 mtime + git reflog），600s 无活性才退出并输出一行死因，退出即系统通知唤醒控制者判 `AgentIdleTimeoutError`。运行期间零输出、零上下文占用；两载体（subagent / herdr）统一。
_Avoid_: 一次性计时器、复杂度分级时限、轮询

**恢复手册**:
失败 issue 落盘的现场档案 `docs/afk-failures/issue-{N}.md`：branch / worktree / commits 快照 / 错误类型 / 失败摘要 / 可复制的重派 prompt。现场保全（worktree 不删、branch 不动、永不 `reset --hard`）。

**恢复**:
失败 issue 的唯一恢复路径：同分支同 worktree 重新分派，prompt 末尾附「Read docs/afk-failures/issue-{N}.md 了解前次失败，同分支继续，复用已 commit 进度」。**零自动重试**——失败即标 `failed`，处置权在人，不停调度其余 unblocked issue。
_Avoid_: 原地重试、自动重试

**status**:
plan 节点四值 `pending` / `dispatched` / `done` / `failed`（自造词汇，sandcastle 无对应物）。`failed` 是终态——不自动重试，收尾把 `afk-failures/` 清单交用户逐条处置（恢复或放弃）。

**主窗口预算**:
控制者的上下文窗口是稀缺资源这一设计约束：材料与汇报默认不进主窗口，能下沉到角色 agent 的一律下沉。

**寻址注入**:
分派 prompt 只给命令与文件路径（`gh issue view N`、`Read CONTEXT.md`），由角色 agent 自取内容。
_Avoid_: 全文注入、控制者代读

**模板自加载**:
分派 prompt 只传模板文件路径与参数（ISSUE / BRANCH / WORKTREE），角色 agent 自行 Read 模板获取完整指令。

**极简汇报**:
角色 agent 的汇报只含 `<promise>COMPLETE</promise>`、状态、以及 CONCERNS 时的一句疑虑；测试输出与 commit 列表由控制者用 git 命令自查，不经汇报回灌。
