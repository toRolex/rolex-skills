# EXAMPLES

## 场景：给 CLI 工具添加 `--verbose` 选项

项目 `my-cli`，已有 `CONTEXT.md`。用户刚完成 `/grill-with-docs` → `/to-prd` → `/to-issues`，产出了 3 个 `ready-for-agent` 的 issue。

### 输入

```bash
$ gh issue list --label ready-for-agent --state open
#42  Add --verbose flag to root command        ready-for-agent
#43  Wire verbose flag into logger middleware   ready-for-agent
#44  Show debug output in verbose mode          ready-for-agent
```

### 阶段 1：扫描

```
用户输入：/afk-issue-loop

Agent 执行 gh issue list，展示 3 个 issue，用户确认。
```

### 阶段 2：逐 issue 实现

**Issue #42**（涉及 2 个文件，用 `sonnet`）：

```
wt switch -c feature/42-add-verbose-flag -b develop

分派 Agent(sonnet, general-purpose)，prompt 注入：
- issue #42 的 body
- CONTEXT.md（领域术语：command/flag/logger）
- 工作目录路径

agent 按流程：确认 seam → TDD → 全量测试 → commit → `wt merge develop --no-ff --no-squash` → 关闭 issue
agent 汇报 DONE，控制者检查依赖图。
```

**Issue #43**（涉及 4 个文件，用 `opus`）：

```
wt switch -c feature/43-wire-logger -b develop

分派 Agent(opus, general-purpose)，同上流程。
agent 汇报 DONE_WITH_CONCERNS："logger 的接口有些不一致，但不影响功能"
确认是观察性疑虑，agent 已自行 `wt merge develop --no-ff --no-squash` 到 develop 并清理 worktree。
```

**Issue #44**（涉及 2 个文件，用 `sonnet`）：

```
wt switch -c feature/44-verbose-output -b develop

分派 Agent，实现，TDD → 全量测试通过 → `wt merge develop --no-ff --no-squash` → 关闭 issue。
```

### 阶段 3：QA

```
调用 /qa-plan，传入 N=6
agent 审查 diff → 生成 step-by-step QA plan → 保存为 issue #45
  QA Plan: 2026-07-06 — --verbose flag implementation

用户按 QA plan 测试，全部通过，无新 issue。
```

### 阶段 4：收尾

```
Agent 报告：
  实现了 3 个 issue，生成 6 个 commit + 3 个 merge commit
  QA plan: #45
  没有新的 ready-for-agent issue
```
