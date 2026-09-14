# AFK 目标工作区有未提交改动不阻止 Merger

[ADR 0007](0007-afk-git-site-recovery.md) 曾规定「目标 dirty 只阻止 Merger，同 run 已通过的 I/R 保留在合并队列，目标恢复 clean 后继续」。本决策替代该条：**目标工作区存在用户未提交改动不再是阻塞 Merger 的理由，引擎只把目标处于未完成的 merge/rebase/冲突视为硬拒。**

## 为什么原决策必须改

原策略把「用户手上有没提交的东西」等同于「引擎不能开工」。实际后果是**全局永久停摆**：`prepareTarget()` 一旦发现目标脏就设置全局 `targetReason`，而 Merger 是唯一的合并与关闭通道，于是所有票都无法交付，run 只能停在 `waiting-user`。在真实的纯 Skill/文档仓库里，用户工作区长期带着在写的文档改动是常态，这个预检等于让引擎永久不可用。

更关键的是**该预检与 Git 自身的保护重复，且比 Git 更严**。实测（`git merge` 在两方修改同一文件、未跟踪文件将被合并覆盖等会丢失工作区改动的情形下自行拒绝并中止，且**不改动用户文件**；在非重叠脏改动下合并成功，用户的未提交改动**原样保留**）：

| 目标工作区状态 | `git merge` 行为 | 用户改动 |
|---|---|---|
| 非重叠的已跟踪脏改动 + 未跟踪文件 | 合并成功 | 原样保留 |
| 重叠的已跟踪脏改动（双方改同一文件） | 拒绝并中止 | 完好，无残留 MERGE_HEAD |
| 未跟踪文件将被合并引入的新文件覆盖 | 拒绝并中止 | 完好 |

也就是说 Git merge 对「会丢失用户改动」的场景是 fail-closed 的。引擎在这之上再做一遍更严的预检，唯一净效果就是把「Git 本可安全推进的局部情况」升级为「整个 run 关不掉任何票」，而没有多保护任何东西。

## 决策

- `prepareTarget()`、`recheckTarget()`、`mergePending()` 派发前的目标门禁**只保留 `inProgress()`**（未完成的 merge/rebase/revert/cherry-pick/冲突）。这才是引擎无法安全接续、且不属于「用户只是有未提交改动」的现场。
- 阻塞原因由 `targetDirtyReason` 改为 `targetInProgressReason`；`recheckTarget()` 的自动恢复路径相应只对 in-progress 生效。原地保留的 `merge-deferred-target-dirty` 等待循环随之删除。
- **保留一条针对性核实**：`prepareTarget()` 快照目标已有的未提交路径（`targetPreexisting`），在 summary 提交后核实该提交的 `--name-only` 与快照无交集。理由：原预检恰好也挡住了「Merger 用 `git add -A` 把用户基线改动卷进 summary 提交」——那会让用户改动凭空从工作区消失、变成别人的提交。Merger 契约本就允许用空提交承载 summary，不需要 `git add`，因此归属违契约行为；这条核实用一条命令换取该风险的封闭，不做持续阻塞。
- `inspectMerger()` 与 summary 前置条件中的 `dirty(targetCwd)` 判据移除（改为只要求 `!inProgress`）。若保留，脏目标下 close 阶段将永远无法被确认为成功，等于把停摆放到了另一处。

## 被接受的取舍

- **用户改动可能与合并结果语义冲突而不被 Git 察觉**：Git 只保证不丢失文本改动，无法判断用户的未提交改动是否与刚合入的内容在语义上矛盾。这交给用户：改动仍在工作区，用户可见、可自行处理。原预检并未解决这个问题，只是把整个 run 停下。
- **Merger 违规 `add -A` 的残余风险**：summary 提交核实能发现吞并，但它发生在提交之后，且与「用户在同一窗口自己编辑并提交」不可区分。此处选择先核实并如实报告，不引入更重的快照/HEAD 协议。
- 不再有「等用户把目标弄干净后自动继续」的自动恢复语义：目标 in-progress 需要用户实际处理冲突，引擎不自愈。

## Consequences

- 全局 `targetDirtyReason` 消失，`target-blocked` 事件只在目标 in-progress 或归属异常时发出。
- 目标带着未提交改动的 run 可以完整走完 I→R→M 并关闭 Issue，这是纯 Skill/文档仓库的常态。
- `scripts/afk-recovery.test.mjs` 中原「目标 dirty 时保留已审查队列，恢复 clean 后不重跑 I/R 直接派 Merger」用例建立在本决策推翻的语义上，替换为两条：目标有未提交改动时 Merger 照常合并关闭且用户改动原样保留、未被 summary 吞并；目标存在未完成 merge 冲突时仍保留现场等待用户。
- [ADR 0007](0007-afk-git-site-recovery.md) 的其余部分（现场恢复、writer policy、`merged-unverified`、worktree 清理与交付分离）继续有效，本决策只替代其第 7 行关于目标 dirty 的一句。
