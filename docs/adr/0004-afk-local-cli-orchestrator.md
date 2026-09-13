# AFK 改为独立本地 CLI 编排

> Pi 模型/effort 的省略默认另由 [ADR 0006](0006-afk-permission-model-defaults.md) 局部替代；下文保留当时决策。

> **部分被 [ADR 0005](0005-afk-sandcastle-source-reuse.md) / [SPEC #8](https://github.com/toRolex/rolex-skills/issues/8) 替代。** 独立本机 CLI、固定范围、Worktrunk、单 Merger 与 close-only 继续有效；下文“最多四票”“无 completion grace”仅保留 #7 当时决定。现行改为全部就绪票一次并发、删除全 blocked fallback、恢复可续60秒 grace、函数级源码提取与三原版中文模板。上游已存在 no-sandbox，本机无 Docker 并不要求全面重写。历史实施与验收记录不改写，也不代表 #8 已通过。

依据 [Issue #7](https://github.com/toRolex/rolex-skills/issues/7)，保留同名 user-invoked skill，仅由它解析输入、启动独立脚本并报告身份、日志和停止方式；脚本是唯一调度者，通过本机 CLI 执行三种角色。相比宿主原生子代理调度，这使发起会话结束不再决定后续批次生命周期，并让脚本直接掌握真实 stdout、每执行 600 秒 idle 与终止确认；相比 Sandcastle 的 Docker 执行，使用 Worktrunk 保留代码现场隔离，免除容器成本，但不提供系统安全沙箱。

保留固定最多四票、逐票独立审查接力、全批 settled barrier、单 Merger、每批一次 summary 后关 Ticket、失败下批复用及 close-only；角色总时长与总批次均无上限。依赖以原生 blocked-by 为准，输入范围固定，SPEC 仅上下文。模型省略沿用所选 CLI 本机配置，执行 Provider 不由宿主猜测。无原生调度兼容模式、completion grace、运行时包下载或持久化任务恢复账本。

本决策 supersede [ADR 0001](0001-afk-issue-loop-main-context-budget.md) 的主会话调度、plan 与固定模型，及 [ADR 0002](0002-afk-issue-loop-sandcastle-failure-timeout.md) 的活性近似、[ADR 0003](0003-afk-issue-loop-native-dag-recovery.md) 的范围扩展、自动关 SPEC 和原阶段恢复；旧文全文保留，仅标注替代范围。实际实现和三种 CLI 的验收状态见 [实施记录](../plans/afk-local-cli-orchestrator-implementation-notes.md)，本决策不替代公开入口测试。
