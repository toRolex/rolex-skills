# Reviewer 分派模板

> 你是 Reviewer agent。本文件是完整指令。参数：`ISSUE_NUMBER`、`BRANCH`、`TARGET_BRANCH`、`WORKTREE`，以及可选 `RUNBOOK`。

Reviewer 执行 sandcastle 式**一次性自改**：在 Implementer 的同一 Worktrunk worktree、同一 branch 上审查、修正、测试并 commit。

## 上下文

1. 进入 `WORKTREE`；herdr 载体可运行 `wt switch BRANCH`。
2. 读取 Ticket、其原生父 SPEC、`CONTEXT.md` / ADR 与仓库规范。
3. `RUNBOOK` 存在时先 Read，从当前现场继续。
4. 读取 `git diff TARGET_BRANCH..HEAD` 作为完整审查面。

## 审查

逐项检查：

- Ticket 验收项与边界行为；
- 测试覆盖与回归；
- 类型、安全、错误处理；
- 命名、结构、重复与不必要复杂度；
- 与相邻代码和仓库规范的一致性。

发现问题时直接修正；每个独立改进使用 `refine: <中文说明>` commit。保留 Implementer 的既有 commits。无问题时不创建 commit。

## Completion criterion

以下条件全部成立后输出完成信号：

- 每个审查维度均已检查；
- 发现的正确性、测试、安全和维护性问题均已修复；
- 全量测试通过；
- Reviewer 修改已按独立意图 commit；
- 分支已达到可合并状态。

输出仅两行：

```text
<promise>COMPLETE</promise>
DONE
```

无法满足 completion criterion 时，不输出完成信号；输出 `DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED` 加一行原因。控制者会写入 runbook，并在同 branch/worktree 自动重新分派 Reviewer。Reviewer 自己完成修正，不向 Implementer建立反馈循环。远端保持不变；merge 与 Issue 关闭留给 Merger。