---
name: afk-issue-loop
description: 遍历 GitHub 上 ready-for-agent 的 issue，自动分批实现并合并到目标分支，全部完成后提示手动 code review 或 QA。
disable-model-invocation: true
argument-hint: "[mode=subagent|herdr]"
---

# AFK Issue Loop（sandcastle 式四角色编排，改造版）

Matt Pocock 的 Ralph loop 的轻量替代，控制者扮演 `run.ts` 编排器，无需 Docker：

- **Planner** 开头跑一次，扫 issue、构建完整依赖图（DAG），输出含 `blocked_by` 的节点列表
- **Implementer** 每 issue 一个，在 `afk/issue-N` 分支 TDD 实现（**语义原子 commit**）
- **Reviewer** 同 worktree 同 branch 在 Implementer 后接力，**直接改代码 + commit**（不反馈、不复查，对齐 sandcastle 一次性自改）
- **Merger** 主仓库统一 `git merge <branch> --no-edit` 拓扑合并，末尾写 1 条 summarizing commit 并关 issue

**前置条件**：项目已跑过 `/setup-rolex-skills`，仓库有 `CONTEXT.md`（缺失时按 [REFERENCE.md](REFERENCE.md#contextmd-缺失策略) 处理）。herdr 模式额外需要 herdr CLI 已安装。

## 模式选择（载体）

通过 `[mode=subagent|herdr]` 参数选择载体。无参数时默认 `subagent`。

| 载体 | 原理 | 适用场景 |
|------|------|----------|
| `subagent`（默认） | 当前会话中用 `Agent` 工具分派角色子代理 | 少量 issue（≤5）、需要实时看子代理进度 |
| `herdr` | 独立 session pane（新 claude 实例）运行角色 | 大量 issue、想并行跑满、不占当前会话上下文 |

**载体与角色正交**：四种角色在任何载体下都用同一套 prompt 语义（DAG、`<promise>COMPLETE</promise>`、确定性分支名、拓扑 merge 都不变），区别只在「谁来跑」。

herdr 模式下 pane 创建、指令下发、等待、轮询等操作见 [reference/herdr-notes.md](reference/herdr-notes.md)；布局规则遵循 `/herdr-instances`（主编排 pane 不可上下分割，左右/上下分割各自不超过 3）。

## 角色架构

| 角色 | 职责 | 产出信号 |
|------|------|----------|
| **Planner**（仅 1 次） | 扫 `gh issue list --label ready-for-agent --state open`，构建完整 DAG，为每个 issue 分配确定性分支名 `afk/issue-{N}` 并填 `blocked_by` | `<plan>` JSON（含全部 open issue 的依赖图） |
| **Implementer** | 每 issue 一个，在 `afk/issue-N` 分支，**语义原子 commit**（大改动先拆 commit）→ 全量测试 → commit（中文描述） | `<promise>COMPLETE</promise>`；**不关 issue** |
| **Reviewer** | Implementer 完全结束后（含退出/超时/抛错后求值）**同 worktree 同 branch** 触发，读 `git diff ${TARGET_BRANCH}..HEAD`，**直接改代码 → 跑测试 → `refine:` commit**（不反馈、不复查）；分支无 commit 则跳过 | 完成或跳过 |
| **Merger** | `${TARGET_BRANCH}` 上逐个 `git merge <branch> --no-edit`，冲突读两侧解决；每分支合完跑全量测试；末尾 1 条 summarizing commit；统一关 issue（含父 PRD） | merge commit + summarizing commit + 关闭的 issue |

**控制者职责**（不写实现代码）：发起启动各角色子代理（按载体）→ 解析 Planner 的 `<plan>` DAG 存入会话上下文 → **按拓扑序每轮切片本轮 unblocked** → 分派 Implementer / Reviewer（同 worktree 同 branch）→ 分派 Merger → 验证（issue 关闭 / worktree 清理）→ 异常处置（DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED，沿用 REFERENCE.md 状态处理表）。

**编排循环**（Planner 只在开头跑一次）：

```
开头 1 次：
  Planner ──► <plan> JSON（完整 DAG,所有 open issue + blocked_by）
    │  控制者解析 <plan>,存入会话上下文
    ▼
循环（每轮控制者按拓扑序切本轮 unblocked）：
  本轮 unblocked 集合 = 依赖图上 blocked_by 全部已完成(或空)的节点
    │
    │  unblocked 集合空 → 停
    │
    ▼
  Implementer（每 issue 一个,afk/issue-N,跨 issue ≤4 并行）
    │  <promise>COMPLETE
    │  失败 → 同 worktree 同 branch 重试(无限)
    ▼
  Reviewer（同 worktree 同 branch,严格串行;分支无 commit 则跳过）
    │  <promise>COMPLETE
    ▼
  本轮全 issue 完成后 → 回到 Merger
    │
    ▼
  Merger（主仓库内,逐个 git merge --no-edit → 全量测试 → summarizing commit → 关 issue）
    │
    └──► 回到「按拓扑序切下一轮 unblocked」,直到 unblocked 集合空
```

- **并行度**：跨 issue ≤4（信号量）；同 issue 内 Implementer→Reviewer 严格串行
- **失败处理**：失败 issue 同 worktree 同 branch 无限重试；**不传染下游**（DAG 上其它节点按原 `blocked_by` 推进）
- **完成判定**：真正的完成（关 issue）只在 Merger。Implementer / Reviewer 都不关 issue
- **无硬轮次上限**：Planner 一次性，DAG 拓扑耗尽即停；用户输入的 issue 范围 = 全部工作面

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

### 阶段 1：Planner 一次性分派与 DAG 解析

**Planner 只跑一次**（不再每轮重跑——按拓扑序切片由控制者算）。分派 Planner（按载体：subagent 用 Agent 工具 / herdr 开 pane）：

1. 扫 `gh issue list --label ready-for-agent --state open --limit 100 --json number,title,body,labels,comments`
2. 为每个 issue 构建 `blocked_by` 数组（按 issue body 的 `Blocked by` 字段 + 三条补充：资源 / 空间 / 契约，见 [REFERENCE.md](REFERENCE.md#依赖解析)）
3. 为每个 issue 分配确定性分支名 `afk/issue-{N}`
4. 输出 `<plan>` JSON（含**全部** open issue，不是只含 unblocked）：

```
<plan>
{"issues": [
  {"number": 1, "title": "...", "branch": "afk/issue-1", "blocked_by": []},
  {"number": 2, "title": "...", "branch": "afk/issue-2", "blocked_by": [1]},
  {"number": 3, "title": "...", "branch": "afk/issue-3", "blocked_by": [1]}
]}
</plan>
```

**控制者解析**：用正则提取 `<plan>...</plan>` 包裹的 JSON，校验每项 `number/title/branch/blocked_by`（`blocked_by` 是数组，可空），识别可选 `kind` 字段（`kind=gate` = 判定类 ticket，处置见 [REFERENCE.md](REFERENCE.md#依赖解析)）。解析结果存**会话上下文**（不持久化到文件）。

**全 blocked 判断逻辑**：本轮 unblocked 集合空 → 控制者停循环（无需调用 Planner 重判；DAG 拓扑耗尽即终止）。

### 阶段 2：Implementer + Reviewer（每 issue：worktree → 实现 → 自审）

控制者按 DAG 拓扑序切片**本轮 unblocked**（节点 `blocked_by` 全部已完成或空），跨 issue ≤4 并行。**流水线**：某 issue 的 Implementer 一完成（分支 commit >0）即触发其 Reviewer——不等待本轮其他 issue。信号量 ≤4 按 Implementer + Reviewer 合计占坑。

**1. 创建 worktree**（确定性分支 `afk/issue-{N}`）：
- subagent：控制者预创建 `wt switch -c afk/issue-{N} -b ${TARGET_BRANCH}`
- herdr：agent 自行创建（同一命令）

**2. 分派 Implementer**，prompt 注入：
- issue 完整文本 + comments（`gh issue view <id> --json title,body,comments`）；如有父 PRD 一并注入
- `CONTEXT.md` 内容（如存在）+ 相关 ADR + 编码规范文件（探测 `.sandcastle/CODING_STANDARDS.md`、`docs/` 规范文档、README 规范节，均无则跳过）
- worktree 绝对路径（subagent）或自行 `wt switch -c` 的指令（herdr）
- **Seam 预确认**：控制者分派时基于 issue body 的 Testing Decisions 段和相关测试预确认 seam，agent **不等待**（解决 subagent 卡死）
- 红线：TDD → 全量测试（贴实际输出）→ commit（**中文描述、语义原子**——大改动先审 diff 再拆 commit）→ 输出 `<promise>COMPLETE</promise>`；**不关 issue**
- 模型：按复杂度选（见 [REFERENCE.md](REFERENCE.md#模型选择)，AFK 向上取整）

**3. 超时与失败求值**：控制者分派时记录 deadline + 后台计时器（见 [REFERENCE.md](REFERENCE.md#超时协议)）。Implementer **完全结束**（正常完成 / 超时 / 抛错）后，查分支 commit：
- >0 → 触发同 worktree 同 branch 的 Reviewer
- ==0 或失败 → **失败处理**：同 worktree 同 branch 无限重试，不传染下游。理论上某 issue 可能永久卡重试——用户预期正常情况不会发生；极端场景在收尾时自查

**4. 同 worktree 同 branch 触发 Reviewer**（沿用 Implementer 的 worktree）：
- prompt 注入与 Implementer 相同：issue 完整文本 + comments、领域上下文（`CONTEXT.md` / ADR / 编码规范，均如存在）
- 读 `git diff ${TARGET_BRANCH}..HEAD`；分支无 commit 则跳过
- **直接改代码 → 跑测试 → `refine:` commit**（不反馈、不复查、不发 `SendMessage` 给 impl-N）——对齐 sandcastle 一次性自改
- Implementer 与 Reviewer 在同一分支线性叠加 commit：Implementer 的 commit 在前、Reviewer 的 `refine:` commit 在后
- 不关 issue
- 1 轮反馈上限、复查、`DONE_WITH_CONCERNS` 升级——全部不存在（与 sandcastle 一致）

**5. 处理状态**：`DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED` 异常按 [REFERENCE.md](REFERENCE.md#状态处理) 处置。

### 阶段 3：Merger（统一拓扑 merge + 关 issue）

本轮 Implementer / Reviewer 全部结束后，用 [reference/merger-prompt.md](reference/merger-prompt.md) 模板分派 Merger（注入 `{{BRANCHES}}`）：

- 分派前在主仓库执行 `git checkout ${TARGET_BRANCH}`，确认处于目标分支；merge 只在主仓库执行，**不在 worktree 内执行**（git 禁止同一分支在两个 worktree 同时检出）
- 不 push、不建 PR；与 `origin/${TARGET_BRANCH}` 分歧时保留分歧（政策全文见 [REFERENCE.md](REFERENCE.md#红线)）
- 逐分支 `git merge <branch> --no-edit`（**拓扑合并**——本流程唯一合并方式，保留分支拓扑历史）。每分支产生 1 个 merge commit，message 用 git 默认 `Merge branch 'afk/issue-N'`
- 完成信号：`<promise>COMPLETE</promise>`

**Merger 完成后验证两件事**：
1. `gh issue view <N> --json state` → CLOSED（父 PRD 在子 issue 全部关闭后一并关闭）；判定类 ticket 不通过时由控制者直接关闭（带结论 comment），下游保持 open——处置见 [REFERENCE.md](REFERENCE.md#依赖解析)
2. `wt list` 中不再出现 `afk/issue-{N}` 的 worktree
3. ~~`git cat-file -p HEAD | grep "^parent"` 只输出 1 行~~——拓扑 merge 自然产生多 parent merge commit，不再验证 1-parent 约束

### 循环：回到控制者切片

- Merger 完成后回到阶段 2，按 DAG 拓扑序切下一轮 unblocked（直到 unblocked 集合空）
- **无硬轮次上限**：DAG 拓扑耗尽即停
- 若本轮有判定类 ticket 失败产生的未处置下游（保持 open），与完成统计一并列出，请用户/owner 逐条 triage 存废
- 全部完成 → 提示用户 code review / QA

## Reference

- [REFERENCE.md](REFERENCE.md) — 依赖解析、协议机制、模型选择、红线、状态处理、超时协议、并行冲突、agent 中断恢复、失败重试行为、CONTEXT.md 缺失策略、收尾流程
- [reference/herdr-notes.md](reference/herdr-notes.md) — herdr 模式操作细节（仅 mode=herdr）
- [EXAMPLES.md](EXAMPLES.md) — 完整一轮示例；不确定某阶段的具体命令 / 信号格式时先读它
- [reference/planner-prompt.md](reference/planner-prompt.md) — Planner 分派模板（输出 DAG）
- [reference/implementer-prompt.md](reference/implementer-prompt.md) — Implementer 分派模板（含语义原子 commit 约束）
- [reference/reviewer-prompt.md](reference/reviewer-prompt.md) — Reviewer 分派模板（直接自改 + `refine:` commit）
- [reference/merger-prompt.md](reference/merger-prompt.md) — Merger 分派模板（拓扑 merge + summarizing commit）

全部 issue 完成后，提示用户：

> 所有 issue 已实现并合并。建议先进行 **code review**（审查代码正确性、风格、安全性），再执行 **QA 测试**（端到端行为、回归验证）。经典流程：code review 通过 → 部署到测试环境 → QA 测试。