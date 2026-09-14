# 删除 Self-report / Gate / Delivery 三层自创判定，回归上游语义

Issue #13 的决策，一次做完的纯减法：**删掉从未是需求的三层自创判定，让 AFK 回到"去 Docker、skill 化"的上游语义。**

## 为什么这三层必须删

它们是实现过程中自作主张加出来的东西，不在任何需求里。上游 sandcastle 的 `parallel-planner-with-review` 用一套极简语义就跑通 planner → implementer → reviewer → merger 全流程：implementer 产出 commits 才进 review，有 commits 的分支才进 merge，merger 按 prompt 指令合分支、跑测试、关 Issue。AFK 叠加的三层带来了持续的误杀（issue #12 修掉两处）、文档与实现对不上的措辞漂移、以及每次对齐上游都要先绕开自创逻辑的额外成本。

## 决策

**删除的三层与相关机制**

- 删除 `gateAccept` / `gateReject`（含 `stagnationCounted` 载荷）、`noteRejection` / `clearRejections`、rejections 计数表、`stagnantRounds` 阈值、以及所有 `engine/gate` 与 `engine/delivery` 观测发布点。
- 删除 `role/self-report` 独立观测发布（传话格式保留在 provider 原始负载里，不再是判定层）。
- 删除"自报通过但无提交"、"Reviewer 脏树"等 Gate 拒绝原因；pipeline 的推进只看 commits 摘要非空与 Git 事实。
- Merger 路径的逐票 delivery 观测一并删除；Merger 结果只做身份形状与血缘核验，新增 `merger-result` 观测供看板推导状态。
- 停滞文案、`blocks` 因 Gate 拒绝的写入、"新 Gate 接受清零"同步删除（无 Gate 即无清零）。

**上游语义的回归**

- Implementer 完成后按提交摘要非空决定是否进 Reviewer；Reviewer 结果的提交与 Implementer 合并后进入待合集。
- 待合集筛选条件为"正常完成且提交非空"，与上游 `fulfilled + commits.length > 0` 同义，另以 `rev-list --count` 做 Git 事实对照。
- 外层加全局最大轮次（默认 10，`--max-rounds` 可配），达到即正常结束当前 run；这是 run 有界性的唯一机制。
- Merger 单次调用完成合并、验证、关闭三件事；关闭指令在 prompt 内，引擎不代关。
- 引擎对 Merger 结果保留的核验：身份形状（run/attempt/role、branch/cwd 绑定、逐票分支对应——`original.workspace.branch !== item.branch` 即拒）与合并血缘事实（分支已成为目标祖先）+ 用户基线改动不被吞并（612f7ff 既有保护，非本次新增）。verified 与 summary 前置不再作为关闭阻断。
- merge/close 两阶段（先持久化合并验证、再独立 close-only 调用）保留：US10 的"单次调用"指合并验证关闭三件事都由 Merger prompt 执行、引擎不代关，不指压缩为一次 runRole 调用；两阶段持久化是防坏封套重做的既有机制，由既有用例锁住。
- `merger-result` 是引擎在 `merge-progress` 旁新增的一条逐票观测事实（merged/verified/closed/phase），看板只能读 observations.jsonl 而不能读 events.jsonl，因此需要它来推导逐票状态；US15 的保留清单按此增补一条。
- 保留 issue #12 的非三层改动：Reviewer prompt 的上游 EXECUTION 对齐、providers / processes 的终局信号裁定权限（含三 harness 洗白）。

**Dashboard 与观测**

- 删除的观测种类：`self-report`、`gate-accepted`、`gate-rejected`、`delivery-*`。看板逐票状态改从 Merger 逐票结果（`merger-result`）与 Git 祖先关系推导。
- 保留的观测种类：provider 原始负载、text-delta、tool-call、进程起止与 Invocation、stderr、Recovery 全套。排障不断档。

## 被接受的取舍

- **引擎不再独立复核交付质量（误关票无人拦）**，这是使用者明确接受的取舍：要机器自动关票又要零误关，两者不可兼得；上游把最终判断留给人和 Merger prompt，本机同此办理。
- 教训：prompt 即代码。关票指令在 merge-prompt 文字里，不在编排器代码里；此前"上游没人关票"的误判正源于只 grep 代码不读 prompt。

## Consequences

- `afk-recovery.test.mjs`：停滞三用例删除，替换为"无提交不进 Reviewer"、"Reviewer 持续失败重试到轮次上限"、"载体层失败重试到轮次上限"三条轮次上限锁，外加全文件"三层观测零出现"断言；权限终局回归保留（改断言为 Merger 派发 + 不进 waiting）。
- `afk-dashboard.test.mjs`：journal 身份测试、Merger batch 测试、not-run 测试全部改断言 `merger-result` 与三层零出现。
- REFERENCE / SKILL / EXAMPLES 中 Gate、Delivery、停滞熔断措辞清零；`--max-rounds` 写入 help 与 REFERENCE。
- `grep 同因拒绝` 只剩本历史 ADR。
