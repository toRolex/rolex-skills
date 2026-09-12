# Sandcastle 原始设计调研笔记

> **SPEC #8 阅读指引**：以下历史源码与验收结论原样保留，不是当前运行协议。现行 AFK 使用固定 `e99f832f26dc9d245c019a9ddd19fa5dee792427` 的函数级提取和三份原版中文角色模板；全部就绪票定批并发、不补位，删除全 blocked fallback，恢复真实 stdout 可续的60秒 completion grace。该版本已有 `src/sandboxes/no-sandbox.ts`，无 Docker 不等于必须重写。现行决定见 [ADR 0005](../adr/0005-afk-sandcastle-source-reuse.md)，逐项差异见 [对照表](sandcastle-vs-afk-sequence.md)；历史三CLI与长测不自动算 #8 通过。

> 历史研究边界：本文主要研究历史 `.sandcastle/run.ts`，正文保留当时结论。固定 commit `e99f832f26dc9d245c019a9ddd19fa5dee792427` 的 `parallel-planner-with-review/main.mts` 无固定四票并发限制，但同样有最多 10 轮的外层循环；不要将 dogfood 的并发 4 当作模板限制。现行 AFK 的固定批次交付及其与上游的差异见 [差异表](sandcastle-vs-afk-sequence.md)。

> 调研对象：`https://github.com/mattpocock/sandcastle`（本次通过 `git clone --depth 1` 成功获取，随后 `git fetch --unshallow` 拉全 1193 个 commit，因此**读到了完整源码与历史**，非仅 README）。
>
> 调研日期：2026-08-16。当前 HEAD = `e99f832`。
>
> 需要说明的重要前提：sandcastle 仓库经历了多次大改。要回答"原始设计"，必须先区分**三个时代**：
>
> 1. **最早单 agent 时代**（commit `fb3ad9b`）：只有一个 `sandcastle.run()`，一个通用 prompt，一次调用。没有角色、没有 plan/merge 阶段。
> 2. **issue-loop 编排时代**（commit `86f049a` 起，文件 `.sandcastle/run.ts`）：这正是 afk-issue-loop 模仿的对象——Plan / Execute / Merge 多阶段循环。
> 3. **库/模板化时代**（后期）：把 issue-loop 抽成 `src/templates/` 脚手架，并新增 `.sandcastle/agent-workflows/`（GitHub Actions 版）与 `.factory/`（"software-factory" daemon）两套不同的演化。
>
> 下面 9 个问题主要针对**第 2 时代（issue-loop 编排，`.sandcastle/run.ts`）**回答，并标注它随 commit 的演进。所有 commit 均可用 `git show <hash>` 复核。

---

## 设计演进时间线（原始设计的关键 commit）

| Commit | 日期 | 变更 |
|---|---|---|
| `fb3ad9b` | — | "Added sandcastle"：单 agent、单次 run、通用 `prompt.md`，无角色无阶段 |
| `86f049a` | 2026-03-25 | "Add parallel orchestration script with plan/execute/merge phases"：**引入 3 阶段**（Plan→Execute→Merge），单遍（无外层循环），无 review，implementer 自己关 issue |
| `165e296` | 2026-03-25 | plan-prompt 改为**构建依赖图**，引入 "blocked by / unblocked" 概念 |
| `6eef309` | 2026-03-25 | 引入 `MAX_ITERATIONS = 10` **外层循环（每轮重 plan）** + 新增 `implement-prompt.md` |
| `908f4e5` | — | implementer 改为 **"Do not close the issue"**；merge-prompt 新增 **"CLOSE ISSUES"** 段（关 issue 责任从 implementer 移到 merger） |
| `ab05534` | 2026-03-26 | "Enhance execution phase to include review process for each branch"：**新增 Reviewer 角色**（`review-prompt.md`） |
| 后期 | — | `MAX_PARALLEL = 4` 并发上限、`createSandbox` 复用同一沙箱、branch 名改为确定性 `sandcastle/issue-{number}`、模板化、agent-workflows、`.factory` |

---

## 逐条回答

### 1. 角色划分

**结论：4 个角色（Planner / Implementer / Reviewer / Merger）全部存在，但它们是"宿主脚本用不同 prompt+model 分别调用 `sandcastle.run()`"，不是引擎里的硬编码子系统。**

- 最早 `fb3ad9b`：**0 个角色**——只有一个 agent 读通用 `prompt.md` 挑任务做。
  - 来源：`git show fb3ad9b:.sandcastle/run.ts`（单次 `sandcastle.run({ promptFile: "./.sandcastle/prompt.md" })`）、`git show fb3ad9b:.sandcastle/prompt.md`（TASK SELECTION 优先级）。
- `86f049a`（issue-loop 首个版本）：**3 个角色**——Planner（opus 分析 issues 输出 `<plan>`）、Implementer（N 个并行、每 issue 一个）、Merger（1 个 agent 合并所有分支）。**没有 Reviewer**。
  - 来源：`git show 86f049a:.sandcastle/run.ts` 全文件；`git show 86f049a:.sandcastle/plan-prompt.md`、`.sandcastle/merge-prompt.md`。
- `ab05534` 起：**4 个角色**——在 Implementer 之后、Merge 之前插入 Reviewer。
  - 来源：`git show ab05534 --stat`（新增 `.sandcastle/review-prompt.md` + 改 `run.ts`）；当前 `src/templates/parallel-planner-with-review/main.mts` 头部注释（"four-phase orchestration loop: Plan / Execute + Review / Merge"）。

### 2. 循环 / 每轮重 Plan

**结论：「每轮重 plan」是 sandcastle 自身机制（自 `6eef309` 起），不是用户改编加的。但最初的 `86f049a` 是单遍的，没有循环。**

- 最原始 `86f049a` 的 `run.ts` 是**单遍**：plan 一次 → execute → merge → 结束。无 `for` 循环。
  - 来源：`git show 86f049a:.sandcastle/run.ts`（文件以 merge 收尾，无外层循环）。
- `6eef309` 加入 `const MAX_ITERATIONS = 10;` + `for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++)`，每轮迭代重新跑 Plan 阶段（"Phase 1: Plan" 在循环体内）。
  - 来源：`git show 6eef309:.sandcastle/run.ts`（头部 15 行即含 `MAX_ITERATIONS` 与循环）。
- 循环目的是合并后**捡起新解除阻塞的 issue**：模板注释原话 "The outer loop repeats up to MAX_ITERATIONS times so that newly unblocked issues are picked up after each round of merges."
  - 来源：`src/templates/parallel-planner-with-review/main.mts` L15-17；`src/templates/parallel-planner/main.mts` L11-13。
- 当前 `.sandcastle/run.ts` 仍是 `MAX_ITERATIONS = 10` 的外层循环。
  - 来源：`.sandcastle/run.ts` L4、L7-8。

### 3. Review 环节

**结论：Review 是后来（`ab05534`）才加的，不是最初设计。Reviewer 是独立 agent 运行；它直接改代码并提交，不是只反馈；per-issue 串行、跨 issue 并行；没有"反馈→原 agent 修复→复查"的闭环。**

- **是否强制**：不是无条件强制。仅当 Implementer 产出了 commit 才触发 review：`if (result.commits.length > 0) { ... review ... }`。没产出 commit 的 issue 直接跳过 review。
  - 来源：当前 `.sandcastle/run.ts` L83-94；`git show ab05534:.sandcastle/run.ts` 同样条件。
- **是否独立角色**：是。Reviewer 是另一次 `sandbox.run()` / `sandcastle.run()`（独立 claude CLI 子进程，独立 prompt `review-prompt.md`），不是 implementer 的 subagent。它**在同一个 branch / 同一个沙箱**上跑。
  - 来源：`.sandcastle/run.ts` L84-94（同 `sandbox` 上第二次 `sandbox.run`）。
- **只反馈还是直接改**：直接改。review-prompt 的 EXECUTION 段：找到可改进就直接在分支上改、跑 typecheck/test、用 `RALPH: Review -` 前缀提交；"If the code is already clean and well-structured, do nothing."
  - 来源：`.sandcastle/review-prompt.md` L53-63；`git show ab05534:.sandcastle/review-prompt.md`（内容基本一致）。
- **串行还是并行**：per-issue 内串行（implement → review 顺序执行）；跨 issue 并行（`Promise.allSettled` 并发所有 issue 管线，后期加 `MAX_PARALLEL = 4` 上限）。
  - 来源：`.sandcastle/run.ts` L41-57（并发 + acquire/release 信号量）、L57 `Promise.allSettled`。
- **有无反馈闭环**：**没有**。Reviewer 要么自己改好、要么不改；不会把 review 意见回传给 implementer 让它修，也不会复查。一次 review pass 结束。
  - 来源：`.sandcastle/review-prompt.md` 全文（无回传指令）；`parallel-planner-with-review/main.mts`（review 后直接进入 merge 阶段）。
  - 补充：后期 `.sandcastle/agent-workflows/` 里的 reviewer 改为**发 PR 评论**（`event: "COMMENT"`，写入 `review_payload.json`），但那已是不同的 GitHub Actions 演化，且也没有"原 agent 修复复查"的闭环。来源：`.sandcastle/agent-workflows/review/review.ts` L63-74。

### 4. Merge 时机

**结论：barrier 式统一 merge——等一批 issue 全部跑完才一次性 merge。不是每 issue 完成就 merge。用的是普通 `git merge --no-edit`，不是 squash merge。**

- **barrier**：`Promise.allSettled` 等**所有** issue 管线结束，收集"有 commit 的分支"（`completedBranches`），然后单个 Merger agent 一次性合并。失败的/无 commit 的 issue 被过滤掉不参与 merge。
  - 来源：`.sandcastle/run.ts` L57（allSettled）、L111-127（过滤 completed）、L141-154（merge 全部）；`86f049a` 版本相同结构。
- **非每 issue merge**：issue 完成只是把 commit 落在自己的 branch 上，等到本轮的 merge 阶段才合回主干。
  - 来源：`86f049a:.sandcastle/run.ts` 结构。
- **merge 方式**：`git merge <branch> --no-edit`，逐分支合并、解决冲突、跑 typecheck/test，最后打一个汇总 commit。**没有 `--squash`**。
  - 来源：`.sandcastle/merge-prompt.md` L7-14；全仓库 grep `squash` 无编排相关命中（仅测试里 `Cause.squash`，无关）。

### 5. 依赖解析（"Blocked by"）

**结论：是 sandcastle 机制，但是 prompt 层面的"planner 推断"，不是结构化字段，也没有依赖图解析代码。**

- `165e296` 把 plan-prompt 改为"构建依赖图"，定义 **blocked by** / **unblocked** 语义（B blocked by A：需 A 的代码/基础设施、改重叠文件、或依赖 A 的 API/决策）。planner 只输出 **unblocked** 的 issue 列表。
  - 来源：`.sandcastle/plan-prompt.md` L13-21（blocked 判定）、L23（确定性 branch 名）、L35（只含 unblocked）；`git show 165e296 -- .sandcastle/plan-prompt.md`（完整 diff）。
- **判定逻辑全在 planner agent 的 prompt 里**（让模型分析 issue 内容推断阻塞关系），宿主脚本只解析 `<plan>` JSON 里的 `issues` 数组，没有解析 "Blocked by" 标签/字段的代码。
  - 来源：`.sandcastle/run.ts` L18-27（正则提取 `<plan>` + `JSON.parse`）；`.sandcastle/plan-prompt.md` L13-21。
- 分支名格式：早期 `sandcastle/issue-{number}-{slug}`，后期改为**确定性** `sandcastle/issue-{number}`（重 plan 同一 issue 得到同一分支名，保留累积进度）。来源：`.sandcastle/plan-prompt.md` L23；commit `d0afa21`（"make planner branch names deterministic"）。

### 6. worktree / 分支隔离

**结论：是核心机制。每个 issue 一个独立分支，配合 git worktree 隔离。**

- issue-loop 从一开始（`86f049a`）就给每个 issue 传 `branch: issue.branch`，分支名形如 `sandcastle/issue-42-...`。
  - 来源：`git show 86f049a:.sandcastle/run.ts`（Phase 2 的 `branch: issue.branch`）。
- 引擎侧：`run()` / `createSandbox()` / `createWorktree()` 在**宿主 repo 的 `.sandcastle/worktrees/` 下建 git worktree**；bind-mount 型 sandbox（docker/podman）把 worktree 目录挂载进容器，agent 直接写宿主文件系统；isolated 型（vercel）则通过 sync in/out。
  - 来源：`CONTEXT.md` L62（worktree 定义："A git worktree created in `.sandcastle/worktrees/` on the host..."）；`src/createWorktree.ts`；README "How it works" 的 branch strategy 三态（head / merge-to-head / branch，README L548-558）。
- `.sandcastle/run.ts` 用 `createSandbox({ branch: issue.branch, ... })` 复用同一沙箱给 implementer 和 reviewer。
  - 来源：`.sandcastle/run.ts` L61-70。

### 7. squash merge 与关 issue

**结论：没有 squash merge（普通 merge）；"统一关 issue"是 sandcastle 机制，但经历过责任迁移——最初是 implementer 自己关，`908f4e5` 后改为 merger 统一关。**

- **squash**：不存在。见第 4 问。
- **关 issue 责任迁移**：
  - 最初 `86f049a` 的 implementer prompt：`Fix issue #N: title ... Make commits, run tests, and close the issue when done.`——implementer 自己关。
    - 来源：`git show 86f049a:.sandcastle/run.ts`（Phase 2 内联 prompt）。
  - `908f4e5` 起：implementer prompt 加入 "Do not close the issue - this will be done later."；merge-prompt 加入 "CLOSE ISSUES" 段，由 **merger 在合并后统一关**（含"若关闭该 issue 会连带完成 parent PRD 也一起关"）。
    - 来源：`.sandcastle/implement-prompt.md` L56（"Do not close..."；注意 L9 仍残留早期 "close the issue when done" 字样，属历史遗留矛盾，以 L56 为准）；`.sandcastle/merge-prompt.md` L16-22；`git log -S "Do not close" --all` 命中 `908f4e5`。
- 因此"**统一 merge + 统一关 issue**"是 sandcastle 从 `908f4e5` 起的正式流程。

### 8. 超时 / 恢复

**结论：引擎层有较完善的超时机制；但 issue-loop 编排层没有中断恢复/断点续跑机制。**

- **超时（引擎层）**：
  - agent 空闲超时 `idleTimeoutSeconds` 默认 600s（README L240-241）。
  - 每个生命周期步骤独立超时（ADR `0001-per-step-timeouts.md`：容器启动、hooks、git 操作等全部 `Effect.timeoutFail`，共 10 种超时错误类型）。
  - completion 信号后的"悬挂进程"宽限期 `completionTimeoutSeconds` 默认 60s（ADR `0019`，README L243-247）。
- **恢复（引擎层）**：有 session capture + `resumeSession`（`claude --resume`），但 ADR `0011-resume-is-one-iteration.md` 规定 **resume 只续跑一次迭代**，且与 `maxIterations > 1` 互斥。
  - 来源：README L885-927；`docs/adr/0011-resume-is-one-iteration.md`。
- **恢复（编排层）**：**没有**。`.sandcastle/run.ts` 对失败 issue 的处理只是 `Promise.allSettled` 捕获 → `console.error` 记录 → 从 merge 名单里跳过。中断整个脚本后没有 checkpoint 可续。
  - 来源：`.sandcastle/run.ts` L103-109（记录失败）、L111-127（过滤掉失败/无 commit 的 issue）。

### 9. 模式载体

**结论：sandcastle 引擎是 provider 无关的，通过"子进程调各家的 CLI"运行 agent；issue-loop 各阶段是独立的 CLI 进程，不是 subagent，也不涉及 herdr。**

- 引擎把 agent 抽象成 AgentProvider，`claudeCode()` 等工厂拼出子进程命令。Claude 命令形如：
  `claude --print --verbose --dangerously-skip-permissions --output-format stream-json --model <model> -p -`（prompt 从 stdin 传入）。
  - 来源：`src/AgentProvider.ts` L1213（claude 命令拼接）、L797/L978/L1202（permission 相关 flag）。
- 引擎支持多 provider：claude-code、codex、pi、cursor、opencode、copilot（README 各 factory 章节）。
- issue-loop（`.sandcastle/run.ts`）是宿主 TS 脚本按顺序/并行 `run()` 每个阶段——每个阶段一次独立 CLI 子进程（+ 各自 sandbox）。**没有**"一个主会话里派 subagent"的机制，**没有** herdr 集成。
  - 来源：`.sandcastle/run.ts` 全文；`src/templates/parallel-planner-with-review/main.mts` L24-26（import `@ai-hero/sandcastle` 直接调用）。
- 沙箱载体：bind-mount（docker/podman，worktree 挂载进容器）与 isolated（vercel Firecracker microVM，sync in/out）两类；`noSandbox()` 可直跑宿主。
  - 来源：README L66-75；`CONTEXT.md` L28（sandbox 定义）。

---

## 附：后期两套不同演化（与本调研问题的区分）

- `.sandcastle/agent-workflows/`（commit `6e9c79c`）：把 implement/review/explore/update-branch 搬进 **GitHub Actions**，reviewer 改发 PR 评论、用 `Output.object` 结构化输出，是 PR 模式而非 issue-loop 模式。
- `.factory/`（commit `b4461a8`）："software-factory" daemon，`run-daemon.sh` 启动 daemon，每个 task 调 `implement-task.ts`，用 worktree + 自动 push 开 PR（`FACTORY_BRANCH`/`FACTORY_BASE` 环境变量）。
  - 来源：`.factory/implement-task.ts` L1-20（环境变量约定）、L30-58（createWorktree + sandbox + implement + review）；`.factory/run-daemon.sh`。
