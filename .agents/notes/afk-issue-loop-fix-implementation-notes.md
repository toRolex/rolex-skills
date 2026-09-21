# AFK Issue Loop 修复 Implementation Notes

## 任务

修复 `afk-issue-loop` 已发现的全部 `writing-for-agents` 规范问题。

## 状态

实现与验证完成，等待用户决定是否提交或合并工作树。

## 已确认决策

- AFK 的工作单元是 **Ticket Issue**，不是 SPEC Issue。
- 初始 Ticket 支持两种来源：用户显式给定 issue number；未给定时扫描当前仓库 open 且带 `ready-for-agent` 标签的 issue。
- 显式输入中的已关闭 Ticket 表示此前已完成，续跑时直接视为已满足。
- **SPEC Issue** 是 Ticket 的 GitHub 原生 parent；角色沿 parent/sub-issue 关系读取整体上下文，但 SPEC 不属于 Execution DAG。
- Ticket 依赖以 GitHub 原生 issue dependencies（`blocked_by`）为权威来源；Planner 只读取、记录和验证。
- Planner 从初始 Ticket 沿开放 `blocked_by` 递归扩展，自动把范围外 blocker 纳入本次执行，直到得到完整依赖闭包；已关闭 blocker 视为已满足。
- 自动纳入的开放 blocker 必须带 `ready-for-agent`；缺少标签时停止 AFK 并报告该 blocker。
- 全部 Ticket 完成后，读取各父 SPEC 的完整 sub-issues；仅当某 SPEC 的全部子 Issue 均已关闭时，由 AFK 自动关闭该 SPEC。
- Ticket 执行失败后，控制者保留现场、写 runbook，并在同一 branch/worktree 自动重新分派 agent；恢复无次数上限。
- 恢复中的 Ticket 持续占用原并行槽；独立 Ticket 使用剩余槽；该 Ticket 下游保持 blocked。
- 状态循环为 `dispatched → recovering → dispatched`；Merger验证后进入 `done`。
- 设计基准是 sandcastle `parallel-planner-with-review`：四角色、Implementer→Reviewer 同现场串行、跨 Ticket ≤4、barrier Merger、拓扑 merge、Merger 统一关闭 Ticket。
- Worktree 生命周期统一由 Worktrunk（`wt`）管理；Git 负责 commit、diff 与 merge。
- 其他适配：Planner 一次性完整 DAG + 落盘、Claude Code/Herdr 载体、watchdog、无限自动现场恢复。

## 实现契约

- `<promise>COMPLETE</promise>` 仅在角色 completion criterion 全部满足时有效；其他角色状态进入自动恢复。
- 每个 barrier 批次固定生成一条 `--allow-empty` summary commit。
- `REFERENCE.md` 是关系、状态、槽位、恢复和合并契约的唯一真相来源；SKILL 只保留顺序步骤，prompts 只保留角色独有动作，EXAMPLES 只示范。
- Herdr 通过 `Skill("herdr")` 与按需 `Skill("herdr-instances")` 到达。
- Planner `BLOCKED` 是输入资格门：立即终止本次运行，不执行旧 plan。
- 显式 roots 由 validator 精确比对；默认 roots 在 live 校验中与 GitHub 分页扫描结果比对。
- Merger 在批次 summary 后统一清理 branches，使中途恢复保留验证依据。

## Deviations

- 先前审查把“父 PRD”解释为 DAG 节点；修正为 GitHub 原生 parent SPEC，仅提供上下文。
- 先前把 Planner 描述成可推断依赖；修正为读取 GitHub 原生 `blocked_by`。
- 初始笔记误用了已有通用文件；已恢复原文件并使用本任务专属文件。
- 最初 live validator 读取 Issue 响应中的 parent 指针；交付复审后改为调用原生 `/parent` endpoint，并覆盖 404。
- 最初 Merger 每分支立即清理；交付复审后将清理移到全批测试与 summary 之后，保证幂等恢复。

## 执行记录

- [x] 重写 SKILL.md：顺序步骤、可检查门槛、按 branch 披露 reference。
- [x] 将关系、状态、槽位、恢复、watchdog、Worktrunk 与 Merger 契约集中到 REFERENCE.md。
- [x] 重写四角色 prompts 与代表性 EXAMPLES。
- [x] 更新 `validate-plan.sh`：schema、显式/default roots、闭包、拓扑和 GitHub live 校验。
- [x] 更新活跃槽位统计为 `dispatched + recovering`。
- [x] 扩展脚本黑盒测试：55 项全部通过。
- [x] 新增 ADR 0003，更新 ADR 0001/0002 supersession。
- [x] 同步 CONTEXT、README、plugin、marketplace、router 与用户文档。
- [x] `bash -n`、`diff --check`、JSON、Markdown links、真实 closed-root live 校验通过。
- [x] writing-for-agents 与脚本复审 findings 已逐项修复。
