---
name: afk-issue-loop
description: 遍历标记为 ready-for-agent 的 GitHub issue，用 Planner/Implementer/Reviewer/Merger 四角色循环批量实现并统一 squash merge，全部完成后提示手动 code review 或 QA。
disable-model-invocation: true
argument-hint: "[mode=subagent|herdr]"
---

# AFK Issue Loop（sandcastle 式四角色编排）

Matt Pocock 的 Ralph loop 的轻量替代，控制者扮演 `run.ts` 编排器，无需 Docker：

- **Planner** 分析 issue 依赖 → 输出 `<plan>` JSON（只含当前 unblocked 的 issue）
- **Implementer** 每 issue 一个，在 `afk/issue-N` 分支 TDD 实现
- **Reviewer** Implementer 完全结束后同分支审查，问题 `SendMessage` 直连对应 Implementer 修复（只反馈，不自己改代码）
- **Merger** 主仓库统一 `git merge --squash` 并关 issue

**前置条件**：项目已跑过 `/setup-rolex-skills`，仓库有 `CONTEXT.md`（缺失时按 [REFERENCE.md](REFERENCE.md#contextmd-缺失策略) 处理）。herdr 模式额外需要 herdr CLI 已安装。

## 模式选择（载体）

通过 `[mode=subagent|herdr]` 参数选择载体。无参数时默认 `subagent`。

| 载体 | 原理 | 适用场景 |
|------|------|----------|
| `subagent`（默认） | 当前会话中用 `Agent` 工具分派角色子代理 | 少量 issue（≤5）、需要实时看子代理进度 |
| `herdr` | 独立 session pane（新 claude 实例）运行角色 | 大量 issue、想并行跑满、不占当前会话上下文 |

**载体与角色正交**：四种角色在任何载体下都用同一套 prompt 语义（依赖分析、`<plan>`、`<promise>COMPLETE`、确定性分支名、squash merge 都不变），区别只在「谁来跑」。

herdr 模式下 pane 创建、指令下发、等待、轮询等操作见 [reference/herdr-notes.md](reference/herdr-notes.md)；布局规则遵循 `/herdr-instances`（主编排 pane 不可上下分割，左右/上下分割各自不超过 3）。

## 角色架构

| 角色 | 职责 | 产出信号 |
|------|------|----------|
| **Planner** | 扫 `gh issue list --label ready-for-agent --state open`，依赖分析，分配确定性分支名 `afk/issue-{N}` | `<plan>` JSON |
| **Implementer** | 每 issue 一个，在 `afk/issue-N` 分支，TDD→全量测试→commit（中文描述） | `<promise>COMPLETE</promise>`；**不关 issue** |
| **Reviewer** | Implementer 完全结束后（含退出/超时/抛错后求值）同分支触发，读 `git diff ${TARGET_BRANCH}..HEAD`，问题 `SendMessage` 直连 impl-N 修复（只反馈不自己改）；分支无 commit 则跳过 | 反馈或跳过 |
| **Merger** | `${TARGET_BRANCH}` 上逐个 `git merge --squash <分支>`，冲突读两侧解决；每分支合完跑全量测试；统一关 issue（含父 PRD） | squash commit（1 parent）+ 关闭的 issue |

**控制者职责**（不写实现代码）：发起启动各角色子代理（按载体）→ 解析 Planner 的 `<plan>` JSON → 分派 Implementer / Reviewer → 分派 Merger → 验证（issue 关闭 / worktree 清理 / `${TARGET_BRANCH}` 出现对应 1-parent squash commit）→ 异常处置（BLOCKED / NEEDS_CONTEXT，沿用状态处理表）。

**编排循环**（每轮重 Plan）：

```
循环：
  Planner ──► <plan> JSON（当前 unblocked 的 issue）
    │  控制者解析 <plan>，校验 number/title/branch
    ▼
  Implementer（每 issue 一个，afk/issue-N，跨 issue ≤4 并行）
    │  <promise>COMPLETE
    ▼
  Reviewer（同分支，严格串行；分支无 commit 则跳过）
    ▼
  Merger（逐个 squash merge → 全量测试 → 关 issue）
    │
    └──► 回到 Planner，直到 <plan> 为空
```

- **并行度**：跨 issue ≤4（信号量）；同 issue 内 Implementer→Reviewer 严格串行
- **完成判定**：真正的完成（关 issue）只在 Merger。Implementer / Reviewer 都不关 issue

## Workflows

### 阶段 0：分支模型检测（TARGET_BRANCH）

后续所有 `${TARGET_BRANCH}` 都指这个值：

```bash
# 直接查 ref 而非解析 git branch -a 文本：当前检出的 develop 显示为 "* develop"、本地分支带缩进、远程分支带 remotes/ 前缀，grep 正则易误判
if git rev-parse --verify --quiet refs/heads/develop >/dev/null 2>&1 || git rev-parse --verify --quiet refs/remotes/origin/develop >/dev/null 2>&1; then
  TARGET_BRANCH=develop
else
  TARGET_BRANCH=main
fi
echo "TARGET_BRANCH=$TARGET_BRANCH"
```

- 有 `develop` 分支（本地或远程）→ **Git flow**：`TARGET_BRANCH=develop`，worktree 从 develop 创建，merge 到 develop
- 只有 `main` → **trunk-based**：`TARGET_BRANCH=main`，worktree 从 main 创建，merge 到 main。**绝不新建 `develop`**——项目维护者只用 main 时，新建 develop 会扰乱他们的分支管理

检查 `CONTEXT.md` 是否存在；缺失时按 [REFERENCE.md](REFERENCE.md#contextmd-缺失策略) 处理。

### 阶段 1：Planner 分派与依赖解析

分派 Planner（按载体：subagent 用 Agent 工具 / herdr 开 pane）。Planner 职责：

1. 扫 `gh issue list --label ready-for-agent --state open --limit 100 --json number,title,body,labels,comments`
2. 依赖分析：`Blocked by` 字段优先，其次三条补充（资源 / 空间 / 契约，见 [REFERENCE.md](REFERENCE.md#依赖解析)）。有实现 issue 链接的 PRD 不作为实现对象
3. 为每个 unblocked 的 issue 分配确定性分支名 `afk/issue-{N}`
4. 输出 `<plan>` JSON：

```
<plan>
{"issues": [{"number": 42, "title": "修复认证 bug", "branch": "afk/issue-42"}]}
</plan>
```

**控制者解析**：用正则提取 `<plan>...</plan>` 包裹的 JSON，校验每项 `number/title/branch`，识别可选 `kind` 字段（`kind=gate` = 判定类 ticket，处置见 [REFERENCE.md](REFERENCE.md#依赖解析)）。空列表 `{"issues":[]}` → 结束循环。

**全 blocked 判断逻辑**：无 unblocked 时，Planner 默认输出单个最高优先候选（依赖最少/最弱）继续推进；当候选为 PRD、或阻塞源在本轮内无解锁路径（外部依赖/需人工）、或已无任何可推进项时输出空列表结束循环。

### 阶段 2：Implementer + Reviewer（每 issue：worktree → 实现 → 审查）

对 `<plan>` 中每个 issue（跨 issue 信号量 ≤4）：

**1. 创建 worktree**（确定性分支 `afk/issue-{N}`）：
- subagent：控制者预创建 `wt switch -c afk/issue-{N} -b ${TARGET_BRANCH}`
- herdr：agent 自行创建（同一命令）

**2. 分派 Implementer**，prompt 注入：
- issue 完整文本 + comments（`gh issue view <id> --json title,body,comments`）；如有父 PRD 一并注入
- `CONTEXT.md` 内容（如存在）+ 相关 ADR
- worktree 绝对路径（subagent）或自行 `wt switch -c` 的指令（herdr）
- **Seam 预确认**：控制者分派时基于 issue body 的 Testing Decisions 段和相关测试预确认 seam，agent **不等待**（解决 subagent 卡死）
- 红线：TDD → 全量测试（贴实际输出）→ commit（**中文描述**）→ 输出 `<promise>COMPLETE</promise>`；**不关 issue**
- 模型：按复杂度选（见 [REFERENCE.md](REFERENCE.md#模型选择)，AFK 向上取整）

**3. 超时与完成求值**：控制者分派时记录 deadline + 后台计时器（见 [REFERENCE.md](REFERENCE.md#超时协议)）。Implementer **完全结束**（正常完成 / 超时 / 抛错）后，查分支 commit：
- >0 → 触发同分支 Reviewer
- ==0 → 跳过 Reviewer，标记后交由下轮 Planner 处理

**4. 同分支触发 Reviewer**（分派时注入 `{{IMPL_AGENT_NAME}}`）：
- 读 `git diff ${TARGET_BRANCH}..HEAD`；分支无 commit 则跳过
- 发现可改进 → **`SendMessage(to=impl-N)` 直连反馈**（只反馈不自己改），状态 `FEEDBACK_SENT`；impl-N 自动 resume 修复 → commit → 回信 review-N → 复查
- 复查通过 → 进 Merger；**1 轮不通过 → 带诊断上报**（换强模型 / 拆分 / 上报，见 [REFERENCE.md](REFERENCE.md#状态处理)）
- 不关 issue

**5. 处理状态**：`FEEDBACK_SENT` 是闭环中（启动等待，见[超时协议](REFERENCE.md#超时协议)）；异常（NEEDS_CONTEXT / BLOCKED 等）按 [REFERENCE.md](REFERENCE.md#状态处理) 处置。

### 阶段 3：Merger（统一 squash merge + 关 issue）

本轮 Implementer / Reviewer 全部结束后，用 [reference/merger-prompt.md](reference/merger-prompt.md) 模板分派 Merger（注入 `{{BRANCHES}}`）：

- 分派前在主仓库执行 `git checkout ${TARGET_BRANCH}`，确认处于目标分支；merge 只在主仓库执行，**不在 worktree 内执行**（git 禁止同一分支在两个 worktree 同时检出）
- 不 push、不建 PR；与 `origin/${TARGET_BRANCH}` 分歧时保留分歧（政策全文见 [REFERENCE.md](REFERENCE.md#红线)）
- 冲突解决、删分支与 worktree 清理、关 issue（含父 PRD）等执行细则均在模板内，控制者不代做
- 完成信号：`<promise>COMPLETE</promise>`

**Merger 完成后验证三件事**：
1. `gh issue view <N> --json state` → CLOSED（父 PRD 在子 issue 全部关闭后一并关闭）；判定类 ticket 不通过时由控制者直接关闭（带结论 comment），下游保持 open——处置见 [REFERENCE.md](REFERENCE.md#依赖解析)
2. `wt list` 中不再出现 `afk/issue-{N}` 的 worktree
3. `${TARGET_BRANCH}` 出现对应的 **1-parent** squash commit（`git cat-file -p HEAD | grep "^parent"` 只输出 1 行；本地 commit，非 `origin/${TARGET_BRANCH}` 上的）——PR 误判修正：只有匹配 `Merge pull request #N` 才是 GitHub PR merge，agent 自写 message 带 `（#N）` 不算；若发现 PR merge，标记流程错误，按[红线](REFERENCE.md#红线)回滚重做

### 循环：回到 Planner

- Merger 完成后回到阶段 1，重新 Planner（**每轮重 Plan**），直到 `<plan>` 为空
- 控制者可为循环设最大轮数（如 10），防止依赖分析错误导致死循环
- 若本轮有判定类 ticket 失败产生的未处置下游（保持 open），与完成统计一并列出，请用户/owner 逐条 triage 存废
- 全部完成 → 提示用户 code review / QA

## Reference

- [REFERENCE.md](REFERENCE.md) — 依赖解析、协议机制、模型选择、红线、状态处理、超时协议、并行冲突、agent 中断恢复、CONTEXT.md 缺失策略、收尾流程
- [reference/herdr-notes.md](reference/herdr-notes.md) — herdr 模式操作细节（仅 mode=herdr）
- [EXAMPLES.md](EXAMPLES.md) — 完整一轮示例；不确定某阶段的具体命令 / 信号格式时先读它
- [reference/planner-prompt.md](reference/planner-prompt.md) — Planner 分派模板
- [reference/implementer-prompt.md](reference/implementer-prompt.md) — Implementer 分派模板
- [reference/reviewer-prompt.md](reference/reviewer-prompt.md) — Reviewer 分派模板（含 feedback 闭环）
- [reference/merger-prompt.md](reference/merger-prompt.md) — Merger 分派模板

全部 issue 完成后，提示用户：

> 所有 issue 已实现并合并。建议先进行 **code review**（审查代码正确性、风格、安全性），再执行 **QA 测试**（端到端行为、回归验证）。经典流程：code review 通过 → 部署到测试环境 → QA 测试。
