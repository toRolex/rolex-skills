# AFK Issue Loop — Reference

关系、状态、恢复的 single source of truth；执行顺序见 [SKILL.md](SKILL.md)，合并算法见 [Merger 模板](reference/merger-prompt.md)。

## Execution DAG

### 输入闭包

- 初始 Tickets 为显式 issue numbers，否则全部 open ready-for-agent Issues（过滤 PR）。
- GitHub 原生 parent/sub-issues 和 blocked_by 是权威；递归纳入每个 open blocker，每个 open 节点必须带 ready-for-agent。
- closed blocker 视为满足，不纳入节点/依赖边；显式 CLOSED root 保留为审计节点，不执行、不清理其历史 worktree、不声明已合并。
- parent SPEC 只进入 specs，不占槽、不建分支，与 issues 不重叠。

```text
GET /repos/{owner}/{repo}/issues/{number}/parent
GET /repos/{owner}/{repo}/issues/{number}/sub_issues?per_page=100&page=N
GET /repos/{owner}/{repo}/issues/{number}/dependencies/blocked_by?per_page=100&page=N
```

数组端点使用 gh api --paginate --slurp；默认 Issues 扫描分页并排除 pull_request。仓库级约定见 docs/agents/issue-tracker.md。

### Plan schema

```json
{
  "version": 1,
  "run_id": "20260829T120000Z-12345",
  "target_branch": "main",
  "roots": [42],
  "specs": [{"number": 10, "title": "Verbose mode SPEC"}],
  "issues": [
    {"number": 42, "title": "Add verbose flag", "branch": "afk/issue-42", "spec": 10, "blocked_by": [], "status": "pending", "stage": "implement"}
  ]
}
```

不变量：version=1；run_id 非空；target_branch=main|develop；roots 唯一且各自在 issues 恰好一次；number 为唯一正整数；branch 精确为 afk/issue-{number}；spec 为已登记 parent number 或 null；依赖引用存在、无重复/自环/环，全部 issues 在 roots 的依赖闭包中。建图后保留 roots 与依赖边；blocker done 才解锁下游。

- status：pending | dispatched | recovering | done；stage：implement | review | merge。pending 只允许 implement，done 只允许 merge。
- `done_source` 仅 done 必填，枚举 `initial_closed | merged`。initial_closed 仅允许 root 且 blocked_by=[]；代表建图时 GitHub 已 CLOSED，不构成 merge 证据。merged 代表本次 Merger 全门槛验收。
- 新 Planner 仅产出 pending 与 initial_closed；live 校验拒绝 merged 或活动节点。运行中只做离线校验，再逐阶段核实 GitHub/现场，不把初始 live 比较用于运行中。
- 旧 v1 plan 的 done 缺来源时暂停推进：从已有验收/分派记录证明本次合并则补 merged；从初始 live 快照证明已关闭 root 则补 initial_closed；仅当前 CLOSED 不足以迁移。证据缺失保留记录报告，不猜测。

## 状态与槽位

| 事件 | 转换 | 结果 |
|---|---|---|
| frontier 分派 | pending → dispatched/implement | 占一个 Ticket 槽 |
| Implementer 验收 | dispatched/review | 同现场 Reviewer |
| Reviewer 验收 | dispatched/merge | 固定 reviewed SHA/review base，立即排队 |
| 可重试失败或授权等待 | recovering，保留 stage | 保留原槽与依赖阻塞 |
| 恢复角色启动 | dispatched，原 stage | 同现场续跑 |
| Merger 完整验收 | done/merge，done_source=merged | 释放槽，立即解锁下游 |

**Ticket 槽**为 dispatched + recovering，最大 4；实现、审查、等 merge、恢复和授权等待均占原槽。Merger 不另占 Ticket 槽，全运行最多一个；不因四槽满再开第五个。

**流式调度**：reviewed 即入队，Merger 空闲就取一个已就绪 Ticket；不等待其他活动 Ticket。队列按 ready 时刻 FIFO，同刻按 issue number，且所有依赖必须 done。单 Ticket 合并单元降低中断恢复和清理范围；不建立全批 barrier。A→C 与 B 独立：A reviewed→merge→测试→summary→关闭→只清理 A→验收 done，立即启动 C，B 可仍在实现/恢复。

**安全基线**：实现记录固定 implementation_base_sha；审查记录 review_base_sha 与 reviewed_sha。目标分支随其他合并推进，不能用浮动 TARGET..HEAD 冒充原审查范围。入 Merger 前核对目标 HEAD：与 review base 不同则 Merger 在新目标上复核该 Ticket 的完整 diff、验收项、安全/类型/回归与相邻接口，并全量测试；涉及 Ticket 业务修正则保留合并现场报告，由控制者按所有权交接同 Ticket Reviewer，重新固定 reviewed SHA，之后 Merger 接管原 merge 现场、重新构造并验证精确结果。未复核不可用旧绿灯关闭 Ticket。

**重新审查交接**：同一合并单元保留原 Ticket 槽，进入 recovering/review；当前 Merger 退出后，Reviewer 仅在原 Ticket worktree 修正，主仓库 merge 现场冻结、无写者。控制者保留单元的 merge stage 失败计数，同时使用该 Ticket 的 review stage 计数选模型。Reviewer 完成并退出后记录 `previous_reviewed_sha`、`reviewed_sha`、新 review base 和输入 revision，置 dispatched/merge；唯一 Merger 接管。新 reviewed SHA 必须包含旧 SHA（保留历史）；否则暂停人工决策，不改写现场。旧 MERGE_HEAD 可且仅可匹配持久化的 previous_reviewed_sha：Merger 先按两侧意图完成旧 merge（尚不关闭/清理），再拓扑合入新 reviewed SHA，重新做完整复核/测试/summary。旧测试与 summary 验收失效，新 revision 使用不同 summary message；旧提交保留为恢复证据。任何中断按旧 merge→新 merge→新测试顺序核实，不把旧结果当新输入完成。

### 进度快照

分派、reviewed 入队、merge 验收、恢复/权限等待和用户询问时，简报 active/4、各 Ticket stage/模型、merge 队列与当前单元、等待原因（依赖/旧写者/授权/四槽/主仓库）。独立任务有空槽继续；无槽如实等，不承诺绕过上限。

## 协议信号

Planner 输出与磁盘 JSON 相同的 `<plan>`；其余输出 `<promise>COMPLETE</promise>`。信号需同时满足门槛；控制者交叉核实 commits、测试、GitHub 和 Worktrunk。旧/重复通知只归档。

## BLOCKED 分流

四角色统一按真实原因，不以 BLOCKED 字符串直接判定资格失败：

| 原因 | 动作 |
|---|---|
| INPUT_INELIGIBLE：PR、open 节点缺标签、输入图不合法 | Planner 终止本次运行，报告具体 Issue/资格原因，保留旧 plan、不执行它 |
| WORKTREE_MISMATCH、现场/分支绑定错误 | 零业务写入；核对旧写者退出，修正现场/载体；需切换载体先授权，再重派原角色，不重复错误配置、不升级模型 |
| PERMISSION_REQUIRED：写入、Git、网络、工具/模型授权拒绝 | 保留现场与槽，报告动作等待授权；不换载体/角色绕过 |
| 缺用户业务决策或不可归属 dirty | 保存证据，等待上下文/所有权确认；其他独立工作照常 |
| 已授权执行失败、测试失败、可从材料补齐的上下文 | 原角色证据驱动恢复；模型按下一节选择 |

未知原因先取日志/状态核实；不无条件终止、不无条件升级或重派。

## 自动恢复

implement→Implementer，review→Reviewer，merge→Merger；Planner 的 plan 阶段仅在 plan 尚未验收时恢复。已授权且有可行动证据的失败无次数上限。同 branch、同 worktree、同 stage、同槽位续跑。每次更新失败输出、commits/dirty 快照、已尝试动作、下一恢复动作与依据；相同失败无新证据时先诊断/补材料或等待外部条件，不空转。失败 Ticket 下游保持 blocked；独立任务使用剩余槽推进。

### 模型与证据

恢复单元键为 `run_id + Ticket + stage`；Planner 为 `run_id + planner + plan`，Merger 为 `run_id + merge_unit_id + merge`（单元映射唯一 Ticket）。各 stage 独立累计 `retryable_failures`，不把 Implementer 失败传给首次 Reviewer。

默认 Sonnet。同键首次**可重试执行失败**，下一 attempt 使用 Opus，携带失败证据；后续失败保持 Opus，不降回 Sonnet。已经 Opus 则保持。权限/绑定/纯观察器故障不计升级次数。Planner 的已授权产出/校验失败可升级，资格终止不升级；Merger 测试/冲突处理/完成门槛失败在该单元 merge stage 升级并持久化。

dispatch 与 runbook 记录 `stage`、`retryable_failures`、`requested_model`、`actual_model`、失败证据、升级原因和下一动作。仅实际工具 schema/agent 定义支持 model 时设置该字段；Herdr 使用经当前接口验证的模型选择。缺 model 参数只可使用能验证的默认模型；若下一 attempt 要求 Opus 而载体不支持或无法验证，暂停该角色报告 MODEL_UNAVAILABLE，不在 Sonnet 上写“Opus”冒充。已有任务模型不可确认时不宣称升级成功。

### 现场所有权与分派记录

一个 worktree 同时一个写入角色；主仓库同时一个 Merger。控制者不执行角色业务写入。Planner 未验收阶段独占 plan 候选文件写入，控制者等待 Planner 退出后校验并接管 plan；验收后只有控制者修改 plan。控制者始终独占 dispatch/runbook，其他角色只读取这些登记文件；避免与 Merger git add/commit 并发，运行时路径永不暂存。

原子持久化 docs/afk-dispatch.json：run_id、requested_mode/mode、主仓库绝对路径、target_branch、初始输入、plan_accepted、运行文件准确清单、执行 Ticket 清单、merge 队列、当前单元，以及各单元 stage/attempt/模型/失败计数/任务与 watchdog 标识/验收证据/现场与 runbook 绝对路径。通知只在 run_id+单元+stage+attempt+任务标识全部匹配且未验收时推进。分派前保存 intent，启动后补 task ID；启动异常先查是否产生实例，身份不明不重复分派。

恢复先读取 dispatch；未验收 plan 不执行 Tickets。Planner 存活则等；已退出且完整产出则结构/live 验收；无完整产出则原现场恢复；资格失败仍终止，权限仍等。仅已验收 plan 可跳过 Planner。旧记录缺 plan_accepted 时核实既有证据，不覆盖已执行 plan。

恢复已验收运行时核对 plan、队列、合并单元、实际 refs/GitHub/Worktrunk 与任务状态。存活实例继续等；退出实例验收或恢复；任务 ID 缺失先取证。阶段交接/重派必须确认旧实例及写入子进程退出；仅 idle 不等于退出。未确认则保留槽等，不启动第二个写者。

### Ticket 角色恢复

AgentError、核实停滞的 AgentIdleTimeoutError、缺 COMPLETE、Implementer 相对固定实现基线无 commit、角色疑虑均先分流。

1. 停 watchdog，确认旧角色及写入子进程退出。
2. 在主仓库 docs/afk-failures/issue-{N}.md 创建或追加该 stage 失败证据、累计计数、模型与下一动作；保留历史。
3. 置 recovering，按 Worktrunk 查询原现场，保留 commits 与未提交改动。
4. 按现场绑定重派原角色，传主仓库 runbook 绝对路径；登记 attempt/模型/任务标识后置 dispatched，挂新 watchdog。
5. 等通知；仅该 Ticket Merger 完整验收后才移除其已处理 runbook。

### 权限门

拒绝或缺授权时保留现场与槽，报告具体动作并等待用户。授权恢复继续原角色；无限恢复不通过重派、换角色、控制者代做或修改权限绕过此门。

### Merger 恢复

主仓库 REPO/TARGET_BRANCH 保留当前 merge 单元、Ticket 槽、merge index、dirty 与既有 commits。单元 runbook 为 docs/afk-failures/merge-{UNIT_ID}.md；控制者写入，stage 固定 merge，按模型契约累计失败。

精确持久化：unit_id、Ticket/branch/worktree、reviewed_sha、review_base_sha、target_before_sha、merge/result SHA、test 命令与 exit/受测 SHA、summary SHA/message、closed/cleaned 验收、当前中断点。任何身份不明先核实，不从摘要文字猜成功。

确认旧 Merger 及子进程退出后原现场重派，只传同单元与 runbook；部分完成逐项核实后继续。未完成单元持有主仓库，后续 Merger 排队；独立 Implementer/Reviewer 可使用剩余槽继续。合并/测试/关闭/清理算法见模板。

## Watchdog

watchdog.sh <worktree> [idle-seconds=600] 观察文件 mtime 与 Git reflog；超时只是存活核实信号，不证明 agent 死亡。每个 attempt 后台启动并登记标识，角色完成先停观察器。超时检查任务状态/最近输出；只读审查或长测试有进展则重挂，核实停滞且旧写者退出才恢复。WatchdogObservationError 只修观察器，不重派存活角色、不升级模型。Planner/Merger 观察主仓库，Ticket 角色观察对应 worktree。等待通知驱动，不忙轮询。

## Worktrunk

- 新建：wt switch -c <branch> -b <base> --no-cd --format=json
- 复用：wt switch <branch> --no-cd --format=json
- 查询：wt list --format=json
- 仅合并后本单元清理：wt remove <branch> -D --foreground

Git 负责 ref/commit/diff 与拓扑 merge；worktree 生命周期只用 Worktrunk。恢复不带 create，不新建第二现场。

## 运行时文件与 clean 边界

控制者登记本次 plan、dispatch 与逐个 runbook 准确路径；保持未跟踪、未暂存，不进入角色 commits。同路径已有文件先读取：同运行恢复；其他运行/用户文件/已跟踪文件暂停报告冲突。

Clean 指除上述准确登记路径外，无未提交改动、未跟踪交付物、暂存差异或未解决 merge；不豁免整个 docs/ 或所有 untracked。新运行初始 clean；恢复保留可归属的实现/merge 现场，对无法归属改动暂停确认。

清理仅本次实际执行 Ticket 的登记现场及用途完成的运行文件；initial_closed 审计节点和其他活动 worktree 不在范围。目录为空才删除。部分中断保留未完成证据；收尾不通配清理所有 afk/issue-*。

## Merger

reviewed 即排队，主仓库可交接且 Merger 空闲即分派一个单 Ticket 合并单元。精确输入与恢复记录按上一节；算法只在 [Merger 模板](reference/merger-prompt.md)维护。通知完整验收后 done、释放槽、立即解锁下游。

SPEC 由控制者收尾分页读全部 sub-issues，全 CLOSED 才关闭。流程不 push、不创建 PR、不自动同步 origin；冲突按两侧意图处理，不偏向单侧。

## 主窗口预算

模板自加载，寻址注入，极简汇报，通知驱动，恢复落盘。角色自行读取上下文，控制者只传路径与参数。

## CONTEXT.md

角色优先根 CONTEXT.md，缺失读 CLAUDE.md 与相关 docs/adr/；控制者不复制材料。

## Scripts

| 脚本 | 完成标准 |
|---|---|
| validate-plan.sh [--expected-run-id ID] [--expected-roots N,N] [--live] <plan> | schema/来源/唯一性/branch/闭包/无环；live 匹配初始 GitHub 快照 |
| dispatched-count.sh <plan> | 输出 dispatched+recovering，超四槽失败 |
| watchdog.sh <worktree> [idle] | 正常静默；超时 exit 1 待核实；观察错误 exit 2 |
| tests.sh | 黑盒测试全部通过 |
