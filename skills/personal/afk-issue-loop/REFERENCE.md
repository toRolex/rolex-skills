# AFK Issue Loop — Reference

本文件是关系、状态、槽位、恢复和合并契约的 single source of truth。顺序步骤留在 [SKILL.md](SKILL.md)；角色独有规则留在 `reference/*-prompt.md`。

## Execution DAG

### 输入闭包

- **初始 Tickets**：用户显式传入的 issue numbers；未传入时为全部 open `ready-for-agent` Issues。
- **原生权威**：每个 Ticket 的依赖来自 GitHub `GET /repos/{owner}/{repo}/issues/{number}/dependencies/blocked_by`。
- **递归闭包**：每个 open blocker 进入 `issues`，继续读取它的 open blockers，直到闭包稳定。
- **资格门**：每个 open 执行节点都带 `ready-for-agent`。发现缺少标签的 open blocker时，Planner 输出 `BLOCKED` 并保持既有 plan 不变。
- **已完成依赖**：closed blocker 视为已满足，不进入 `issues` 或 `blocked_by`；仅当 closed Ticket 本身属于初始输入时，以 `done` 节点保留以支持续跑。
- **SPEC 上下文**：GitHub parent 是 SPEC。SPEC 写入顶层 `specs`，供角色读取；SPEC 不建 branch、不占槽、不进入 `issues`。

GitHub 原生 API 路径：

```text
GET /repos/{owner}/{repo}/issues/{number}/parent
GET /repos/{owner}/{repo}/issues/{number}/sub_issues?per_page=100&page=N
GET /repos/{owner}/{repo}/issues/{number}/dependencies/blocked_by?per_page=100&page=N
```

数组端点使用 `gh api --paginate --slurp` 读取全部页；默认扫描同样分页读取 Issues API，并过滤含 `pull_request` 字段的对象。GitHub 命令接线的仓库级约定见 `docs/agents/issue-tracker.md`。

### Plan schema

```json
{
  "version": 1,
  "run_id": "20260829T120000Z-12345",
  "target_branch": "main",
  "roots": [42, 44],
  "specs": [
    {"number": 10, "title": "Verbose mode SPEC"}
  ],
  "issues": [
    {
      "number": 42,
      "title": "Add verbose flag",
      "branch": "afk/issue-42",
      "spec": 10,
      "blocked_by": [],
      "status": "pending",
      "stage": "implement"
    }
  ]
}
```

不变量：

- `version == 1`；`run_id` 是本次 AFK 运行的唯一字符串标识；`target_branch` 为 `main` 或 `develop`。
- `roots` 去重；每个 root 在 `issues` 中恰好出现一次。
- `issues[].number` 唯一；`branch` 精确等于 `afk/issue-{number}`。
- `spec` 为 parent issue number 或 `null`；`specs[].number` 唯一，且不与执行节点重叠。
- `blocked_by` 在 Planner 初始生成时只列当时 open 的 blockers；运行中保留这些边，blocker 节点可转为 `done`，控制者据此解锁下游。
- status 属于 `pending | dispatched | recovering | done`。
- stage 属于 `implement | review | merge`。

`validate-plan.sh` 先做离线 schema/拓扑校验；`--live` 用于 Planner 初始验收，对 GitHub 逐节点验证 state、label、parent 与 open blockers 闭包。初始 plan 只有 exit 0 才可执行。运行中保留建图时的 roots 与依赖边，恢复先做离线校验，再按当前角色门槛核对 GitHub 与现场；初始快照的 `--live` 比较不用于运行中验收。

## 状态与槽位

Plan 节点状态与角色汇报状态是两套不同概念：

- **Plan status**：`pending | dispatched | recovering | done`
- **角色状态**：`DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED`

状态转换：

| 事件 | 转换 | 控制者动作 |
|---|---|---|
| frontier 分派 Implementer | `pending → dispatched`，`stage=implement` | 创建/复用 worktree，挂 watchdog |
| Implementer 完成 | 保持 `dispatched`，`stage=review` | 同现场分派 Reviewer |
| Reviewer 完成 | 保持 `dispatched`，`stage=merge` | 等本批 barrier |
| 任一角色失败 | `dispatched → recovering` | 按自动恢复契约更新 runbook、接管现场并重派 |
| 恢复角色已分派 | `recovering → dispatched` | 保持原 stage |
| Merger 验证通过 | `dispatched → done`，`stage=merge` | 下游在下一批解锁 |

**槽位**按 Ticket 管线计数：`dispatched + recovering`。Implementer、Reviewer、等待 barrier 与恢复循环都占同一个 Ticket 槽；最大值为 4。Merger 处理当前批次，不另占 Ticket 槽。

**Barrier**：本批开始后不追加新 Ticket。全部批次节点到达 `stage=merge` 才调用一次 Merger；Merger 验证后再计算下一批 frontier。这与 sandcastle `Promise.allSettled → Merger` 的批次边界一致。

### 进度快照

建批、进入 barrier 等待、发生恢复/权限阻塞或用户询问时，简报当前批次、占用槽位 `/4`、各 Ticket 的 stage 与等待对象。把“等待本批慢 Ticket”和“被依赖阻塞”分开；复用事件通知、plan 与当前实例记录生成简报。

## 协议信号

- Planner：`<plan>{...}</plan>`，内容与落盘 JSON 相同。
- Implementer / Reviewer / Merger：`<promise>COMPLETE</promise>`。
- 完成信号必须与角色门槛同时成立；控制者以 branch、tests/commits、GitHub state 与 Worktrunk 状态交叉验证。
- `DONE_WITH_CONCERNS`、`NEEDS_CONTEXT`、`BLOCKED` 对 Implementer、Reviewer、Merger 按[自动恢复](#自动恢复)分流；授权受阻走权限门。Planner 的 `BLOCKED` 是输入资格门，立即终止本次运行。

## 自动恢复

恢复角色由失败 stage 唯一确定：implement → Implementer、review → Reviewer、merge → Merger。测试失败原因写入该角色的 runbook，由原角色处理。已授权的执行失败恢复无次数上限；授权受阻先走[权限门](#权限门)。

### 现场所有权与分派记录

**Single-writer**：一个 worktree 同时只有一个写入角色。角色交接或自动重派前，确认前一实例及其写入子进程已退出；无法确认时保留槽位，继续核实，不启动第二个写入者。

控制者在 `docs/afk-dispatch.json` 原子保存运行记录：`run_id`、`mode`、主仓库绝对路径、当前批次、运行时文件准确路径清单，以及每个角色的 Ticket/批次、stage、attempt、载体任务标识、watchdog 标识、验收标记和 worktree/runbook 绝对路径。分派前落盘角色与递增 attempt，返回后补齐任务标识；只有匹配当前 `run_id + Ticket/批次 + stage + attempt + 任务标识` 且尚未验收的通知可以推进状态。验收后关闭该记录；旧通知与重复通知只归档。

**恢复会话**：先读取 plan 与分派记录，核对仓库、运行标识和载体中的任务状态。存活实例继续等待；已退出实例按完成门槛验收或恢复。缺失任务标识时先查载体与现场，确认无旧写入者再重派。沿用已有 plan 的状态与批次，恢复时跳过 Planner。

### Ticket 角色恢复

恢复是 Implementer / Reviewer 失败时的自动续跑循环：**同 branch、同 Worktrunk worktree、同 stage、同槽位**。

#### 触发

- agent 抛错：`AgentError`
- watchdog 超时后核实停滞：`AgentIdleTimeoutError`
- 缺少 `<promise>COMPLETE</promise>`
- Implementer 正常退出但分支相对 `${TARGET_BRANCH}` 无 commit
- 角色报告 `DONE_WITH_CONCERNS`、`NEEDS_CONTEXT` 或 `BLOCKED`

#### Runbook

首次失败创建、后续失败追加 `docs/afk-failures/issue-{N}.md`：

```markdown
branch: afk/issue-{N}
worktree: <绝对路径>
stage: implement | review
attempts: <累计失败次数>

## 最近失败
error: AgentIdleTimeoutError | AgentError | IncompleteResult
summary: <错误或疑虑>
commits: <git log --oneline TARGET_BRANCH..BRANCH>

## 恢复
Read docs/afk-failures/issue-{N}.md；在同一 branch/worktree 从当前现场继续，保留已有 commits 与未提交改动。
```

恢复步骤：

1. 停止对应 watchdog；按现场所有权契约确认旧角色及其写入子进程已退出。
2. Read 或创建 runbook，递增 `attempts`，记录当前 stage、错误和 commit 快照。
3. 节点置为 `recovering`。
4. 使用 `wt switch afk/issue-{N} --no-cd --format=json` 找回 worktree。
5. 原角色 prompt 后附主仓库中 runbook 的绝对路径，立即重派；登记新实例后将节点置回 `dispatched`。
6. 挂新 watchdog，等待通知。

该 Ticket 的下游在它 `done` 前保持 blocked；其他已分派 Ticket 独立推进。成功并由 Merger 验证后删除对应 runbook。

### 权限门

授权拒绝或缺失时，保留现场与槽位，报告被阻止的具体动作并等待用户授权；授权恢复后继续原角色。无限恢复适用于已授权动作的执行失败，不通过重派、换角色、控制者代做或修改权限来绕过权限门。

### Merger 批次恢复

Merger 在主仓库 `REPO/TARGET_BRANCH` 恢复，保留当前批次与 Ticket 槽位：

1. 按现场所有权契约确认旧实例退出，保留 merge index、工作树改动和已完成 commits，更新批次 runbook。
2. 在主仓库重派 [Merger](reference/merger-prompt.md)，传入 runbook 绝对路径并登记新实例。
3. 挂新 watchdog，按模板完成门槛验收；中断点识别与批末清理由 Merger 执行。

## Watchdog

`watchdog.sh <worktree> [idle-seconds=600]` 是两种载体统一的文件活动观察器：

- 取 worktree 文件 mtime 与 Git reflog 的最新时间；600 秒无变化时输出一行 `AgentIdleTimeoutError` 并 exit 1。这是存活核实信号，不单独证明 agent 已死亡。
- 分派时后台启动并登记任务标识；agent 完成通知先到时终止对应 watchdog。
- 超时后检查当前实例的任务状态与最近输出。只读审查、长测试仍有进展时重新挂 watchdog；确认停滞后按现场所有权契约停止旧实例，再自动恢复。
- `WatchdogObservationError` 或其他观察器启动/读取失败只修复观察器；不据此重派仍存活的角色。
- Planner 以主仓库、Merger 以主仓库目标分支为观察目录；每次自动恢复启动新的 watchdog。

等待由通知驱动。控制者分派并挂 watchdog 后停手，等 agent 或 watchdog 通知。

## Worktrunk

Worktree 生命周期只通过 Worktrunk：

- 新 branch：`wt switch -c <branch> -b <base> --no-cd --format=json`
- 已有 branch/worktree：`wt switch <branch> --no-cd --format=json`
- 查询：`wt list --format=json`
- 合并后清理：`wt remove <branch> -D --foreground`

`--create` 仅用于新 branch；恢复路径使用不带 `--create` 的 `wt switch`。Git 负责 branch ref 检查、commit、diff 与 `git merge --no-edit`。

## 运行时文件与 clean 边界

控制者登记本次创建的 `docs/afk-plan.json`、`docs/afk-dispatch.json` 与逐个 runbook 的准确路径。它们保持未跟踪、未暂存，只用于恢复，不进入角色 commits。启动发现同路径已有内容时先读取：属于同一运行则恢复；属于其他运行、用户文件或已跟踪文件则暂停并报告冲突。

**Clean**：除上述明确登记的运行时文件外，目标仓库及 Ticket worktree 没有未提交改动或未跟踪交付物，无暂存差异且无未解决 merge。只按登记路径排除，不整体豁免 `docs/` 或所有 untracked 文件。新运行检查初始 clean；恢复先核对所有权并保留本次角色的未提交实现与 merge 现场，仅对无法归属的改动暂停并请用户处理。

收尾仅删除本次登记且已完成用途的运行时文件；目录为空时才移除目录。

## Merger

控制者在本批全部到达 `stage=merge` 后，将主仓库 `${TARGET_BRANCH}` 交给一个 Merger。分派或恢复时读取 [Merger 模板](reference/merger-prompt.md)；合并、测试、summary 与清理算法只在该模板维护。

完成通知按模板门槛验收，通过后才将本批节点置为 `done` 并解锁下一批。

SPEC 关闭在控制者收尾阶段进行：分页读取每个 SPEC 的全部原生 sub-issues，全部 CLOSED 后关闭 SPEC。

远端保持不变：流程不 push、不创建 PR、不自动同步 `origin/${TARGET_BRANCH}`。冲突根据两侧意图解决，不使用偏向单侧的 strategy option。

## 主窗口预算

- **模板自加载**：分派 prompt 只传模板路径与参数。
- **寻址注入**：角色自行读取 Ticket、SPEC、CONTEXT、ADR 与规范。
- **极简汇报**：角色只回完成信号、状态及一行疑虑；事实留在环境中供控制者自查。
- **通知驱动**：等待依靠 agent/watchdog 通知。
- **恢复落盘**：compact 或 `--resume` 后按“恢复会话”核对 plan、分派记录与载体现场。

## CONTEXT.md

角色优先读取根 `CONTEXT.md`；缺失时读取 `CLAUDE.md` 与相关 `docs/adr/`。控制者只传路径，不复制内容。

## Scripts

| 脚本 | Completion criterion |
|---|---|
| `validate-plan.sh [--expected-run-id ID] [--expected-roots N,N] [--live] <plan.json>` | schema、运行标识、显式 roots、唯一性、branch、状态、闭包与无环全部通过；live 模式同时匹配 GitHub 原生关系 |
| `dispatched-count.sh <plan.json>` | 输出 `dispatched + recovering` 节点数 |
| `watchdog.sh <worktree> [idle]` | 有活动时静默运行；超时输出待核实信号并 exit 1；观察错误 exit 2 |
| `tests.sh` | 所有脚本黑盒用例通过，最终 exit 0 |
