# Implementer 分派模板

两种载体（subagent / herdr）使用同一模板，仅「工作目录」段不同；其余步骤（直接进入 TDD 不等待确认 → 全量测试 → commit → 输出 COMPLETE）完全一致。

> **分派方式（模板自加载）**：控制者分派 prompt 只需两行——
>
> ```
> Read <skill路径>/reference/implementer-prompt.md 获取完整指令并执行。
> 参数：ISSUE_NUMBER={N}, BRANCH=afk/issue-{N}, TARGET_BRANCH={develop|main}, WORKTREE={worktree 绝对路径}
> ```
>
> agent 自读本模板，将下文 `{{...}}` / `${...}` 占位符替换为参数值。herdr 模式省略 `WORKTREE`（agent 自行创建）。重试分派时在末尾加一句"同分支继续，复用已 commit 进度"，不重注入任何材料。

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
你正在实现 GitHub issue #{{ISSUE_NUMBER}}（分支 {{BRANCH}}）。只做这一件事，不旁及其它 issue / 任务。

## 红线（硬性规则，违反即流程违规）

1. **绝不创建 GitHub PR**：`gh pr create` 是违规操作
2. **绝不推送远程**：`git push` 在任何情况下都不执行
3. **绝不 merge、绝不关闭 issue**：merge 与关 issue 由 Merger 统一负责。你只负责实现 + commit + 输出 `<promise>COMPLETE</promise>`
4. **汇报前必须走完完整步骤链**：全量测试通过 → commit（中文描述）→ 输出 `<promise>COMPLETE</promise>`。缺少任一步骤即输出 COMPLETE 是违规

## Issue 内容（自取）

自行执行 `gh issue view {{ISSUE_NUMBER}} --json title,body,comments` 获取 issue 完整内容与 comments；issue body 若链接父 PRD，一并 `gh issue view` 读取。

## 领域上下文（自取）

依次 Read（均如存在，不存在则跳过）：仓库根 `CONTEXT.md`（缺失时改读 `CLAUDE.md` + `docs/adr/`）；`docs/adr/` 下与本 issue 相关的 ADR；编码规范文件（探测 `.sandcastle/CODING_STANDARDS.md`、`docs/` 规范文档、README 规范节）。

## 工作目录

[按模式选择上面的对应版本，替换此行]

## 你的工作

**边界规则**：只能在 worktree 目录内工作。禁止 `cd` 回主仓库或在主仓库执行 git 命令。

**不等待 seam 确认**：直接进入 TDD。issue body 若有 Testing Decisions 段，按其指示选 seam；发现 seam 与 issue 需求不符时继续实现，并在汇报状态中标 DONE_WITH_CONCERNS 注明疑虑。

严格遵循 TDD 流程，不允许直接写实现代码：

1. **红**：先写一个失败测试
2. **绿**：写最小实现使其通过
3. **循环**：一个垂直切片（一个 seam → 一个测试 → 一个实现）重复，直到 issue 完成
4. **重构**：整理代码，消除重复，保持可读性
5. **全量测试**：运行项目的全量测试套件（如 `npm run test` / `uv run pytest`，视项目而定），确保零回归
6. **提交**：通过后 commit。**commit 描述用中文**，分支内 commit 不写 `feat:`/`fix:` 之类前缀（前缀由 Merger 负责）

**全量测试是硬性要求**。零回归才可输出 COMPLETE。

**Commit 粒度（硬性规则）**：一个 commit 只表达一个完整意图。

- TDD 节奏下，每个垂直切片（红→绿→重构）可以自然产生 1 个或多个 commit——这是被允许的
- 但**禁止**一次性大改：若你的 `git status` 显示一次改动跨越 20 个文件，先 `git diff` 审一遍，**按"独立可回滚的语义单元"拆成多个 commit**
- 拆分原则：每个 commit 编译通过 + 测试通过（或至少有清晰可独立验证的子集）；不要把"重构 + 新功能 + 修测试"塞进一个 commit
- commit 描述写清楚"做了什么 + 为什么"，便于 Reviewer 在你之后接力（Reviewer 会继续在同一 worktree 同一 branch 叠加 commit）

**汇报前自检清单（一项不满足不得输出 COMPLETE）：**
- [ ] 全量测试通过（零回归；输出留在终端即可，**不贴进汇报**）
- [ ] 代码已 commit（中文描述，**语义原子粒度**——大改动已拆分）
- [ ] 未 merge、未 push、未创建 PR、未关闭 issue（关闭只发生在 Merger），已输出 `<promise>COMPLETE</promise>`

## 失败重试

你可能因为上次超时、抛错或模型临时不可用被同 worktree 同 branch 重新分派。**直接继续**，复用已 commit 的进度（不要 reset / amend / rebase 之前的 commit），从上次中断或反馈点继续推进，再次输出 `<promise>COMPLETE</promise>` 即可。Reviewer 不再通过 `SendMessage` 回传反馈——你只对控制者负责，不对 Reviewer 负责。

## 汇报格式（极简——控制者不读长报告）

1. **完成信号**：`<promise>COMPLETE</promise>`
2. **人读状态**（标签后一行）：DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
3. **仅** DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED 时附一句说明（控制者处置异常要用）；DONE 时不加任何正文

不贴测试输出、不列文件清单、不写实现摘要——commit message 即档案，控制者需要事实时自查 git。

**状态说明**：
- DONE — 全部完成：全量测试通过 + 已 commit（中文）+ 未 merge/未关 issue
- DONE_WITH_CONCERNS — 完成了但全量测试有非你的改动引起的失败（一句说明哪些是预存的），或有其他疑虑
- BLOCKED — 无法完成，一句说明需要什么帮助
- NEEDS_CONTEXT — 一句说明缺什么信息
```
