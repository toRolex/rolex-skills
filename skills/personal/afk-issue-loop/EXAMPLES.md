# AFK Issue Loop 示例

只在需要具体演练时读取；行为契约以 [REFERENCE.md](REFERENCE.md) 为准。

## 输入与原生关系

用户运行：

```text
/afk-issue-loop 43 44 mode=subagent
```

GitHub 关系：

- SPEC `#10` 的 sub-issues 为 `#42 #43 #44`；
- `#43` 原生 blocked by `#42`；`#44` 原生 blocked by `#43`；
- `#42` 已 CLOSED，`#43 #44` 为 open `ready-for-agent`。

Planner 写入：

```json
{
  "version": 1,
  "run_id": "20260829T120000Z-12345",
  "target_branch": "main",
  "roots": [43, 44],
  "specs": [{"number": 10, "title": "Verbose mode SPEC"}],
  "issues": [
    {"number": 43, "title": "Wire logger", "branch": "afk/issue-43", "spec": 10, "blocked_by": [], "status": "pending", "stage": "implement"},
    {"number": 44, "title": "Show debug output", "branch": "afk/issue-44", "spec": 10, "blocked_by": [43], "status": "pending", "stage": "implement"}
  ]
}
```

`#42` 是 closed blocker，因此视为已满足，不进入执行节点或 `#43.blocked_by`。若用户把 closed `#42` 也作为显式输入，它才以 `done` root 保留用于续跑审计。

## 第一批：#43

创建 Worktrunk worktree：

```bash
wt switch -c afk/issue-43 -b main --no-cd --format=json
```

控制者将 `#43` 置为 `dispatched/implement`，分派 Implementer 并挂 watchdog。Implementer 完成后，同 worktree 分派 Reviewer；Reviewer 完成后节点为 `dispatched/merge`。

当前批次所有节点到达 merge stage，Merger 执行：

```bash
git merge afk/issue-43 --no-edit
<project full test command>
gh issue close 43
git commit --allow-empty -m "chore: 汇总 AFK 20260829T120000Z-12345 批次 #43"
wt remove afk/issue-43 -D --foreground
```

控制者验证后将 `#43` 置为 `done`，`#44` 进入下一批 frontier。

## 自动恢复

假设 `#44` Implementer 被 watchdog 判死：

1. 控制者保留 `afk/issue-44` worktree 现场，将节点改为 `recovering/implement`。
2. 创建或追加：

```markdown
branch: afk/issue-44
worktree: /path/to/afk-issue-44
stage: implement
attempts: 1

## 最近失败
error: AgentIdleTimeoutError
summary: worktree 600s 无活动
commits: a1b2c3d 实现 debug 输出骨架
```

3. `wt switch afk/issue-44 --no-cd --format=json` 找回原 worktree。
4. 在 Implementer prompt 附 `RUNBOOK=docs/afk-failures/issue-44.md`，立即重派并将节点置回 `dispatched`。
5. 同时运行的独立 Tickets 使用剩余槽继续；依赖 `#44` 的 Tickets 保持 blocked。
6. 失败再次发生时追加 runbook 并继续同一循环，无次数上限。

恢复成功后正常进入 Reviewer 与 Merger。Merger验证通过后删除 `issue-44.md`。

## 关闭 SPEC

`#44` CLOSED 后，控制者分页读取 `#10/sub_issues`。当 `#42 #43 #44` 全部 CLOSED：

```bash
gh issue close 10
```

随后验证全部 plan 节点 done、AFK worktrees 已清理，删除 `docs/afk-plan.json`，提示 code review 与 QA。

## 阻塞资格门

若 `#44` 递归依赖 open `#41`，但 `#41` 没有 `ready-for-agent`，Planner 输出：

```text
BLOCKED — open blocker #41 缺少 ready-for-agent
```

本次执行不开始，也不覆盖已有 plan。补齐 Ticket 后重新运行 skill。
