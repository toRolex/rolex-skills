# AFK 以当前 Git 事实恢复任务现场

依据 [Issue #9](https://github.com/toRolex/rolex-skills/issues/9)，AFK 新 run 不恢复旧进程内存或依赖历史 PID，而在固定 Ticket 范围后根据当前 GitHub 状态、标准 `afk/issue-N` 分支、Worktrunk worktree、writer socket 与目标祖先关系重建交付阶段。唯一标准现场默认恢复，dirty 任务成果保留，活跃或无法确认的写者使本票等待；分支已在目标中时跳过重复 merge，继续验证和关闭。这样可直接继承旧版本留下的代码现场，同时避免以重型 checkpoint 或模型猜测决定所有权。

恢复现场不自动成为本 run 所有；worktree 清理与核心交付分离。目标 dirty 只阻止 Merger，同 run 已通过的 I/R 保留在合并队列，目标恢复 clean 后继续；跨 run 未合并成果重新审查当前状态，已合并成果按祖先事实进入 `merged-unverified`。此决策局部替代 [ADR 0004](0004-afk-local-cli-orchestrator.md) 和 [ADR 0005](0005-afk-sandcastle-source-reuse.md) 中“不支持重启恢复”与旧现场必须逐票 `--reuse` 的边界。
