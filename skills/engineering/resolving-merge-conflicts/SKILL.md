---
name: resolving-merge-conflicts
description: "Use when you need to resolve an in-progress git merge/rebase conflict."
---

# Resolving Merge Conflicts（解决合并冲突）

1. **查看当前状态**——合并或 rebase 的状态。检查 git 历史和冲突文件。

2. **找到每个冲突的一手来源**。深入理解每个变更为什么被做出，以及原始意图是什么。阅读 commit 消息，检查 PR，检查原始 issue/tickets。

3. **解决每个 hunk。** 尽可能保留两个意图。在不可兼得时，选择与合并声明目标一致的那个，并记录权衡。**不要**发明新行为。始终解决；永远不要 `--abort`。

4. **发现项目的自动检查**并运行它们——通常是类型检查，然后测试，然后格式化。修复合并引入的任何问题。

5. **完成合并/rebase。** 暂存所有内容并提交。如果是 rebasing，继续 rebase 过程直到所有 commits 都被 rebase 完成。
