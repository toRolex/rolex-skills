---
name: afk-issue-loop
description: 按 GitHub 依赖分批实现 Tickets，逐票审查，批末合并成功部分；失败本次跳过。
disable-model-invocation: true
argument-hint: "[issue-number ...]"
---

# AFK Issue Loop

你就是调度者，亲自读票、分派和核对结果。**直接派 Implementer，不把本 skill 或整批调度转交给另一个 agent。** 业务代码由 Implementer 实现、独立 Reviewer 审查，Merger 负责批末合并。

```text
当前 agent
├─ Implementer A → Reviewer A
├─ Implementer B → Reviewer B
└─ 本批结果明确 → 一个 Merger → 刷新依赖 → 下一批
```

使用当前 harness 已有的委派和结果获取方式，遵守其调用约束及用户指定的模型。需要创建现场或查询执行接口时，读 [工作现场](reference/workspace-binding.md)。

## 1. 选票

1. 有编号就读取指定 Tickets；否则分页读取所有 open `ready-for-agent` Issues，排除 PR。按 [输入与依赖](REFERENCE.md#输入与依赖)核对原生 blocked-by、开放 blocker 闭包、资格和循环；父 SPEC 的处理也在该处。
2. 确定目标分支：用户指定优先，否则本地或远端有 develop 就用 develop，没有则 main。从依赖已满足的未尝试 Tickets 中按编号选最多四个，固定本批成员；一票就绪也可开工。
3. 在简短 [运行记录](REFERENCE.md#运行记录与重新开始)中记下本批。读取临时失败按 [读取失败](REFERENCE.md#读取失败)处理；需要复用旧现场或用户要求重新开始时，只核对该记录章节规定的相关事实。

完成条件：每个入选 Ticket 的执行资格和依赖均已确认，本批成员已记录。未知或不满足的项有具体阻塞原因，未被当成就绪票。

## 2. 直接派发 Implementer

1. 按 [工作现场](reference/workspace-binding.md#分派)用 Worktrunk 为本批各票建独立 worktree，记录原始实现基线。
2. 按 [Implementer 模板](reference/implementer-prompt.md)，直接派出各票实现者，给出 Ticket、目录、分支、固定基线、目标分支、必要材料及模型要求。让本批各票并发工作，不等第一票结束再派其余。

完成条件：本批各票的真实 Implementer 已启动，任务与现场可以关联；未能启动的项已有失败或阻塞记录。准备清单、记录或调用脚本不算启动实现。结果未知时按 [失败与停止](REFERENCE.md#失败与停止)处理。

## 3. 逐票接力审查

1. 某票实现结束，核对提交、测试结果及写者退出后，立即按 [Reviewer 模板](reference/reviewer-prompt.md)派独立审查者接手同一现场；其他票继续实现。
2. Reviewer 直接修正问题、测试并提交。明确失败按 [失败与停止](REFERENCE.md#失败与停止)记为本次跳过，无关票继续。批内成员保持不变，不补新票。

完成条件：本批每票均有绑定精确 SHA 的审查通过结果，或明确的失败/阻塞结果。退出不明的现场保持占用；实现或审查失败的分支不进入成功集。

## 4. 批末合并与下一批

1. 成功集为空则结束本批。有成功集时，确认目标现场及写者隔离安全，派一个 [Merger](reference/merger-prompt.md) 顺序合并本批成功分支。
2. 按 [交付与收尾](REFERENCE.md#交付与收尾)逐票核对实际合并、测试、Issue 关闭及现场清理结果，登记部分成功和待收尾事项。
3. 本批核对完成后刷新依赖，回步骤 1。没有可安全推进的任务时，汇报已交付、初始已关闭、本次跳过、依赖阻塞和待收尾事项，附提交及现场位置。

完成条件：本批每项成果均已核对并记录；只有合并与目标安全状态明确后才建下一批。结束运行时，所有未交付或未安全结束的工作均有具体去向。

需要对照完整批次、父 SPEC、读取故障或重新开始的例子时，读 [EXAMPLES.md](EXAMPLES.md)。
