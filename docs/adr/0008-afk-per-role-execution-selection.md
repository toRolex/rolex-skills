# AFK 按角色指定执行 harness 与模型

依据 [Issue #11](https://github.com/toRolex/rolex-skills/issues/11)，`start` 接受按角色前缀的执行配置：`--<role>-provider` / `--<role>-model` / `--<role>-effort`（role 为 `implementer` / `reviewer` / `merger`）。顶层 `--provider` / `--model` / `--effort` 保留为 Run 默认值，角色前缀逐字段覆盖，未写则继承顶层。这样一次 Run 内三个角色可以分处不同 harness 与不同模型/effort，同时不破坏角色接力与 Gate 语义——分多次 Run 分别启动做不到这一点。

## 与本决策相邻的取舍

**编排器自动按 Ticket 难度择模仍被拒绝**，[ADR 0001](0001-afk-issue-loop-main-context-budget.md) 保持有效。两者不是同一件事：ADR 0001 拒绝的是*编排器自行判断*难度并替换模型（用户不再掌握最终配置），本决策允许的是*用户显式写下*每个角色该用什么（配置完全由用户表达，编排器只忠实翻译与校验）。本特性不新增任何自动择模逻辑，因此不构成对 ADR 0001 的替代。

**继承规则只跟顶层默认，不做「缺省角色跟随已指定角色」的推断。** 若允许推断，用户只指定 Implementer 时 Reviewer 会被悄悄拉到同源模型；而 Gate 完全依赖 Reviewer 的判读，同源模型的盲区会被系统性认可。宁可让用户多写一行，也不静默削弱 Gate 的独立性。

**每个角色的最终配置在 `start` 时一次解析并冻结进 `selection.json` 的 `roles`，不在角色启动时重选**（沿用 ADR 0006「同 run 三角色固定」的精神，改为「每角色各自固定」）。daemon 崩溃恢复后仍读这份冻结结果，不重新解析，使同一 Run 的配置不因本机配置变化而漂移。既有单份读取方（`config.provider`、`result.json` 的展开、既有测试断言）继续读顶层扁平三字段，同时给出 `default` 键作为同一份值的规范名字；`roles` 中的每一项与 `default` 字段级一致，唯一差别是未显式指定的角色来源标为 `role-inherited-default`。`resolve-selection` 另附 `display` 人类可读视图，`roles` 保持机器可读的枚举值。

**公共 effort 契约取三家 harness 交集 `low`/`high`/`max`**，但不因此拒绝各家更多的档位；校验仍以该 harness 的实际支持面为准，不支持即启动期失败并给出合法值。两家已知腐坏/静默失效被一并处理：Codex 的硬编码表删去 CLI 不支持的 `none`/`minimal`、补上 CLI 支持的 `max`（以本机 `codex debug models` 的 `supported_reasoning_levels` 为准）；Pi 遇到模型不支持的档位会**静默降级且不报错**，因此把既有的 `thinkingLevelMap` 能力校验从 luna 自动路径复用到**显式 Pi 模型**路径——这是「不静默降级」的主要技术手段。

## Consequences

- `provider` 不再是单点全局值：启动期可执行检查覆盖去重后的全部实际 harness；流解析器与观测标签 `provider/<name>` 改取该次 Invocation 所属角色的 harness。后者是混 harness 能工作的前提，因为不同 harness 的 stream-json 格式完全不同。
- 恢复语义不变（不重解析、不恢复旧进程内存），只是把「三角色固定」拆成「每角色各自固定」；Recovery 的 Writer 探针按 `role:tickets` 建 key，其职责是判断是否有活跃写者、不参与配置选择，因此不并入 provider。
- 不新增自然语言解析层（agent 解析，脚本只收精确 flag）；不实现编排器自动择模、失败后自动升级模型、跨 harness 模型别名归一化。
- 三家 harness 实际共用本机同一 CLIProxyAPI 代理，混 harness 不带来后端冗余，收益仅在 flag 语法灵活性与不同模型的能力/成本差异。真实 harness 链路的逐格验收属于使用决策，不是本决策的交付物。
