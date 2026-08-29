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

`validate-plan.sh` 先做离线 schema/拓扑校验；`--live` 再对 GitHub 逐节点验证 state、label、parent 与 open blockers 闭包。Plan 只有 exit 0 才可执行。

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
| 任一角色失败 | `dispatched → recovering` | 更新 runbook，立即重派同角色 |
| 恢复角色已分派 | `recovering → dispatched` | 保持原 stage |
| Merger 验证通过 | `dispatched → done`，`stage=merge` | 下游在下一批解锁 |

**槽位**按 Ticket 管线计数：`dispatched + recovering`。Implementer、Reviewer、等待 barrier 与恢复循环都占同一个 Ticket 槽；最大值为 4。Merger 处理当前批次，不另占 Ticket 槽。

**Barrier**：本批开始后不追加新 Ticket。全部批次节点到达 `stage=merge` 才调用一次 Merger；Merger 验证后再计算下一批 frontier。这与 sandcastle `Promise.allSettled → Merger` 的批次边界一致。

## 协议信号

- Planner：`<plan>{...}</plan>`，内容与落盘 JSON 相同。
- Implementer / Reviewer / Merger：`<promise>COMPLETE</promise>`。
- 完成信号必须与角色门槛同时成立；控制者以 branch、tests/commits、GitHub state 与 Worktrunk 状态交叉验证。
- `DONE_WITH_CONCERNS`、`NEEDS_CONTEXT`、`BLOCKED` 对 Implementer、Reviewer、Merger进入自动恢复；Planner 的 `BLOCKED` 是输入资格门，立即终止本次运行。

## 自动恢复

### Ticket 角色恢复

恢复是 Implementer / Reviewer 失败时的自动续跑循环：**同 branch、同 Worktrunk worktree、同 stage、同槽位**。

### 触发

- agent 抛错：`AgentError`
- watchdog 判死：`AgentIdleTimeoutError`
- 缺少 `<promise>COMPLETE</promise>`
- Implementer 正常退出但分支相对 `${TARGET_BRANCH}` 无 commit
- 角色报告 `DONE_WITH_CONCERNS`、`NEEDS_CONTEXT` 或 `BLOCKED`

### Runbook

首次失败创建、后续失败追加 `docs/afk-failures/issue-{N}.md`：

```markdown
branch: afk/issue-{N}
worktree: <绝对路径>
stage: implement | review | merge
attempts: <累计失败次数>

## 最近失败
error: AgentIdleTimeoutError | AgentError | IncompleteResult
summary: <错误或疑虑>
commits: <git log --oneline TARGET_BRANCH..BRANCH>

## 恢复
Read docs/afk-failures/issue-{N}.md；在同一 branch/worktree 从当前现场继续，保留已有 commits 与未提交改动。
```

恢复步骤：

1. 杀掉对应 watchdog；需要时停止失活 agent。
2. Read 或创建 runbook，递增 `attempts`，记录当前 stage、错误和 commit 快照。
3. 节点置为 `recovering`。
4. 使用 `wt switch afk/issue-{N} --no-cd --format=json` 找回 worktree。
5. 原角色 prompt 后附 runbook 指针，立即重派；节点置回 `dispatched`。
6. 挂新 watchdog，等待通知。

恢复无次数上限。该 Ticket 的下游在它 `done` 前保持 blocked；其他已分派 Ticket 独立推进。成功并由 Merger验证后删除对应 runbook。

### Merger 批次恢复

Merger 在主仓库 `REPO/TARGET_BRANCH` 恢复，不执行 Ticket 角色的 `wt switch` 步骤：

1. 保留 merge index、工作树改动和已完成 commits，更新批次 runbook。
2. 在主仓库立即重派 Merger。
3. 对仍存在的 branch 检查 ancestor；已删除 branch 由目标分支历史与同一 `run_id` 的 summary 证明已完成。
4. summary 已存在时先关闭本批任何仍 OPEN 的 Ticket，再进入清理；清理循环根据 `wt list` 跳过已移除项。

Merger 恢复同样无次数上限，但不占用或重建 Ticket worktree。

## Watchdog

`watchdog.sh <worktree> [idle-seconds=600]` 是两种载体统一的 hang detector：

- 取 worktree 文件 mtime 与 Git reflog 的最新时间；600 秒无变化时输出一行 `AgentIdleTimeoutError` 并 exit 1。
- 分派时后台启动；agent 完成通知先到时终止对应 watchdog。
- watchdog 只判断无活动；角色结果由完成信号和控制者验收判断。
- 每次自动恢复启动新的 watchdog。

等待由通知驱动。控制者分派并挂 watchdog 后停手，等 agent 或 watchdog 通知。

## Worktrunk

Worktree 生命周期只通过 Worktrunk：

- 新 branch：`wt switch -c <branch> -b <base> --no-cd --format=json`
- 已有 branch/worktree：`wt switch <branch> --no-cd --format=json`
- 查询：`wt list --format=json`
- 合并后清理：`wt remove <branch> -D --foreground`

`--create` 仅用于新 branch；恢复路径使用不带 `--create` 的 `wt switch`。Git 负责 branch ref 检查、commit、diff 与 `git merge --no-edit`。

## Merger

Merger 在主仓库已检出的 `${TARGET_BRANCH}` 上幂等处理当前批次：

1. 按 issue number 稳定排序。分支尚未成为目标分支 ancestor 时执行 `git merge <branch> --no-edit`；已合入则继续验证。
2. 每个分支集成后解决冲突并跑全量测试；Ticket 仍 OPEN 时关闭。
3. 全批完成后用稳定 message 检查并固定执行一次空 summary commit：

   ```bash
   SUMMARY="chore: 汇总 AFK ${RUN_ID} 批次 #42, #43"
   git log --format=%s --fixed-strings --grep="$SUMMARY" | grep -Fxq "$SUMMARY" || \
     git commit --allow-empty -m "$SUMMARY"
   ```

4. summary commit 存在且全批测试通过后，用 Worktrunk 清理所有批次 branches。

分支清理位于批次末尾，因此 merge/test/summary 中途恢复仍有 branch 可用于 ancestor 验证；清理阶段重派则根据 `wt list --format=json` 跳过已清理项。

SPEC 关闭在控制者收尾阶段进行：分页读取每个 SPEC 的全部原生 sub-issues，全部 CLOSED 后关闭 SPEC。

远端保持不变：流程不 push、不创建 PR、不自动同步 `origin/${TARGET_BRANCH}`。冲突根据两侧意图解决，不使用偏向单侧的 strategy option。

## 主窗口预算

- **模板自加载**：分派 prompt 只传模板路径与参数。
- **寻址注入**：角色自行读取 Ticket、SPEC、CONTEXT、ADR 与规范。
- **极简汇报**：角色只回完成信号、状态及一行疑虑；事实留在环境中供控制者自查。
- **通知驱动**：等待依靠 agent/watchdog 通知。
- **Plan 落盘**：compact 或 `--resume` 后 Read `docs/afk-plan.json` 重建状态。

## CONTEXT.md

角色优先读取根 `CONTEXT.md`；缺失时读取 `CLAUDE.md` 与相关 `docs/adr/`。控制者只传路径，不复制内容。

## Scripts

| 脚本 | Completion criterion |
|---|---|
| `validate-plan.sh [--expected-run-id ID] [--expected-roots N,N] [--live] <plan.json>` | schema、运行标识、显式 roots、唯一性、branch、状态、闭包与无环全部通过；live 模式同时匹配 GitHub 原生关系 |
| `dispatched-count.sh <plan.json>` | 输出 `dispatched + recovering` 节点数 |
| `watchdog.sh <worktree> [idle]` | 有活动时静默运行；超时输出死因并 exit 1 |
| `tests.sh` | 所有脚本黑盒用例通过，最终 exit 0 |
