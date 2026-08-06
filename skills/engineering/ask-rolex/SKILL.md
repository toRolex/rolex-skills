---
name: ask-rolex
description: 询问哪个 skill 或流程适合当前场景。本仓库所有 user-invoked skill 的路由器。
disable-model-invocation: true
---

# Ask Rolex

你不必记住每个 skill，问就行。

一个 **flow** 是一条贯穿多个 skill 的路径。大部分路径沿着一条 **主流程** 走，两条 **匝道** 汇入。其余都是独立的，或者是底层运行的词汇层。

## 主流程：想法 → 交付

大多数工作走的路线。你有一个想法，想把它做出来。

1. **`/grill-with-docs`** — 通过访谈打磨想法。只要你在**工作目录**里就从这里开始：它是有状态的，把学到的东西保存在 `CONTEXT.md` 和 ADR 中。（没有工作目录？用 `/grill-me` — 见独立 skill。两者运行同一个 `/grilling` 底层引擎；`grill-with-docs` 是会留下文档痕迹的那个，所以只要有仓库可以留，它就是两者中更好的。）
2. **分支 — 能否在对话中解决每个问题？** 如果一个问题需要可运行的答案（状态、业务逻辑、你必须看到的 UI），绕行原型，用 **`/handoff`** 双向桥接（原型住在自己的目录里，这正是 `/handoff` 的用途——见阶段边界）：
   - **`/handoff`** 转出，然后针对那个文件开新会话，
   - **`/prototype`** 用一次性代码回答问题，
   - **`/handoff`** 把你学到的东西转回来，从原始想法线程引用它。
3. **分支 — 这是多会话构建吗？**
   - **是** → **`/to-spec`**（把线程变成 spec），然后 **`/to-tickets`** 拆成 tracer-bullet tickets，每个标注其**阻塞边**。在本地 tracker 上是 `.scratch/<feature>/issues/` 下一个 ticket 一个文件，按阻塞顺序手工推进；在真实 tracker 上阻塞边变成原生链接，所以任何阻塞已清的 ticket 都可以被拿走——对每个 ticket 启动 **`/implement`**，**每个之间 `/clear` 上下文**。每个 ticket 是自包含的，所以上一个的上下文可以丢弃。
   - **否** → **`/implement`** 就在当前上下文窗口里构建。

   无论哪种，**`/implement`** 构建每个 issue 时内部驱动 **`/tdd`**——一次一个红-绿切片——然后在提交前用 **`/code-review`** 收尾，对 diff 做双轴 review（Standards + Spec）。只想测试先行地构建一个具体行为、不需要完整 spec 时单独用 **`/tdd`**；想针对固定点 review 分支或 PR 时单独用 **`/code-review`**。

### 上下文卫生

步骤 1–3 保持在 **一个不间断的上下文窗口** 中——在 `/to-tickets` 完成之前不要 compact 或 clear——这样访谈、spec 和 tickets 都建立在同一套思考上。每个 `/implement` 然后全新开始，从 ticket 出发工作。

限制来自 **[smart zone](https://www.aihero.dev/ai-coding-dictionary/smart-zone)**：模型仍能敏锐推理的窗口（最新模型约 150k tokens）。如果会话在 `/to-tickets` 之前接近它，不要在降级状态下硬撑——在最近的阶段边界 **`/compact`** 并继续（见阶段边界）。

## 匝道

产生工作的起始场景，然后汇入主流程。

- **Bug 和请求堆积** → **`/triage`**。将 issue 按 triage 角色推进，产出 agent-ready 的 issues，后续由 **`/implement`** 拾取。

  Triage 只用于 **不是你创建的** issue——bug 报告、incoming 功能请求，任何原始到达的东西。`/to-tickets` 产出的 tickets 已经是 agent-ready 的，所以**不要 triage 它们**。

- **什么东西坏了** → **`/diagnosing-bugs`**。用于困难的那种：第一眼看不出来的 bug、间歇性 flake、在两个已知良好状态之间悄悄出现的回归。它在有**紧密反馈循环**之前拒绝推测——一个已经在这_个_ bug 上变红的命令——然后用回归测试修复。当真正的发现是没有好的 seam 来锁定 bug 时，它的事后分析交接给 **`/improve-codebase-architecture`**。

- **巨大、模糊的工作量——绿地项目或超大功能构建，一个会话装不下** → **`/wayfinder`**，这里是认知上最重的流程。当从这里到目的地之间的路还不可见时，它在 issue tracker 上绘制一张 **共享的** 决策 ticket 地图，一次解决一个——产出的是**决策，不是交付物**——直到迷雾被推开、路线清晰。**`/grill-with-docs`** 打磨的是你能在一个会话里握住的想法，wayfinder 针对的是你握不住的——而且它更慢、更密，所以只留给那种情况，绝不用于范围清晰的 feature。

  当地图清晰时，**它交接，不构建**：在 **`/to-spec`** 汇入主流程，后者把地图上链接的决策折叠成一个可构建的计划，然后照常 `/to-tickets` 和 `/implement`。把地图直接循环进 `/implement` 会跳过那个折叠、丢掉链接的细节——只有当工作量实际上很小才直接去 `/implement`。

## 代码库健康

不是功能工作——维护。

- **`/improve-codebase-architecture`** — 有空时运行，保持代码库适合 agent 操作。它发现 **deepening 机会**；选一个就_产生一个想法_，可以带进主流程的 `/grill-with-docs`。它是找到候选的勘察；**`/codebase-design`**（见下）是你设计选中那个的工作台。

## 底层词汇

两个 model-invoked 参考，运行在其他 skill _之下_——每个是其词汇的唯一权威来源。当 **词语** 而不是流程是问题时直接访问它们；或者让上面的 skill 自行调用。

- **`/domain-modeling`** — 打磨项目的_领域_语言：挑战模糊的术语，解决过载的词（一个词干三份活的 "account"），把难以逆转的决策记录为 ADR。它是 `/grill-with-docs` 驱动、让 `CONTEXT.md` 保持干净词汇表的活动纪律。
- **`/codebase-design`** — 深度模块词汇（module、interface、depth、seam、adapter、leverage、locality），用于设计模块的_形状_：大量行为藏在干净 seam 上的小接口后面。`/tdd` 和 `/improve-codebase-architecture` 都在说这门语言。

## 阶段边界

一个**阶段**是会话内的一块工作——访谈、实现、QA。在两者之间的**边界**上你有五个选项，在它们之间做选择是整个地图里最模糊的决定：

- **继续** — 原地不动。不花任何成本，不损失任何东西。
- **`/clear`** — 清空窗口，当这里的东西对接下来都不重要时。
- **`/handoff`** — 写一个可移植的 markdown 文件。窄：只用于**新 harness**、**新目录**、**同事**，或在**阶段中间**分叉一个旁支任务。它买到的是可移植性。
- **Sub-agent** — 把一个紧范围的任务送到它自己的窗口，拿回一份报告。
- **`/compact`** — 压缩当前上下文，用摘要开启新会话。**默认**，在树的底部而不是第一个伸手的地方。

阅读 [PHASE-BOUNDARIES.md](PHASE-BOUNDARIES.md) 了解有序的树——五个问题、每个分支背后的推理、以及为什么一手来源成本使 **继续** 成为最先排除的那个。在**边界处**做决定；阶段中间，继续或把剩下的拆给 sub-agent。

## 独立 skill

完全脱离主流程。

- **`/grill-me`** — 与 `/grill-with-docs` 相同的 relentless 访谈，但**无状态**：它不在本地保存任何东西，不构建 `CONTEXT.md`。当你**不在工作目录里**工作时用它——打磨计划、设计、一段写作、任何底下没有仓库的东西。如果你在工作目录里，改用 `/grill-with-docs`：它运行同样的访谈并留下文档痕迹，所以严格来说更好。
- **`/grilling`** — 访谈原语本身：轮次、前沿，事实是 agent 的活、决定是你的。`/grill-me` 和 `/grill-with-docs` 是两个具名的入口，`/triage`、`/wayfinder` 和 `/improve-codebase-architecture` 内部都运行它。只有当你想在没有任何包装的情况下直接要访谈时才直接访问它。
- **`/resolving-merge-conflicts`** — 一块一块地处理进行中的 merge/rebase 冲突，按**意图**解决，追溯到每一侧的一手来源，而不是挑行，然后完成操作。它从不运行 `--abort`。独立且脱离所有流程：当你已经在冲突中时用它。
- **`/prototype`** — 一个小的、一次性程序，回答一个设计问题：这个状态模型对吗，或者这个 UI 应该长什么样。一次性是对代码书写方式的约束，不是销毁它的承诺：答案折叠进真实代码，原型本身作为**一手来源**保存在 main 之外一个 `prototype/<name>` 分支上，从实现 issue 指向它。它是主流程第 2 步的绕行，但任何时候设计问题难以在纸面上解决时都可以用它。
- **`/research`** — 把阅读的苦力活委托给**后台 agent**：它针对**一手资料**调查问题，然后在仓库里留下带引用的 Markdown 文件。它阅读时你继续工作。它产出的文件是要带_进_主流程的 `/grill-with-docs` 的东西——研究喂养思考，不替代思考。
- **`/to-questionnaire`** — 当卡住你的不在你脑子里也不在代码库里，而在**别人的**脑子里时，这个 skill 给他们写一份问卷去填。它是 `/grill-me` 的反面：不访谈你关于主题，而是访谈你关于**投递**——发给谁、你需要拿回什么——并把问题瞄准那个缺口。拿回来的是 `/grill-with-docs` 或 `/to-spec` 的材料。
- **`/wizard`** — 用于只有**人类**能做的步骤：开通基础设施、设置凭据或 CI secrets、在一个陌生的第三方 dashboard 里点来点去、跑一次性迁移或切换。它生成一个交互式 bash 脚本，打开每个 URL、捕获每个值、写进 `.env` 和 GitHub secrets——这样那个流程就不再需要你每次重新解释给 agent。Model-invoked，所以 agent 一碰到只有你能过的墙就会去够它。如果 agent 能自己做，它就该自己做；这是给真正有人类在循环里的情况。
- **`/wait-what`** — 纠正一条没落地的消息。在对话中间、任何其他 skill 内部使用它，agent 会用你缺失的上下文、用浅白的语言、用 `CONTEXT.md` 的词汇重新讲解它刚说的话。它是事后生效的；`/grill-with-docs` 是事先的治愈——因为早早就约定好的共享语言才是阻止行话出现的东西。
- **`/teach`** — 跨多个会话学习一个概念，用当前目录作为有状态的工作区。
- **`/writing-for-agents`** — 编写 agent 消费的文档的参考：skill、AGENTS.md、被指向的文档。
- **`/writing-great-skills`** — 编写和编辑 skill 的参考指南。
- **`/afk-issue-loop`** — 批量 AFK 处理 GitHub issues。遍历 `ready-for-agent` 标签的 issue，逐个分发给独立 agent。
- **`/qa-plan`** — 从最近 commit 生成 step-by-step QA 测试计划，保存为 GitHub issue。
- **`/clean-branches`** — 清理本地和远程已合并的 Git 分支。
- **`/git-flow-conventions`** — Git Flow 分支管理与提交规范指南。
- **`/publish-release`** — 从 develop 分支发版。
- **`/safe-pull`** — 安全 git pull + rebase 工作流。

## 前置条件

**`/setup-rolex-skills`** — 在第一个工程流程之前运行，配置 issue tracker、triage 标签和文档布局，其他 skill 假定它们存在。自定义 issue tracker 也能用。

## Rolex 专属补充

这些是本仓库相比 matt pocock skills 的差异化内容，原创 skill 位于 `skills/personal/`：

- **6 个原创技能** — 覆盖 Git 工作流（`/safe-pull`、`/clean-branches`、`/git-flow-conventions`、`/publish-release`）、AFK 批量处理（`/afk-issue-loop`）、QA 计划（`/qa-plan`）。
- **浏览器工具**：每次会话首次使用浏览器/搜索工具前必须先 `Skill("browser-tools")`。`WebSearch` 有 bug，走其他搜索途径。Playwright 默认 `--headed --persistent`。
- **强模型顾问**：目标不清、高影响多方案、关键权衡不明时，调用 `Agent(subagent_type="strong-model-consultant")`，顾问返回决策后再继续执行。
