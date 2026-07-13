---
name: to-tickets
description: Break a plan, spec, or the current conversation into a set of tracer-bullet tickets, each declaring its blocking edges, published to the configured tracker — edges as text in one file per ticket locally, or native blocking links on a real tracker.
disable-model-invocation: true
---

# To Tickets（生成 Tickets）

将计划、spec 或对话分解为一组 **tickets**——tracer-bullet 垂直切片，每个声明阻塞它的 tickets。

issue tracker 和 triage 标签词汇应该已经提供给你——如果没有，运行 `/setup-rolex-skills`。

## 流程

### 1. 收集上下文

从对话上下文中已有的内容出发。如果用户传入了引用（spec 路径、issue 编号或 URL）作为参数，获取并阅读其完整正文和评论。

### 2. 浏览代码库（可选）

如果你还没有浏览过代码库，现在浏览以了解代码的当前状态。Ticket 标题和描述应使用项目的领域词汇，并尊重你正在接触区域的 ADR。

寻找预重构代码的机会，使实现更容易。"让变更变得容易，然后做容易的变更。"

### 3. 草拟垂直切片

将工作分解为 **tracer bullet** tickets。

<垂直切片规则>

- 每个切片在每一层（schema、API、UI、测试）中切出一条狭窄但**完整的**路径——垂直的，**不是**一个层的水平切片
- 一个完成的切片本身是可演示或可验证的
- 每个切片大小适合一个全新的上下文窗口
- 任何预重构应首先完成

</垂直切片规则>

给每个 ticket 它的**阻塞边**——必须在它开始之前完成的其他 tickets。没有阻塞者的 ticket 可以立即开始。

**宽重构是垂直切片的例外。** **宽重构**是一个机械性变更——重命名一个列、重新类型化一个共享符号——其**爆炸半径**波及整个代码库，因此一个编辑会同时破坏数千个调用点，没有垂直切片可以保持绿色。不要强行塞入 tracer bullet；将其作为**展开-收缩**序列化。首先展开：在旧形式旁边添加新形式，这样什么都不会破坏。然后按爆炸半径分批（按包、按目录）迁移调用点，每批是其自己的 ticket，被展开所阻塞，保持 CI 逐批绿色，因为旧形式仍然存在。最后收缩：在没有调用者剩余时删除旧形式，在一个被所有迁移批阻塞的 ticket 中执行。即使批次本身无法单独保持绿色，保持序列但让它们共享一个集成分支，所有分支阻塞最终的集成和验证 ticket——绿色只在那里承诺。

### 4. 询问用户

将提议的分解以编号列表呈现。对每个 ticket，展示：

- **标题**：简短描述性名称
- **被阻塞者**：必须先完成的其它 tickets（如果有）
- **交付内容**：此 ticket 使其工作的端到端行为

问用户：

- 粒度感觉对吗？（太粗 / 太细）
- 阻塞边正确吗——每个 ticket 只依赖真正阻塞它的 tickets 吗？
- 是否有任何 tickets 应该合并或进一步拆分？

迭代直到用户批准分解。

### 5. 发布 tickets 到配置的 tracker

发布已批准的 tickets。**方式**取决于 `/setup-rolex-skills` 配置的 tracker——tickets 本身是一样的，只有阻塞边的形式不同：

- **本地文件** → 每个 ticket 一个文件放在 `.scratch/<feature-slug>/issues/<NN>-<slug>.md` 下，从 `01` 开始按依赖顺序编号（阻塞者优先）。每个文件的"被阻塞者"列出它依赖的编号/标题。使用下面的每 ticket 文件模板——每个文件一个 ticket，永远不要一个合并文件。
- **真实 issue tracker（GitHub、Linear...）** → 按依赖顺序发布一个 issue 对应一个 ticket（阻塞者优先），这样每个 ticket 的阻塞边可以引用真实标识符。在 tracker 原生支持的地方使用原生阻塞/子 issue 关系；否则在每个 ticket 的"被阻塞者"中设置阻塞 issue。除非另有指示，应用 `ready-for-agent` triage 标签——tickets 默认就是 agent 可接取的。

处理**前沿**：所有阻塞者都已完成的任何 ticket。对于纯线性链意味着从上到下。

不要关闭或修改任何父 issue。

<本地 ticket 模板>

# <NN> — <Ticket 标题>

**要构建什么：** 此 ticket 使其工作的端到端行为，从用户的角度来看——不是按层列的实现清单。

**被阻塞者：** 阻塞此 ticket 的编号/标题，或"无——可以立即开始"。

**状态：** ready-for-agent

- [ ] 验收标准 1
- [ ] 验收标准 2

</本地 ticket 模板>

<issue 模板>

## 父级

对 tracker 上父 issue 的引用（如果来源是已有 issue，否则省略此部分）。

## 要构建什么

此 ticket 使其工作的端到端行为，从用户的角度来看——不是按层列的实现。

## 验收标准

- [ ] 标准 1
- [ ] 标准 2

## 被阻塞者

- 对每个阻塞 ticket 的引用，或"无——可以立即开始"。

</issue 模板>

在两种形式中，避免具体的文件路径或代码片段——它们很快过时。例外：如果原型产生了比散文更精确地编码决策的片段（状态机、reducer、schema、类型形状），内联它并简要注明来自原型。裁剪到决策丰富的部分——不是工作演示，只是重要的部分。

一次一个 ticket 地用 `/implement` 处理前沿，在 ticket 之间清空上下文。
