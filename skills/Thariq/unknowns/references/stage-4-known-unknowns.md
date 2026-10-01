# Stage 4 — Known Unknowns：访谈收敛

经过盲点扫描与具体候选，原本隐藏的问题已经能叫出名字。现在收敛这些决策，而不是要求用户在没有实物时想象偏好。

## 做法

1. 汇总尚未回答的显式问题：盲点留下的选择、brainstorm 和 prototype 反馈、reference 的迁移差异。公开问题队列，高架构影响的问题优先。
2. 调用 Skill 工具两次，分别传入 `grilling` 和 `domain-modeling`，采用 [grill-with-docs](../../../engineering/grill-with-docs/SKILL.md) 的同一组合。传入当前地图、候选反馈和参考语义。保持 Matt 的 skill 不变。
3. 访谈的 design tree、frontier、提问轮次和等待行为以 `grilling` 为准；术语、glossary 和 ADR 的持久化以 `domain-modeling` 为准。本阶段不再另外要求“一次一题”，避免和 frontier rounds 冲突。
4. 已回答的问题记录答案、证据和关闭者。用户明确同意推迟的问题记为 OPEN，并写明阻塞性、解锁条件和恢复时要处理的 design tree 分支。OPEN 仍是未解决分支，不从 frontier 中假删除，也不算通过 grilling 的结束条件。
5. 访谈揭示仍需看到实物才能回答的问题时，回到 stage 3；发现新的盲点时补做 stage 2。每次收回新证据都更新地图，再继续当前决策队列，不重复已经确认的问答。

需要参考源码才能说清行为时，读取 [References](references.md)，理解并展示语义与差异，再回到访谈签收。

## 完成或暂停

- **正常完成：** 按 `grilling` 的规则，当前 design tree 已收敛、frontier 为空，用户确认 shared understanding。稳定决策收成“一行决定 + why”，再进入 stage 5。
- **暂停交接：** 仍有未解决分支，且外部事实暂缺或用户明确要求推迟时，暂停访谈，不宣称 grilling 或本阶段完成。记录 OPEN、解锁条件、恢复分支及下一步；经用户确认后可进入 stage 5 交付标注“访谈暂停”的阶段性地图。这是进度交接，不是通过完成门。阻塞 OPEN 存在时地图不得启动实现；恢复后先回到本阶段继续访谈。

回到 stage 2 或 3 获取新证据属于访谈中的暂时绕行，返回后重新计算 frontier，不把绕行本身当成决策已解决。
