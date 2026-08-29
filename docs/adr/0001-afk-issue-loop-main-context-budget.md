# afk-issue-loop 主窗口预算改造

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
