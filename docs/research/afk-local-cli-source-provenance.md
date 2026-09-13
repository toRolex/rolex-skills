# AFK 源码来源与分发边界

现行规格：[SPEC #8](https://github.com/toRolex/rolex-skills/issues/8)。旧实现的完整差异与失败记录保留在[源码审计](afk-sandcastle-source-audit.md)；本文件描述本轮源码切片与必要适配，不把历史通过当作当前验收。

## 固定来源与许可

- 上游：[mattpocock/sandcastle](https://github.com/mattpocock/sandcastle/tree/e99f832f26dc9d245c019a9ddd19fa5dee792427)。固定 commit：`e99f832f26dc9d245c019a9ddd19fa5dee792427`，包版本 `0.12.0`。
- 本轮重新读取该 commit 的 recursive Git tree，`truncated=false`；本地归档的256个普通文件 Git blob 均与该 tree 一致。符号链接不计入这256个普通文件；此检查不是签名认证。
- MIT，Copyright (c) 2026 Matt Pocock。全文保留在 [LICENSE.sandcastle](../../skills/personal/afk-issue-loop/scripts/LICENSE.sandcastle)，分发提取或改编源码时一并保留。
- 下列行号均指固定上游，而非 main/latest。运行源码目录为 [scripts/](../../skills/personal/afk-issue-loop/scripts/)。本轮验收与偏差见[实现记录](../plans/afk-sandcastle-reuse-implementation-notes.md)。

## 必要依赖闭包

直接复制函数与模板随 skill 提供，运行时只引用本地模块和 Node 内置模块，不 import/require Sandcastle 或其他外部包，不安装、下载或依赖开发期缓存目录。

| 上游范围 | 闭包处理 |
| --- | --- |
| `AgentProvider.ts` | 提取三 CLI parser、错误 helper、命令构造；删除 SessionStore 初始化及 imports，而不是只设置 `captureSessions:false`。不搬 session/UI/其他 provider。 |
| `boundedTail.ts` | 全文件去 TypeScript 类型，算法保留；没有外部依赖。 |
| `PromptResolver.ts` | Effect/FileSystem 接线替换为内置 fs 与 Error cause；保留来源互斥、读取和错误分支。 |
| `PromptArgumentSubstitution.ts` | 保留单次替换、缺参检查和标记清洗；去 Effect/Display，增加可信命令边界与 shell 插参安全。 |
| `PromptPreprocessor.ts` | Effect 执行/超时/日志接线替换为受管 command 与 Promise；保留并发命令、30秒期限、逆序回填。 |
| `Orchestrator.ts`、`no-sandbox.ts` | 提取调用与本机执行所需控制流，替换 Effect Deferred/Fiber/race 和环境接口；不递归搬 Factory、Lifecycle、Display、session 搬运体系，不制作 Effect 替身。真实本机终止确认属于必要新增。 |
| `extractStructuredOutput.ts` | 提取标签和 fence helper；业务 schema 校验集中于 engine，不搬通用 Output/Standard Schema 框架。 |
| 批次模板 `main.mts` | 提取逐票 I→R/finally、allSettled、单 Merger；Planner/Docker/Zod、npm 初始化与轮数上限不进入本机闭包。 |

上游已有 no-sandbox，**去 Docker 不等于必须全面重写**。同样，上游调用链仍传权限 bypass、写全局 Git，且 no-sandbox 的 close 是空操作；这些不能原样迁入本机。

开发期去类型工具、下载归档、fixture 和原始 diff 不是运行依赖。复制安装不需要上游 checkout；相对 import 和三模板路径均从安装位置解析。

## 函数级来源与适配

“直接提取”与“控制流适配”“本机新增”分别标注，不把顺序相同或补一条注释称为函数提取。

| 本地组件 | 固定上游来源 | 保留内容与必要改动 | #8 依据 |
| --- | --- | --- | --- |
| `providers.mjs`：`shellEscape`、`TOOL_ARG_FIELDS`、`extractErrorMessage`、`parseStreamJsonLine` | `AgentProvider.ts:41–121` | 实际源码切片去类型，保留 text/result/tool/session 事件形状；外层排除嵌套角色文本并补终态、权限元数据。 | D2、D4 |
| `parsePiStreamLine` | `AgentProvider.ts:546–611` | 完整函数去类型；外层处理空最终结果、可恢复 message_end、agent_end 与未知 aborted 来源。 | D4 |
| `parseCodexUsage`、`parseCodexStreamLine` | `AgentProvider.ts:681–747` | 完整函数去类型；保留 agent_message、tool、usage 分支；外层区分可恢复 error 与 turn.failed、末尾 item.error。 | D4 |
| 三 CLI `buildPrintCommand` | `AgentProvider.ts:637–654,782–814,1190–1216` | 保留命令正文、flag 插值、stdin prompt；移除 session/resume/fork、bypass 和默认模型；本机调用使用受控 shell/exec 与安全转义。`buildInvocation` 保持原公开配置接口。 | D2、D10 |
| `bounded-tail.mjs`：`BoundedTail`、`MAX_TAIL_CHARS` | `boundedTail.ts:20–69` | 原文件去类型，保留有限尾部算法。 | D2、D4 |
| `structured-output.mjs`：`findLastTagContent`、`unwrapFences` | `extractStructuredOutput.ts:119–161` | 沿用已提取函数，不把本轮没有改动的 helper 冒称新提取；只向其提供当前权威结果。 | D4 |
| `prompts.mjs`：`resolvePrompt` | `PromptResolver.ts:23–61` | 保留 inline/file 互斥、来源与读取错误分支；Node fs 取代 Effect/FileSystem。`loadTemplates` 是三个安装相对路径与空文件校验的薄接线。 | D2、D4 |
| `substitutePromptArgs` | `PromptArgumentSubstitution.ts:87–157` | 标记清洗、缺参收集、单次 replace；可信命令边界在插参前固定，参数按 shell 单引号转义，标量与 own-property 校验。 | D4 |
| `preprocessPrompt` | `PromptPreprocessor.ts:23–102` | 收集标记、并行展开、trimEnd、逆序按索引回填、末尾清洗；Promise.allSettled 等所有预处理结束，30秒由实际受管 command 终止而非仅取消 Promise。 | D2、D4 |
| `processes.mjs`：`invokeAgent` | `Orchestrator.ts:89–120,140–189,209–243` | 控制流适配：raw→parser→完成信号扫描→重置当前 timer；独立 resultText 与增量，正常退出不等 grace。Effect 接线换原生 Promise/timer；最终结果按存在性处理，不用旧历史封套兜底。 | D2、D4、D8 |
| `execute` | `sandboxes/no-sandbox.ts:57–135` | 本机 exec 接线适配：spawn、stdin、readline、BoundedTail、非流式 stdout、stderr、close；补独立进程组、退出信号分类和有界管道确认，不照搬 `code ?? 0`。 | D2、D8、D9 |
| `terminate`、`stop`、`halt`、进程组辅助逻辑 | 本机新增 | TERM/KILL 与实际结束确认；未确认写者隔离；日志基础设施失败与用户 stop 分离。这不是上游已有取消保证。 | D8、D9 |
| `engine.mjs` 的逐票与批末执行 | `templates/parallel-planner-with-review/main.mts:114–182,208–221` | 保留 I→R、finally close、allSettled、单 Merger；串行准备后全就绪并发，无补位；固定 scope/native blocked-by 替换 Planner。 | D2、D5、D6 |
| engine scope、父 SPEC、Worktrunk、close-only | AFK 必要新增/保留 | 确定性分支与明确复用、按票故障隔离、最小内存续作、交付事实检查；移除目标快照相等、HEAD 钉死和 summary 标题计数证明。 | D4–D7 |
| `afk.mjs` | AFK 独立入口新增，不称上游提取 | detached daemon、start/status/stop、120秒启动握手、路径引用、事件与终态；异常日志仍优先停止受管执行。 | D9 |

## 三份角色模板

源目录：[`src/templates/parallel-planner-with-review/`](https://github.com/mattpocock/sandcastle/tree/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/templates/parallel-planner-with-review)。现行三份 Markdown 是逐段中文翻译与必要微调，common 层及加载已移除。

- **Implementer**，原 `implement-prompt.md:1–62`：保留 TASK/CONTEXT/EXPLORATION/EXECUTION/FEEDBACK LOOPS/COMMIT/THE ISSUE/FINAL RULES 顺序、RGR、测试关注、未完成评论与不关票。最近十条提交仍在原动态位置；PRD 改父 SPEC，固定 npm 与 RALPH 前缀适配项目验证、提交规范。
- **Reviewer**，原 `review-prompt.md:1–55`：完整 diff/log 位置、六步检查与 unsafe casts、any、嵌套三元、避免过度精简等细项保留。改为保留预期功能并修复验收错误，不退回 Implementer 往返。
- **Merger**，原 `merge-prompt.md:1–26`：分支列表、顺序 merge、当前失败先修、单 summary 后逐票关闭顺序保留。加入 AFK 已确认的部分合并续作与 close-only；单票关闭失败不阻止其他可关闭票。

三角色保留 `<promise>COMPLETE</promise>`。模板仅加入适用的本机绑定、权限与前序输入边界；平铺 AFK 结果字段仍由 engine 短协议附加，身份与业务校验集中一处，没有新增 SHA/tree 证明或多层封套。

可信命令在启动角色前预展开。Ticket、评论、SPEC 及参数内的新命令块、伪来源标记、占位符保持数据身份；来源标记不代替 shell 转义。Git diff/log 完整输入，不做诊断尾部式截断。

## CLI 配置与监管范围

本轮再次通过 Context7 resolve→query 查询 [Claude 官方 CLI/权限文档](https://code.claude.com/docs/en/cli-reference)、[Codex 官方源码文档](https://github.com/openai/codex)、[Pi JSON 文档](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/json.md)，并核对本机版本：Claude Code `2.1.228`、Codex `0.151.0`、Pi `0.85.1`。

- 明确 model/effort 原样配置；省略时沿用所选 CLI 本机配置，不根据宿主猜测，不静默换模型。不添加新的权限 bypass，不删除保护环境变量。
- 普通前置命令默认30秒，启动握手120秒；二者不是角色总时长。
- 角色完成信号前为600秒 stdout idle，之后为60秒 completion grace；所有真实 stdout 行重置本角色当前计时，stderr、其他角色和监控消息不续期。grace 主动收尾只有实际结束确认、有效结果与交付门禁满足才可接受。
- 最终结果、完成信号、退出0与业务交付不是同一个状态。明确终态失败、未知取消和权限拒绝不得冒成功，也不能仅因测试文本包含 EPERM 而判拒绝。
- grace 收尾仅将已发送信号匹配、退出0或与已发送 TERM/KILL 对应的标准包装器退出码143/137作为候选；任意非零（如42）不获豁免。143/137是窄兼容惯例，不是所有并发信号因果的证明。
- 监管确认原 POSIX 进程组与继承管道。脱组且保留管道的未结束可有界检测并隔离；**不保证发现所有瞬时脱组并关闭继承管道的后代**，不把 killpg 称为完整进程树安全证明。
- 沿用原 Git 身份；不写全局身份或 safe.directory、不自动 fetch/pull/push/PR、不批准 Worktrunk hooks、不清理无关现场。

真实 CLI、默认时钟长测与受控缩时 fixture 分开记于[本轮实现记录](../plans/afk-sandcastle-reuse-implementation-notes.md)。参数核查、源码提取和静态检查本身均不等于完整运行验收通过。
