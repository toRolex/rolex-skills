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

**阈值提示**：阶段 0 先跑 `gh issue list --label ready-for-agent --state open --json number --jq length` 计数；>5 且用户未显式指定载体时，先向用户确认仍用 subagent，否则建议 herdr。

**载体与角色正交**：四种角色在任何载体下都用同一套 prompt 语义（DAG、`<promise>COMPLETE</promise>`、确定性分支名、拓扑 merge 都不变），区别只在「谁来跑」。

herdr 模式：用 `/herdr` 开新窗口跑同一套角色 prompt（模板自加载 + 寻址注入不变，省略 `WORKTREE` 参数，agent 自行 `wt switch -c`）；herdr CLI 操作与报错细节见 herdr skill，布局规则遵循 `/herdr-instances`（主编排 pane 不可上下分割，左右/上下分割各自不超过 3）。超时与失败语义两载体统一——同一套 watchdog（见 [REFERENCE.md](REFERENCE.md#超时协议)），skill 里不存在任何轮询。

## 角色架构

| 角色 | 职责 | 产出信号 |
|------|------|----------|
| **Planner**（仅 1 次） | 扫 `gh issue list --label ready-for-agent --state open`，构建完整 DAG，为每个 issue 分配确定性分支名 `afk/issue-{N}` 并填 `blocked_by` | `<plan>` JSON（含全部 open issue 的依赖图） |
| **Implementer** | 每 issue 一个，在 `afk/issue-N` 分支，**语义原子 commit**（大改动先拆 commit）→ 全量测试 → commit（中文描述） | `<promise>COMPLETE</promise>`；**不关 issue** |
| **Reviewer** | Implementer 完全结束后（含退出/超时/抛错后求值）**同 worktree 同 branch** 触发，读 `git diff ${TARGET_BRANCH}..HEAD`，**直接改代码 → 跑测试 → `refine:` commit**（不反馈、不复查）；分支无 commit 则跳过 | 完成或跳过 |
| **Merger** | `${TARGET_BRANCH}` 上逐个 `git merge <branch> --no-edit`，冲突读两侧解决；每分支合完跑全量测试；末尾 1 条 summarizing commit；统一关 issue（含父 PRD） | merge commit + summarizing commit + 关闭的 issue |

**控制者职责**（不写实现代码）：发起启动各角色子代理（按载体，**模板自加载 + 寻址注入**：prompt 只传模板路径与参数、材料由 agent 自取，见 [REFERENCE.md](REFERENCE.md#主窗口预算)）→ 把 Planner 的 `<plan>` DAG 落盘目标项目 `docs/afk-plan.json` 并维护每节点 `status` → **按拓扑序每轮切片本轮 unblocked** → 分派 Implementer / Reviewer（同 worktree 同 branch）后进入**通知驱动等待**（禁轮询，机制见 [REFERENCE.md](REFERENCE.md#超时协议)）→ 分派 Merger → 验证（issue 关闭 / worktree 清理）→ 异常处置（DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED，沿用 REFERENCE.md 状态处理表）。

**编排循环**（Planner 只在开头跑一次）：

```
开头 1 次：
  Planner ──► <plan> JSON（完整 DAG,所有 open issue + blocked_by）
    │  控制者验收 docs/afk-plan.json,补 status 字段
    ▼
循环（每轮控制者按拓扑序切本轮 unblocked）：
  本轮 unblocked 集合 = 依赖图上 blocked_by 全部已完成(或空)的节点
    │
    │  unblocked 集合空 → 停
    │
    ▼
  Implementer（每 issue 一个,afk/issue-N,跨 issue ≤4 并行）
    │  <promise>COMPLETE
    │  失败 → 落盘恢复手册 + 标 failed(零自动重试),不停调度其余 unblocked
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
- **失败处理**：失败即标 `failed`、落盘恢复手册（`docs/afk-failures/issue-{N}.md`）、现场保全（worktree 不删、branch 不动），**零自动重试**；不停调度其余 unblocked issue，收尾把 `afk-failures/` 清单交用户逐条处置（恢复路径见 [REFERENCE.md](REFERENCE.md#恢复机制)）
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

### 阶段 1：Planner 一次性分派与 DAG 落盘

**Planner 只跑一次**（不再每轮重跑——按拓扑序切片由控制者算）。分派 Planner（按载体：subagent 用 Agent 工具 / herdr 开 pane），**模板自加载**——不复制模板全文，prompt 只有两行：

```
Read ~/.claude/skills/afk-issue-loop/reference/planner-prompt.md 获取完整指令并执行。
参数：TARGET_BRANCH=${TARGET_BRANCH}
```

（skill 若安装在其他路径则用实际路径；herdr 模式 prompt 相同。）

Planner 自行扫描 issue、构建完整 DAG（含全部 open issue 的 `blocked_by`），把结果**写入目标项目 `docs/afk-plan.json`**（无 `docs/` 则新建），并输出 `<plan>` JSON——schema：`{"issues":[{"number","title","branch","blocked_by":[number,...]}]}`（完整示例在 [reference/planner-prompt.md](reference/planner-prompt.md)，控制者验收只需字段名）。

**控制者验收**：跑 `bash ~/.claude/skills/afk-issue-loop/scripts/validate-plan.sh docs/afk-plan.json`（schema + 分支名格式 + `blocked_by` 引用存在 + 无环检测，exit 1 时错误行指明问题、有环时报成环节点——plan 验收不靠 LLM 肉眼）；通过后识别可选 `kind` 字段（`kind=gate` = 判定类 ticket，处置见 [REFERENCE.md](REFERENCE.md#依赖解析)）；给每节点补 `status: "pending"`，逐轮用 Edit 维护（`dispatched` / `done` / `failed`）。**plan 落盘即状态落盘**——compact / `--resume` 后重读文件即可无状态重建，不依赖会话记忆。

**全 blocked 判断逻辑**：本轮 unblocked 集合空 → 控制者停循环（无需调用 Planner 重判；DAG 拓扑耗尽即终止）。

### 阶段 2：Implementer + Reviewer（每 issue：worktree → 实现 → 自审）

控制者按 DAG 拓扑序切片**本轮 unblocked**（节点 `blocked_by` 全部已完成或空），跨 issue ≤4 并行——分派前用 `bash ~/.claude/skills/afk-issue-loop/scripts/dispatched-count.sh docs/afk-plan.json` 查当前 dispatched 节点数比对信号量，不靠心里记。**流水线**：某 issue 的 Implementer 一完成（分支 commit >0）即触发其 Reviewer——不等待本轮其他 issue。信号量 ≤4 按 Implementer + Reviewer 合计占坑。

**1. 创建 worktree**（确定性分支 `afk/issue-{N}`）：
- subagent：控制者预创建 `wt switch -c afk/issue-{N} -b ${TARGET_BRANCH}`
- herdr：agent 自行创建（同一命令）

**2. 分派 Implementer**（`model: "sonnet"`，四角色统一），prompt 模板自加载 + 寻址注入，只有两行：

```
Read ~/.claude/skills/afk-issue-loop/reference/implementer-prompt.md 获取完整指令并执行。
参数：ISSUE_NUMBER={N}, BRANCH=afk/issue-{N}, TARGET_BRANCH=${TARGET_BRANCH}, WORKTREE={worktree 绝对路径}
```

- issue 全文 + comments、父 PRD、`CONTEXT.md` / ADR / 编码规范——**均由 agent 按模板指引自取**（`gh issue view` / Read），控制者不代读、不粘贴全文
- herdr 模式无预置 worktree：省略 `WORKTREE` 参数，agent 按模板自行 `wt switch -c`
- 红线摘要（模板内详述）：TDD → 全量测试 → commit（**中文描述、语义原子**）→ `<promise>COMPLETE</promise>`；**不关 issue**；不等待 seam 确认

**3. 超时与失败求值**：分派时以 `run_in_background: true` 挂 watchdog（`bash ~/.claude/skills/afk-issue-loop/scripts/watchdog.sh {worktree 绝对路径} 600`，herdr 模式 agent 自行创建 worktree 后控制者用确定性路径挂同一个脚本），然后**立即停手等通知**（禁轮询，契约见 [REFERENCE.md](REFERENCE.md#超时协议)）：

- **系统完成通知先到** → 杀掉该 watchdog（不误报），查分支 commit：>0 → 触发同 worktree 同 branch 的 Reviewer；==0 → 空产出按 `AgentError` 进失败流程
- **watchdog 退出通知先到**（一行死因：哪个 worktree、idle 多久）→ 判 `AgentIdleTimeoutError`，`TaskStop` 终止 agent，进失败流程
- **agent 抛错** → `AgentError`，进失败流程

**失败流程（零自动重试）**：现场保全（worktree 不删、branch 不动、永不 `reset --hard`）→ 落盘恢复手册 `docs/afk-failures/issue-{N}.md`（branch / worktree / commits 快照 / 错误类型 / 失败摘要 / 可复制的重派 prompt，格式见 [REFERENCE.md](REFERENCE.md#恢复机制)）→ 节点标 `failed` → **不停调度其余 unblocked issue**，收尾把清单交用户逐条处置

**4. 同 worktree 同 branch 触发 Reviewer**（沿用 Implementer 的 worktree，`model: "sonnet"`），prompt 同样模板自加载（模板 `reference/reviewer-prompt.md`，参数与 Implementer 相同）：
- issue 内容与领域上下文同样由 agent 自取
- 读 `git diff ${TARGET_BRANCH}..HEAD`；分支无 commit 则跳过
- **直接改代码 → 跑测试 → `refine:` commit**（不反馈、不复查、不发 `SendMessage` 给 impl-N）——对齐 sandcastle 一次性自改
- Implementer 与 Reviewer 在同一分支线性叠加 commit：Implementer 的 commit 在前、Reviewer 的 `refine:` commit 在后
- 不关 issue
- 1 轮反馈上限、复查、`DONE_WITH_CONCERNS` 升级——全部不存在（与 sandcastle 一致）

**5. 处理状态**：`DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED` 异常按 [REFERENCE.md](REFERENCE.md#状态处理) 处置。

### 阶段 3：Merger（统一拓扑 merge + 关 issue）

本轮 Implementer / Reviewer 全部结束后，分派 Merger（`model: "sonnet"`，模板自加载 `reference/merger-prompt.md`，参数 `BRANCHES` + 主仓库绝对路径）：

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
- **收尾把 `docs/afk-failures/` 完整清单交用户逐条处置**：每条按恢复手册恢复重派（同分支同 worktree，prompt 附手册路径），或人工接手 / 放弃后清理 worktree——处置权在人，用户处置完毕前不删 `afk-failures/`
- 收尾时删除目标项目 `docs/afk-plan.json`（运行时临时文件，不 commit；`docs/` 若因此为空可一并删）
- 全部完成 → 提示用户 code review / QA

## Reference

- [REFERENCE.md](REFERENCE.md) — 依赖解析、协议机制、主窗口预算、模型、红线、状态处理、超时协议（watchdog）、恢复机制、scripts 契约、并行冲突、CONTEXT.md 缺失策略、收尾流程
- [EXAMPLES.md](EXAMPLES.md) — 完整一轮示例（含失败 → 恢复手册 → 同分支重派）；不确定某阶段的具体命令 / 信号格式时先读它
- [scripts/](scripts/) — `validate-plan.sh`（plan 校验）/ `watchdog.sh`（超时盯梢）/ `dispatched-count.sh`（并行计数），契约见 REFERENCE.md scripts 契约段
- [reference/planner-prompt.md](reference/planner-prompt.md) — Planner 分派模板（输出 DAG）
- [reference/implementer-prompt.md](reference/implementer-prompt.md) — Implementer 分派模板（含语义原子 commit 约束）
- [reference/reviewer-prompt.md](reference/reviewer-prompt.md) — Reviewer 分派模板（直接自改 + `refine:` commit）
- [reference/merger-prompt.md](reference/merger-prompt.md) — Merger 分派模板（拓扑 merge + summarizing commit）

全部 issue 完成后，提示用户：

> 所有 issue 已实现并合并。建议先进行 **code review**（审查代码正确性、风格、安全性），再执行 **QA 测试**（端到端行为、回归验证）。经典流程：code review 通过 → 部署到测试环境 → QA 测试。