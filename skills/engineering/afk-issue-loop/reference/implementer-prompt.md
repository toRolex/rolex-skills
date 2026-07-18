# 实现 agent 分派模板

两种模式使用同一模板，仅工作目录段不同。其余步骤（seam 确认 → TDD → 全量测试 → commit → 本地 merge → 清理 worktree → 关 issue）完全一致。

---

**subagent 模式** — 工作目录段用此版本：

```
## 工作目录

[worktree 的绝对路径，已由 `wt switch -c <prefix>/<issue-id>-<name> -b develop` 预创建]

你在这个 worktree 中直接工作，不需要自己创建分支或隔离环境。
```

**herdr 模式** — 工作目录段替换为：

```
## 工作目录

你没有预置 worktree。请先自行创建并切换：

  wt switch -c <prefix>/<issue-id>-<short-name> -b develop

确认已在 worktree 目录内后，再进行后续步骤。
```

---

完整模板（合并工作目录段后）：

```
你正在实现 GitHub issue #[number]：[title]

## Issue 内容

[gh issue view <id> --json title,body 的完整输出]

## 领域上下文

[粘贴 CONTEXT.md 完整内容，如存在]

[粘贴相关 ADR 内容，如存在]

## 工作目录

[按模式选择上面的对应版本，替换此行]

## 你的工作

**边界规则**：你只能在 worktree 目录内工作。禁止 `cd` 回主仓库或在主仓库执行 git 命令。

严格遵循 TDD 流程，不允许直接写实现代码：

1. **确认 seam**：阅读 issue body 中的 Testing Decisions 段落和代码库中相关测试。列出你计划测试的 seam（一行一句，标注测试所在文件和方法），**在写任何代码前向控制者确认这些 seam 是否正确**。控制者确认后你才能进入第 2 步。
2. **红**：确认后，先写一个失败测试
3. **绿**：写最小实现使其通过
4. **循环**：一个垂直切片（一个 seam → 一个测试 → 一个实现），重复直到 issue 完成
5. **全量测试**：运行项目的全量测试套件，确保零回归
6. **提交**：通过后 commit
7. **合并**：在 worktree 内执行本地 merge，不推送远程：
   ```bash
   git checkout develop
   git merge --no-ff --no-squash <当前分支名>
   ```
   然后手动清理 worktree 和分支：
   ```bash
   cd /path/to/main/repo  # 退出 worktree
   wt remove <worktree路径>
   git branch -D <当前分支名>
   ```
8. **验证 merge**：确认 merge commit 有 2 个 parent：`git cat-file -p HEAD | grep "^parent"`。如果只有 1 个 parent，说明 merge 未生效，**不得关闭 issue**，先排查原因。
9. **关闭 issue**：`gh issue close [number]` — **硬性要求，汇报 DONE 前必须执行**

**全量测试是硬性要求**。在你汇报 DONE 之前，项目的全量测试套件必须全部通过。

## 汇报格式

- **状态**：DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- 实现了什么（或被阻塞时尝试了什么）
- **全量测试结果**（必须贴实际输出）：命令 + 通过/失败数量
- 修改了哪些文件
- **Issue 关闭**：已关闭（gh issue close [number] 已执行）/ 未关闭（原因）

**状态说明**：
- DONE — 全部完成，全量测试通过，无误
- DONE_WITH_CONCERNS — 完成了但全量测试有非你的改动引起的失败（具体说明哪些是预存的）
- BLOCKED — 无法完成，需要帮助
- NEEDS_CONTEXT — 缺少信息无法继续
```
