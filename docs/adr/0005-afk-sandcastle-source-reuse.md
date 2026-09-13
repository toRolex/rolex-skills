# AFK 回归 Sandcastle 源码提取与原版中文角色

> 「不恢复危险 bypass」由用户后续明确要求的 [ADR 0006](0006-afk-permission-model-defaults.md) 局部替代；身份、外层权限和其余边界不变，下文保留当时决策。

依据 [SPEC #8](https://github.com/toRolex/rolex-skills/issues/8)，以 Sandcastle 固定 commit `e99f832f26dc9d245c019a9ddd19fa5dee792427` 的实际源码及三份角色模板为底稿，直接复制必要函数、保留业务控制流，只替换本机环境与框架接线。此前仅少量 helper 提取、重排角色与额外交付证明增加了对照维护成本；选择函数级提取而非继续重写，也不把 Sandcastle 或其他包变成运行依赖。

## 决定与替代范围

- 保留 [ADR 0004](0004-afk-local-cli-orchestrator.md) 的同名入口、独立本机 CLI、固定输入、原生 blocked-by、Worktrunk、原身份权限和单 Merger；替代其四票上限与禁用 grace。每批一次选择全部未 blocked 且可执行票，无数量 cap，不中途补位；等待整组 allSettled 后交付。无在途或可推进合并/关闭且剩余全 blocked 时记录阻碍并结束，删除内部单候选 fallback。
- 三 MD 逐段翻译上游，保留章节、步骤、具体检查项、动态 Git 位置及 COMPLETE。移除 common 层，只作项目验证、绑定、GitHub、权限、提交规范和必要续作适配；结果沿用现有平铺接口，由引擎附加短协议并集中校验，不在正文塞复杂 schema。
- 角色启动前自动采集实现者最近十条提交、审查者完整分支 diff/log。单次参数替换、可信来源标记、预展开与安全 shell quoting 一起保留；Ticket/评论/SPEC 中的命令、伪标记和占位符不二次执行。模板读取、空白与预展开失败均可见。
- 提取真实 stdout 原始行转发与计时：完成信号前600秒 idle，COMPLETE 后默认60秒 grace，后续真实 stdout 继续重置当前期限；未知行也续期，stderr/其他角色/监控不续期。正常退出不等 grace，无角色总时长。grace 主动收尾确认结束后可接受有效成果，不因自身信号退出码一律失败；外部异常、idle、拒绝、坏结果与终止不明不冒成功。
- I→R 复用同一现场。管线结束且受管写者确认结束后，dirty 保留，clean 任务目录可由 Worktrunk 清理但 branch/commits 保留。目标现场、归属未知与终止不明的现场不清理，不以 force、reset/abort 隐藏失败。
- 保留普通分支/Git/GitHub事实与最终结果核实，删除目标内容快照、HEAD钉死、SHA/tree与summary标题计数证明。Merger顺序合并，当前冲突或验证失败先修；原批一个中文Conventional Commit summary后逐票关闭，一票关闭失败不阻断其余。未完成合并由Merger续作；close-only不重复实现、审查、合并、验证或summary。副作用已发生但结果坏时先核实，不靠旧passed猜成功。
- 按项目实际测试与类型检查验证；无自动测试时执行原项目约定的具体检查，不新增免测接口或豁免机制。

## 接线与运行边界

运行源码、适用MIT许可证与来源说明随skill分发，只有本地模块和Node内置模块依赖；无Effect shim、外部包调用、运行时安装下载或临时上游目录依赖。上游已有no-sandbox，本机执行不是全面重写的理由；也不恢复其危险bypass、全局Git写入、自动远端同步或无关容器/UI/session体系。

入口启动握手最多120秒，普通前置/模板预展开命令默认30秒；这些步骤期限不构成角色总时长。自动日志故障仍尽力停止受管执行，不因事件写入失败跳过终止。POSIX原进程组与继承pipe确认不等于证明所有脱组且无pipe后代已结束，终止未确认时保留现场并报告限制。后代监管须按三种真实CLI分别验收，不承诺完整进程安全沙箱。

本决策局部替代 [ADR 0001](0001-afk-issue-loop-main-context-budget.md)、[ADR 0002](0002-afk-issue-loop-sandcastle-failure-timeout.md)、[ADR 0003](0003-afk-issue-loop-native-dag-recovery.md)、ADR 0004 的冲突条款；旧正文和历史失败验收保留。现行规则见 [业务参考](../../skills/personal/afk-issue-loop/REFERENCE.md) 与 [现场边界](../../skills/personal/afk-issue-loop/reference/workspace-binding.md)。源码来源、必要闭包见 [来源研究](../research/afk-local-cli-source-provenance.md)。

验收继续只走公开 start/status/stop，区分启动、角色结束、全部交付和阻塞停止。受控fixture、真实三CLI、600/60真实时间长测分别记证据；旧版本通过、源码对照通过或接口存在，都不代表本规格运行验收全部通过。
