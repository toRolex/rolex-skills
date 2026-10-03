# Rolex Skills

我在用的 AI agent skill 合集，已推广 41 个：一部分改编自 [mattpocock/skills](https://github.com/mattpocock/skills)，一部分受 [Thariq 的 quadrant walk 方法](https://x.com/trq212/status/2073100352921215386) 启发。

## 快速开始

```bash
npx skills@latest add toRolex/rolex-skills
```

记得勾选 `/setup-rolex-skills`，安装后在项目里运行。

其他安装方式（Plugin / Git 克隆 / 技能守卫 hooks）见 [docs/usage-guide.md](docs/usage-guide.md)。

## Skills

各 bucket 完整列表见其 README：[engineering](skills/engineering/README.md) · [productivity](skills/productivity/README.md) · [personal](skills/personal/README.md) · [Thariq](skills/Thariq/README.md)（[misc](skills/misc/README.md) 保留但不推广）。使用顺序与流向见 [Skill 使用地图](docs/skill-map.md)。

有些技能会调用其他技能。请同时安装以下技能：

| Skill | 同时安装 |
|---|---|
| `grill-me` | `grilling` |
| `grill-with-docs` | `grilling` |
| `triage` | `grilling` |
| `improve-codebase-architecture` | `grilling` |
| `wayfinder` | `grilling`, `prototype` |
| `implement` | `tdd` |
| `implement-spec` | `to-spec`, `to-tickets` |
| `retro` | （建议在 `/implement` 或 `/implement-spec` 之后运行） |
| `setup-rolex-skills` | `to-spec`, `to-tickets` |
| `unknowns` | `blind-spot-pass`, `brainstorm`, `grilling`, `domain-modeling`, `prototype` |
| `brainstorm` | `prototype`（独立使用时另建议 `grilling`，可选） |
| `pre-implement` | （可选：读取 `grilling` 的结论） |

不确定用哪个？`ask-rolex` 是路由器，会按当前情境路由到具体 skill。

## User-invoked

- **[ask-rolex](skills/engineering/ask-rolex/SKILL.md)**：询问哪个 skill 或流程适合当前场景，是整个仓库的路由器。
- **[grill-with-docs](skills/engineering/grill-with-docs/SKILL.md)**：深入访谈，同时构建项目领域模型，更新 `GLOSSARY.md` 和 ADR。
- **[setup-rolex-skills](skills/engineering/setup-rolex-skills/SKILL.md)**：配置本仓库的工程 skill（issue tracker、triage 标签、领域文档布局）。每个仓库首次使用前运行一次。
- **[to-spec](skills/engineering/to-spec/SKILL.md)**：将当前对话转化为 spec 并发布到 issue tracker。
- **[to-tickets](skills/engineering/to-tickets/SKILL.md)**：将计划或 spec 拆分为 tracer-bullet tickets，标注阻塞关系。
- **[implement](skills/engineering/implement/SKILL.md)**：按 spec/tickets 构建，内部驱动 `/tdd`，完成后运行 `/code-review`。
- **[implement-spec](skills/engineering/implement-spec/SKILL.md)**：把 `/to-spec` 和 `/to-tickets` 的产出实现为代码：integration branch 上以任务图并行推进 implementer subagent。
- **[triage](skills/engineering/triage/SKILL.md)**：将 issue 按 triage 角色状态机处理。
- **[wayfinder](skills/engineering/wayfinder/SKILL.md)**：为超大工作量绘制共享的调研 ticket 地图。
- **[improve-codebase-architecture](skills/engineering/improve-codebase-architecture/SKILL.md)**：扫描代码库寻找 deepening 机会，生成 HTML 报告。
- **[retro](skills/engineering/retro/SKILL.md)**：对 coding session 做复盘，从 navigation、automated checks、coding standards 等类别提出环境改进建议。
- **[grill-me](skills/productivity/grill-me/SKILL.md)**：对计划或设计进行 relentless 访谈，直到决策树的每个分支都解决。
- **[handoff](skills/productivity/handoff/SKILL.md)**：将当前对话压缩为 handoff 文档，供另一个 agent 继续工作。
- **[teach-me](skills/productivity/teach-me/SKILL.md)**：多会话教学，用当前目录作为有状态的教学工作区。
- **[writing-great-skills](skills/productivity/writing-great-skills/SKILL.md)**：编写和编辑 skill 的参考指南。
- **[to-questionnaire](skills/productivity/to-questionnaire/SKILL.md)**：把一个用户无法独自回答的决策变成问卷，交给别人填写。
- **[wait-what](skills/productivity/wait-what/SKILL.md)**：上一条消息没讲清楚时的纠正：重新讲一遍。
- **[afk-issue-loop](skills/personal/afk-issue-loop/SKILL.md)** — 启动独立本地脚本，分批实现、审查、合并并关闭 GitHub Tickets。
- **[ask-advisor](skills/personal/ask-advisor/SKILL.md)** — 显式把当前决策点交给强模型顾问（strong-model-consultant），获取决策建议。
- **[vertical-slice-review](skills/personal/vertical-slice-review/SKILL.md)** — 审查 ticket 拆解方案是否符合 vertical slice 方法论，必要时重拆并请强模型复核。
- **[next-steps](skills/personal/next-steps/SKILL.md)** — 显式调用时按当前会话上下文，给出最多三个可直接提交的后续 prompt。
- **[unknowns](skills/Thariq/unknowns/SKILL.md)** — 按四个象限走一遍任务，把 unknowns map 交到用户手里。
- **[to-plan](skills/Thariq/to-plan/SKILL.md)** — 写一份供审阅的实现计划：最可能变的决策置顶，机械性工作沉底。
- **[to-pitch](skills/Thariq/to-pitch/SKILL.md)** — 打包 prototype、spec、notes 成争取 buy-in 的文档：explainer 加速理解，pitch 加速批准；用户提到 remote / 手机 / Tailscale 时，经 Tailscale 让手机直接访问。
- **[quiz-me](skills/Thariq/quiz-me/SKILL.md)** — 就一次变更出报告和测验，满分通过才 merge。

## Model-invoked

- **[prototype](skills/engineering/prototype/SKILL.md)**：构建一次性原型来回答设计问题。
- **[diagnosing-bugs](skills/engineering/diagnosing-bugs/SKILL.md)**：困难 bug 的诊断循环：复现→最小化→假设→插桩→修复→回归测试。
- **[research](skills/engineering/research/SKILL.md)**：针对高可信度一手资料调查问题，产出带引用的 Markdown 文件。
- **[tdd](skills/engineering/tdd/SKILL.md)**：红-绿-重构循环的测试驱动开发。
- **[domain-modeling](skills/engineering/domain-modeling/SKILL.md)**：主动构建和打磨项目领域模型。
- **[codebase-design](skills/engineering/codebase-design/SKILL.md)**：深度模块设计的共享词汇和原则。
- **[code-review](skills/engineering/code-review/SKILL.md)**：双轴 review：Standards（代码规范）+ Spec（需求匹配）。
- **[pr](skills/engineering/pr/SKILL.md)**：用 diagram/diff-sketch/template 撰写 PR body，包含 Summary、Evidence、Merge Danger 三段。
- **[wizard](skills/engineering/wizard/SKILL.md)**：生成交互式 bash wizard，引导人类完成只有他们能执行的步骤（开通基础设施、设置凭据/CI secrets、一次性迁移）。
- **[grilling](skills/productivity/grilling/SKILL.md)**：深入访谈的通用循环，`grill-me` 和 `grill-with-docs` 的底层引擎。
- **[writing-for-agents](skills/productivity/writing-for-agents/SKILL.md)**：面向 agent 的文档写作参考：skill、AGENTS.md/CLAUDE.md、被指针指向的文档。
- **[clean-branches](skills/personal/clean-branches/SKILL.md)** — 清理已合并 Git 分支（本地 + 远程 + 残留 worktree）。
- **[github-api-rate-limits](skills/personal/github-api-rate-limits/SKILL.md)** — 在 gh CLI / GitHub API 的分页、循环、批量请求中遵守 REST 与 GraphQL 两条独立的 rate limit 预算。
- **[browser-tools](skills/personal/browser-tools/SKILL.md)** — 浏览器与网页任务的路由器：按任务把工作交给 ego-browser / OpenCLI / firecrawl / anysearch / CloakBrowser 之一。
- **[blind-spot-pass](skills/Thariq/blind-spot-pass/SKILL.md)** — 盲点扫描：进入陌生区域前，找出并解释你的 unknown unknowns。
- **[pre-implement](skills/Thariq/pre-implement/SKILL.md)** — 动手实现前先调用：维护 implementation notes，偏离 plan/spec 时记入 Deviations 继续。
- **[brainstorm](skills/Thariq/brainstorm/SKILL.md)** — 在充满 unknown knowns 的领域发散：列举介入点或产出多个设计方向供用户反应。

另有 4 个保留但不推广的 skill，见 [skills/misc/](skills/misc/)。仓库里的 `SKILL.md` 共 45 个。
## 协议

MIT，见 [LICENSE](LICENSE)。

## 致谢

- [mattpocock/skills](https://github.com/mattpocock/skills)：部分 skill 的上游。
- [Thariq 的 quadrant walk 文章](https://x.com/trq212/status/2073100352921215386)：`Thariq/` bucket 的灵感来源。
- [dzhng/explore-unknowns](https://github.com/dzhng/skills)：`Thariq/unknowns` 四象限地图的来源。
