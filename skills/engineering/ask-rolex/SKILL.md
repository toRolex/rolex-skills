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

1. **`/grill-with-docs`** — 通过访谈打磨想法。当你有代码库时从这里开始：它是有状态的，把学到的东西保存在 `CONTEXT.md` 和 ADR 中。（没有代码库？用 `/grill-me` — 见独立 skill。两者都运行同一个 `/grilling` 底层引擎；`grill-with-docs` 多了一层文档记录。）
2. **分支 — 是否每个问题都能在对话中解决？** 如果某个问题需要可运行的答案（状态、业务逻辑、必须看到的 UI），通过原型绕行，用 **`/handoff`** 双向桥接（见跨会话）：
   - **`/handoff`** 转出，然后在那个文件上开新会话，
   - **`/prototype`** 用一次性代码回答问题，
   - **`/handoff`** 转回你学到的东西，在原始想法线程中引用。
3. **分支 — 这是多会话构建吗？**
   - **是** → **`/to-spec`**（将线程转为 spec），然后 **`/to-tickets`** 拆成 tracer-bullet tickets，每个标注其 **阻塞边**。在本地 tracker 上是 `.scratch/<feature>/issues/` 下一个 ticket 一个文件，按阻塞关系手动推进；在正式 tracker 上阻塞边变成原生链接，任何阻塞已清的 ticket 都可以拿起来——对每个 ticket 启动 **`/implement`**，**每完成一个清空上下文**。
   - **否** → **`/implement`** 直接在当前上下文窗口构建。

   无论是哪种，**`/implement`** 构建每个 issue 时内部驱动 **`/tdd`**——一次一个红-绿切片——完成后运行 **`/code-review`**（双轴 review：Standards + Spec）再提交。只想对具体行为做测试驱动开发、不需要完整 spec 时单独用 **`/tdd`**；想针对固定点 review 分支或 PR 时单独用 **`/code-review`**。

### 上下文卫生

步骤 1–3 保持在 **一个不间断的上下文窗口** 中——不要压缩或清空，直到 `/to-tickets` 完成——这样访谈、spec 和 tickets 都建立在同一套思考上。每个 `/implement` 然后从 ticket 开始全新上下文。

这有一个上限：**[smart zone](https://www.aihero.dev/ai-coding-dictionary/smart-zone)**（当前最强模型约 120k tokens），在此窗口内模型推理仍然敏锐。如果会话在 `/to-tickets` 之前接近它，不要勉强——用 `/handoff` 并在新线程中继续。

## 匝道

产生工作的起始场景，然后汇入主流程。

- **Bug 和请求堆积** → **`/triage`**。将 issue 按 triage 角色状态机推进，产出 agent-ready 的 issues，后续由 **`/implement`** 拾取。

  Triage 只用于 **不是你创建的** issue——bug 报告、 incoming 功能请求，任何原始到达的东西。`/to-tickets` 产出的 tickets 已经是 agent-ready 的，所以 **不要 triage 它们**。

- **什么东西坏了** → **`/diagnosing-bugs`**。用于困难 bug：一眼看不出原因的、间歇性 flake、在两个已知正常状态之间悄悄出现的回归。它在有 **紧密反馈循环** 之前拒绝推测——一个在此 bug 上已经变红的命令——然后用回归测试修复。事后分析在发现真正问题是缺少锁定 bug 的良好 seam 时交接给 **`/improve-codebase-architecture`**。

- **巨大、模糊的工作量——绿地项目或超大功能构建，一个会话装不下** → **`/wayfinder`**。当从当前位置到目标的路径还不可见时，它在 issue tracker 上绘制一张 **共享的** 调研 ticket 地图，一次解决一个——产出的是 **决策，不是交付物**——直到迷雾散开、路径清晰。然后汇入主流程的 **`/to-spec`**（或者，如果工作量其实很小，直接到 **`/implement`**）。`/grill-with-docs` 打磨的是一个会话能装下的想法，wayfinder 针对的是装不下的。

## 代码库健康

不是功能工作——维护。

- **`/improve-codebase-architecture`** — 有空时运行，保持代码库适合 agent 操作。它发现 **deepening 机会**；选择一个就 _产生一个想法_，可以带到主流程的 `/grill-with-docs`。它是找到候选的勘察；**`/codebase-design`**（见下）是你设计选中那个的工作台。

## 底层词汇

两个 model-invoked 参考，运行在其他 skill _之下_——每个是其词汇的唯一权威来源。当 **词语** 而不是流程是问题时直接访问它们；或者让上面的 skill 自行调用。

- **`/domain-modeling`** — 打磨项目的 _领域_ 语言：挑战模糊术语，解决过载词，将难以逆转的决策记录为 ADR。它是 `/grill-with-docs` 驱动的、保持 `CONTEXT.md` 干净的活动纪律。
- **`/codebase-design`** — 深度模块词汇（模块、接口、深度、seam、适配器、杠杆、局部性），用于设计模块的 _形状_：大量行为隐藏在干净 seam 上的小接口后面。`/tdd` 和 `/improve-codebase-architecture` 都在说这门语言。

## 跨会话

- **`/handoff`** — 当线程满了或需要分支（例如进入 `/prototype` 会话），将对话压缩为 markdown 文件。不在原地继续——**开新会话并引用那个文件** 来携带上下文。它是上下文窗口之间的桥梁，双向使用。当想要 **全新会话** 但需要 **保留当前对话** 时用它。
- **`/compact`**（内置）— 留在 **同一个会话**，让前面的轮次被摘要。在阶段的 **有意断点** 使用，当不介意丢失逐字历史时。不要在阶段中间压缩——agent 会迷路。`/handoff` 是分叉；`/compact` 是继续。

## 独立 skill

完全脱离主流程。

- **`/grill-me`** — 与 `/grill-with-docs` 相同 relentless 的访谈，但用于 **没有代码库** 的情况。无状态：不在本地保存任何东西，不构建 `CONTEXT.md`。用于打磨任何不驻留在仓库中的计划或设计。
- **`/prototype`** — 一个小型一次性程序，回答一个设计问题：这个状态模型对吗，或者这个 UI 应该长什么样。从第一天就是一次性的——保留答案，删除代码。它是主流程第 2 步的绕行，但任何时候设计问题难以在纸面上解决时都可以用它。
- **`/research`** — 将阅读工作委托给 **后台 agent**：针对 **一手资料** 调查问题，然后在仓库中留下带引用的 Markdown 文件。它阅读时你继续工作。产出的文件是带入主流程 `/grill-with-docs` 的东西——研究喂养思考，不替代思考。
- **`/teach`** — 多会话学习一个概念，用当前目录作为有状态的教学工作区。
- **`/resolving-merge-conflicts`** — 解决进行中的 git merge/rebase 冲突。冲突时 model 会自动调用。
- **`/writing-great-skills`** — 编写和编辑 skill 的参考指南。
- **`/afk-issue-loop`** — 批量 AFK 处理 GitHub issues。遍历 `ready-for-agent` 标签的 issue，逐个分发给独立 agent。
- **`/qa-plan`** — 从最近 commit 生成 step-by-step QA 测试计划，保存为 GitHub issue。
- **`/clean-branches`** — 清理本地和远程已合并的 Git 分支。
- **`/git-flow-conventions`** — Git Flow 分支管理与提交规范指南。
- **`/publish-release`** — 从 develop 分支发版。
- **`/safe-pull`** — 安全 git pull + rebase 工作流。

## 前置条件

**`/setup-rolex-skills`** — 在第一个工程流程之前运行，配置 issue tracker、triage 标签和领域文档布局。自定义 issue tracker 也能用。

## Rolex 专属补充

这些是本仓库相比 matt pocock skills 的差异化内容：

- **6 个原创技能** — 覆盖 Git 工作流（`/safe-pull`、`/clean-branches`、`/git-flow-conventions`、`/publish-release`）、AFK 批量处理（`/afk-issue-loop`）、QA 计划（`/qa-plan`）。
- **浏览器工具**：每次会话首次使用浏览器/搜索工具前必须先 `Skill("browser-tools")`。`WebSearch` 有 bug，走其他搜索途径。Playwright 默认 `--headed --persistent`。
- **强模型顾问**：目标不清、高影响多方案、关键权衡不明时，调用 `Agent(subagent_type="strong-model-consultant")`，顾问返回决策后再继续执行。
