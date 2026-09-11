---
name: afk-issue-loop
description: 按 GitHub 原生依赖成批并行实现与审查 Tickets，批末统一合并成功部分；失败本次跳过。
disable-model-invocation: true
argument-hint: "[issue-number ...] [mode=subagent|herdr]"
---

# AFK Issue Loop

**读取依赖 → 一批并行 Implementer→Reviewer → allSettled → 一个 Merger → 刷新依赖 → 下一批。** 控制者只读业务输入、调度和核对成果，不写实现代码。单批最多四个 Ticket，批内不补位。

## 1. 读取真实任务

1. 解析显式 Ticket 编号；未指定时分页读取全部 open `ready-for-agent` Issues，排除 PR。默认 `mode=subagent`；仅显式选择才用 Herdr。保留用户模型/角色偏好，未指定使用宿主默认，实际不可用时报告原因。
2. 确定 `REPO`、本次加载目录的绝对 `SKILL_ROOT`、`RUN_ID`、目标分支（本地或远端存在 develop 则 develop，否则 main）。同次压缩/续接沿用运行身份和跳过集合；用户下一次明确调用才建立新运行。
3. 控制者按 [输入闭包](REFERENCE.md#输入闭包)直接读取原生 blocked-by、父 SPEC 及资格，保存薄记录。原生父 SPEC 只供上下文。输入失败、关系不完整、资格不符或循环，报告具体节点并停止建批，不执行旧图。
4. 按 [记录与再次调用](REFERENCE.md#记录与再次调用)核对相关旧现场及已交付证据；已交付只处理剩余收尾。按 [现场绑定](reference/workspace-binding.md)在真实分派/写入/交接时检查所需边界。
5. 首次图使用 `scripts/validate-plan.sh --expected-run-id RUN_ID [--expected-roots N,N] --live PLAN` 校验。默认输入省略 expected-roots。运行中离线校验结构，实时资格和依赖由控制者逐批核对。

**完成标准**：输入及开放 blocker 闭包完整、唯一、无环，现场归属明确；或有具体阻塞报告。直接进入真实任务，不启动 Planner、能力探测或握手角色。

## 2. 固定批次，并行流水线

1. 每批前刷新候选资格与原生依赖；从未尝试且依赖满足的 Ticket 按编号选最多四个，持久化固定批次。失败集合始终排除。相关未知占用按 [有限停止与隔离](REFERENCE.md#有限停止与隔离)处理。
2. 控制者用 Worktrunk 为入选 Ticket 建立独立 `afk/issue-{N}` 现场，固定 `IMPLEMENTATION_BASE_SHA`。一次派发本批所有真实 Implementer，不等待第一个结果才派其余。每次携带运行/批次/Ticket 身份、模板绝对路径、现场、基线及模型偏好；模板由角色自行读取。
3. 每个 Implementer 成果验收且写者退出后，立即在同现场启动 Reviewer；其他 Ticket 可以仍在实现。Reviewer 自查、自改并测试；固定 `REVIEW_BASE_SHA`、`REVIEWED_SHA` 与证据位置。
4. 依 [阶段验收](REFERENCE.md#阶段验收)分类结果。明确失败置 `skipped`，本次不重派；正常尝试内可调试修正。原生最终通知即可工作，无中途 ACK 要求。
5. **allSettled**：等待本批每条管线审查成功或明确失败；退出未知也可归类失败，但现场仍冻结。所有管线有结果后才建立成功集合，批内空位保持空置。

分派提示只需以下寻址参数，无需控制者全文加载角色模板。

```text
直接读取 ${SKILL_ROOT}/reference/implementer-prompt.md 执行真实 Ticket。
RUN_ID, BATCH_ID, ISSUE_NUMBER, REPO, TARGET_BRANCH, BRANCH, WORKTREE,
IMPLEMENTATION_BASE_SHA, RESULT_PATH；按宿主接口设置模型偏好。
```

Reviewer 换用 `reviewer-prompt.md`，额外传实现成果地址和 `REVIEW_BASE_SHA`。通知按稳定任务身份关联、阶段只生效一次。

**完成标准**：本批每个 Ticket 均已审查可验收或本次跳过；不会因某个失败取消无关管线，也不会因未知退出无限等待。

## 3. 批末一个 Merger

1. 成功集合为空：不派 Merger，记录本批结果，进入步骤 4。
2. 成功集合非空：确认各入选现场已退出、目标分支安全，且失败未知写者与成功集合及目标分支的隔离可证明。无法证明则有限观察后返回阻塞，不强行合并。
3. 只启动一次 Merger，读取 `reference/merger-prompt.md`，传本批成功集合清单绝对路径、运行/批次身份、目标现场、结果文件地址。Merger 按编号顺序处理分支，目标分支始终单写者。
4. Merger 返回后逐 Ticket 核对精确 SHA、审查与测试证据、目标实际历史；汇总 COMPLETE 不能证明全部交付。保留已验收成功；未交付部分本次 skipped。目标冲突、未知写者或未验收修改会阻塞后续合并。
5. **交付、关闭、清理分别登记**。结果与证据先保存，写者退出后才按准确现场清单安全清理；清理失败不撤销交付、不重新实现。具体合并算法只在 Merger 模板维护。

**完成标准**：本批每个入选项均有实际交付或失败事实，关闭和残留可区分；Merger 已安全退出或相关现场明确冻结。

## 4. 批末刷新与结束

1. 上批合并/无成功集处理及核对完成后，再刷新 GitHub 资格、关闭事实和原生依赖，回步骤 2。被 skipped blocker 的下游仍依赖阻塞，不伪造执行失败。
2. 无可安全推进工作时结束本次调用，保留简短失败与现场证据。下次调用重新评估；上下文压缩不清空本次 skipped。
3. 对涉及的 SPEC 分页读取全部原生 sub-issues：非空且全部 CLOSED、无本次已知未验收成果，才可关闭 OPEN SPEC；读取失败报告，不推断完成。
4. 报告本次交付、初始关闭审计、本次跳过、依赖阻塞、退出未知、待关闭/待清理，附批次、SHA/证据和现场地址；区分全部完成、部分失败和安全阻塞。提示后续 review/QA。

**完成标准**：所有已开始工作有事实归类，未安全结束现场有记录；停止不等于成功。运行记录保留到可安全核对及收尾，不通配删除其他运行材料。

## 按需读取

- 输入、状态、失败、薄记录及脚本：[REFERENCE.md](REFERENCE.md)
- 角色动作边界：[现场绑定](reference/workspace-binding.md)
- 角色自加载：[Implementer](reference/implementer-prompt.md) / [Reviewer](reference/reviewer-prompt.md) / [Merger](reference/merger-prompt.md)
- 调度与异常示例：[EXAMPLES.md](EXAMPLES.md)
