# Stage 2 — Unknown Unknowns：盲点扫描

先让用户看见自己不知道该问的事，再要求他们判断候选。疆域常常知道你们都未考虑的陷阱。

## 做法

1. 调用 Skill 工具，传入 `blind-spot-pass`。交给它 stage 1 的已知事实、假设、用户经验起点和任务范围；其教学与扫描方法是 [blind-spot-pass](../../blind-spot-pass/SKILL.md) 的唯一职责。
2. 收回盲点发现，记录到地图：证据、为什么咬人、它改变了任务的什么，最重要的在前。披露扫描覆盖与局限，不把没看过的代码说成已覆盖。
3. 需要用户选方案的发现先进入 stage 4 的 known unknowns 队列；只需要了解的记录为 sharp edge。会阻止当前探索的关键约束立即澄清，不为等待访谈而隐瞒。
4. 用户缺少领域语言或“好”的判断标准时，先解释；需要参考物帮助理解时，进入 [References](references.md)。

**完成：** 盲点扫描已经执行，用户已看到重要发现，每条都标记为已知事实、待决定、OPEN 或 sharp edge。然后进入 stage 3 的 brainstorm/prototype，不代替用户做最终决策。
