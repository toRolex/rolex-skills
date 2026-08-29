# sandcastle vs afk-issue-loop：现行差异

基准：sandcastle `parallel-planner-with-review`。两者共享四角色、Implementer→Reviewer 同现场串行、跨 Ticket ≤4、barrier Merger、`git merge --no-edit` 与 Merger 统一关闭 Ticket。

| 维度 | sandcastle | afk-issue-loop |
|---|---|---|
| 编排器 | TypeScript `main.mts` | 当前 Claude 会话（控制者） |
| Planner | 每轮重 plan，输出当前 unblocked | 开头一次，输出完整 Execution DAG 并落盘 |
| Issue 关系 | Planner 从文本推断 | GitHub 原生 parent/sub-issue 与 `blocked_by` |
| 输入 | 扫描 open `ready-for-agent` | 显式 Ticket numbers；未给时默认扫描 |
| 隔离 | sandcastle sandbox + 内部 worktree | subagent/herdr + Worktrunk worktree |
| 状态恢复 | 失败结果从本轮过滤 | 同 branch/worktree/runbook 无限自动恢复 |
| 超时 | 引擎 stdout idle timeout | 文件 mtime + reflog watchdog |
| SPEC | Merger prompt 识别父 PRD | 原生 parent 只供上下文；全部 sub-issues closed 后关闭 |
| Plan 校验 | Zod 输出校验 | bash+jq schema/拓扑校验 + GitHub live 校验 |
| Summary commit | 一条 summarizing commit | 每批固定一条 `--allow-empty` summary commit |

AFK 的 Worktrunk 适配：

```text
新 Ticket       wt switch -c afk/issue-N -b TARGET --no-cd --format=json
恢复/复用       wt switch afk/issue-N --no-cd --format=json
查询            wt list --format=json
合并后清理      wt remove afk/issue-N -D --foreground
```

现行协议以 `skills/personal/afk-issue-loop/SKILL.md` 与 `REFERENCE.md` 为准；sandcastle 原始源码调研见 `sandcastle-original-design.md`。
