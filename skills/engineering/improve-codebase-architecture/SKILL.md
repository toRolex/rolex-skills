---
name: improve-codebase-architecture
description: 扫描代码库寻找深化机会，以可视化 HTML 报告呈现，然后对你选择的任一候选项进行 grilling。
disable-model-invocation: true
---

> **术语约定：** 以下关键术语保持固定译法，含英文源词以便对照：
>
> | English | 中文 |
> |---------|------|
> | architecture | 架构 |
> | deepening opportunity | 深化机会 |
> | shallow / deep module | 浅模块 / 深模块 |
> | seam | seam（保留英文） |
> | interface | interface（保留英文） |
> | module | module（术语）/ 模块（正文） |
> | adapter | adapter（保留英文） |
> | leverage | leverage（保留英文） |
> | locality | locality（保留英文） |
> | deletion test | 删除测试 |
> | friction | 摩擦 |
> | surface (v.) | surface（保留英文） |
> | candidate | 候选项 |
> | domain model | 领域模型 |
> | ADR | ADR（保留英文） |

# Improve Codebase Architecture（优化代码库架构）

将架构摩擦 surface 出来并提出**深化机会**——将浅模块转变为深模块的重构。目标是可测试性和 AI 可导航性。

此命令由项目的领域模型驱动，并建立在共享的设计词汇之上：

- 运行 `/codebase-design` skill 获取架构词汇（**module**、**interface**、**depth**、**seam**、**adapter**、**leverage**、**locality**）及其原则（删除测试、"interface 就是测试面"、"一个 adapter = 假设的 seam，两个 = 真实的 seam"）。在每个建议中精确使用这些术语——不要漂移到"component"、"service"、"API"或"boundary"。
- `CONTEXT.md` 中的领域语言为好的 seam 提供了名称；`docs/adr/` 中的 ADR 记录了本命令不应重新争论的决策。

## Process（流程）

### 1. Explore（探索）

首先阅读项目的领域词汇（`CONTEXT.md`）和你正在接触区域的任何 ADR。

然后使用带 `subagent_type=Explore` 的 Agent 工具浏览代码库。不要遵循死板的启发式规则——有机地探索，注意你在哪里感受到摩擦：

- 哪里理解一个概念需要在许多小模块之间跳转？
- 哪些模块是**浅的**——interface 几乎和实现一样复杂？
- 哪里纯函数只是为了可测试性而被提取，但真正的 bug 隐藏在它们**如何被调用**中（没有**locality**）？
- 哪里紧密耦合的模块跨 seams 泄漏？
- 代码库的哪些部分未经测试，或通过当前 interface 难以测试？

对你怀疑是浅的任何东西应用**删除测试**：删除它会集中复杂性，还是仅仅移动它？"是的，集中了"就是你想要的信号。

### 2. Present candidates as an HTML report（将候选项呈现为 HTML 报告）

编写一个自包含的 HTML 文件到 OS 临时目录，这样什么都不会留在仓库中。从 `$TMPDIR` 解析临时目录，回退到 `/tmp`（Windows 上为 `%TEMP%`），写入 `<tmpdir>/architecture-review-<timestamp>.html`，这样每次运行都获得一个新文件。为用户打开它——Linux 上 `xdg-open <path>`，macOS 上 `open <path>`，Windows 上 `start <path>`——并告诉他们绝对路径。

报告使用 **Tailwind via CDN** 进行布局和样式，使用 **Mermaid via CDN** 在图/流/序列能可靠传达结构的地方绘制图表。将 Mermaid 与手写的 CSS/SVG 视觉元素混合——在关系是图形形状（调用图、依赖关系、序列）时使用 Mermaid，在想要更具编辑性的内容（质量图、截面、折叠动画）时使用手写的 div/SVG。每个候选项获得一个**前后可视化**。要有视觉冲击力。

对每个候选项，渲染一个卡片，包含：

- **文件**——涉及哪些文件/模块
- **问题**——当前架构为何造成摩擦
- **解决方案**——将发生什么变化的纯英文描述
- **收益**——用 locality 和 leverage 解释，以及测试如何改进
- **前后对比图**——并排，自定义绘制，说明浅度和深化
- **推荐强度**——`Strong`、`Worth exploring`、`Speculative` 之一，渲染为徽章

以 **Top recommendation** 部分结束报告：你会首先处理哪个候选项以及为什么。

**对领域使用 `CONTEXT.md` 词汇，对架构使用 `/codebase-design` 词汇。** 如果 `CONTEXT.md` 定义了"Order"，谈"Order 接收模块"——而不是"FooBarHandler"，也不是"Order 服务"。

**ADR 冲突**：如果一个候选项与现有 ADR 矛盾，只有当摩擦真实到值得重新审视 ADR 时才将它 surface 出来。在卡片中清晰标记（例如警告标注：_"与 ADR-0007 冲突——但值得重新打开，因为……"_）。不要列出 ADR 禁止的每个理论上可能的重构。

完整的 HTML 脚手架、图表模式、样式指南见 [HTML-REPORT.md](HTML-REPORT.md)。

不要先提出 interfaces。在文件写入后，问用户："你想探索哪个？"

### 3. Grilling 循环

一旦用户选定一个候选项，运行 `/grilling` skill 与他们一起走设计树——约束、依赖、深化后模块的形状、seam 背后是什么、哪些测试幸存。

随着决策固化，副效应就地发生——运行 `/domain-modeling` skill 保持领域模型及时更新：

- **用一个不在 `CONTEXT.md` 中的概念命名深化后的模块？** 将该术语添加到 `CONTEXT.md`。如果文件不存在则惰性创建。
- **在对话中锐化了模糊的术语？** 当场更新 `CONTEXT.md`。
- **用户用有承重作用的理由拒绝了候选项？** 提供一个 ADR，措辞为："_想让我将其记录为 ADR 吗？这样未来的架构审查就不会再次建议它。_" 只在该理由对未来的探索者有用以阻止再次建议时提供——跳过失效的理由（"现在不值得"）和自明之理。
- **想探索深化后模块的 alternative interface？** 运行 `/codebase-design` skill 并使用它的 design-it-twice 并行 sub-agent 模式。
