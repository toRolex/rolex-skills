# Skill 使用地图

不确定时 → [ask-rolex](../skills/engineering/ask-rolex/SKILL.md)。首次工程 flow 前运行 [setup-rolex-skills](../skills/engineering/setup-rolex-skills/SKILL.md)，配置 tracker、标签与文档布局。

本图是导航，不是必跑清单。流程以 [ask-rolex](../skills/engineering/ask-rolex/SKILL.md)（上游 [ask-matt](https://github.com/mattpocock/skills/tree/main/skills/engineering/ask-matt) 的中文化改编）为准；阶段划分参考 [Thariq 的 pre / during / post implementation 框架](https://x.com/trq212/status/2073100352921215386)。同名出口节点连接各图。`clear`、`compact`、sub-agent、merge 与实际 QA 是操作，不是 skill。

## ① 实现前：想法 → tickets

```mermaid
flowchart TD
    IDEA["想法"] --> ENTRY{"如何开始澄清？"}
    ENTRY -->|整段模糊| UNKNOWN["unknowns：四象限编排"]
    UNKNOWN -->|按需继续澄清| GRILL["grill-with-docs：访谈并维护 GLOSSARY 与 ADR"]
    ENTRY -->|只需扫描陌生领域的盲点| BLIND["blind-spot-pass"]
    ENTRY -->|熟悉领域| TASTE{"判断标准需要看到才认得？"}
    BLIND --> TASTE
    TASTE -->|是| BRAIN["brainstorm：展开不同方向"]
    TASTE -->|否| GRILL
    BRAIN --> GRILL
    GRILL --> REAL{"需要可运行的答案？"}
    REAL -->|是| OUT["handoff：转出到原型目录"]
    OUT --> PROTO["prototype：回答设计问题"]
    PROTO --> BACK["handoff：将发现转回原线程"]
    BACK --> SIZE{"多 session 构建？"}
    REAL -->|否| SIZE
    SIZE -->|否，单行为| INPLACE["implement：就地实现，见图②"]
    SIZE -->|是| DECISION{"先审关键决策？"}
    DECISION -->|按需| PLAN["to-plan：关键决策置顶"]
    PLAN --> SPECIN["规格入口"]
    DECISION -->|直接写 spec| SPECIN
    SPECIN --> SPEC["to-spec"]
    SPEC --> TICKETS["to-tickets：声明 blocking edges"]
    TICKETS --> READY["agent-ready tickets"]
```

`unknowns` 是整段模糊时的编排入口，与单跑盲点扫描、头脑风暴互为替代。`to-plan` 是 spec 前的可选审阅，不是循环关卡。**`to-tickets` 产出的票已 agent-ready，不再 triage。** 工程量大到一个 session 握不住？不走这条标准路线，见图④ `wayfinder`。

图中技能：[unknowns](../skills/Thariq/unknowns/SKILL.md) · [blind-spot-pass](../skills/Thariq/blind-spot-pass/SKILL.md) · [brainstorm](../skills/Thariq/brainstorm/SKILL.md) · [grill-with-docs](../skills/engineering/grill-with-docs/SKILL.md) · [handoff](../skills/productivity/handoff/SKILL.md) · [prototype](../skills/engineering/prototype/SKILL.md) · [to-plan](../skills/Thariq/to-plan/SKILL.md) · [to-spec](../skills/engineering/to-spec/SKILL.md) · [to-tickets](../skills/engineering/to-tickets/SKILL.md)。

## ② 实现中：tickets → 实现完成

```mermaid
flowchart TD
    READY["agent-ready tickets"] --> CHECK{"需要复核拆票？"}
    CHECK -->|可选| SLICE["vertical-slice-review"]
    SLICE --> MULTI{"交付形态？"}
    CHECK -->|直接推进| MULTI
    MULTI -->|多步骤交付| NOTES["pre-implement：维护 implementation notes，偏离计划记入 Deviations"]
    MULTI -->|单行为，同一 context 就地做| SINGLE["implement：一次跑完"]
    NOTES --> MODE{"多票推进方式？"}
    MODE -->|亲自逐票，按 blocker 优先| IMPL["implement ×N：每票内部 tdd + code-review"]
    MODE -->|编排整个构建| SPEC["implement-spec：task graph 与 integration branch"]
    SPEC --> STDD["tdd：各 implementer 驱动"]
    STDD -->|integration branch 收尾一次| REVIEW["code-review：对 diff 做 Standards + Spec 双轴 review"]
    IMPL --> BUILT["实现完成"]
    REVIEW --> BUILT
    SINGLE --> BUILT
```

逐票 `implement` 之间 `clear`，每票从自包含 ticket 开始。`pre-implement` 面向多步骤交付：无论规划多充分，实现中总会有 unknown unknowns 迫使偏离——按保守选项执行并记入 Deviations，供下一次尝试学习。

图中技能：[vertical-slice-review](../skills/personal/vertical-slice-review/SKILL.md) · [pre-implement](../skills/Thariq/pre-implement/SKILL.md) · [implement](../skills/engineering/implement/SKILL.md) · [implement-spec](../skills/engineering/implement-spec/SKILL.md) · [tdd](../skills/engineering/tdd/SKILL.md) · [code-review](../skills/engineering/code-review/SKILL.md)。

## ③ 实现后：交付与收尾

```mermaid
flowchart TD
    BUILT["实现完成"] --> DELIVER{"如何交付？"}
    DELIVER -->|PR| PR["pr：最小可视化 + before/after 证据 + 门型判断"]
    DELIVER -->|直接合并| GATE
    PR --> GATE{"用户触发 quiz-me？"}
    GATE -->|是，按需| QUIZ["quiz-me：报告与测验，满分才可 merge"]
    GATE -->|否| MERGE["merge"]
    QUIZ -->|满分通过| MERGE
    MERGE --> DONE["交付完成"]
    BUILT -. 同一 session、clear 之前 .-> RETRO["retro：回看 session，改进 agent 环境"]
    BUILT -. 需要争取 buy-in .-> PITCH["to-pitch：prototype + spec + notes 打包成 pitch 文档"]
    RETRO -.-> NEXT["下一次构建从更好的环境开始"]
```

PR 文案、测验、merge 是三个不同节点。`quiz-me` 只有用户触发时才成为满分合并门禁，不是所有交付的强制步骤。`retro` 回看的是整个 session（含澄清与实现），唯一硬约束是**在同一 session 里、`/clear` 之前**；错过窗口就改为读取原 session 日志。`to-pitch` 不依赖 retro，交付成果需要 reviewer 或专家认可时使用。

图中技能：[pr](../skills/engineering/pr/SKILL.md) · [quiz-me](../skills/Thariq/quiz-me/SKILL.md) · [retro](../skills/engineering/retro/SKILL.md) · [to-pitch](../skills/Thariq/to-pitch/SKILL.md)。

## ④ 其他入口：triage、诊断、探索与架构维护

```mermaid
flowchart TD
    EXTERNAL["外部 bug 报告与功能请求"] --> TRIAGE["triage：将原始 issue 推到 agent-ready"]
    TRIAGE --> READY["agent-ready tickets"]
    BROKEN["难诊断的 bug、flake 或 regression"] --> DIAG["diagnosing-bugs：先建立变红的 feedback loop"]
    DIAG -->|能锁住 bug| FIX["regression test 与修复"]
    DIAG -->|post-mortem 发现缺少好 seam| ARCH["improve-codebase-architecture：勘察 deepening opportunities"]
    MAINT["代码库健康维护"] --> ARCH
    ARCH --> SELECT["挑中候选，产生想法"]
    SELECT --> IDEA["想法"]
    FOG["一个 session 握不住的巨大模糊工程"] --> WAY["wayfinder：decision tickets map"]
    WAY -->|路线清晰后交接| SPECIN["规格入口"]
    WORK["需要设计所选模块的形状"] --> DESIGN["codebase-design：设计工作台与 deep module 词汇层"]
    DESIGN --> RESULT["设计结论供澄清、架构勘察与 tdd 使用"]
```

架构勘察 → 挑中候选 → **产生想法** → 图① `grill-with-docs`；`codebase-design` 不是这条路径的终点，而是设计所选对象的工作台与底层词汇。`triage` 只处理非自己创建的原始 issue。`wayfinder` 产出 decisions 而非 deliverables，通常在 `to-spec` 汇入；只有工程量确实很小时才直接 `implement`。

图中技能：[triage](../skills/engineering/triage/SKILL.md) · [diagnosing-bugs](../skills/engineering/diagnosing-bugs/SKILL.md) · [wayfinder](../skills/engineering/wayfinder/SKILL.md) · [improve-codebase-architecture](../skills/engineering/improve-codebase-architecture/SKILL.md) · [codebase-design](../skills/engineering/codebase-design/SKILL.md)。

## ⑤ Context 与阶段交接

```mermaid
flowchart TD
    THREAD["澄清到 to-tickets：保持同一不间断 context"] --> BOUNDARY["阶段边界"]
    BOUNDARY --> Q1{"后续需要一手来源，或 smart zone 足够？"}
    Q1 -->|是| CONTINUE["Continue：原地继续"]
    Q1 -->|否| Q2{"当前 context 与后续无关？"}
    Q2 -->|是| CLEAR["clear：从零开始"]
    Q2 -->|否| Q3{"需要换 harness、目录、同事或分叉旁支？"}
    Q3 -->|是| HAND["handoff：可移植 Markdown"]
    Q3 -->|否| Q4{"范围足够窄，可无人干预完成？"}
    Q4 -->|是| SUB["sub-agent：独立窗口，带回报告"]
    Q4 -->|否| COMPACT["compact：保留下一阶段所需信息"]
```

在 `to-tickets` 完成前不主动 clear 或 compact；若接近 smart zone 上限，在最近阶段边界 compact，而非硬撑。阶段中途只继续或拆给 sub-agent；`handoff` 也可用于中途分叉旁支。原型的双向交接见图①，逐票 clear 与构建后 retro 见图②图③。

图中技能：[handoff](../skills/productivity/handoff/SKILL.md)。决策顺序详见 [Phase boundaries](../skills/engineering/ask-rolex/PHASE-BOUNDARIES.md)。

## 辅助技能：按场景取用，不构成额外流水线

| 场景 | Skill | 作用或输入去向 |
|---|---|---|
| 没有工作目录 | [grill-me](../skills/productivity/grill-me/SKILL.md) | 无状态访谈；有仓库时优先 grill-with-docs。 |
| 需要直接 interview 原语 | [grilling](../skills/productivity/grilling/SKILL.md) | grill-me、grill-with-docs 等的底层轮次与 frontier。 |
| 领域词语含糊或过载 | [domain-modeling](../skills/engineering/domain-modeling/SKILL.md) | grill-with-docs 驱动的词汇纪律，维护 GLOSSARY 与 ADR。 |
| 缺背景事实 | [research](../skills/engineering/research/SKILL.md) | 背景 agent 调查 primary sources；带引用的文件作为 grill-with-docs 的输入。 |
| 信息在别人脑子里 | [to-questionnaire](../skills/productivity/to-questionnaire/SKILL.md) | 发问卷；回收答案供 grill-with-docs 或 to-spec 使用。 |
| 高影响多方案或关键权衡不明 | [ask-advisor](../skills/personal/ask-advisor/SKILL.md) | 强模型顾问辅助决策；拿到结论后继续原流程。 |
| 想知道最自然的后续请求 | [next-steps](../skills/personal/next-steps/SKILL.md) | 手动调用，预测最多三个请求，展示标题与完整 prompt；回复编号直接执行。不做待办规划，留在当前会话；[handoff](../skills/productivity/handoff/SKILL.md) 用于转移 context。 |
| 拆票或 triage 后，需要无人值守批量交付 | [afk-issue-loop](../skills/personal/afk-issue-loop/SKILL.md) | 用户手动启动独立脚本，处理就绪票；started 不等于交付完成，可结束发起会话。不是 implement-spec 的后置步骤。 |
| 只有人能完成的凭据、设施或 dashboard 操作 | [wizard](../skills/engineering/wizard/SKILL.md) | 生成交互脚本，保留真正需要 human in the loop 的步骤。 |
| 任意 skill 对话中没听懂一条消息 | [wait-what](../skills/productivity/wait-what/SKILL.md) | 用缺失 context 与项目词汇重新讲解。 |
| 跨 session 学习概念 | [teach-me](../skills/productivity/teach-me/SKILL.md) | 以当前目录为有状态学习工作区。 |
| 写 agent 文档或 skill | [writing-for-agents](../skills/productivity/writing-for-agents/SKILL.md) · [writing-great-skills](../skills/productivity/writing-great-skills/SKILL.md) | 文档与 skill 编写参考。 |
| 浏览器或网页任务 | [browser-tools](../skills/personal/browser-tools/SKILL.md) | 浏览器与搜索工具的路由入口。 |
| gh 或 GitHub API 请求 | [github-api-rate-limits](../skills/personal/github-api-rate-limits/SKILL.md) | 管理 REST 与 GraphQL 独立预算，尤其分页、循环、批量调用。 |
| 清理已合并分支 | [clean-branches](../skills/personal/clean-branches/SKILL.md) | Git 运维，不是 retro 的产物。 |
