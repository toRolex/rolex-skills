---
name: ask-rolex
description: 询问哪个 skill 或 flow 适合当前场景。本仓库所有 user-invoked skill 的路由器。
disable-model-invocation: true
---

# Ask Rolex

你不必记住每个 skill，问就行。

一个 **flow** 是一条贯穿多个 skill 的路径。大部分路径沿着一条 **main flow** 走，两条 **on-ramp** 汇入其中。其余的都是 standalone，或者是一个在底层运行的词汇层。

## main flow：想法 → 交付

大多数工作走的路线。你有一个想法，想把它做出来。

0. **分支：任务在陌生地带吗？** 如果它落在 codebase 里你没碰过的区域，或者一个你不熟悉的领域（一种没接触过的技术、一类没做过的设计），先跑一次 **`/blind-spot-pass`**（user-invoked，手动触发）：让 agent 把你的 **unknown unknowns** 翻出来讲清楚，再带着它们进入步骤 1。熟悉的领域直接跳过——它的价值与你的盲区成正比。
0.5. **分支：判断标准是看到才认得的吗？** 如果你不知道有哪些可能，或者标准说不出来但看到能认出（审美、口味、"就要这个感觉"），先 **`/brainstorm`** 发散：列举介入点，或产出多个截然不同的方向交给 prototype 供你反应。grilling 中途发现剩下的决策要看到实物才能定时，也会转手调用它。
1. **`/grill-with-docs`** 通过 interview 打磨想法。只要你在**工作目录**里工作，就从这里开始：它是有状态的，会把学到的东西保留在 `CONTEXT.md` 和 ADR 中。（没有工作目录？改用 `/grill-me`，见 Standalone。两者运行同一个 `/grilling` 原语；`grill-with-docs` 是会留下书面痕迹的那个，所以只要有仓库可以留下痕迹，它就是两者中更好的那个。）
2. **分支：你能在对话中解决每个问题吗？** 如果一个问题需要可运行的答案（状态、业务逻辑、一个你必须亲眼看到的 UI），就绕行一个 prototype，用 **`/handoff`** 双向桥接（prototype 住在自己的目录里，这正是 `/handoff` 的用途；见 Phase boundaries）：
   - **`/handoff`** 转出，然后针对那个文件开一个新的 session，
   - **`/prototype`** 用 throwaway 代码回答那个问题，
   - **`/handoff`** 把你学到的东西转回来，并从原始想法线程引用它。
3. **分支：这是多 session 构建吗？** 想在动手前先审阅关键决策，就在 spec 之前跑一次 **`/to-plan`**：它把最可能变的决策（data model、type interface、UX flow）置顶供你反应，机械性重构沉底。
   - **是** → **`/to-spec`**（把线程变成一份 spec），然后 **`/to-tickets`** 把它拆成 tracer-bullet tickets，每个都声明自己的 **blocking edges**。在本地 tracker 上，就是 `.scratch/<feature>/issues/` 下每个 ticket 一个文件，按 blocker 优先手工推进；在真实的 tracker 上，这些 edges 变成原生的阻塞链接，所以任何 blocker 都已完成的 ticket 都可以被拿走：对每个 ticket 启动 **`/implement`**，**每两个之间 `/clear` context**。每个 ticket 都是自包含的，所以上一个 ticket 的 context 是可以随手丢弃的。
   - **否** → **`/implement`** 就在这里、在同一个 context window 里构建。

   无论走哪条路，**`/implement`** 构建每个 issue 时都在内部驱动 **`/tdd`**（一次一个 red → green 切片），然后在 commit 之前用 **`/code-review`** 收尾，对 diff 做一次双轴 review（Standards + Spec）。当你只想以 test-first 的方式构建一个具体行为、不需要完整 spec 时，单独使用 **`/tdd`**；当你想针对某个 fixed point review 一个 branch 或 PR 时，单独使用 **`/code-review`**。

### context hygiene

把步骤 1–3 保持在**一个不间断的 context window** 里（在 `/to-tickets` 完成之前不要 compact 或 clear），这样 grilling、spec 和 tickets 都建立在同一套思考之上。每个 `/implement` 随后从 ticket 出发、全新开始。

这个做法的上限是 **[smart zone](https://www.aihero.dev/ai-coding-dictionary/smart-zone)**：模型仍能敏锐推理的 context window（在最新模型上约 150k tokens）。如果 session 在 `/to-tickets` 之前逼近这个上限，不要在降级状态下硬撑；在最近的 phase boundary 处 **`/compact`**，然后继续（见 Phase boundaries）。

## On-ramps

一种产生工作、然后汇入 main flow 的起始场景。

- **bug 和请求堆积** → **`/triage`**。它把 issue 推过各个 triage role，产出 agent-ready 的 issue，后续由 **`/implement`** 拾取。

  triage 只用于**不是你创建的** issue：bug 报告、外部进来的功能请求、任何原始到达的东西。`/to-tickets` 产出的 tickets 已经是 agent-ready 的，所以**不要对它们做 triage**。

- **有东西坏了** → **`/diagnosing-bugs`**。用于那些难啃的：第一眼看不出来的 bug、间歇性的 flake、在两个已知良好状态之间悄悄溜进来的 regression。在建立起**紧密的 feedback loop**（一条已经在这_个_ bug 上变红的命令）之前，它拒绝空想，然后用一条 regression test 修复。当真正的发现是没有好的 seam 能把 bug 锁住时，它的 post-mortem 会交接给 **`/improve-codebase-architecture`**。

- **一个巨大而模糊（foggy）的工程量：绿地项目，或一个超大功能构建，一个 session 装不下** → **`/wayfinder`**，这是这里认知负担最重的 flow。当从这里到 destination 之间的路还看不见时，它会在 issue tracker 上绘出一张由 **decision tickets** 组成的**共享 map**，并一次一个地解决它们，产出的是 **decisions，而不是 deliverables**，直到 fog 被推回去、路线清晰。**`/grill-with-docs`** 打磨的是你能在一个 session 里握住的想法，wayfinder 针对的则是你握不住的那种，而且它更慢、更密，所以只把它留给那种情况，绝不要用于一个范围清晰的功能。

  当 map 清晰之后，**它做 handoff，而不是构建**：在 **`/to-spec`** 处汇入 main flow，后者把 map 上相互链接的 decisions 折叠成一份可构建的计划，然后照常走 `/to-tickets` 和 `/implement`。把 map 直接循环进 `/implement` 会跳过那个折叠、丢掉相互链接的细节，所以只有当工程量确实很小的时候，才直接去 `/implement`。

## 代码库健康

不是功能工作，只是维护。

- **`/improve-codebase-architecture`** 只要你有空闲时间就运行它，让代码库保持对 agent 友好、适合在其中操作。它会浮出 **deepening opportunities**（加深机会）；挑中一个就_产生一个想法_，你可以把它带进 main flow 的 `/grill-with-docs`。它是找出候选者的勘察；**`/codebase-design`**（见下）是你设计所选对象的工作台。

## 底层词汇

两个 model-invoked 的参考，运行在其他 skill 的_下层_，各自是自己词汇的唯一权威来源。当问题出在**词语**而不是流程上时，直接伸手去拿它们；或者让上面的 skill 把它们拉进来。

- **`/domain-modeling`**：打磨项目的_领域_语言：挑战一个模糊的术语，解决一个过载的词（一个 "account" 干三份活），把难以逆转的 decision 记录成一条 ADR。它是 `/grill-with-docs` 驱动的主动纪律，让 `CONTEXT.md` 保持为一份干净的 glossary。
- **`/codebase-design`** 是用于设计模块_形状_的 deep module 词汇（module、interface、depth、seam、adapter、leverage、locality）：大量行为藏在干净 seam 上的一个小 interface 后面。`/tdd` 和 `/improve-codebase-architecture` 都讲这门语言。

## Phase boundaries

一个 **phase** 是 session 内的一块工作：grilling、实现、QA。在它们两者之间的 **boundary** 上，你有五个选项，而在它们之间做选择，是整个 map 里最模糊的一个 decision：

- **Continue（继续）**：原地不动。不花任何成本，也不损失任何东西。
- **`/clear`**：清空 context window，当这里没有任何东西对接下来重要时。
- **`/handoff`** 写一个可移植的 markdown 文件。范围很窄：只用于**新的 harness**、**新的目录**、**一位同事**，或**在 phase 中途**分叉一个旁支任务。它换来的是可移植性。
- **sub-agent**：把一个严格限定范围的任务送到它自己的窗口，拿回一份报告。
- **`/compact`** 压缩当前 context，并用它开启一个新的 session。**默认选项**，在树的底部，而不是最先伸手就能拿到的地方。

阅读 [PHASE-BOUNDARIES.md](PHASE-BOUNDARIES.md) 了解那棵有序的树：五个问题、每个分支背后的推理，以及为什么 primary-source 的成本让 **Continue** 成为最先被排除的那个。要在 boundary 处做 decision；在 phase 中途，要么继续，要么把其余部分拆给 sub-agent。

## Standalone

完全脱离 main flow。

- **`/grill-me`**：和 `/grill-with-docs` 同样不留情面的 interview，但**无状态**：它不在本地保存任何东西，也不构建 `CONTEXT.md`。当你**不在工作目录里**工作时使用它（打磨一份计划、一个设计、一段文字，任何底下没有 repo 的东西）。如果你在工作目录里，就改用 `/grill-with-docs`：它运行同样的 interview 并留下书面痕迹，所以严格来说它是更好的那个。
- **`/grilling`** 是 interview 原语本身：轮次（rounds）、frontier，事实是 agent 的职责，decision 是你的。`/grill-me` 和 `/grill-with-docs` 是两个具名的进入方式，`/triage`、`/wayfinder` 和 `/improve-codebase-architecture` 内部都在运行它。只有当你想直接要一场不带任何包装的 interview 时，才直接伸手去拿它。
- **`/resolving-merge-conflicts`** 逐个 hunk 地处理进行中的 merge 或 rebase 冲突，按**意图**解决（追溯到每一侧各自的 primary source），而不是挑拣代码行，然后完成整个操作。它从不运行 `--abort`。它是 standalone，独立于每一条 flow：当你已经身陷冲突之中时使用它。
- **`/prototype`** 是一个小的、throwaway 的程序，回答一个设计问题：这个状态模型感觉对吗，或者这个 UI 应该长什么样。throwaway 是对代码书写方式的一种约束，而不是销毁它的承诺：答案会融入真实的代码，prototype 本身则作为 **primary source** 保存在 main 之外的 `prototype/<name>` 分支上，由实现 issue 指向它。它是 main flow 第 2 步里的那个绕行，但任何时候一个设计问题难以在纸面上定夺，都可以使用它。
- **`/research`**：把阅读的跑腿活委托给一个 **background agent**：它对照 **primary sources** 调查一个问题，然后在仓库里留下一份带引用的 Markdown 文件。它阅读的时候你继续干活。它产出的文件，是要带_进_ main flow、供 `/grill-with-docs` 使用的东西，因为 research 喂养思考，而不是取代思考。
- **`/to-questionnaire`**：当挡住你的东西不在你脑子里、也不在代码库里，而是在**别人的**脑子里时，这个 skill 会写一份问卷给他们去填。它是 `/grill-me` 的反面：它不是就那个主题采访你，而是采访你关于**发送（send）**（发给谁、你需要拿回什么），并把问题对准那个缺口。拿回来的东西，是 `/grill-with-docs` 或 `/to-spec` 的素材。
- **`/wizard`** 用于那些只有**人类**才能完成的步骤：开通基础设施、设置凭据或 CI secrets、在一个陌生的第三方 dashboard 里点来点去、运行一次性的迁移或切换。它生成一个交互式 bash 脚本，打开每个 URL、捕获每个值，并写进 `.env` 和 GitHub secrets，这样那套流程就不再是每次都需要你向 agent 重新解释的东西了。它是 model-invoked 的，所以 agent 一撞上只有你能通过的墙，就会伸手去够它。如果 agent 能自己做，它就应该自己做；这个 skill 是为真正有 human in the loop 的情况准备的。
- **`/wait-what`** 是针对一条没能落地的消息的矫正。在对话中途、任何其他 skill 内部使用它，agent 会用你缺失的 context、用通俗易懂的语言、用 `CONTEXT.md` 的词汇，重新讲解它刚刚说的话。它是事后生效的；`/grill-with-docs` 是事前的治愈，因为早早约定好的共享语言，才正是阻止行话出现的东西。
- **`/teach`**：跨多个 session 学习一个概念，把当前目录当作一个有状态的工作区。
- **`/writing-for-agents`** 是编写 agent 消费的文档时的参考：skills、AGENTS.md、被指向的文档。
- **`/writing-great-skills`**：编写和编辑 skill 的参考指南。
- **`/afk-issue-loop [issue numbers]`**：处理指定 Tickets；省略 numbers 时扫描 open `ready-for-agent`。按 GitHub 原生依赖递归编排并自动恢复。
- **`/qa-plan`**：从最近 commit 生成 step-by-step QA 测试计划，保存为 GitHub issue。
- **`/clean-branches`**：清理本地和远程已合并的 Git 分支。
- **`/git-flow-conventions`**：Git Flow 分支管理与提交规范指南。
- **`/publish-release`**：从 develop 分支发版。
- **`/safe-pull`**：安全 git pull + rebase 工作流。

## 前置条件

**`/setup-rolex-skills`**：在第一个工程 flow 之前运行，配置其他 skill 所假定的 issue tracker、triage 标签和文档布局。自定义 issue tracker 也能用。

## Rolex 专属补充

这些是本仓库相比 matt pocock skills 的差异化内容，原创 skill 位于 `skills/personal/`：

- **6 个原创技能**：覆盖 Git 工作流（`/safe-pull`、`/clean-branches`、`/git-flow-conventions`、`/publish-release`）、AFK 批量处理（`/afk-issue-loop`）、QA 计划（`/qa-plan`）。
- **浏览器工具**：每次会话首次使用浏览器/搜索工具前必须先 `Skill("browser-tools")`。`WebSearch` 有 bug，走其他搜索途径。Playwright 默认 `--headed --persistent`。
- **强模型顾问**：目标不清、高影响多方案、关键权衡不明时，调用 `Agent(subagent_type="strong-model-consultant")`，顾问返回决策后再继续执行。
