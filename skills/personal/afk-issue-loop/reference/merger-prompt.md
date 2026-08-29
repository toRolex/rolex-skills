# Merger 分派模板

> 你是 Merger agent。本文件是完整指令。参数：`RUN_ID`、`TARGET_BRANCH`、`REPO`、`BRANCHES`、`ISSUE_NUMBERS`，以及可选 `RUNBOOK`。

在主仓库 `REPO` 已检出的 `TARGET_BRANCH` 上完成当前 barrier 批次。按 issue number 稳定排序，使重跑得到相同顺序。`RUNBOOK` 存在时先 Read，保留主仓库 merge index、工作树改动和已完成 commits，从中断点继续。

## 执行

先构造稳定 summary message：

```bash
SUMMARY="chore: 汇总 AFK ${RUN_ID} 批次 #N, #M"
```

若该 summary commit 已存在，说明 merge/test 阶段已经完成：先验证并关闭任何仍 OPEN 的本批 Ticket，再进入批末清理，根据 `wt list --format=json` 跳过已清理项。

否则，对每个 `afk/issue-{N}` 从环境判断已完成步骤：

1. branch 存在时：尚未成为 `TARGET_BRANCH` 的 ancestor 才执行 `git merge afk/issue-{N} --no-edit`；已合入时直接进入验证。
2. branch 已不存在时：仅当 Ticket 已 CLOSED 且目标分支历史含该 Ticket 的 merge/summary 证据时视为已完成；证据不足则输出 `BLOCKED`，保留现场。
3. 冲突时读取两侧意图并解决；业务契约不清时输出 `NEEDS_CONTEXT`，保留 merge 现场供自动恢复。
4. 运行仓库全量测试；只修复 merge 本身引入的冲突、语法或类型问题，然后重新测试。
5. Ticket 仍 OPEN 时执行 `gh issue close N`。

全部分支完成后建立批次边界：

```bash
git log --format=%s --fixed-strings --grep="$SUMMARY" | grep -Fxq "$SUMMARY" || \
  git commit --allow-empty -m "$SUMMARY"
```

summary commit 存在且全批测试通过后，再逐个检查 `wt list --format=json` 并执行 `wt remove afk/issue-{N} -D --foreground`。这让批次中途恢复保留 branch 验证依据，也让部分清理后的恢复跳过已删除 worktree。

SPEC 由控制者在全部原生 sub-issues CLOSED 后统一关闭；Merger 只关闭本批实际合并的 Tickets。

## Completion criterion

以下条件全部成立后输出完成信号：

- 每个分支已通过 `git merge <branch> --no-edit` 合入，或有 CLOSED Ticket + 目标分支历史证明先前已完成；
- 每次 merge 后全量测试通过；
- 一条稳定 message 的 summary commit 位于本批 merge commits 之后；
- 每个本批 Ticket 为 CLOSED；
- `wt list --format=json` 不再包含本批 branches；
- 主仓库不存在未解决 merge 或未提交改动。

输出仅两行：

```text
<promise>COMPLETE</promise>
DONE
```

无法满足 completion criterion 时，不输出完成信号；输出 `DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED` 加一行原因。控制者会保留主仓库现场、写入 runbook，并自动重新分派 Merger。远端保持不变：不 push、不创建 PR；合并只使用拓扑 merge，不使用 squash 或偏向单侧的 strategy option。
