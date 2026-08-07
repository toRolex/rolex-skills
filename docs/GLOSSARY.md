# 翻译术语表（Translation Glossary）

本仓库是 [mattpocock/skills](https://github.com/mattpocock/skills) 的中文改编版。所有从上游翻译来的 SKILL.md，其**专业术语一律保留英文原文，不翻译成中文**。

## 为什么要有这张表

同一个英文术语如果在一个 skill 里保留英文、在另一个 skill 里被译成中文，或在不同 skill 里译成不同的中文词，会造成**语义漂移**——模型在不同 skill 之间学习到的概念对不上。这张表是唯一的裁决标准：术语的英文拼写是规范，所有 skill 都必须使用同一个英文词。

> 注意：`skills/productivity/writing-great-skills/GLOSSARY.md` 是上游英文原版的领域模型词汇表（Predictability、Invocation 等），描述"好 skill 长什么样"。本表是**中文翻译层面**的术语规范，两者用途不同、互不替代。

## 翻译总原则

1. **术语保留英文原文**，后文需要解释时用括号附一次简短中文注释，之后不再重复。
2. **同一英文词，全局只用这一个词**，不因文档而异。
3. **章节标题里的术语同样保留英文**——标题里的"假设/复现/回归测试"与正文里的 `hypothesis`/`reproduce`/`regression test` 会造成文档内不一致。
4. 普通叙述词（如 "the aim is…"、"usually"）正常翻译，不受此表约束。

## 术语清单

每个术语：**英文原名（规范）** — 定义 — 状态。状态含义：

- ✅ 已合规：本地所有 skill 均保留英文原文。
- 低风险：本地仍以中文叙述词呈现，可改可不改，不影响语义统一。

### 流程与工作流

| 英文术语（规范） | 定义 | 状态 |
|---|---|---|
| flow | 贯穿多个 skill 的路径 | ✅ 保留 |
| main flow | 主流程——大部分工作走的路线 | ✅ 保留 |
| on-ramp | 匝道——产生工作并汇入主流程的起始场景 | ✅ 保留 |
| standalone | 独立于主流程之外的 skill | ✅ 保留 |
| phase / phase boundary | 会话内的一块工作 / 两块工作之间的分界 | ✅ 保留 |
| grilling | 访谈追问原语本身 | ✅ `/grilling` 斜杠命令均保留 |
| interview | 打磨想法所用的访谈 | ✅ 保留 |
| session | 一次 agent 会话 | ✅ 保留 |
| context window | 上下文窗口 | ✅ 保留 |
| smart zone | 模型仍能敏锐推理的窗口 | ✅ 保留 |

### 文档制品与领域模型

| 英文术语（规范） | 定义 | 状态 |
|---|---|---|
| spec | 规格说明书（模板见 spec-template） | ✅ 保留 |
| spec template | spec 的章节模板 | ✅ 模板标题保留英文，见下 |
| user story | 用户故事——"作为 <角色>，我想 <功能>，以便 <收益>" | ✅ 保留 |
| ADR | Architecture Decision Record，架构决策记录 | ✅ 保留 |
| CONTEXT.md / CONTEXT-MAP.md | 领域术语库 / 多上下文地图 | ✅ 保留 |
| glossary | 术语表 | ✅ 保留 |
| domain glossary | 项目领域术语库 | ✅ 保留 |
| domain model | 领域模型 | ✅ 保留 |
| ubiquitous language | 统一语言（领域建模术语） | ✅ 保留 |
| domain term | 领域术语 | ✅ 保留 |
| decision | 决策（wayfinder 产出物） | ✅ 保留 |
| deliverables | 交付物 | ✅ 保留 |

**spec 模板章节标题**（to-spec）：上游模板为英文标题 `Problem Statement` / `Solution` / `User Stories` / `Implementation Decisions` / `Testing Decisions` / `Out of Scope` / `Further Notes`。该模板是 to-spec 的**可交付输出**，后续 skill（code-review 按 spec 对照、to-tickets 引用）依赖其结构，**保留英文标题**。其中 `user story` 是硬术语，必须保留英文。

### 架构设计词汇（codebase-design）

| 英文术语（规范） | 定义 | 状态 |
|---|---|---|
| module | 有 interface 和 implementation 的东西 | ✅ 保留 |
| interface | 调用者必须知道才能正确使用模块的一切 | ✅ 保留 |
| implementation | 模块内部的东西 | ✅ 保留 |
| adapter | 在 seam 处满足 interface 的具体东西 | ✅ 保留 |
| depth | 每单位 interface 能执行的行为量 | ✅ 保留 |
| deep module / shallow module | 深模块 / 浅模块 | ✅ 保留 |
| seam | 可改变行为而不编辑该位置的地方 | ✅ 保留 |
| internal seam / external seam | 内部 seam / 外部 seam | ✅ 保留（seam 保留） |
| leverage | 调用者从深度获得的能力 | ✅ 保留 |
| locality | 维护者从深度获得的集中性 | ✅ 保留 |
| deletion test | 删除测试——想象删除模块后复杂性是否集中 | ✅ 保留 |
| design-it-twice | 并行设计多种接口并比较 | ✅ 保留 |
| boundary | 被明确拒绝的替代词（DDD 有界上下文） | ✅ 保留英文原词 |

### 任务与追踪（to-tickets / triage / wayfinder）

| 英文术语（规范） | 定义 | 状态 |
|---|---|---|
| ticket | 一张可独立完成的工作切片 | ✅ 保留 |
| issue | 问题单 | ✅ 保留 |
| issue tracker | 问题跟踪系统 | ✅ 保留 |
| blocking edges | 阻塞边——必须先完成的其他 ticket | ✅ 保留 |
| blocker | 阻塞者 | ✅ 保留 |
| frontier | 前沿——所有阻塞者都已完成的可接取 ticket | ✅ 保留 |
| tracer bullet | 曳光弹——垂直切片式的少量端到端实现 | ✅ 保留 |
| vertical slice | 垂直切片（跨所有层） | ✅ 保留 |
| wide refactor | 宽重构——波及全代码库的单一机械变更 | ✅ 保留 |
| blast radius | 爆炸半径——一次变更影响的调用点范围 | ✅ 保留 |
| expand–contract | 先展开后收缩的重构序列 | ✅ 保留 |
| prefactor | 预重构——先让变更变容易 | ✅ 保留 |
| ready-for-agent / ready-for-human | 可交给 AFK agent / 需人工实现 | ✅ 保留 |
| needs-triage / needs-info / wontfix | triage 状态角色 | ✅ 保留 |
| triage role | 分类/状态角色 | ✅ 保留（role 保留） |
| bug / enhancement | 缺陷 / 增强（triage 分类角色） | ✅ 保留 |
| agent brief | 交给 agent 的实现简报 | ✅ 保留 |
| acceptance criteria | 验收标准 | ✅ 保留 |
| scope / out of scope / scope creep | 范围 / 范围外 / 范围蔓延 | ✅ 保留 |
| destination | 目标（wayfinder 目的地） | ✅ 保留 |
| fog of war | 战争迷雾——尚不可见但可预见的决策区 | ✅ 保留 |
| graduate | 迷雾毕业——变得可 spec 化的部分转为新 ticket | ✅ 保留 |
| claim / assignee | 认领 ticket / 被分配者 | ✅ 保留 |
| map | wayfinder 的共享决策地图 | ✅ 保留 |
| Decisions so far / Not yet specified / Out of scope | map 的节标题 | ✅ 保留 |
| HITL / AFK | human-in-the-loop / away-from-keyboard | ✅ 保留 |
| research / prototype / grilling / task | wayfinder 的四种 ticket 类型 | ✅ 保留 |

### 调试与测试（diagnosing-bugs / tdd）

| 英文术语（规范） | 定义 | 状态 |
|---|---|---|
| feedback loop | 反馈循环——能在此 bug 上变红的命令 | ✅ 保留（含章节标题） |
| repro / reproduce / minimise | 复现 / 最小化 | ✅ 保留 |
| hypothesis | 假设 | ✅ 保留 |
| bisection / bisect | 二分定位 | ✅ 保留 |
| instrumentation | 仪表化（调试探针） | ✅ 保留 |
| regression test | 回归测试 | ✅ 保留 |
| post-mortem | 事后分析 | ✅ 保留 |
| seam（测试语境） | 测试所在的公共边界 | ✅ 保留 |
| fixture / snapshot | 夹具 / 快照 | ✅ 保留 |
| harness | 测试台架 | ✅ 保留 |
| HITL（脚本语境） | 人在环中 | ✅ 保留 |
| e2e / unit / integration | 端到端 / 单元 / 集成（测试层级） | ✅ 保留 |
| deterministic / non-deterministic | 确定性的 / 非确定性的 | ✅ 保留 |
| flaky | 偶发性（flaky 测试） | ✅ 保留 |
| red / green | 红 / 绿（TDD 失败/通过状态） | ✅ 保留 `red → green` |
| anti-pattern | 反模式 | ✅ 保留 |
| Implementation-coupled / Tautological / Horizontal slicing | tdd 的三种反模式 | ✅ 保留（附中文注释） |
| vertical slice / tracer bullet（tdd 语境） | 见上 | ✅ 保留 |
| mocking | 打桩 | ✅ 保留 |
| typecheck / test suite | 类型检查 / 测试套件 | ✅ 保留 |
| mental model | 心智模型 | ✅ 保留 |

### 代码审查（code-review）

| 英文术语（规范） | 定义 | 状态 |
|---|---|---|
| Standards / Spec（双轴） | 规范轴 / 规格轴 | ✅ 保留 |
| fixed point | 固定点（commit/branch/tag） | ✅ 保留 |
| diff / merge-base / ref | git 差异 / 合并基 / 引用 | ✅ 保留 |
| sub-agent | 子代理 | ✅ 保留 |
| code smell baseline | 代码坏味道基线（Fowler） | ✅ 保留 |
| Mysterious Name / Duplicated Code / Feature Envy / Data Clumps / Primitive Obsession / Repeated Switches / Shotgun Surgery / Divergent Change / Speculative Generality / Message Chains / Middle Man / Refused Bequest | 十二种 Fowler code smells | ✅ 保留英文原名（附中文注释） |
| judgement call | 判断性结论（非硬性违规） | ✅ 保留 |
| violation | 违规 | ✅ 保留 |

### 研究、原型与协作

| 英文术语（规范） | 定义 | 状态 |
|---|---|---|
| primary source | 一手来源/一手资料 | ✅ 保留 |
| background agent | 后台代理 | ✅ 保留 |
| prototype | 原型 | ✅ 保留 |
| throwaway | 一次性的（临时代码） | ✅ 保留 |
| UI variant | UI 变体 | ✅ 保留（variant 保留） |
| state / state machine / reducer | 状态 / 状态机 / 归约器 | ✅ 保留 |
| persistence | 持久化 | ✅ 保留 |
| artifact | 工件 | 低风险——wayfinder 译「工件」，普通叙述词，可改可不改 |
| fidelity | 保真度 | 低风险——wayfinder 译「保真度」，普通叙述词，可改可不改 |

### 会话与上下文

| 英文术语（规范） | 定义 | 状态 |
|---|---|---|
| context pointer | 指向上下文外材料的引用 | ✅ 保留 |
| compact / clear | 压缩上下文 / 清空上下文 | ✅ 保留（`/compact`、`/clear`） |
| handoff | 上下文交接 | ✅ 保留（`/handoff`） |
| context hygiene | 上下文卫生 | ✅ 保留 |

### Git 与工程运维（resolving-merge-conflicts / personal）

| 英文术语（规范） | 定义 | 状态 |
|---|---|---|
| merge / rebase / hunk / commit / branch | git 基础操作 | ✅ 保留 |
| --abort | 放弃操作（resolving-merge-conflicts 永不运行） | ✅ 保留 |
| worktree | 工作树 | ✅ 保留（personal 保留 `wt`/worktree） |
| push / pull / stash / tag | git 远程操作 | ✅ 保留 |
| primary source（冲突语境） | 一手来源 | ✅ 保留 |
| --no-ff / --squash / --ff-only | 合并策略 | ✅ 保留 |

### Wizard 与基础设施（wizard）

| 英文术语（规范） | 定义 | 状态 |
|---|---|---|
| wizard | 交互式 bash 向导 | ✅ 保留 |
| stage | 向导的一个步骤 | ✅ 保留 |
| secret / confirm | 机密 / 确认门 | ✅ 保留 |
| .env / CI secrets | 环境文件 / CI 机密 | ✅ 保留 |
| idempotent | 幂等的 | ✅ 保留 |
| dashboard | 第三方控制台 | ✅ 保留 |

### 写作给 agent（writing-for-agents / writing-great-skills / SKILL-MECHANICS）

以下术语是「写文档给 agent」领域模型的定义性术语，英文定义见 `writing-great-skills/GLOSSARY.md`。**写作家族内必须统一保留英文。**

| 英文术语（规范） | 定义 | 状态 |
|---|---|---|
| context load | 常驻材料对 agent 上下文窗口的成本 | ✅ 统一保留 |
| cognitive load | 常驻材料对人的记忆成本（人是索引） | ✅ 统一保留 |
| leading word | 预训练中已存在、供 agent 思考用的紧凑概念词 | ✅ 统一保留 |
| completion criterion | 完成标准——告诉 agent 工作完成的条件 | ✅ 统一保留 |
| premature completion | 过早完成（失败模式） | ✅ 统一保留 |
| post-completion steps | 当前 step 之后可见的 steps | ✅ 统一保留 |
| legwork | agent 在单步内部做的幕后工作 | ✅ 统一保留 |
| information hierarchy | 内容按需要紧急性排序的阶梯 | ✅ 统一保留 |
| progressive disclosure | 渐进披露——把参考推到指针后面 | ✅ 统一保留 |
| co-location | 相关概念同处一个标题下 | ✅ 统一保留 |
| sprawl | 文档过长（失败模式） | ✅ 统一保留 |
| duplication | 同一含义出现在多处 | ✅ 统一保留 |
| single source of truth | 单一真相来源 | ✅ 统一保留 |
| relevance | 一行是否仍与文档相关 | ✅ 统一保留 |
| sediment | 沉积（失败模式） | ✅ 统一保留 |
| no-op | 不改变默认行为的指令 | ✅ 统一保留 |
| negation | 否定式引导（失败模式） | ✅ 统一保留 |
| branch | 文档处理的不同情况 | ✅ 统一保留 |
| steps / reference | 步骤 / 参考（两种内容类型） | ✅ 统一保留 |
| external reference | 文档系统之外的参考 | ✅ 统一保留 |
| environment / cache | 环境 / 缓存（真相来源） | ✅ 统一保留 |
| granularity | 拆分粒度 | ✅ 保留（writing-great-skills） |
| predictability | 可预测性（根本美德） | ✅ 保留 |
| router skill | 路由器 skill | ✅ 保留 |
| model-invoked / user-invoked | 模型可调用 / 用户可调用 | ✅ 保留 |

### 追问访谈（grilling）

| 英文术语（规范） | 定义 | 状态 |
|---|---|---|
| design tree | 设计树——每个 decision 分支到依赖它的 decisions | ✅ 保留 |
| rounds | 轮次——按轮推进 design tree | ✅ 保留 |
| shared understanding | 共同理解——访谈的终止条件 | ✅ 保留 |
| recommended answer | 推荐答案（问题模板字段） | ✅ 保留 |
| frontier | 前提已定、现在可问的 decisions | ✅ 已收录 |

### 教学（teach）

| 英文术语（规范） | 定义 | 状态 |
|---|---|---|
| lesson | 课时——单页自包含 HTML 教学单元 | ✅ 保留 |
| mission | 用户想学的主题与原因（MISSION.md） | ✅ 保留 |
| learning record | 学习记录（近似 ADR） | ✅ 保留 |
| zone of proximal development | 最近发展区 | ✅ 保留 |
| reference document | 参考文档 | ✅ 保留 |
| fluency strength / storage strength | 流利度强度 / 存储强度 | ✅ 保留 |
| desirable difficulty | 合意困难 | ✅ 保留 |
| retrieval practice / spacing / interleaving | 检索练习 / 间隔 / 交错 | ✅ 保留 |
| component | 组件（assets 下的可复用单元） | ✅ 保留 |
| community | 社区 | ✅ 保留 |
| knowledge / skill / wisdom | 知识 / 技能 / 智慧 | ✅ 保留 |

### 问卷（to-questionnaire）

| 英文术语（规范） | 定义 | 状态 |
|---|---|---|
| questionnaire | 问卷 | 低风险——译「问题单」，首次出现附英文 `questionnaire` |
| gap | 接收者所知与用户所需之间的缺口 | 低风险——译「缺口」 |

## 变更记录

### 2026-08 上游 productivity 补查

对上游 `productivity/` 桶做了跨文件术语补查（此前只审计了 `engineering/`）。发现：

- **写作家族术语未统一**：`writing-for-agents` 把整批定义性术语译成中文（context load→上下文负载、leading word→引导词、completion criterion→完成标准、legwork→苦功 等），而同一批术语在 `writing-great-skills/SKILL.md` 和 `SKILL-MECHANICS.md` 保留英文，且在英文 `GLOSSARY.md` 中有定义——需重译 `writing-for-agents` 对齐（已修复，见下方「2026-08 写作家族术语对齐」）。
- **wait-what 误译**：上游 `ASD-STE100 Simplified Technical English` 被译成「《中文技术文档写作风格指南》」，应为「ASD-STE100 Simplified Technical English（简化技术英语）」；`ubiquitous language` 被译成「通用语言」，应改回英文。
- **grilling / teach 术语保留良好**：design tree、rounds、lesson、mission、zone of proximal development、fluency/storage strength 等均已保留英文，无需修改。
- **to-questionnaire** 的 `questionnaire`/`gap` 译中文（低风险，可改可不改）。

### 2026-08 写作家族术语对齐

- `writing-for-agents/SKILL.md` 已重译对齐：context load、cognitive load、leading word、completion criterion、premature completion、post-completion steps、legwork、information hierarchy、progressive disclosure、co-location、sprawl、duplication、single source of truth、relevance、sediment、no-op、negation、branch、steps/reference、external reference、environment/cache 等整批定义性术语全部改回英文，与 `writing-great-skills/SKILL.md` 和 `SKILL-MECHANICS.md` 一致，中文译词清零。
- `writing-great-skills/SKILL.md` 的 `post-completion steps` 由「后续 step」改回英文（When to split 与 Failure modes 两处）。
- 上方「写作给 agent」术语表状态全部更新为 ✅。

### 2026-08 全量重译

`skills/engineering/` 下 11 个 skill（ask-rolex、code-review、tdd、diagnosing-bugs、to-spec、to-tickets、codebase-design、domain-modeling、prototype、improve-codebase-architecture、wayfinder）已从上游英文原版**全量重译**，未基于旧中文版修补。此前审计发现的以下问题全部修复：

- **A 档（跨文档不一致）**：`deletion test`、`primary source`、`glossary`、`state machine`、`user story`、`feedback loop`、`regression test`、`post-mortem` 在不同文件中被译成不同中文的问题——全部统一回英文。
- **B 档（标题/正文不一致）**：`diagnosing-bugs` 章节标题术语改回英文（如 "阶段 1 — 构建 feedback loop"、"Reproduce + minimise（复现 + 最小化）"、"Cleanup + post-mortem（清理 + 事后分析）"），正文中文只作括号注释。
- **C 档（整体译成中文）**：`code-review` 12 个 Fowler code smells、`tdd` 三种反模式、`ask-rolex` 的 `on-ramp`/`main flow`、`domain-modeling` 的 `ubiquitous language`、`to-tickets` 的 `wide refactor`/`acceptance criteria`、`to-spec` 的 spec 模板标题——全部改回英文。
- **本地化**：所有 `/setup-matt-pocock-skills` → `/setup-rolex-skills`；`ask-matt` → `ask-rolex`；`Matt` 零残留。
- **本地定制保留**：`ask-rolex` 的 Rolex 专属补充段、`to-tickets` 的 GitHub tracker 接线引用（`references/github-tracker.md`）、`wayfinder` 的 6 处 tracker 接线定制段，均保留。
- **额外修正**：`triage` description 的「状态机」→ `state machine`；`grill-with-docs` description 的「词汇表」→ `glossary`；`codebase-design` description 的「共享词汇表/deep-module 词汇表」→ `shared vocabulary`/`deep-module vocabulary`。

**剩余低风险项**（普通叙述词，不影响语义统一，可改可不改）：`artifact`（wayfinder 译「工件」）、`fidelity`（wayfinder 译「保真度」）。

## 维护规则

- 新增翻译或修订 skill 时，先查本表：术语一律用英文原名。
- 发现本表未收录、但属于「上游 glossary / 定义性术语」的词，补充进本表。
- 上游更新后 cherry-pick 时，对照本表检查新引入的术语。
- 全量重译后，如某术语在本地仍以中文呈现，先在术语表标注再决定是否改回。
