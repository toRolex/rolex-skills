# Design It Twice（设计两遍）

当用户想为选定的深化 candidate 探索替代 interface 时，使用这种并行 sub-agent 模式。基于 "Design It Twice"（Ousterhout）：你的第一个想法不太可能是最好的。

使用 [SKILL.md](SKILL.md) 中的词汇：**module**、**interface**、**seam**、**adapter**、**leverage**。

## 流程

### 1. 框定问题空间

在启动 sub-agents 之前，为选定的 candidate 写一份面向用户的、关于问题空间的说明：

- 任何新 interface 需要满足的约束
- 它依赖什么，以及它们属于哪个类别（见 [DEEPENING.md](DEEPENING.md)）
- 一个粗略的示例代码草图，让约束落地，不是 proposal，只是让约束变得具体的方式

把它展示给用户，然后立即进入步骤 2。sub-agents 并行工作时，用户阅读并思考。

### 2. 启动 sub-agents

使用 Agent 工具并行启动 3+ 个 sub-agents。每个都必须为深化后的 module 产出一个**截然不同**的 interface。

为每个 sub-agent 提供单独的技术 brief（文件路径、coupling 细节、来自 [DEEPENING.md](DEEPENING.md) 的依赖类别、seam 后面是什么）。这个 brief 独立于步骤 1 中面向用户的问题空间说明。给每个 agent 一个不同的设计约束：

- Agent 1："最小化 interface：最多瞄准 1–3 个入口点。最大化每个入口点的 leverage。"
- Agent 2："最大化灵活性：支持许多用例和扩展。"
- Agent 3："为最常见的调用者优化：让默认情况变得微不足道。"
- Agent 4（如果适用）："围绕 ports & adapters 设计，以处理跨 seam 的依赖。"

把 [SKILL.md](SKILL.md) 词汇和 CONTEXT.md 词汇都包含在 brief 中，这样每个 sub-agent 的命名都与 architecture 语言和项目的领域语言一致。

每个 sub-agent 输出：

1. Interface（类型、方法、参数，外加不变量、排序约束、错误模式）
2. 展示调用者如何使用它的用法示例
3. implementation 在 seam 后面隐藏了什么
4. 依赖策略和 adapters（见 [DEEPENING.md](DEEPENING.md)）
5. 权衡：leverage 高在哪里、薄在哪里

### 3. 呈现并比较

按顺序呈现设计，让用户逐个吸收，然后用文字比较它们。按 **depth**（interface 处的 leverage）、**locality**（变更集中在哪里）和 **seam 放置**进行对比。

比较之后，给出你自己的推荐：你认为哪个设计最强，为什么。如果不同设计的元素能很好地结合，提出一个混合方案。要有主见：用户要的是一个强判断，不是一个菜单。
