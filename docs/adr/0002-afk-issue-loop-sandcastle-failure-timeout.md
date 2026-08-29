# afk-issue-loop watchdog 与现场保全

> 状态：恢复策略已被 [ADR 0003](0003-afk-issue-loop-native-dag-recovery.md) supersede。本文的 watchdog、runbook 与现场保全仍有效；零自动重试、`failed` 终态和人工处置已失效。

AFK 需要区分长任务与失活 agent，并在终止失活进程时保留进度。决定用 watchdog 取代 wall-clock 复杂度分级：

- 每次角色分派启动 `watchdog.sh`；
- 以 worktree 文件 mtime 与 Git reflog 的最新时间作为活性；
- 600 秒无活动时输出 `AgentIdleTimeoutError`；
- agent 完成通知先到时终止对应 watchdog；
- 两种载体共享同一超时语义；
- 失败现场保留 branch、Worktrunk worktree、commits 与未提交改动；
- runbook 记录恢复所需事实。

## Considered Options

- **复杂度分级一次性计时器**：拒绝。长测试会被误杀，判据应是 idle。
- **stdout idle timeout**：Agent 工具不暴露子代理流式 stdout，采用文件与 reflog 活性近似。
- **completion grace**：未采用；本架构的完成通知表示角色进程已退出。
- **直接丢弃现场**：拒绝。确定性 branch 与 Worktrunk worktree 允许后续 agent 续跑。

## Consequences

- 纯思考超过 600 秒且不落盘可能误判；自动恢复会从保留现场继续。
- watchdog 只判断 hang；角色成功仍由 completion signal 与控制者验收共同决定。
- 恢复次数、状态和槽位由 ADR 0003 定义。
