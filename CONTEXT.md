# Rolex Skills

mattpocock/skills 的中文改编版：按 bucket 组织的 agent skill 集合。

## Language

**Skill**:
一个可调用的工作流或参考知识单元。User-invoked 仅由人调用，Model-invoked 也可由模型调用。

**Bucket**:
Skill 的推广分组；engineering、productivity、personal 为已推广组，misc 为保留但不推广组。

### afk-issue-loop 编排

**控制者**:
AFK 主会话，负责角色编排、依赖推进与验收，而非实现工作。
_Avoid_: 主 agent、orchestrator

**角色**:
Planner、Implementer、Reviewer、Merger 四种职责单元。

**载体**:
角色的运行方式，subagent 或 Herdr；载体不改变角色语义。

**Ticket Issue**:
AFK 可执行工作单元，包括初始输入及其开放依赖。初始已关闭输入仅作为审计节点。
_Avoid_: PRD issue、DAG 外任务

**SPEC Issue**:
Ticket 的原生父 Issue，提供整体规格上下文，不属于执行节点。
_Avoid_: PRD 节点、父 PRD

**Execution DAG**:
初始 Tickets 与其开放依赖闭包形成的无环执行图；已关闭依赖视为满足。
_Avoid_: SPEC DAG、分轮 plan、推断 DAG

**Ticket 槽**:
一条活动 Ticket 管线占用的容量，包括实现、审查、等待合并与恢复。

**合并单元**:
由一个已审查 Ticket 及其固定交付版本构成的独立合并、验收与清理范围。
_Avoid_: 全批 barrier

**流式调度**:
Ticket 独立推进，合并完成后立即释放容量并解锁下游，不等待其他独立 Ticket。

**初始关闭审计**:
记录输入在运行开始前已关闭的事实，不代表本次或历史上已合并。

**完成来源**:
区分初始关闭跳过与本次执行合并的来源事实。

**恢复**:
失败角色基于已保存证据，在原现场延续原阶段；不替代权限或业务决策授权。
_Avoid_: 重建现场、无证据重试

**runbook**:
角色恢复档案，包含失败证据、已尝试动作、模型选择与下一恢复依据。

**status**:
执行节点的 pending、dispatched、recovering、done 状态；角色汇报的 BLOCKED 等信号不属于这套节点状态。

**watchdog**:
角色活性观察器，异常提示需核实，不等于死亡证明。

**主窗口预算**:
控制者上下文容量约束，材料与事实保留在角色或环境中。

**寻址注入**:
只传上下文地址，由角色自行获取材料。
_Avoid_: 全文注入、控制者代读

**模板自加载**:
角色根据传入路径自行读取完整角色指令。

**极简汇报**:
角色只返回完成信号、状态与必要疑虑；详细证据可寻址。
