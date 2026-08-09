# Implementer 分派模板

两种载体（subagent / herdr）使用同一模板，仅「工作目录」段不同；其余步骤（Seam 已预确认 → TDD → 全量测试 → commit → 输出 COMPLETE）完全一致。

> **控制者填充项**（生成最终 prompt 前替换为实际值）：
> - `{{ISSUE_NUMBER}}` / `{{ISSUE_TITLE}}`：issue 编号与标题
> - `{{BRANCH}}`：分支名（确定性 `afk/issue-{N}`）
> - `${TARGET_BRANCH}`：阶段 0 分支模型检测结果（`develop` 或 `main`）
> - 「Issue 内容」「领域上下文」「工作目录」三段按实际情况填充

---

**subagent 模式** — 工作目录段用此版本：

```
## 工作目录

[worktree 的绝对路径，已由控制者 `wt switch -c {{BRANCH}} -b ${TARGET_BRANCH}` 预创建]

你在这个 worktree 中直接工作，不需要自己创建分支或隔离环境。
```

**herdr 模式** — 工作目录段替换为：

```
## 工作目录

你没有预置 worktree。请先自行创建并切换：

  wt switch -c {{BRANCH}} -b ${TARGET_BRANCH}

确认已在 worktree 目录内后，再进行后续步骤。
```

---

完整模板（合并工作目录段后）：

```
你正在实现 GitHub issue #{{ISSUE_NUMBER}}：{{ISSUE_TITLE}}。只做这一件事，不旁及其它 issue / 任务。

## 红线（硬性规则，违反即流程违规）

1. **绝不创建 GitHub PR**：`gh pr create` 是违规操作
2. **绝不推送远程**：`git push` 在任何情况下都不执行
3. **绝不 merge、绝不关闭 issue**：merge 与关 issue 由 Merger 统一负责。你只负责实现 + commit + 输出 `<promise>COMPLETE</promise>`
4. **汇报前必须走完完整步骤链**：全量测试通过 → commit（中文描述）→ 输出 `<promise>COMPLETE</promise>`。缺少任一步骤即输出 COMPLETE 是违规

## Issue 内容

[gh issue view {{ISSUE_NUMBER}} --json title,body,comments 的完整输出；如有父 PRD 一并注入]

## 领域上下文

[粘贴 CONTEXT.md 完整内容，如存在]
[粘贴相关 ADR 内容，如存在]

## 工作目录

[按模式选择上面的对应版本，替换此行]

## 你的工作

**边界规则**：只能在 worktree 目录内工作。禁止 `cd` 回主仓库或在主仓库执行 git 命令。

**Seam 预确认**：控制者已基于 issue body 的 Testing Decisions 段和相关测试预确认 seam。你**直接进入 TDD，不等待确认**。若发现 seam 与 issue 需求不符，继续实现并在汇报中注明疑虑。

严格遵循 TDD 流程，不允许直接写实现代码：

1. **红**：先写一个失败测试
2. **绿**：写最小实现使其通过
3. **循环**：一个垂直切片（一个 seam → 一个测试 → 一个实现）重复，直到 issue 完成
4. **重构**：整理代码，消除重复，保持可读性
5. **全量测试**：运行项目的全量测试套件（如 `npm run test` / `uv run pytest`，视项目而定），确保零回归
6. **提交**：通过后 commit。**commit 描述用中文，不带任何英文字母前缀**（分支内 commit 不写 `feat:`/`fix:` 之类前缀；squash commit 的前缀规范由 Merger 负责）

**全量测试是硬性要求**。零回归才可输出 COMPLETE。

**汇报前自检清单（一项不满足不得输出 COMPLETE）：**
- [ ] 全量测试通过（后端 + 前端，贴实际输出）
- [ ] 代码已 commit（中文描述，无英文字母前缀）
- [ ] 未 merge、未 push、未创建 PR、未关闭 issue（关闭只发生在 Merger），已输出 `<promise>COMPLETE</promise>`

## 汇报格式

1. **给自然人读的摘要**（在 `<promise>COMPLETE</promise>` 标签**之前**输出）：
   - 实现了什么
   - 全量测试结果（必须贴实际输出：命令 + 通过/失败数量）
   - 修改了哪些文件
   - 未 merge、未关闭 issue（由 Merger 统一负责）
2. **完成信号**：全部完成后输出 `<promise>COMPLETE</promise>`
3. **人读状态**（在标签**之后**输出）：DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED

**状态说明**：
- DONE — 全部完成：全量测试通过 + 已 commit（中文）+ 未 merge/未关 issue
- DONE_WITH_CONCERNS — 完成了但全量测试有非你的改动引起的失败（具体说明哪些是预存的），或有其他疑虑
- BLOCKED — 无法完成，需要帮助
- NEEDS_CONTEXT — 缺少信息无法继续
```
