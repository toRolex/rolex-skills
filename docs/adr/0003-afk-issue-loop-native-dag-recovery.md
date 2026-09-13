# afk-issue-loop 原生 DAG 与自动恢复

> **现行优先级：以 [SPEC #8](https://github.com/toRolex/rolex-skills/issues/8) / [ADR 0005](0005-afk-sandcastle-source-reuse.md) 为准。** 以下四票/四槽与旧状态均为历史；现行一次并发全部就绪票、不补位，无在途或可推进交付且剩余全 blocked 则报告结束，不再 fallback。原生 blocked-by、批末 allSettled 和必要 Merger 续作保留，不恢复范围扩展或旧恢复协议。

> **历史决策，现行替代范围见 [Issue #7](https://github.com/toRolex/rolex-skills/issues/7) / [ADR 0004](0004-afk-local-cli-orchestrator.md)。** 以下旧状态（包括“barrier 被流式合并替代”）仅为历史。现行保留原生 blocked-by 权威，采用固定最多四票、全批 settled barrier、每批一个 summary 后由 Merger 关 Ticket；递归扩大范围、依赖闭包证明、自动关 SPEC、plan/runbook、原阶段立即重派、占槽补位与模型升级均不适用。失败下批可重选复用，未完成合并和 close-only 直接由 Merger 续做。

> 部分 superseded：barrier、每批 summary 与无条件立即重派已由[流式合并决策](../plans/afk-streaming-merge-implementation-notes.md)替代。现行协议见 [REFERENCE](../../skills/personal/afk-issue-loop/REFERENCE.md)。本文保留历史决定；上游 allSettled 是结束后合并成功部分，不要求全部成功，四槽是本地限制而非模板限制。

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
