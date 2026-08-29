# afk-issue-loop 失败与超时机制对齐 sandcastle

ADR 0001 的两条款在 AFK 实测语义下被证伪，本 ADR 记录修订。修订内容：**「原地重试」改为零自动重试 + runbook**（失败即标 `failed`、现场保全、落盘 `docs/afk-failures/issue-{N}.md`、不传染下游，收尾交用户逐条处置；恢复 = 同分支同 worktree 重新分派并附 runbook 指引句）；**「超时只挂一次性计时器」改为 watchdog**（每次分派挂后台脚本盯 worktree 文件活性——文件 mtime + git reflog，600s 无活性才退出并输出一行死因，取代按复杂度分级的 2-20 分钟一次性计时器）；**herdr 模式同步去轮询**（两载体统一 watchdog，`reference/herdr-notes.md` 删除，CLI 细节归 herdr skill）。ADR 0001 的其余部分（模板自加载 / 寻址注入 / 极简汇报 / 禁轮询 / plan 落盘 / 统一 sonnet）不变，且禁轮询因 herdr 去轮询而更彻底。

## Considered Options

- **保留复杂度分级一次性计时器**：拒绝。按 wall-clock 拍脑袋会在长任务（如 25 分钟全量测试）误杀正常 agent；真正判据是「无活动」（idle）。
- **移植 sandcastle 的 stdout idle timeout**：不可行。Agent 工具不暴露子代理流式输出，只能盯文件系统活性（文件 mtime + reflog）；已知差距是 agent 长时间纯思考不落盘会误判，600s 阈值下概率低。
- **失败原地自动重试（保留次数上限）**：拒绝。AFK 场景下任何自动重试都可能在用户不在场时烧 token；对齐 sandcastle fail-fast 零重试 + 现场保全，处置权交回人。
- **恢复用 sandcastle `resume()`**：拒绝。其全仓库仅用于 structured output 重试与 produce→extract 两段式，失败恢复零用例；真实恢复姿势是确定性分支名 + worktree 复用捡回已 commit 进度。
- **completion grace 60s（sandcastle ADR 0019）**：显式排除。其场景是「signal 已发出但进程挂起不退」，本架构的完成终点是进程已退的系统通知，中间态不存在。
- **拓扑切片 / status 状态机 / 收尾验证 / 分派锁脚本化**：拒绝（「sandcastle 没有就不要」；分派锁对齐的 ADR 0007 在 sandcastle main 分支未实现）。只落 3 个脚本：plan 校验、watchdog、并行计数。

## Consequences

- 失败不再自动愈合：agent 能力不够的 issue 会停在 `failed` 终态等用户处置，而不是反复尝试——这是意图，不是退化。
- watchdog 误判（纯思考超 600s 不落盘）会以 `AgentIdleTimeoutError` 杀掉健康 agent；现场保全保证不丢进度，恢复路径单条且零思考。
- herdr 操作文档单源化到 herdr skill：afk-issue-loop 不再维护 herdr CLI 细节，两份文档漂移风险消除。
