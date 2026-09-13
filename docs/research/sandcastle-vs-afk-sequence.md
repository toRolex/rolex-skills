# Sandcastle vs afk-issue-loop：现行差异

固定基准：[mattpocock/sandcastle commit `e99f832f26dc9d245c019a9ddd19fa5dee792427`](https://github.com/mattpocock/sandcastle/tree/e99f832f26dc9d245c019a9ddd19fa5dee792427)，以 `src/templates/parallel-planner-with-review`、PromptResolver/ArgumentSubstitution/Preprocessor、AgentProvider、Orchestrator、run 与 no-sandbox 实际源码为准。模板与历史 dogfood 分开比较；现行决定为 [SPEC #8](https://github.com/toRolex/rolex-skills/issues/8) / [ADR 0005](../adr/0005-afk-sandcastle-source-reuse.md)，执行权威见 [SKILL](../../skills/personal/afk-issue-loop/SKILL.md)。

| 维度 | Sandcastle 固定基准 | 本地 AFK |
|---|---|---|
| 输入与选择 | Planner 读取 open Issues、推断依赖并输出 unblocked 候选 | 独立脚本固定显式 Tickets 或首次完整分页 open ready-for-agent；排除 PR/closed/SPEC，原生 blocked-by 为权威，不另设 LLM Planner |
| 全 blocked | Planner 可选内部依赖最少或最弱候选 | 删除该 fallback；无在途或可推进交付且剩余全 blocked 时记录原因并结束，不强行开工，不扩大范围 |
| 并发与轮数 | 模板并发全部选中票，无四票限制，最多10轮；历史 dogfood 另设并发4 | 全部就绪可执行票一次定批并发，不补位，无固定轮数或总业务重试上限；阻塞、权限与用户停止仍是边界 |
| 实现与审查 | 每票 Implementer 后接独立 Reviewer，同现场直接修正 | 保留逐票接力及具体检查项，允许按验收修正错误行为，不退回原 Implementer；已有未交付分支成果计入 |
| 批末合并 | Promise.allSettled 后单 Merger 普通 merge、单 summary、关闭对应 Issues | 保留顺序；当前冲突/验证失败先修，中文 summary 后逐票关闭；只关 Tickets、不关父 SPEC，一票关闭失败其余继续 |
| 失败续作 | 失败一票不取消其余；后续轮次重新选择open票，确定性分支累计成果 | 普通临时失败退出本次尝试，不永久block；保留必要未完成合并与close-only，由Merger在本运行续作，不引入重启恢复账本 |
| 角色模板 | 三份独立角色MD，具体步骤、检查项和COMPLETE | 逐段中文翻译，仅本机/项目与已确认AFK适配；无common层、无复杂schema正文，结果短协议附加 |
| 动态prompt | 参数单次替换、可信来源标记、并行预展开、逆序回填 | 提取核心函数，以Node内置替换Effect接线；启动前自动提供最近10条提交和完整diff/log，命令插参shell quoting，输入命令与伪标记不二次求值 |
| stdout与完成 | 原始行转发，600秒idle，COMPLETE后默认60秒grace，后续stdout重置 | 恢复同语义；未知行也记录续期，stderr与其他角色不续期；自身grace收尾不因信号退出码一律失败，但仍需终止确认与有效成果 |
| 现场close | per-ticket finally/close管理生命周期，分支保留累计成果 | Worktrunk管理；I→R不清理，管线结束且写者确认结束后dirty保留，clean任务目录可清但保留branch/commits；目标或归属未知现场不清理 |
| 运行与分发 | 模板示例使用Docker/指定模型/npm；框架也有no-sandbox | 固定必要源码随skill提供，仅本地模块与Node内置依赖，无外部包调用/下载；本机CLI原身份权限、项目验证命令，不bypass、不改全局Git、不自动push/PR/fetch/pull |
| 结果与证明 | 普通角色结果、分支成果与Git/GitHub事实 | 现有平铺AFK接口集中校验，最终答复优先；不回退历史passed，不新增SHA/tree、目标快照、HEAD钉死或summary标题计数证明 |

## #7保留边界与#8替代

#7确立同名skill启动独立脚本，握手成功后报告started、身份、目标仓库日志和安全的status/stop命令，发起会话可结束；该架构继续有效。#8明确替代四票、全内部blocked fallback与禁用grace，不撤销本机授权、固定范围、Worktrunk和必要Merger续作。

启动握手最多120秒，普通前置与模板预展开默认30秒，均非角色总时长。停止和日志异常仍须尽力终止受管执行；POSIX原进程组及继承pipe结束确认不能证明所有脱组且无pipe后代均已结束，未知则保留现场、报告受限。

源码来源、许可证与必要闭包见 [来源研究](afk-local-cli-source-provenance.md)。历史 [#7实施记录](../plans/afk-local-cli-orchestrator-implementation-notes.md)、旧三CLI结果与旧长测原样保留，不自动成为#8通过证据。三种真实CLI的启动、模型、输出、结果及取消需各自走公开入口；受控fixture与真实时间长测分别验收。本表描述决定，不声明全部运行条件已验证。
