# AFK 以当前 Git 事实恢复任务现场

> **现行优先级：writer 策略以本文「writer policy」小节为准。** [Issue #10](https://github.com/toRolex/rolex-skills/issues/10) 已把第一段中的“活跃或无法确认的写者使本票等待”改为 liveness-first：只有 ownership channel 明确证明同一 worktree 的 AFK writer 仍在运行才进入 `waiting-writer`，stale/unreachable socket、历史 PID/PGID、`EPERM` 与不完整事件只作观察事实，不再阻止派发。第一段的“唯一标准现场默认恢复、dirty 成果保留、已合入目标则跳过重复 merge”仍然有效。

依据 [Issue #9](https://github.com/toRolex/rolex-skills/issues/9)，AFK 新 run 不恢复旧进程内存或依赖历史 PID，而在固定 Ticket 范围后根据当前 GitHub 状态、标准 `afk/issue-N` 分支、Worktrunk worktree、writer socket 与目标祖先关系重建交付阶段。唯一标准现场默认恢复，dirty 任务成果保留，分支已在目标中时跳过重复 merge，继续验证和关闭。这样可直接继承旧版本留下的代码现场，同时避免以重型 checkpoint 或模型猜测决定所有权。

恢复现场不自动成为本 run 所有；worktree 清理与核心交付分离。~~目标 dirty 只阻止 Merger，同 run 已通过的 I/R 保留在合并队列，目标恢复 clean 后继续~~（**已由 [ADR 0009](0009-afk-target-dirty-does-not-block-merger.md) 替代**：目标工作区有未提交改动不再阻止 Merger，只有未完成的 merge/rebase/冲突才保留现场等待用户）；跨 run 未合并成果重新审查当前状态，已合并成果按祖先事实进入 `merged-unverified`。此决策局部替代 [ADR 0004](0004-afk-local-cli-orchestrator.md) 和 [ADR 0005](0005-afk-sandcastle-source-reuse.md) 中“不支持重启恢复”与旧现场必须逐票 `--reuse` 的边界。

## writer policy：从 conservative unknown-blocking 改为 liveness-first positive detection

[Issue #10](https://github.com/toRolex/rolex-skills/issues/10) 修订了本 ADR 的 writer 部分。

原策略偏向保守安全：writer socket 响应无法确认归属、历史 `role-start` 缺少可核实 PID、历史 PID/PGID 返回 `EPERM`、或历史事件不完整时，都可能永久阻止接管。代价是用户调用 skill 后可能因无法证明旧进程已消失而长期不开工。

现改为 **liveness-first**：只有明确检测到占用同一 worktree 的 AFK writer script 仍在运行——即 writer ownership channel 可连接、响应当前 AFK 标识——才阻止新的 write-capable Role Invocation，使该 Ticket 进入 `waiting-writer`。若没有得到这种正向活跃证明，则默认没有 Implementer、Reviewer 或 Merger 在运行，恢复 Git 现场并继续开工。

- 删除 `unknown writer` 阻塞状态：stale/unreachable socket、未知 socket 响应、历史 PID/PGID、`EPERM` 与不完整历史事件都只作为 Recovery Observation 记录，不再单独阻止派发。
- active writer 消失后，run 定期重新做正向活跃检测并自动恢复派发，无需重新调用 skill。
- 局部 writer 阻碍不冻结其他独立 Ticket。

**被接受的取舍**：旧 daemon 已消失、但其派生的脱离 ownership channel 的子进程仍可能存在的理论风险，换取调用 skill 后默认恢复现场并开工。实现不得偷偷恢复 historical `unknown writer` 阻塞语义。

**仍然有效的不变量**：当前 active recovery guard 继续串行化恢复；多个 worktree、错误仓库绑定、locked/prunable、Git conflict/merge/rebase 等非 writer blocker 沿用既有语义，本决策不授权通过猜测、删除或丢弃现场绕过它们。
