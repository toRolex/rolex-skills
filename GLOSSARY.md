# Rolex Skills

mattpocock/skills 的中文改编版：按 bucket 组织的 agent skill 集合。

## Language

**Skill**:
一个可调用的工作流或参考知识单元。User-invoked 仅由人调用，Model-invoked 也可由模型调用。

**Bucket**:
Skill 的推广分组；engineering、productivity、personal、Thariq 为已推广组，misc 为保留但不推广组。

### 领域文档与笔记隔离

**Docs（事实文档）**:
位于 `docs/` 等面向公众与开发者的文档体系。描写系统的“确定事实”，回答当前系统如何运转；不记录历史决策过程、探索踩坑与废弃尝试。
_Avoid_: 历史决策过程、探索踩坑、废弃尝试

**Implementation Notes（因果笔记）**:
位于 `.agents/notes/` 的实现决策与因果记录。描写系统的“演进因果”，记录为什么选型、舍弃了什么、偏离计划的理由与踩坑经验，供未来 Agent 与开发者在下一次尝试时学习与复用。
_Avoid_: 混入 docs/、无规则随处散落


### next-steps 建议

**建议标题（label）**:
一条 next-steps 建议的简短动作摘要，帮助用户快速辨认选项；不同于完整请求。

**完整请求（prompt）**:
一条 next-steps 建议中，以用户口吻表达的后续请求；可以是普通请求，也可以是可用 skill 的调用及参数。

**编号选择**:
用户以建议编号选定完整请求，表示要求执行该请求；不同于仅查看建议或生成输入草稿。

### to-pitch 交付

**remote 分享**:
to-pitch 的一条交付路径：单页 HTML 经本机 Tailscale 起服务，由手机直接访问。
_Avoid_: 远程分享、手机版

**普通路径**:
to-pitch 的默认交付路径：按目的地格式化，粘贴即发。
_Avoid_: 默认路径、标准路径

### afk-issue-loop 编排

**启动者**:
接受 AFK 调用、解析输入并报告启动身份的 agent；启动完成不等于 Tickets 已交付。
_Avoid_: 总调度 agent

**编排器**:
独立于发起会话的本地脚本，是 AFK 范围、批次与角色生命周期的唯一调度者。
_Avoid_: 当前主 agent、Planner、控制者

**角色**:
Implementer、Reviewer、Merger 三种交付职责单元；依赖读取与就绪判断属于编排器的调度职责。

**Role Selection**:
一次 Run 内每个角色各自冻结的一份 `{provider, model, effort, selectionSource}`；在 `start` 时解析一次并写入 `selection.json` 的 `roles`，角色启动与 daemon 恢复都不重选。`selectionSource` 区分用户显式指定、继承顶层默认与 Pi 意图解析。
_Avoid_: 统一执行配置、逐角色重选

**载体**:
角色所使用的独立本机 CLI，与调用 skill 的宿主相区分；载体不改变角色职责。

**Ticket Issue**:
AFK 范围内的可执行工作单元，来自显式输入或默认的 open `ready-for-agent` 集合；已关闭输入不属于待交付工作。
_Avoid_: PRD issue、SPEC Issue

**SPEC Issue**:
为 Ticket 提供整体需求上下文的 Issue，可由父关系、正文引用或用户指定识别，不属于 AFK 自动交付关闭的工作单元。
_Avoid_: PRD 节点、父 PRD

**原生依赖**:
GitHub blocked-by 表达的 Ticket 前置关系；范围外前置是等待条件，不是自动加入的工作。
_Avoid_: 推断 DAG、依赖闭包

**就绪 Ticket**:
仍开放、具有执行资格且前置依赖已满足的 Ticket；执行资格不等于依赖就绪。

**批次**:
一次选定当前全部就绪 Tickets 的交付集合；成员固定，是统一收敛与总结的边界。
_Avoid_: 并发槽位、流式补位
_Avoid_: 流式调度、Ticket 槽

**settled**:
批内每票的实现与审查管线均已成功完成或结束失败执行的状态，不代表所有票都成功。

**Merger**:
批次中负责合并、验证、关闭 Issue 与清理分支/worktree 的角色；单次调用完成全部收尾。
_Avoid_: 引擎代关、两阶段关闭

**完成信号**:
角色输出中的 `<promise>COMPLETE</promise>` 字符串；是角色声明完成的唯一信号。
_Avoid_: 结构化封套、交付证明

**再次尝试**:
尚未交付的失败 Ticket 的新一次执行尝试，与既有尝试的失败结果相区分。
_Avoid_: 本次跳过、模型升级恢复

**收尾宽限（completion grace）**:
完成信号之后允许角色继续产生输出、完成尾部工作的等待阶段。
_Avoid_: 角色总时限

**全阻塞停止**:
剩余 Tickets 均被阻塞，且已无在途工作或可推进交付时结束本次运行；不同于全部交付。

**恢复现场**:
开放 Ticket 已存在的标准 `afk/issue-N` 分支和／或 Worktrunk worktree；其 commits 与 dirty 进度属于可继承交付事实，不等于本 run 所有。

**恢复分类**:
新 run 根据当前 GitHub、Git、Worktrunk 与 writer 事实为 Ticket 标记的下一步，如跳过、恢复 worktree、恢复分支、创建、等待或等待活跃写者。

**活跃写者（active writer）**:
通过 AFK writer ownership channel 可连接并正向证明其仍负责某 worktree 的 AFK script；只有这种明确证据才使该 Ticket 进入 `waiting-writer`。
_Avoid_: unknown writer、历史 PID、推测占用

**Attempt**:
当前 run 中某 Ticket/Role 的一次完整 Recovery／派发 cycle 序号；Merger 为 batch-level。planned Attempt 在 Agent 尚未 spawn 时已存在且不含 Invocation。
_Avoid_: 全局调用序号

**Invocation**:
本 run 中实际 spawn 的 Role CLI 全局单调序号；只在 spawn 成功后分配并公开 PID。
_Avoid_: planned Attempt、尝试次数

**Observation**:
Dashboard 可重放的 append-only 事实记录，拥有 run-level 单调 `seq`；best-effort 写入，不参与调度、Recovery 或 Gate 正确性。
_Avoid_: 核心事件、events.jsonl

**merged-unverified**:
任务分支提交已成为目标分支祖先，但本次仍需完成目标验证和 Issue 关闭的恢复状态。
_Avoid_: 已交付、已完成
