# afk-issue-loop 主窗口预算改造

afk-issue-loop 的主会话（控制者）上下文窗口在运行中被快速填满：注入式分派让 issue 全文 / CONTEXT.md / 规范文件全部经过主会话两次（采集一次、prompt 一次），模板全文被复制进每次分派的 prompt 参数，agent 汇报贴测试输出全量回灌，控制者还用 TaskOutput 非阻塞轮询后台 agent 制造大量垃圾条目。我们决定按「主窗口预算」原则改造 skill：**材料与汇报默认不进主窗口**——分派 prompt 只传模板路径与参数（模板自加载）、只给命令与路径由 agent 自取内容（寻址注入）、汇报只留完成信号 + 状态 + 可选疑虑（极简汇报，对齐 sandcastle 的 TS 编排器不读 agent 汇报的事实）、Planner 的 DAG 落盘到目标项目 `docs/afk-plan.json`（控制者无状态可重建，compact/resume 无害）、分派后停手等系统完成通知（禁轮询，超时只挂一次性计时器）、四角色模型统一显式 sonnet。总流程（四角色 / DAG / 拓扑 merge / 原地重试 / ≤4 并行 / 流水线触发）不变。

## Considered Options

- **TaskCreate 镜像 DAG 状态**：拒绝。plan 落盘后属冗余机制，且 task 提醒每轮自身占上下文，与目标相悖。
- **Seam 预确认保留**：拒绝。其动机是"agent 等待人类确认导致卡死"，属等待行为问题而非信息问题，模板中"直接进入 TDD 不等待"已解决；寻址注入后控制者不再读 issue body，也没有信息源做预确认。
- **模型按复杂度选择（含 AFK 向上取整）**：拒绝。控制者不读 issue 后无法判复杂度；统一 sonnet 简单稳定，优于继承主会话模型（主会话模型任意可换，行为不可预期）。
- **herdr 改为默认载体**：拒绝。只加"issue >5 时先向用户确认"的提示，不改变使用习惯。
- **skill 本体瘦身（SKILL.md / EXAMPLES.md）**：暂缓。实测确认大头是 loop 消息而非 skill 本体，跑一轮看 `/context` 再定。
- **三行式汇报（状态 / 测试数 / hash 列表）**：拒绝，采用更极简的 sandcastle 式。测试数与 hash 都是控制者一条 git 命令可自查的事实，让 agent 贴出来是纯浪费；Merger 每分支跑全量测试本就兜底。
- **plan 落盘放隐藏目录（`.afk/`）**：拒绝。放目标项目 `docs/afk-plan.json` 单文件，不建 dotfile 目录；收尾删除、不 commit。

## Consequences

- 未来修改 afk-issue-loop 时不得回退这些约束；回退 = 主窗口再次快速填满。
- 控制者失去 issue 内容视野，DONE_WITH_CONCERNS 处置完全依赖汇报中的疑虑文本——该文本是唯一不可瘦身的汇报内容。
