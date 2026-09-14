# Rolex Skills

mattpocock/skills 的中文改编版：按 bucket 组织的 agent skill 集合。

## Language

**Skill**:
一个可调用的工作流或参考知识单元。User-invoked 仅由人调用，Model-invoked 也可由模型调用。

**Bucket**:
Skill 的推广分组；engineering、productivity、personal 为已推广组，misc 为保留但不推广组。

### afk-issue-loop 编排

**启动者**:
接受 AFK 调用、解析输入并报告启动身份的 agent；启动完成不等于 Tickets 已交付。
_Avoid_: 总调度 agent

**编排器**:
独立于发起会话的本地脚本，是 AFK 范围、批次与角色生命周期的唯一调度者。
_Avoid_: 当前主 agent、Planner、控制者

**角色**:
Implementer、Reviewer、Merger 三种交付职责单元；依赖读取与就绪判断属于编排器的调度职责。

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
批次中负责合并交付成果与交付收尾的角色。

**仅待关闭（close-only）**:
合并、验证及批次总结已经完成，只剩对应 Ticket 尚未关闭的交付收尾状态。

**再次尝试**:
尚未交付的失败 Ticket 的新一次执行尝试，与既有尝试的失败结果相区分。
_Avoid_: 本次跳过、模型升级恢复

**完成信号**:
角色声明进入完成收尾的提示，不等于执行已结束或 Ticket 已交付。
_Avoid_: 交付证明

**收尾宽限（completion grace）**:
完成信号之后允许角色继续产生输出、完成尾部工作的等待阶段。
_Avoid_: 角色总时限

**全阻塞停止**:
剩余 Tickets 均被阻塞，且已无在途工作或可推进交付时结束本次运行；不同于全部交付。

**恢复现场**:
开放 Ticket 已存在的标准 `afk/issue-N` 分支和／或 Worktrunk worktree；其 commits 与 dirty 进度属于可继承交付事实，不等于本 run 所有。

**恢复分类**:
新 run 根据当前 GitHub、Git、Worktrunk 与 writer 事实为 Ticket 标记的下一步，如跳过、恢复 worktree、恢复分支、创建、等待、等待活跃写者或继续验证关闭。

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

**Self-report**:
Role 输出封套中的自报状态，不等于 Gate。
_Avoid_: 交付结论、验收通过

**Gate**:
engine 对 Role result、测试、Git deliverable 与交付条件的独立接受或拒绝结论；必须显式发布，不能从 Self-report 或 role-end 反推。
_Avoid_: 角色自报、进程退出码

**Delivery**:
merge、summary、Issue close 等最终交付阶段与逐 Ticket 结果；独立于 Gate 与进程状态。

**merged-unverified**:
任务分支提交已成为目标分支祖先，但本次仍需完成目标验证、summary 核实和 Issue 关闭的恢复状态。
_Avoid_: 已交付、已完成
