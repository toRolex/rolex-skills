# afk-issue-loop 主窗口预算改造

> **「动态模型选择：拒绝」的替代范围见 [ADR 0008](0008-afk-per-role-execution-selection.md)。** 该拒绝针对的是**编排器自行按 Ticket 难度择模**——这一点仍然有效，ADR 0008 不替代它。ADR 0008 允许的是**用户显式按角色指定** harness/模型（配置由用户表达、编排器只翻译与校验），不引入任何自动择模。不得以本文反对用户 per-Role 指定。

> **现行优先级：以 [SPEC #8](https://github.com/toRolex/rolex-skills/issues/8) / [ADR 0005](0005-afk-sandcastle-source-reuse.md) 为准。** 以下所有“仍有效”等状态均属当时历史；主会话调度与模板自加载已由独立 CLI、启动前读取三 MD 及动态 Git 注入替代。本文历史决定不重写。

> **历史决策，现行替代范围见 [Issue #7](https://github.com/toRolex/rolex-skills/issues/7) / [ADR 0004](0004-afk-local-cli-orchestrator.md)。** 以下旧状态与正文仅记录当时结论。主会话原生调度、plan 落盘/恢复、固定 sonnet、载体确认、通知驱动和仅 completion signal 汇报均不再适用；现行为 skill 启动独立脚本、CLI 角色与引擎结构化结果，不要求主窗口持续在线。

> 状态：部分被 [ADR 0002](0002-afk-issue-loop-sandcastle-failure-timeout.md) 与 [ADR 0003](0003-afk-issue-loop-native-dag-recovery.md) 修订。本文的主窗口预算、plan 落盘、统一 sonnet 与载体确认仍有效；超时和恢复语义以后二者为准。

控制者上下文曾被 issue 全文、模板复制、测试输出和后台轮询快速填满。决定采用**主窗口预算**：

- 模板自加载：分派只传模板路径与参数；
- 寻址注入：角色自行读取 Ticket、SPEC、CONTEXT、ADR 与规范；
- 极简汇报：只返回 completion signal、状态与必要疑虑；
- plan 落盘：`docs/afk-plan.json` 支持 compact/resume 重建；
- 通知驱动：分派后等待 agent 或 watchdog 通知；
- 四角色统一显式使用 sonnet。

## Considered Options

- **TaskCreate 镜像 DAG**：拒绝。plan 已是持久化状态源。
- **Seam 预确认**：拒绝。角色直接按 Ticket Testing Decisions 进入 TDD。
- **动态模型选择**：拒绝。控制者不读取 Ticket 全文，统一模型更可预测。
- **Herdr 默认载体**：拒绝。无参数仍用 subagent；初始 Tickets 多于 5 且未指定 mode 时确认载体。
- **三行事实汇报**：拒绝。测试数和 hashes 可从环境查询。
- **隐藏 plan 目录**：拒绝。运行文件固定为 `docs/afk-plan.json`，收尾删除。

## Consequences

- 控制者只承担编排、验证和恢复，不实现 Ticket。
- 后续修改必须保持模板自加载、寻址注入、极简汇报、通知驱动与 plan 落盘。
- `DONE_WITH_CONCERNS` 等疑虑文本是恢复 runbook 的必要输入。
