# Stage 3 — Unknown Knowns：头脑风暴与原型

用户（或 codebase）握着尚未表达的口味、词汇、惯例和 context。判断标准只有看到才能定义时，廉价的候选与原型能在实现成本变高前抽出这些知识。

## 做法

1. 调用 Skill 工具，传入 `brainstorm`，带上目标、stage 1 的事实、stage 2 的盲点和已有 references。候选生成、范围发散和反馈方式由 [brainstorm](../../brainstorm/SKILL.md) 负责。
2. 需要实际操作 UI 或 state model 才能判断时，brainstorm 调用 `prototype`；若已有明确问题而无需发散，可直接调用 Skill 工具传入 `prototype`。它的 UI/logic 分支与制作规则仍由 Matt 的 [prototype](../../../engineering/prototype/SKILL.md) 拥有，不在这里重写。
3. 先用原型回答布局、行为或状态问题，不把“看看按钮的位置”扩张成接好后端的完整实现。用户未提供参考且表达困难时，进入 [References](references.md)。
4. 在 artifact 交给用户后停下。收集保留、舍弃、组合及理由；追问 tacit context：谁消费它、在哪里运行、接手者怎样判断完成。
5. 把反应写进地图，说明它改变了哪些假设或约束。新的显式问题交给 stage 4 的访谈，不把反应里的模糊偏好当成已批准 spec。

**完成：** 用户对具体候选或原型已作出反应，context probes 已回答或明确推迟，偏好、约束与新问题都在地图上。然后进入访谈收敛。
