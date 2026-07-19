---
name: wayfinder
description: 规划一大块工作——超过一个 agent 会话能容纳的体量——将其作为 issue tracker 上调研 ticket 的共享地图，然后逐个解决，直到通往目的地的道路清晰可见。
disable-model-invocation: true
---

# Wayfinder（探路者）

> **术语约定：** 以下关键术语保持固定译法，含英文源词以便对照：
>
> | English | 中文 |
> |---------|------|
> | ticket | ticket（不翻译） |
> | map | 地图 |
> | destination | 目的地 |
> | frontier | 前沿 |
> | out of scope | **超出范围**（n./adj.）；**列为超出范围**（v.） |
> | fog of war | 战争迷雾 |
> | claim / assign | 认领 / 分配 |
> | resolution / resolve | 解决 |
> | HITL / AFK | HITL（人在循环）/ AFK（离线自主） |
> | grilling | grilling（不翻译，skill 名称） |
> | research / prototype / task | 调研 / 原型 / 任务 |

一个模糊的想法到来了——太大，一个 agent 会话装不下，而且笼罩在迷雾中：从这里到 **destination** 的路还看不到。Wayfinding 是关于找到那条路，而不是冲向 destination。本 skill 将路径绘制为 repo issue tracker 上的**共享地图（map）**，然后一次一个地处理 tickets，直到路线清晰。

每个工作的 destination 不同，命名它是绘制的第一个动作——它塑造了每个 ticket。它可能是一个要交付和迭代的 spec、一个在计划开始前需要锁定的决策、或一个像数据结构迁移那样原地进行的变更。Map 是领域无关的——工程工作、课程内容、任何适合这个形状的东西。

## 计划，而不是执行

Wayfinder 默认是**计划**性的：每个 ticket 解决一个决策，当路线清晰时 map 就完成了——在某人去执行之前没有需要决定的事了。直接去做工作的冲动通常是你已到达 map 边缘的信号，该交接了。一个 effort 可以在其 **Notes** 中覆盖这一点——将执行本身带入 map——但如果没有，产出决策，而不是交付物。

## 用名称引用

每个 map 和 ticket 都是一个 issue，所以它有一个**名称**——它的标题。在人类阅读的所有内容中——叙述、map 的 Decisons so far——用名称引用它，永远不要用裸 id、编号或 slug。一堆 `#42、#43、#44` 难以阅读；名称一眼就能看明白。id 和 URL 不会消失——一个名称包装了它的链接——但它们*在*名称内部，不能代替名称。

## Map

Map 是本 repo issue tracker 上的一个 issue，标注 `wayfinder:map`——规范的产物。它的 tickets 是 map 的子 issue。

Map 是一个**索引**，不是存储。它列出已做出的决策并指向持有细节的 tickets；一个决策只存在一个地方——它的 ticket——所以 map 永远不会重述它，只做摘要和链接。

**Map、它的子 tickets、阻塞关系和 frontier 查询具体位于 tracker 的哪个位置，取决于 tracker 类型。** Issue tracker 应该已经提供给你——如果没有，运行 `/setup-rolex-skills`。关于此 repo 如何表达它们，请查阅 tracker 文档的"Wayfinding operations"部分。如果没有提供 tracker，默认使用本地 markdown tracker。

### Map 正文

整个 map 的低分辨率视图，每个会话加载一次。打开的 tickets **不**列出——它们是打开的子 issue，通过查询找到。

```markdown
## Destination

<到达 map 终点看起来什么样——此 effort 在寻找的 spec、决策或变更。一两行；每个会话在选择 ticket 之前以此为目标。>

## Notes

<领域；每个会话应查阅的技能；此 effort 的常设偏好>

## Decisions so far

<!-- 索引——每个已关闭 ticket 一行：足以判断相关性，然后放大链接查看 ticket 持有的细节 -->

- [<已关闭 ticket 标题>](link) —— <一行结论摘要>

## Not yet specified

<!-- 参见"战争迷雾"：范围内的迷雾，你还无法生成 ticket；随着 frontier 推进而毕业 -->

## Out of scope

<!-- 参见"超出范围"：超出 destination 的已排除工作；已关闭，永不毕业 -->
```

### Tickets

每个 ticket 是 map 的一个**子 issue**；tracker 的 issue id 就是它的身份。它的正文就是问题，大小适合一个 100K token 的 agent 会话：

```markdown
## 问题

<此 ticket 要解决的决策或调研>
```

每个 ticket 携带一个 `wayfinder:<type>` 标签——可以是 `research`、`prototype`、`grilling`、`task`（见 [Ticket 类型](#ticket-类型)）。

一个会话通过**先将 ticket 分配给自己**来**认领（claim）** ticket，然后才开始工作，这样并发会话会跳过它。那个 assignee _就是_ claim：打开的、未分配的 ticket 就是未认领的。

阻塞使用 tracker 的**原生**依赖关系——这至关重要，因为它使 frontier 在 tracker 自己的 UI 中_可见_，这样人类不需要打开 map 就能看到什么可以领取。只有在 tracker 缺乏原生阻塞时才回退到正文约定。一个 ticket 在阻塞它的所有 ticket 都关闭时**解除阻塞**；**frontier** 是打开的、未阻塞的、未认领的子 issue——已知的边缘。

答案不是正文的一部分——它在解决时记录（见[通过 map 工作](#通过-map-工作)）。解决 ticket 时创建的资产从 issue 链接，而不是粘贴进来。

## Ticket 类型

每个 ticket 要么是 **HITL**——人在循环中，与能为自己说话的人一起工作——要么是 **AFK**（离线自主），由 agent 单独驱动。HITL ticket 只能通过现场交流解决；agent 从不代表人类一方回答问题（一个自己回答自己问题的 grilling agent 已经违背了这一点）。

- **Research（调研）**（AFK）：阅读文档、第三方 API 或知识库等本地资源。创建 markdown 摘要作为链接资产。当需要当前工作目录之外的知识时使用。
- **Prototype（原型）**（HITL）：通过制作廉价、粗糙、具体的工件——提纲、粗略想法、桩代码、或通过 /prototype skill 生成的 UI/逻辑代码——来提高讨论的保真度。链接原型作为资产。当"它应该长什么样"或"它应该怎么表现"是关键问题时使用。
- **Grilling（访谈）**（HITL）：通过 /grilling 和 /domain-modeling skill 的对话，一次一个问题。默认情况。
- **Task（任务）**（HITL 或 AFK）：在做出*决策*之前必须完成的动手工作——没有要决定、原型或调研的内容，但讨论被阻塞直到完成。注册服务以便判断它的 API、开通访问权限、移动数据以便看到它的形状。这是唯一种产出**执行方案**而非决策的类型——它通过识别要改什么、怎么改、波及范围来解除决策的阻塞。它的"解决"是交付一份精确的执行规范（影响文件列表、变更要点、风险、验收标准），**不是实际修改代码**。Agent 在能做到的地方独自驱动（AFK）；否则交给人类一个精确的检查清单（HITL）。当工作完成时解决；答案记录做了什么以及任何后续 tickets 依赖的结果事实（凭据位置、新 URL、行数）。

## 战争迷雾

Map 是_故意_不完整的：不要绘制你还看不到的东西。在活跃 tickets 之外是**战争迷雾（fog of war）**——你能够判断即将到来但还无法确定的决策和调查的模糊视图，因为它们挂在尚未解决的问题上。解决一个 ticket 会清除它前方的迷雾，将现在可以明确的任何内容毕业（graduate）为新的 tickets——一次一个，直到通往 destination 的道路清晰，不再有 tickets 剩余。

Map 的 **Not yet specified** 部分就是记录这个模糊视图的地方：可疑的问题、以后需要重新审视的领域。它是朝向 destination 的未发现 frontier——这里的一切都在范围内，只是还不够锐化到能生成 ticket。写得宽泛或详细都可以；它同时充当协作者的路径标志，指示工作的方向。

**迷雾还是 ticket？** 判断标准是你现在能否精确陈述问题——_不是_你能否现在回答它。

- **是 ticket 当**问题已经锐利——即使它被阻塞，你还不能对它采取行动。
- **Not yet specified 当**你还不能那么精确地表述它。不要将迷雾预先切成 ticket 大小的块：它比 ticket 更粗颗粒，一块迷雾可能毕业为几个 ticket，或没有，一旦 frontier 到达它。

**Not yet specified** 排除了已经决定的内容（Decisions so far）、已经是活跃 ticket 的内容以及超出范围的内容（下一节）。

## Out of scope

迷雾只聚集在_朝向_ destination 的方向。Destination 固定了范围，所以超出 destination 的工作是**超出范围（out of scope）**的——它不是迷雾，不属于 **Not yet specified**。它在地图上有自己的 **Out of scope** 部分：你有意识地排除了_此_ effort 范围的工作。范围，而不是锐度，将它放在这里。

超出范围的工作从不毕业——frontier 在 destination 处停止——所以它只有在地图被重新绘制时才返回，而且是以全新的 effort，而非恢复。

将某件事列为超出范围是一个划定范围的行为，不是路线上的一个步骤。当一个已经存在的 ticket 最终位于 destination 之外——绘制时误入范围，或通过解决一个 ticket 暴露出来——**关闭它**（关闭的 ticket 明确不在 frontier 上）并在 **Out of scope** 部分留下一行：摘要加上为什么超出范围，链接已关闭的 ticket。它不进入 **Decisions so far**，后者记录实际行走的路线——范围边界不是路线上的一个步骤。

## 调用

两种模式。无论哪种，**每个会话最多只解决一个 ticket**——research 类型的 ticket 除外。

### 绘制 Map

用户用一个模糊的想法调用。

1. **命名 destination。** 运行 `/grilling` 和 `/domain-modeling` 会话以确定此 map 在找什么——spec、决策或变更。Destination 固定了 scope，所以先确定它。
2. **绘制 frontier。** 再次 grilling，这次**广度优先**：在整个空间内展开而不是深入任何一个线程，浮现开放的决策和现在可以迈出的第一步。**如果没有浮现迷雾**——通往 destination 的路已经清晰，整个旅程小到一个会话——你不需要 map。停下来问用户想怎么继续。
3. **创建 map**（标签 `wayfinder:map`）：填写 Destination 和 Notes，Decisions so far 为空，将迷雾勾勒到 **Not yet specified** 中。
4. **创建你现在可以明确的 tickets** 作为 map 的子 issue——然后在**第二轮**中连接阻塞边（issue 需要先有 id 才能互相引用）。连接将它们排序为 frontier 和被阻塞；所有你现在还不能明确的内容留在迷雾中——即 **Not yet specified** 部分。
5. 停止——绘制 map 是一个会话的工作；不要同时解决 tickets。

### 通过 Map 工作

用户用一个 map（URL 或编号）调用。可以指定 ticket——没有的话，你来选下一个决策，不是用户。

1. 加载 **map**——低分辨率视图，不是每个 ticket 的正文。
2. 选择 ticket。如果用户指定了一个，使用它。否则按顺序取第一个 frontier ticket。**认领它**：在工作开始前分配给自己。

> **约束：** 这是决策层工作。任何 ticket 的"解决"产出都是信息（决策、方案、规范）——将答案发布为解决评论、关闭 issue、追加到 map 的 Decisions so far，同时将新浮现的内容毕业为新 ticket、清除迷雾、处理超出范围和无效化部分。代码执行始终在 wayfinder 会话之外进行。

3. 解决它，按 ticket 类型决定"解决"的含义：
   - **Research / Grilling / Prototype**：通过调研、对话或原型来锁定决策。产出记录在解决评论中。
   - **Task**：**产出执行方案**——分析影响文件、变更要点、风险和执行顺序，写成解决评论。**禁止直接修改代码**。执行由后续 feature 分支完成。

   按需获取任何相关或已关闭 ticket 的完整正文；调用 `## Notes` 块中指定的 skills。如有疑问，使用 `/grilling` 和 `/domain-modeling`。
4. 记录解决：将答案作为**解决评论**发布，**关闭**该 issue，并将**上下文指针**追加到 map 的 Decisions so far 中。（不是以独立评论追加）
5. 添加新浮现的 tickets（创建后连接）；将答案已使其明确的所有迷雾毕业，从 **Not yet specified** 中清除每个已毕业的片段，使其仅作为新 ticket 存在。如果答案揭示某个 ticket——这个或其他——位于 destination 之外，将其**列为超出范围**而不是在路径上解决。如果决策使 map 的其他部分无效，更新或删除那些 tickets。

用户可能并行运行未阻塞的 tickets，所以要预期其他会话在同时编辑 tracker。
