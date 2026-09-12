# afk-issue-loop watchdog 与现场保全

> **现行优先级：以 [SPEC #8](https://github.com/toRolex/rolex-skills/issues/8) / [ADR 0005](0005-afk-sandcastle-source-reuse.md) 为准。** 以下“无 completion grace”“未采用”与旧状态保留为历史，不再是现行要求。现行是信号前600秒 stdout idle、COMPLETE 后默认60秒 grace，后续真实 stdout 续期；dirty 保留，clean 任务目录可安全清理但保留分支。终止确认边界见 [工作现场](../../skills/personal/afk-issue-loop/reference/workspace-binding.md)。

> **历史决策，现行替代范围见 [Issue #7](https://github.com/toRolex/rolex-skills/issues/7) / [ADR 0004](0004-afk-local-cli-orchestrator.md)。** 以下旧状态与正文仅记录当时结论。watchdog.sh、mtime/reflog 活性近似、原生载体通知及 runbook 恢复已替代为脚本持有真实 stdout、每执行 600 秒 idle 和实际进程终止确认；完成文本不代表退出，无 completion grace。保留分支、commits 与 dirty 现场的原则仍有效。

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
