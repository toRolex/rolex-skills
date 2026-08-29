# afk-issue-loop 原生 DAG 与自动恢复

AFK 的输入已经由 SPEC 拆成 GitHub Ticket，并通过原生 parent/sub-issue 与 issue dependencies 表达关系。旧 Planner 又从正文推断依赖，旧失败流程停在 `failed` 等待用户；两者分别引入双重真相和无人值守中断。

决定：

- 初始 Tickets 来自显式 issue numbers；未给定时扫描 open `ready-for-agent`。
- GitHub 原生 `blocked_by` 是依赖权威；open blockers 递归纳入，closed blockers 视为已满足。
- 每个 open 执行节点都必须带 `ready-for-agent`；缺少标签时 Planner 停止。
- 原生 parent 是 SPEC，只提供上下文；全部原生 sub-issues 关闭后自动关闭 SPEC。
- Plan 状态为 `pending / dispatched / recovering / done`。
- 失败后保留现场并写 runbook，在同 branch、同 Worktrunk worktree、同 stage 立即自动重派。
- 自动恢复无次数上限；Ticket 持续占原槽，其下游保持 blocked，独立 Ticket 使用剩余槽推进。
- 每批遵循 sandcastle barrier：批内 Ticket 管线全部到达 merge stage 后，由一个 Merger 拓扑合并。
- 每个 AFK 运行生成并持久化唯一 `run_id`；批次 summary message 包含 `run_id`，避免重开同一 Ticket 时命中历史 summary。
- 每批固定生成一个 `--allow-empty` summary commit。

## Considered Options

- **Planner 推断资源/空间/契约依赖**：拒绝。原生 dependencies 已是可见、可查询的权威关系。
- **SPEC 进入执行 DAG**：拒绝。SPEC 没有实现 branch，只承担上下文与聚合完成。
- **用户手动恢复**：拒绝。AFK 的目标是无人值守完成。
- **有限自动重试**：拒绝。恢复应持续捡起保留现场，直至 completion criterion 成立。
- **失败时释放槽位**：拒绝。Ticket 管线尚未完成，释放会突破 ≤4 的真实并行边界。
- **恢复时创建新 worktree**：拒绝。Worktrunk 通过确定性 branch 找回原现场。

## Consequences

- `failed` 不再是 Plan 状态；历史 runbook 变成自动恢复输入。
- `dispatched-count.sh` 统计 `dispatched + recovering`。
- 控制者只有在全部节点 `done` 时正常结束；frontier 暂空但仍有 active 节点时继续等待。
- `validate-plan.sh --live` 核对 GitHub state、labels、parent 与 open blockers 闭包。
- ADR 0002 的零自动重试、人工处置与 `failed` 终态被本文 supersede；watchdog 与现场保全继续有效。
