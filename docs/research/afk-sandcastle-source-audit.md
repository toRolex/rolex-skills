# AFK 对照 Sandcastle 的完整源码审计

日期：2026-09-12。对象：当前未提交工作树中的 `skills/personal/afk-issue-loop`，不是旧提交或旧测试快照。仅审计；没有修改运行代码、prompt、现行规则，没有提交、push 或操作业务 Issues。本文件是本轮唯一新增仓库交付物。

## 1. 结论

**当前 AFK 是“少量函数提取 + 部分 Provider/角色内容改编 + 大量新写的调度与进程监管”，不是“仅去掉 Docker 的 Sandcastle”。**

- 可确认的函数级提取：`extractErrorMessage`、`findLastTagContent`、`unwrapFences`。
- 可确认的结构改编：三类 CLI 部分文本事件解析、逐票 Implementer→Reviewer、allSettled 屏障、批末单 Merger，以及角色职责清单。
- 新写/重写：本地进程监管、独立 daemon、固定范围和依赖调度、Worktrunk 接线、写锁、业务结果验证、pending/close-only、目标快照，以及 Markdown 加载/JSON 上下文拼接。
- **四份 Markdown 现在确实进入 CLI，但没有恢复上游 `PromptResolver → PromptArgumentSubstitution → PromptPreprocessor` 机制。**
- 大量差异确由 Issue #7 要求，不能当作错误；但零 npm、移除 Effect、放弃启动前 Git 上下文注入等并非 no-Docker 的必然结果。现有来源说明不足以证明当前重写范围已经最小化。
- 已发现源码可证的调度/异常路径缺口和文档失配。下文区分确定的代码行为、条件性风险、未证实的运行后果，不把它们统一叫“已复现 bug”。

### 基准与证据

- 规格：[Issue #7](https://github.com/toRolex/rolex-skills/issues/7)，本轮完整读取正文及评论（无评论）。下文 D1—D8 对应其 Implementation Decisions 八节。
- 固定上游：[e99f832f26dc9d245c019a9ddd19fa5dee792427](https://github.com/mattpocock/sandcastle/tree/e99f832f26dc9d245c019a9ddd19fa5dee792427)。没有换成 main/latest。
- 本轮重新下载完整归档，GitHub recursive tree `truncated=false`；逐文件计算 Git blob ID，**256 个普通文件全部与该 commit 的 API tree 匹配**。符号链接未列入这256个普通文件；此核验不是签名认证。
- 完整上游只读目录：`/tmp/afk-sandcastle-full.Q1sYLq/upstream`。审计本地文件基线：`/tmp/afk-audit-baseline.json`。
- 两份附录中“子审计未独立认证 commit”的说明仅描述子任务边界；上面的来源核验由主审计完成。
- 本轮是静态源码对照，另有 Provider 纯解析探针；**未重跑公开 CLI 全流程、真实 LLM、615秒长测或上游 Vitest**。历史验收不计作本轮实测。

### 分类：两个维度，不能混为一谈

来源：**提取 / 改编 / 重写 / 新增 / 未采用**。

符合性：**要求的适配 / 可选选择 / 需修或需裁决 / 非目标裁剪 / 保留**。

“重写”不自动等于违规；“合理适配”也不等于直接源码提取。全文列的是行为/结构偏离，**不是同等数量的 bugs**。文末保留 Provider 65项细表及逐角色、动态模板细表，避免只展示精选问题而隐藏其余裁剪。

### 引用简写

本地前缀 `L = skills/personal/afk-issue-loop/`：

- E：`L/scripts/engine.mjs`；A：`L/scripts/afk.mjs`；X：`L/scripts/processes.mjs`；P：`L/scripts/providers.mjs`；S：`L/scripts/structured-output.mjs`。
- C/I/R/M：`L/reference/common-prompt.md`、`implementer-prompt.md`、`reviewer-prompt.md`、`merger-prompt.md`。

上游 `U` 均相对上述固定 commit 根目录，可用 GitHub 固定链接查看，不依赖临时目录才能理解：

- T：`src/templates/parallel-planner-with-review/main.mts`；TP/TI/TR/TM：同目录 `plan-prompt.md`、`implement-prompt.md`、`review-prompt.md`、`merge-prompt.md`。
- AP：`src/AgentProvider.ts`；OR：`src/Orchestrator.ts`；NS：`src/sandboxes/no-sandbox.ts`；RUN：`src/run.ts`。
- W：`src/WorktreeManager.ts`；CW：`src/createWorktree.ts`；CS：`src/createSandbox.ts`；SL：`src/SandboxLifecycle.ts`；SI/SO：`src/syncIn.ts`、`src/syncOut.ts`。

## 2. 首先纠正来源判断

### 2.1 上游已有本机执行，不是只有 Docker

`U/NS:38–117` 已实现本机 spawn、stdin、逐行 stdout、stderr 与 close；`U/src/SandboxFactory.ts:342–457` 有正式 no-sandbox 分支；`U/package.json:29–32` 公开导出。该路径支持 AFK 和主机 worktree，非未接线实验。

所以：**不能用“去 Docker”直接推导“必须重新写进程层、Provider、prompt 和调度框架”。**必须适配 Worktrunk、权限、独立生命周期与 AFK 业务；是否完全去 Effect、采用五个零依赖 mjs，是另一项分发选择。

现行 `docs/research/afk-local-cli-source-provenance.md:35–48` 未直接声称“必须完全重写”，但没有完整讨论这条已有本机路径。不能把上述错误措辞伪造为该文件原话，也不能把其依赖分析当成已证明最小改编范围。

### 2.2 也不能反过来原样搬入 no-sandbox

固定版本的**注释/ADR 与调用代码存在冲突**：

- `U/NS:8–11` 和 ADR0015:25 说 no-sandbox 不传权限绕过；但 `U/OR:140–146` 无条件传 `dangerouslySkipPermissions:true`，`U/AP:1199–1203` 在未显式配置 permissionMode 时生成 Claude bypass，Codex `U/AP:790–797` 也默认 bypass。**以实际调用链为准。**
- `U/SL:230–255` 仍执行全局 Git safe.directory/name/email 写入。
- `U/NS:78–135,164–166` 没有真实取消接线，close 为 no-op；Effect race 结束不证明主机子进程已终止。

因此本地删除 bypass、删除全局配置写入、增加真实取消确认是必要适配。发现上游已有 no-sandbox，**不等于建议直接依赖原包或恢复危险默认值**。

### 2.3 具体复用归属

| 本地对象 | 上游证据 | 来源裁决 |
|---|---|---|
| P:61–70 extractErrorMessage | AP:56–65 | 函数级提取，去类型/注释调整 |
| S:6–21 last complete tag | extractStructuredOutput.ts:119–139 | 函数级提取，格式调整、算法一致 |
| S:23–27 fences | extractStructuredOutput.ts:154–161 | 函数级提取，格式调整、算法一致 |
| P 文本解析 | AP:71–108、557–565、585–606、708–719 | 部分结构改编；返回类型、错误、终态策略已变 |
| P 启动 argv | AP:650–653、809–813、1212–1215 | 协议参考后重写，不是原串提取 |
| X 逐行监管 | OR:147–185；NS:57–135 | 保留 raw→parse→reset 思路；监管器新写，不能计作完整 Orchestrator 提取 |
| E pipeline | T:114–182、208–221 | 保留 I→R / allSettled / 单Merger骨架；其余业务状态大量新增 |
| E:78–85、314–320 prompt | PromptResolver/Substitution/Preprocessor | 新加载拼接器；未采用上游三模块 |
| C/I/R/M 内容 | TI/TR/TM | 中文重组、职责改编和本地边界增强 |
| LICENSE.sandcastle | U/LICENSE:1–21 | MIT正文一致、版权和源码文件指针保留 |

来源说明中“finally结束现场也已移植”（`docs/research/afk-local-cli-source-provenance.md:52`）不精确：上游 T:158–160 是每票 finally.close，本地 E:517–523 是整轮释放写锁；本地已改为串行准备、所有worktree保留。

## 3. 需要修正或明确裁决的偏离

下表已合并重复发现，并经过两轮针对性反证复核。风险级别不是运行事故统计。

| ID | 偏离与影响 | 本地 / 上游 | 裁决与边界 |
|---|---|---|---|
| F01 | worktree准备的任意异常都写入永不清除的blocks，可恢复失败也不能下批重选 | E:477–484、193–198、230；T:114–170 | **确认代码缺口**，与D4失败仅退出当前批冲突。修复还要处理E:287已取得但未释放的自身锁，不是简单删block |
| F02 | close-only组任一票unknown/blocked，整组Merger不派发，其余可关闭票也停止 | E:378–389、464–474；TM:18–24，本地M:24 | **确认代码缺口**，与D4逐票关闭故障隔离冲突。固定批次不等于整组关票必须共同可用 |
| F03 | HEAD/status/binary diff/未跟踪文件stat快照严格相等，成为后续Merger接管门槛；close-only另钉HEAD | E:369–409、428–434；上游无等价本地交接门槛 | **需裁决的明显额外证明机制**，与D6/Out of Scope禁止SHA/tree交接证明有冲突。普通Git事实查询不算；锁名hash不算；mtime在此不用于idle |
| F04 | summarySubject在baseline..HEAD恰好出现一次被用作summary确认 | E:424–435；TM:14 | **非规格必需的弱证明**。同标题普通提交可能误拒、不同标题的重复summary不被发现；不等同可靠“一次summary”验证，也不把标题计数本身叫SHA证明 |
| F05 | 最近10提交、Reviewer diff/log从代码启动前自动展开改成角色自行读取 | E:314–320、I:7、R:7；TI:13–19、TR:7–13；PromptPreprocessor.ts:42–79 | **明确非必需行为偏离**。阅读意图保留，但自动输入/失败时点保证下降；恢复MD没有修复这一差异 |
| F06 | 所有delta、assistant和最终result混合累加，后来终态无封套时仍可选中早先passed封套 | P:108–112、X:140、160；OR:159–166、209 | **纯解析探针确认条件行为**。需退出成功、无错误、身份及下游门禁都过才影响交付；未证明真实CLI必然产生该序列。上游最后非空result具有独立权威槽 |
| F07 | 坏JSON或任意error粘性影响整次角色调用，后续成功不清除 | P:195–196、X:139–142、158；AP相关分支、OR:191–209 | **确认机制，影响待按事件分类**。权限粘性合理；不是所有中间错误都应终止业务成功；仅本次调用，不跨尝试永久污染 |
| F08 | 失败测试内容的EPERM/EACCES可被误当权限拒绝；plain stdout真实拒绝反而漏分类 | P:72–80、137–141、190；X:145–158；OR:191–205 | **纯解析探针确认边界**。可能误停或重复尝试，但未证明真实任务事故。不能把stdout诊断直接当业务结果；应保留来源和限长诊断 |
| F09 | Pi aborted仅普通失败，角色外部signal通常也普通失败，可能被后批重选 | P:158–174、X:153–158、E:505–510；OR:123–135 | **条件风险**。公开stop能阻派；aborted不一定用户停止，不能一律等同，也不能未经归因就无限重试 |
| F10 | 父CLI exit即清idle并TERM/KILL同组后代，清理成功后仍可能返回passed | X:74–80、109–113、153–169；NS:111–117 | **确认监管语义差异**。不是COMPLETE grace，但可能在600秒前切断活跃工具而仍成功；本轮未真实复现 |
| F11 | 仅确认原POSIX组；脱组后代若保留pipe，父exit清timer后可无限等close；若断pipe则可能继续写 | X:16–39、74–80、107–118；NS无同等保证 | **静态可达边界**。killpg不是全部后代证明。文档的“所有相关写者”保证过强；上游更弱不使本地保证成立 |
| F12 | 启动握手和前置git/gh/wt命令无等待期限，前置挂住使start既不成功也不失败 | A:155–163、X:122–125；RUN:320–329、SL:188–194 | **确认代码缺口**。启动检查期限不属于被禁止的角色总时长上限 |
| F13 | 返回的status/stop命令未引用脚本路径，JSON.stringify(runDir)不等于shell escaping | A:165；SKILL.md:36；上游无AFK控制接口 | **确认提示命令缺陷**。空格会拆词、双引号内$()可展开；仅影响用户复制的字符串，不是内部argv spawn注入 |
| F14 | stop先同步追加event再调用processes.stop；日志异常可跳过实际终止 | A:57、65–74、85–94；上游RUN:302–312选择吞日志错 | **确认高影响异常路径**。信号回调可未捕获退出；socket路径捕获异常但仍可能没停。需保证清理，不要求磁盘故障平台 |
| F15 | only显式config.specs预注入，未实现原生parent/正文Parent发现 | E:115–129、167–170、314–320；TI:5 | **文档/接线缺口**。REFERENCE.md:21、workspace-binding.md:11、CONTEXT.md:33–34描述更强；角色可补读，不能说父上下文一定永远不可得 |
| F16 | 两处现行文档说clean目录移除，代码全部保留 | docs/personal/afk-issue-loop.md:15；docs/research/sandcastle-vs-afk-sequence.md:12；E:517–523；CS:1093–1104 | **确认文档失实**。保留clean本身是规格允许选择，不是缺陷 |
| F17 | 文档允许用户明确免测；代码Reviewer及首次Merger要求至少一项且全部passed | REFERENCE.md:43；E:325、365、425；T:175–182无该门禁 | **确认文档/门禁冲突**。人工检查passed可行，不代表not-run免测路径可行 |
| F18 | I/R误关票且管线失败未进队列，refresh可能全closed后completed，交付失败保护未覆盖这些票 | E:178–187、354–366、456–459、498–501；TM:16–24 | **条件性静态漏洞**。须先有角色违反不关票规则；不是正常链路必然误完成 |
| F19 | Merger已产生summary/关闭副作用但封套失败，代码不能确定性转close-only | E:400–435；RUN:842–889有可选只纠正输出重试 | **降级为恢复边界**。M:10、14、18要求查历史避免重复，不能说一定重复summary；已关票可能转人工核实 |
| F20 | 缓存workspace重试直接返回，角色启动前脚本未再核对branch | E:283–285、330–334、348；CS:375–378 | **纵深防御缺口**，C:7已要求角色写前核对，成功后还有检查；不认定必然错分支写入 |
| F21 | 抛出的通用ENOENT被workspaceFailure视作永久现场阻碍 | E:18、494；上游typed errors/有限setup重试 | **异常分类过宽**，不是任何角色文本或测试ENOENT都会中招 |
| F22 | 所有显式SPEC共用、初始失败可阻全部票且不刷新；SPEC变更不自动进入后续角色 | E:120–128、153–177；TI:5按角色读取 | **保守但额外选择**。多个SPEC不一定都与每票有关，影响面可能过大；当前没有逐票关联模型 |
| F23 | 父级监管异常收尾不完整：未使用的onStart在try外、groupExists回调异常、异常spawn缺role-end | X:59–63、74–79、104–118、131–152；EM:61–66、OR生命周期 | **条件健壮性/可观测性缺口**。onStart当前role未传，不能作为主路径事故；附录41等正常idle保证不受此否认 |

## 4. 调度、GitHub、worktree：其余全部语义差异

此节与第3节共同覆盖engine；“全部”指本次当前skill职责和所列上游闭包，不是承诺没有任何未发现缺陷。

| ID | 上游 → 当前实现 | 源码位置 | 来源 / 符合性 |
|---|---|---|---|
| G01 | LLM Planner → 代码读票、固定范围、确定排序 | T:73–87、TP:15–35 → E:110–240 | 新增 / D1/D3要求 |
| G02 | 每轮重新规划scope → 初次分页open ready-for-agent，排除PR/closed，后续只刷新初始集合 | T:61–89 → E:98–177 | 新增 / D3要求 |
| G03 | 代码重叠/API等LLM依赖启发 → GitHub原生blocked_by唯一权威 | TP:15–23 → E:168–170、193–240 | 替换 / D3要求，不要求恢复LLM图 |
| G04 | 最多任务数由Planner决定 → 每批最多4、固定成员、一票也启动 | TP:35、T:89–115 → E:227–240、467–488 | 改编 / D3/D4要求 |
| G05 | 主观最高优先 → 入口解析项目标签映射，脚本同级按编号 | TP:35 → SKILL.md:17、E:221–226 | 改编 / D3要求；“未读取项目优先级”误报已排除 |
| G06 | 最弱/最少依赖单候选 → 开放直接内部依赖数量、优先级、编号；fallback一次一票 | TP:35 → E:238–240 | 新增明确排序 / 可选规则，D3要求可检查化 |
| G07 | 上游没有外部前置/unknown隔离协议 → 传播受影响票，独立票继续 | TP:15–35 → E:193–219 | 新增 / D3要求；不是依赖闭包证明平台 |
| G08 | 并发map内创建现场 → 先串行准备，再并行I | T:114–121 → E:476–488 | 改编 / D4明确要求 |
| G09 | I运行maxIterations100、R1 → 每次角色一次CLI，失败交外层重选 | T:125–147 → E:354–366 | 重写 / 单调用是可选；移除总批次10上限才是D4必需 |
| G10 | fulfilled且有commits进成功集 → 独立Reviewer passed、测试和实际deliverable都过 | T:137–182 → E:354–366、488–501 | 新增 / D4业务要求；具体校验实现可选 |
| G11 | 本次run新增commits → 整个任务分支相对目标的未交付commits/diff | SL:375–383、513–523 → E:347–365 | 替换 / D4/D5历史成果要求 |
| G12 | 外层最多10轮 → 无限批次、失败重选、1秒退避 | T:44、61 → E:455–510 | 改编 / 无总限必需，退避值可选 |
| G13 | 合回启动分支 → 显式target，否则develop/main，不同步origin | T:202–221、SL:200–209 → E:94–97、263–281 | 替换 / D3要求 |
| G14 | Merger临时merge-to-head现场 → 唯一目标worktree直接写 | T:208–221、SL:408–481 → E:263–281、402 | 替换 / D4/D5要求 |
| G15 | 无业务merge/close续作 → pending、mergeQueue、原批身份、close-only驻内存 | T:193–223 → E:98–107、178–190、388–443 | 新增 / D4要求的业务状态；不是持久化恢复账本 |
| G16 | 每批等待Merger完成 → 目标受阻时独立票可继续并积累成功组 | T:208–221 → E:464–503 | 新增 / 独立票继续有D5依据，队列形式可选 |
| G17 | 上游角色关票后return → 本地要求中文summary后逐票关，再由脚本refresh核实 | TM:14–26 → E:414–438、M:18–26 | 改编 / D4要求；引擎没有代关票 |
| G18 | git worktree add → wt switch创建/复用；git仅查询和提交/合并 | W:363–395 → E:263–306 | 替换 / D5要求 |
| G19 | 自动fetch/ff origin → 不fetch/pull | W:195–275、340–346 → E:94–97、283–305 | 未采用 / D3明确排除 |
| G20 | 自动prune/orphan清理/force remove → 不做全仓清理 | W:447–538、CW:234–242 → E:243、263–306、520 | 未采用 / D5只处理本次现场 |
| G21 | 上游受管路径归属复用 → deterministic afk/issue-N、用户--reuse确认旧现场 | W:331–361、TP:25 → E:286–305、A:143 | 改编 / 归属要求必需，命名与显式确认接口可选 |
| G22 | 上游自身worktree锁 → common-dir/branch映射Unix socket，整运行持目标锁 | W:121–145、331–361 → E:33–49、265、287、513–523 | 新增 / 防冲突有依据，锁协议与持锁范围可选；不能挡人工/其他工具 |
| G23 | clean close删除、dirty保留 → 所有worktree/branch保留 | T:158–160、CS:1093–1104 → E:520–523 | 未采用 / 规格“可清理”，允许；目录累积应披露 |
| G24 | 无SPEC自动识别 → 标题/label/type启发式排除SPEC | TP:1–11 → E:21、135、147、161–163 | 新增 / 显式SPEC排除必需，启发式可选且可能误排Ticket |
| G25 | 各run独立读上下文 → SPEC初始固定、I/R复用票对象、Reviewer加入I自报previous | TI:5、TR:7–17 → E:120–128、355–362 | 新增 / 前序输入有D1依据；新鲜度/统一注入策略可选 |
| G26 | setup特定重试 → GitHub读取最多3次、250/500ms等待 | SL:24–40、75–81 → E:61–73 | 新增 / D3允许读取重试，具体次数可选；不是总任务次数上限 |
| G27 | 上游无AFK日志门禁 → dirty排除整个.afk/logs，禁暂存/提交日志 | W:434–439 → E:244–255、350–351 | 新增 / 必要日志适配及可选保护；不等于所有路径都无例外检查 |
| G28 | 通用schema → 自写分层validator，tests/commits/clean更严格 | extractStructuredOutput.ts:45–87 → X:164–168、E:309–365、414–436 | 重写 / 领域字段必需；重复校验、全部tests必须passed是可选且有F17冲突 |
| G29 | fallback无pending业务态 → 只避开直接依赖pending的候选 | TP:35 → E:229–240 | 新增 / 不是传递保护；注释的广义“下游不冒进”过强，不据此要求依赖证明平台 |
| G30 | SDK Sandbox/Worktree对象、sync-in/out、分支策略、copy/hooks → 固定AFK现场流程 | CW、CS、SI、SO → E:51–528 | 重写/裁剪 / 不要求保留SDK对象、容器patch搬运、Windows mount、interactive等非目标 |

## 5. 入口、分发、日志及产品能力差异

F12—F17、F23已列缺口；下表列其余改动，包括合理删减。

| ID | 上游 → 当前实现 | 双边位置 | 来源 / 符合性 |
|---|---|---|---|
| A01 | npm SDK run Promise + init/docker/podman CLI → 同名skill启动start/status/stop专用程序 | U/src/cli.ts:692–699、RUN:493–505 → A:168–189、SKILL.md:10–40 | 新增 / D1/D8要求；不是给上游已有run子命令加选项 |
| A02 | 发起进程内运行 → detached daemon、文件stdio、短期IPC握手、unref | U/src/main.ts:16–22 → A:52–128、150–165 | 新增 / D8要求独立；具体协议可选 |
| A03 | 同步shutdown callback/退出 → SIGINT/TERM传播stop、HUP忽略、状态确认 | U/src/shutdownRegistry.ts:40–54 → A:65–90、X:31–50 | 重写 / D8要求；TERM/KILL清理预算不是角色时限 |
| A04 | 内存run结果 → control.json、token/socket、events、终态result.json | RUN:801–860 → A:55–57、103、124、177–185 | 新增 / D8允许最小身份和最终结果；不恢复调度状态 |
| A05 | 模板固定不同Claude模型 → 默认claude、model/effort缺省由本机CLI决定、全角色同一配置 | T:81、128、142、213 → A:135–148、P:42–53 | 改编 / 用户配置必需，默认CLI与统一配置为可选 |
| A06 | .sandcastle/.env/provider env merge → 继承process.env及本机CLI设置 | RUN:618–626、EnvResolver.ts:49–73 → X:55 | 裁剪 / D6环境方向，通用env配置不是目标；不删CLAUDECODE等保护变量 |
| A07 | shell字符串命令 → command+args / shell=false默认 / stdin结束 | NS:68–88、AP启动函数 → P:24–54、X:55、105 | 重写 / 合理可选安全适配 |
| A08 | verbose=false不记录全部raw → stdout始终原始行落盘，stderr另存且不续期 | RUN:222–255、271–312、OR:147–185 → X:137–149 | 改编 / D7强制日志与stdout活动源 |
| A09 | .sandcastle/logs按branch/name → 目标.afk/logs/run/attempt-role-tickets | RUN:135–148、646–655 → A:137–151、E:333 | 新增 / 日志归属必需，命名可选 |
| A10 | Display/typed工具/usage/TextDeltaBuffer/observer → raw文件+简要events/duration | Display.ts、AgentStreamEmitter.ts、TextDeltaBuffer.ts → X:131–152、A:57 | 未采用 / TUI、成本统计、token展示非必需；见附录精确语义损失 |
| A11 | 600秒idle可配置+每分钟warn → role固定600秒，无周期warning | OR:75–121、246–248 → X:13、64–70、136 | 改编 / 固定idle必需，warning删除可选 |
| A12 | COMPLETE后切默认60秒可续grace并可成功返回 → 无COMPLETE控制语义，等exit/idle/业务结果 | OR:89–120、174–185、224–269 → X:153–169 | 未采用 / D6要求明确处理，删除grace是符合目标的方案 |
| A13 | raw输出尾部BoundedTail+业务累加 → 角色raw无诊断tail、stderr64000字符slice、业务文本仍累加 | boundedTail.ts:20–68、NS:99–117、OR:44–50 → X:58、94–95、130–140 | 重写 / 诊断回退减少、长运行内存边界见附录；上游业务文本也无界，不能全算本地回归 |
| A14 | Output.object/string+Standard Schema → 固定afk-result、手写校验 | Output.ts:67–108、extractStructuredOutput.ts:45–109 → X:160–168、E:309–345 | 改编 / 领域契约必需，validator形式可选，string/泛型非目标 |
| A15 | 可选session resume/fork/输出格式纠错重试 → 每次新CLI，业务阶段重新执行 | RUN:805–838、842–889 → E:330–345、354–365 | 未采用 / 非必备，但格式纠错重试默认0，不是规格禁止必须删的总重试上限 |
| A16 | session id/capture/本机与sandbox搬运/cwd重写 → 全部不管理 | SessionStore.ts、AP sessionStorage → P、X无对应 | 未采用 / 非目标；不能说CLI自己不保存会话 |
| A17 | TS+Effect+构建产物及依赖 → 五个Node内置模块ESM，Node≥22 | package.json:65–101、tsup.config.ts:8–38 → SKILL.md:20、五mjs imports | 重写 / 无运行时下载必需，零npm和Node版本选择不是规格强制 |
| A18 | no-sandbox具Windows shell路径 → 仅macOS/Linux POSIX | NS:68–88、144–151 → A:131–133 | 未采用 / 已披露平台收窄，本机Mac目标下允许 |
| A19 | 模板npm install、copy node_modules、任意hooks → 不自动npm bootstrap，由Worktrunk已有机制处理现场 | T:46–55、116–120 → E:270、293–298 | 裁剪 / 不自动安装合理，SDK hooks非目标；不能说Worktrunk绝不运行hooks |
| A20 | 多Provider、多sandbox、Beads/custom tracker、模板scaffold、interactive等 → 三CLI、GitHub、固定AFK模板 | AP、InitService、cli、sandbox providers → SKILL.md、P、E | 未采用 / 明确产品范围，非缺陷，不要求复刻整个Sandcastle |
| A21 | 多入口/历史原生规则 → 现行注册路由统一指向独立脚本，同名同bucket | 本地README:102、personal/README:11、ask-rolex:90、usage-guide:72/190、plugin.json:9–12 | 保留产品入口 / 未发现新增同用途skill或原生fallback；不抵消F15–F17文档失配 |

## 6. 明确排除的误报与未验事项

1. **否定“没有项目优先级解析”**：SKILL.md:17负责解析并传参，E:221–226消费，职责闭合。
2. **否定“上游Prompt SDK自动递归内联@file”**：被审计三模块无此实现；review模板的`@.sandcastle/CODING_STANDARDS.md`是交给agent的引用。
3. **否定“所有review标准都丢失”**：多数检查保留，仅重组、泛化少数专名，附录逐项列出。
4. **不把内存pending、最小control/result文件叫持久恢复账本**；没有恢复读盘调度接线。
5. **不把targetSnapshot的mtime叫idle活动源**；计时仍仅stdout真实行。
6. **不把锁名SHA256、普通git status/log/ancestry查询一概叫交付SHA证明**；争议仅在内容快照相等作为交接硬门槛。
7. **不把clean保留叫规格违反**；错误是部分文档仍写已清理。
8. **不把onStart未使用分支或错误角色行为叫正常运行必现事故**；F18/F20/F23保留条件。
9. **不把格式错误后的merge模式叫必然重复summary**；prompt已有历史核对，但代码没有确定性close-only确认。
10. **不把上游已有no-sandbox叫可直接安全复用**；本轮实际调用发现绕权限、全局写配置和取消缺口。
11. 本轮没有重新验证安装副本/软链接执行、真实三CLI模型与授权、逃逸后代、超长上下文或600秒时序。静态imports/资源定位不依赖开发期上游目录；这不等于所有安装态运行已验收。
12. 历史记录中的Claude完整链路、Codex权限阻碍、Pi认证/网络阻碍以及受控615秒长测仍按各自原结论保留，不升级为“当前版本三CLI全部通过”。

## 7. 覆盖闭合与后续优先级

### 覆盖

- 当前skill全部14文件：五个运行mjs、许可证、四prompt、SKILL/REFERENCE/EXAMPLES/workspace-binding。另核对现行路由、来源说明及相关实施记录。
- 上游相关闭包：指定批次模板全部文件、AgentProvider/Orchestrator/run、三个Prompt模块、structured output、worktree/createSandbox/lifecycle/sync、本机provider及启动、shutdown、Display/emitter/buffering、env、公共CLI/exports/package/license。
- Prompt三份完整测试；Provider/Orchestrator/结构输出/缓冲/恢复与no-sandbox测试；run与初始化相关测试区间，详见附录覆盖清单。读取不等于执行。
- 非当前skill职责未作逐行产品审计：其他模板业务、其他sandbox/CLI实现、网站UI、发布/CI、历史plans。已在A20及附录列为未采用能力，不以“无条目”默认它们相符。
- 已完成四个维度审计、覆盖顾问及两组反证复核；原始候选以主报告裁决优先。下载源文件核验只证明基准准确，不证明改编正确。

### 优先级建议（本轮不修复）

1. **先裁决复用边界**：确认是否接受新写监管/调度；明确恢复自动Git上下文注入还是接受agent自行读取。不要未经授权再重构一遍。
2. **优先修控制与隔离故障**：F01/F02/F12/F13/F14，另用公开CLI受控场景验证F10/F11。
3. **修结果语义和错误归因**：F06–F09；针对坏封套、部分副作用、提前关票核实F18/F19。
4. **删除或简化不获认可的证明门槛**：F03/F04不是上游必要提取，不能靠“安全”无限扩大设计。
5. **对齐实际文档**：来源、parent上下文、clean保留、免测与写者保证。修完再按公开入口复验，不复用旧“通过”结论。

## 附录一：Provider / Process / Structured Output 逐项原始审计

以下保留65项完整细表、纯探针和覆盖范围。子任务版本认证限制由本报告第1节主审计补齐；风险结论以第3/6节反证后的限定为准。

### AFK Provider / Process / Structured Output 完整源码对照审计

#### 结论与边界

- 只读审计；未改仓库、未启动 Claude/Codex/Pi 真实角色、未另派代理。唯一写入为本报告。补做了无文件写入的 Node 纯解析函数探针，未把它称为公开入口验收。
- 三个本地模块及指定七份上游源码均全文阅读；六份直接相关上游测试共 7,545 行全文阅读，另全文读 no-sandbox 源码/测试、定向读 run 重试/日志接线及测试、以及本地结果消费者。覆盖详见末节。
- **确有小范围源码提取**：`extractErrorMessage` 函数体、`findLastTagContent` 算法、`unwrapFences` 正则/分支。Provider 三种文本事件分支有可定位的结构改编，但返回协议、错误策略和启动命令均已改写。
- **`processes.mjs` 是新写 Node 进程监管器，不是提取后的上游 Orchestrator**。它保留 raw→parse→reset 的行为顺序，但这个顺序不足以证明具体源码复用。不能用该模块的来源注释或相同 600 秒常量，把整个执行层称为“真实提取”。
- 主要风险：权限/用户停止识别依赖启发式且有遗漏；所有错误事件永久污染本次结果；最终快照与增量/历史消息混合可能接纳旧封套；stdout 诊断 fallback 丢失；取消仅能确认原 POSIX 组、不覆盖脱组后代；正常父进程 exit 会立即杀同组后代且仍可能返回 passed；回调和启动清理边界有缺口。
- 不能误报：删除默认绕权限、删除 COMPLETE 60 秒 grace 成功竞速、固定 600 秒 stdout idle、自动原始日志、等 close/组清理后再返回，均是合理且多数明确要求的 AFK 适配。删除 session 搬运、TUI、usage、其他三种 CLI 不自动构成缺陷。**不能仅凭 processes.role 的浅检查判定结果未验证，engine 有第二层校验。**

#### 引用与分类

上游用户指定基准 `e99f832f26dc9d245c019a9ddd19fa5dee792427`，目录 `/tmp/afk-sandcastle-full.Q1sYLq/upstream` 是源码快照而非 Git checkout，`git rev-parse HEAD` 失败；本次未联网独立认证快照 commit，版本身份以用户交付为依据，所有行号以实际读取快照为准。

以下使用精确绝对路径别名，`AP:67–121` 表示对应下列绝对路径第 67–121 行，不是别的版本/文件。缺失能力没有可引用的“空行”，本地引用其覆盖完整替代职责的实现范围。

| 别名 | 精确绝对路径 |
|---|---|
| AP | `/tmp/afk-sandcastle-full.Q1sYLq/upstream/src/AgentProvider.ts` |
| OR | `/tmp/afk-sandcastle-full.Q1sYLq/upstream/src/Orchestrator.ts` |
| SO | `/tmp/afk-sandcastle-full.Q1sYLq/upstream/src/extractStructuredOutput.ts` |
| EM | `/tmp/afk-sandcastle-full.Q1sYLq/upstream/src/AgentStreamEmitter.ts` |
| TB | `/tmp/afk-sandcastle-full.Q1sYLq/upstream/src/TextDeltaBuffer.ts` |
| BT | `/tmp/afk-sandcastle-full.Q1sYLq/upstream/src/boundedTail.ts` |
| RM | `/tmp/afk-sandcastle-full.Q1sYLq/upstream/src/RecoveryMessage.ts` |
| RUN | `/tmp/afk-sandcastle-full.Q1sYLq/upstream/src/run.ts` |
| NS | `/tmp/afk-sandcastle-full.Q1sYLq/upstream/src/sandboxes/no-sandbox.ts` |
| P | `/Users/rolex/Documents/Codes/githubProject/MyProject/rolex-skills/skills/personal/afk-issue-loop/scripts/providers.mjs` |
| X | `/Users/rolex/Documents/Codes/githubProject/MyProject/rolex-skills/skills/personal/afk-issue-loop/scripts/processes.mjs` |
| S | `/Users/rolex/Documents/Codes/githubProject/MyProject/rolex-skills/skills/personal/afk-issue-loop/scripts/structured-output.mjs` |
| E | `/Users/rolex/Documents/Codes/githubProject/MyProject/rolex-skills/skills/personal/afk-issue-loop/scripts/engine.mjs` |
| A | `/Users/rolex/Documents/Codes/githubProject/MyProject/rolex-skills/skills/personal/afk-issue-loop/scripts/afk.mjs` |
| PROV | `/Users/rolex/Documents/Codes/githubProject/MyProject/rolex-skills/docs/research/afk-local-cli-source-provenance.md` |

规格：`/tmp/afk-sandcastle-audit-issue7.json:1`（整个 JSON 仅一行）。下文 D2/D6/D7/D8 分别指 body 内 Implementation Decisions §2 源码复用、§6 Provider、§7 日志 idle、§8 生命周期；D4/D5 为批次/现场；T 为 Testing Decisions。

分类：**R = 规格明确要求**；**O = 可选工程选择**；**U = 无依据或违背规格**（明确区分风险/待验证与已证实行为）；**G = 上游通用能力、不属于 AFK 必备范围**。一项若含“要求+具体选择”，分别写明，避免把每个实现细节说成规格规定。

#### A. 接口、依赖、参数、stdin（01–14）

| # | 上游与本地精确位置 | 上游行为 → 本地行为 | 分类、影响与建议 |
|---|---|---|---|
| 01 | AP:202–277,628–665,773–825,1181–1267；P:7–54,186–199 | 有类型 AgentProvider 实例：name/env/captureSessions/sessionStorage/buildPrintCommand/buildInteractiveArgs/parseStreamLine/usage；本地两个无状态函数，以 provider 字符串分派，状态由 X 持有。name 从 claude-code 改为 claude。 | O；轻量、易并发，但非接口兼容提取。注明此 API 重设计，不宣称保留完整 Provider。 |
| 02 | AP:1–23；OR:1–16；P:5；X:6–11；S:6–27 | 上游 Provider 闭包含 SessionStore，Orchestrator 含 Effect、Sandbox、Display 等；本地只用 Node 内置模块和随 skill 自带 mjs。 | R(D2) 要求可分发无运行时 Sandcastle 包；去 Effect 是 O，不是规格强制。闭包可静态确认不依赖临时 checkout，不把原模块 TS 导入列表当最终依赖。 |
| 03 | AP:123–200,827–1149；P:7–17 | 上游另外支持 Cursor/OpenCode/Copilot、相应 argv 限长与解析器；本地仅 Claude/Codex/Pi，未知 provider 抛错。 | R(D6) 三种范围；额外 CLI 为 G。删除合理，不要求移植无关解析器。 |
| 04 | AP:656–659,816–819,1218–1231；P:24–54；X:55,105 | 上游有 interactive argv/TTY 路径；本地全部 print/JSON，stdin 一次写入后关闭，无交互 TTY。 | G/R(D8)；符合独立角色。需要交互授权时应明确 blocked，不能恢复交互宿主依赖。 |
| 05 | AP:41,650–653,809–813,1212–1215；NS:68–88；P:24–54；X:55 | 上游返回 shellEscape 后的命令字符串，noSandbox 再 sh -c/cmd.exe；本地返回 command+args，spawn 默认 shell=false。 | O，消除 shell 拼接注入，属于本地适配而非原文复制。源码注释要求 shell:false，实际未显式设置但 Node 默认相符。 |
| 06 | AP:1213–1214；P:42–43,53；X:105 | Claude 上游 `--print --verbose … --model M … -p -` + stdin；本地只 `--print --verbose --output-format stream-json [--model] [--effort]`，删重复 -p 和 stdin positional `-`，仍把 prompt 写 stdin。 | O；保留 stdin 意图，命令不是同一串。参数实际兼容性是 T 的三 CLI 验收项，不能仅靠上游测试推断。 |
| 07 | AP:802–813；P:44–45,47–52；X:55 | Codex 上游 fresh exec 不附 `-`，resume/fork 才附；本地始终 fresh exec、总附 `-`、新增 `--cd cwd`、`-m` 改 `--model`。 | O；cwd 同时通过 argv 和 spawn 固定。需要在本机目标版本验收，不把新增参数称原样移植。 |
| 08 | AP:637–659；P:46–53；X:105 | Pi 上游 `-p --mode json --model M [--thinking] [--session]` + stdin；本地保留 print/json/stdin，model 可缺省，无 session 参数。 | R(D6) 适配 Pi；具体 argv 为 O。不加 --no-session，因此不能声称禁用了 CLI 自身会话文件。 |
| 09 | AP:279,628–630,773–775,1181–1183；P:32–35,47；A:135–136 | 上游工厂必须传 model，导出默认 Claude 模型；本地 model 缺省时不传任何模型 flag，执行 CLI 缺省 claude。 | R(D6) 明确默认、原样传用户模型；具体默认 O。适配器不改模型，但不能保证 CLI 自身 fuzzy model/effort clamp 不发生；应记录实际执行配置，别以参数回显当模型验证。 |
| 10 | AP:616,751,1156；P:7–11,36–38,48–50 | Claude effort 集合相同；Codex 增 none/minimal，Pi 增 max；本地运行时白名单强校验，统一 effort 映射到 Pi thinking/Codex config。 | O；扩展值不是固定 commit 已验证支持，旧版本将报错。官方/help 核查在 PROV:55–73 有声称，但本审计未重做当前 CLI 文档查验，不能借此判扩展值错误或通过。 |
| 11 | AP:202–215,637–653,782–813,1190–1215；P:24–38 | 上游这些构造函数不做 prompt/cwd/model 运行时形状约束；本地拒绝空 prompt、非绝对 cwd/NUL、空或 - 开头/控制字符 model、未知 effort。 | O；早失败更明确。model 保留前后空格（只用 trim 验空），不自动修正；cwd 是否真实存在仍交 spawn。 |
| 12 | OR:141–144；AP:794–797,1199–1203；P:40–53 | 上游 Orchestrator 总传 dangerouslySkipPermissions=true；Codex 默认 bypass，Claude 条件 bypass；本地无任何绕权限/approval/sandbox/add-dir 参数。 | R(D2/D6) 正确偏离。不能以“不忠实上游”为由要求恢复危险 flags。 |
| 13 | AP:762–770,794–797,1167–1178,1199–1203；P:24–54 | 上游可显式选 Claude permissionMode/Codex approvalsReviewer，auto_review 分支还改 sandbox；本地接口不接这些选项，只继承现有 CLI 设置。 | O/G；规格不要求暴露所有权限模式，只要求不静默扩权。文档须指向用户自己已有授权，不自动 auto-review。 |
| 14 | AP:266–267,633,778,1186；NS:49–52；P:24–54；X:55,102–105 | 上游可合并 provider/env；stdin 不存在时 noSandbox ignore，有输入 write+end（无该处 EPIPE 处理）；本地永远 env:process.env、三个 pipe、end(input??'')，忽略 EPIPE，其他 stdin 错误记 failure。 | R(D6/D8) 保留环境；O 不开放 per-provider env。EPIPE 不令已完成任务误失败；其他 stdin error 仅置 failure、不即时终止，可能等满 idle，宜记录输入失败并受控结束。不要删除 CLAUDECODE 等保护环境来求通过。 |

#### B. 流事件、错误、工具、会话（15–31）

| # | 上游与本地精确位置 | 上游行为 → 本地行为 | 分类、影响与建议 |
|---|---|---|---|
| 15 | AP:34–39；OR:159–172；P:74–80,94–199；X:139–142 | 上游 text/result/tool_call/session_id/usage 有语义区分；本地 texts/error/permissionDenied，无最终结果事件类型。 | O；简化不是等价。丢失 result 的权威性是 #23 的根因，建议至少保留 final snapshot 与 delta 的区别。 |
| 16 | AP:67–70,117–120,546–549,607–610,699–702,743–746；P:186–198 | 上游仅接第一字符 `{`，JSON 及分支异常均静默跳过；本地先 trim（含 BOM/空白），非 `{` 忽略，JSON parse 失败返回显式 error，分支函数无统一 catch。 | O；缩进行可识别是扩展；坏 JSON 粘性失败不是 R，未知行仍应记日志/reset（本地已做到），需将协议噪音策略明确，避免正常任务因单条坏行无限重做。 |
| 17 | AP:56–65；P:61–70 | extractErrorMessage 读取 string error、error.message、error.data.message、顶层 string message，函数体相同。 | R(D2) 有真实函数提取；非偏离对照锚点。只此函数不能支持“完整 AgentProvider 已复用”。 |
| 18 | AP:71–105；P:83–92,108–111 | 上游 Claude 按 text/tool_use 顺序 flush 文本、emit allowlisted tool；本地只取文本块，全 join，忽略工具块，且 !parent_tool_use_id 才收 assistant。 | O；去 UI tool 展示合理，排子代理文本加强角色结果归属。工具前后的文本被拼接，不能再恢复工具事件顺序。 |
| 19 | AP:43–49,82–100,567–576,721–728；P:83–92,123–179；X:137–143 | 上游 Claude/Pi 的 Bash/WebSearch/WebFetch/Agent、Codex command_execution -> tool_call；本地不产生任何 typed tool event，只有原始日志仍保留。 | G/O；原始 stdout 足够满足 D7，不是缺日志。若需要 UI/观察系统，应复用事件适配，而不是解析日志猜工具。 |
| 20 | AP:107–109（无 Claude 显式错误分支）；P:94–105,109,113–118 | 本地新增 Claude permission_denied/system denial、result.permission_denials、is_error/error subtype、errors[]、assistant.error、user tool_result 权限错误。上游多忽略，result 字符串仍当结果。 | R(D6) 必须识别拒绝；具体事件形状与匹配 O。退出码 0 不再掩盖错误是合理加强。permission_denials 非空即 blocked，哪怕角色后续成功，属于保守政策，不应伪称上游原行为。 |
| 21 | AP:730–735；P:129–142 | Codex 上游 error 转 result，无 message 则忽略；本地 error/turn.failed/item.completed error 都失败，无 message 仍给默认错误，并从失败 command_execution output 检出权限。 | R 错误/拒绝不冒成功；新增终端事件支持为 O，需相应 fixture。API 可恢复错误也统一粘性失败，见 #25。 |
| 22 | AP:557–565,578–606；P:146–178 | Pi 保留 delta 和倒序最后 assistant 文本；本地新增 delta error、message_end assistant stopReason error/aborted、agent_end stopReason、工具结束权限错误，缺字段有更多防御。 | O/R 错误不冒成功。`aborted` 仅标普通 error，不能分辨用户主动中止与可重试执行失败，见 #28。 |
| 23 | OR:44–50,159–166,209；P:112,123–127,147–175；X:130,140,159–164 | 上游 resultText 最后 result 覆盖，返回 `resultText || raw stdout`；本地将 assistant/delta/所有结果快照全部累加，再取最后完整 afk-result。Codex 单事件不再 text+result 重复，但仍累加多消息。 | U（结果权威性缺口，非所有多标记都错）。末条 result 没有封套时，可能接纳此前 passed 封套；上游该情形会只取最后非空 result 并缺标失败。建议保留 final-result 槽，明确 delta fallback；不能以“最后完整标签”替代“最后角色最终答复”。纯函数探针已证实旧封套仍被选中，未真实跑角色。 |
| 24 | AP:71–108,585–606；OR:159–166,209；P:108–112,166–175；X:140 | 上游 accumulator 也会重复 Claude assistant/result、Pi delta/snapshot，但正常返回的是最后 result；本地重复进入业务提取输入。同一条 Pi terminal 快照覆盖增量的语义被取消。 | O/U；重复完整封套通常可被 last-tag 处理，并非一律 bug；增量未闭合后追加完整快照会嵌套开标签、可能使 JSON 无效。不能把上游 accumulator 重复直接当本地结果选择等价证据。 |
| 25 | AP:578–583,730–735；OR:191–209；P:74–80；X:139–142,155–158 | 上游 API error 多只覆盖 resultText，主要依赖 exitCode；本地任何 parsed.error 均粘性（后来的成功不清空），只最后一个错误消息保留。 | O，非规格要求“任何中间可恢复错误永远令角色失败”。可能 CLI 自己重连成功仍下批重做。建议区分 terminal/recoverable；权限拒绝保持粘性，诊断保留首因/全部关键错误而非覆盖。 |
| 26 | AP:56–65,578–583,730–735（无拒绝正则）；P:72–80,113–118,137–141,162–164；X:14,145–157 | 上游无本地 permission 分类；本地从结构事件、失败工具内容、stderr 任意文本匹配多套正则。`EACCES|EPERM` 无词界，stderr refusal 无退出码条件。 | U（启发式未限定来源）。失败测试输出 `test expected EPERM but got OK` 会被判 permissionDenied；正常 stderr 讨论权限错误也会 blocked。纯探针已证实前例。建议优先结构拒绝/明确 CLI 终端状态，文本兜底附证据且可区分测试断言。 |
| 27 | OR:191–205；P:189–190；X:137–158 | 普通 stdout `permission denied` 仍原样入日志/reset，但 parser 返回 texts:[]，角色又无 raw tail fallback；非零退出最终只得“退出 N”，不会 blocked。 | U(D6/D8) 真实拒绝可能被当普通 failed，下批无限重选；不能为修它把普通 stdout 当业务结果。建议独立有限诊断 tail→拒绝归因，未知授权状态报告用户。 |
| 28 | OR:123–135,226–230；P:158–174；X:153–158；E:355–365,505–510 | 上游通过 AbortSignal 中止并拒绝；本地显式 Processes.stop 可 stopped，但 Pi stopReason aborted 只普通 error，外部 signal 导致 code=null 也通常普通 failed。 | U（条件性）。公开 stop 路径正确；若 CLI 事件的 aborted 实为用户停止，本地下一批会重启，违背 D8。须建立可验证 user-cancel 信号映射，不能推断每次 aborted 都等于用户停，也不能一律重试。 |
| 29 | AP:110–116,550–555,704–706；OR:168–169,292–299,379–404,502–545；P:94–179；X:128–169 | 上游抽 session id，支持存储、capture host、resume sandbox、cwd 重写/查找；本地忽略 session 事件，不搬运、不返回 CLI sessionId、run/attempt 是自己运行身份。 | G；D5 不要求持久化恢复，删除合理。注意不搬运 session 不等于 CLI 不在本机保存 session；亦不能把 AFK run UUID 称 CLI sessionId。 |
| 30 | AP:647–649,802–805,1205–1211；OR:379–383；P:24–54；E:330–345 | 上游第一 iteration 可 resume/fork；Claude/Codex 支持 fork，Pi 仅 resume；本地每次新进程无 resume/fork，Reviewer 因此新会话，失败重试也新会话。 | G/O；独立 Reviewer 为 R(D4)，不强制失败实现 resume。丢失推理上下文但保留分支成果，不能称“上游会话处理已移植”。 |
| 31 | AP:225–231,671–696,738–742,1238–1265；OR:170–171,502–545,569–573；P:123–179；X:152 | 上游 Codex 流 usage，Claude session 最后 assistant usage，session 可覆盖 stream usage；本地全删，只记录墙钟 durationMs。 | G；不影响 AFK 必备交付，成本/实际模型审计能力较弱。无需为完整复用而恢复 token 统计。 |

#### C. 原始行、日志、idle、completion（32–44）

| # | 上游与本地精确位置 | 上游行为 → 本地行为 | 分类、影响与建议 |
|---|---|---|---|
| 32 | OR:147–185；X:82–93,137–143 | 顺序均为 raw 行先转发/落盘，再解析，再 reset；未知文本、工具事件、空行也续期。上游 raw callback 抛错被吞，本地回调抛错则 kill、该行不再 reset。 | R(D7) raw+idle 共源；失败时不无日志降级正确。具体 callback 顺序是行为适配，不证明整段源码被移植（见复用结论）。 |
| 33 | RUN:271–313；EM:46–68；X:85–100,137–145 | 上游外部 observer/verbose sink 异常吞掉，最多无 raw 日志继续；本地 append/parse callback 异常记录 failure 并终止执行。 | R(D7) 不允许无日志继续；O 终止故障策略。此差异必要而非 regression；磁盘故障无需扩成平台。 |
| 34 | RUN:135–148,363–364；OR:447–455；X:138,145；E:330–335；A:138 | 上游默认 .sandcastle/logs，branch/target/name 文件名，typed events 带 iteration/timestamp；本地 .afk/logs/run/attempt-role-tickets.stdout.log，stderr 另文件，events.jsonl 元数据。 | R(D7) 目标仓库日志与执行关联；命名/分离 O。原始 JSONL 不逐行加本地 timestamp，执行关联靠路径和事件；不能说所有 raw 行都有记录时间。 |
| 35 | RUN:274–289,297–313；EM:16–35；X:137–150 | 上游 raw 自动写文件仅 verbose，typed text/tool 另走 Display；本地无 verbose 开关，所有 stdout 行总 append，stderr 原始 chunks 总 append，0600 仅适用于创建新文件。 | R(D7)；日志能力并非“原样上游默认”，而是必要强化。已有同名文件权限不会因 mode 参数自动修复，但当前 run 隔离命名避免通常冲突。 |
| 36 | TB:1–73；OR:418–445,497–498；X:137–143；P:147–150 | 上游增量 UI 按换行、句边界、>=80字、50ms debounce 聚合，tool 前 flush，结束 dispose；本地无此层，Pi 每个原始事件即时入日志，业务文本直接累加。 | G/O；删除只影响可读显示/写次数，不该在 raw idle 前加 debounce，不能把缺 TB 判核心流处理缺失。 |
| 37 | BT:20–68；NS:99–117；X:58,86–87,94–95,130–140 | 上游流式 exec stdout/stderr 都 BoundedTail 默认65536字符，可配置；本地角色 stdout 不留 raw tail、stderr 固定64000字符 slice；普通 command stdout 全串，业务 text 全串。 | O/U 长运行内存风险。BoundedTail **没有提取**，64000 slice 只是同目的新写。上游 OR.accumulatedOutput 本来也无界，不能夸称上游全程有界、本地才引入所有无界。建议提取 bounded diagnostic tail；业务结果用可界定的消息/封套缓存，不武断截断有效大结果。 |
| 38 | NS:90–117；OR:148–185；X:82–88,94–95,145–149 | 上游 readline 默认 CRLF 时间，本地 crlfDelay:Infinity；本地普通命令也改为逐行重构并补 \n，stderr 原 bytes 入文件但 data.toString 按 chunk 解码诊断。 | O；CRLF/EOF 最后一行仍记录，原始“行”不等于字节级原样保存。stdout 分行不完整字节不续 idle；stderr 多字节跨块可损坏中文诊断，boundary 只能拼字符、不能补 UTF-8 解码。 |
| 39 | OR:89–121,138,246–248,321–325；X:13,64–70,103,136 | 上游默认600秒可配置；本地 role 强制600000ms，底层 execute idleMs 可选，调用前启动同一 timer，先前真实行后重新计时。 | R(D7) 固定600秒/no total cap；不暴露 role timeout 配置合理。不是“派发起600秒总时长”。普通 git/gh/wt command 无 idle 不是角色 timer 被禁用。 |
| 40 | OR:75–87,118–119,457–463；X:64–70,152 | 上游每静默一分钟 warn，真实行将计数归零；本地无周期 warning/idle 倒计时，只有 role-end idle 和时长。 | O/G；规格不强制每分钟提醒，不影响 timer。可选记录 idle-trigger 事件以提高排障，不引入 heartbeat 给角色续期。 |
| 41 | OR:148–185；NS:104–110；X:82–101 | 两边只有 stdout onLine reset，不因 stderr 或 typed emitter/其他执行/历史日志续期；本地 timer 为每 execute 闭包。 | R(D7)，无行为偏离的关键验收锚点。高频 stderr 同样会600秒 stdout idle，属明确要求。 |
| 42 | OR:89–103,174–185,225,246–269；P:181–184；X:64–70,158–164 | 上游累计文本包含 COMPLETE/自定义 signal 后切到默认60秒 grace，后续 raw 行继续 reset grace，到期成功返回；本地不识别任何 complete 控制信号，不创建 grace timer，只等进程/600秒 idle。 | R(D6) 必须明确且不能无意早杀；删 grace 是合理 O 实现方案。不得恢复上游“信号出现即可 force-complete 成功”。 |
| 43 | OR:209,547–557,575–602；X:107–113,153–169 | 上游 code0可成功返回普通文本，再由 COMPLETE 决定迭代结束/上限；本地 code0/EOF/COMPLETE 都不足，必须无 provider error、非idle/stop，并解析业务封套，实际交付还由 E 验证。 | R(D6/D8) 正确加强，不能把角色 passed 当全部 Tickets delivered。 |
| 44 | OR:210–242；X:74–80,107–119 | 上游 exec/race ensuring 清理 timer/warn；本地父 exit 即清 idle（即便 close 尚未到），正常 close/finally 再清，EOF 本身不清。 | O/R(D7/D8)。组内后代由 exit cleanup 处理，但脱组进程若仍持有 pipe，父 exit 清 timer 后 close 可永远不来（#49）；不要只说“所有 EOF 都已验证安全结束”。 |

#### D. 本地进程生命周期与取消（45–55）

| # | 上游与本地精确位置 | 上游行为 → 本地行为 | 分类、影响与建议 |
|---|---|---|---|
| 45 | OR:22–42,140–147,221–231；NS:78–88,164–166；X:26–58 | 上游 Effect race 调 sandbox Promise，noSandbox 不 detached、close no-op；本地新 Processes registry、每 spawn 建独立 POSIX 组，stdin/out/err 由编排器持有。 | R(D8) 要求真实生命周期，具体 Node/组实现 O。不要把上游 Promise 中断当作已验证进程结束。Processes 只管角色/命令，发起会话脱离是否成功还需 A 公共入口验证。 |
| 46 | OR:123–135,226–240,350–356；X:28,48–55,113,153；A:65–76 | 上游 AbortSignal reason 原样 defect；本地 stop 设置全局 stopping，并发 terminate 当前受管组，后续 execute 禁派；SIGTERM/SIGINT 为 stop，SIGHUP 单独忽略。 | R(D8)；任意 abort reason 替换为统一“用户停止”是 O 且丢诊断细节。无需照搬 AbortSignal API。 |
| 47 | OR:221–241；NS:95–117,164–166；X:16–46,107–118 | 上游 noSandbox 无取消确认；本地 SIGTERM→最多5秒轮询→SIGKILL→最多10秒轮询，组仍存在则 unsafe/stopping、抛错，交接等待 close+termination。 | R(D5/D7/D8) 确认后才交接；5/10秒为 O 清理预算，不是角色总时限，不与600秒冲突。实际 CLI/OS 后代验证仍需 T。 |
| 48 | NS:111–117,164–166；OR:191–209；X:74–80,109–113,158 | 上游正常父进程结束但子进程持 pipe 会 hang，可能 COMPLETE grace 处理；本地父 exit 时只要组存在立即 TERM/KILL 剩余同组后代，即使持续输出且未 idle。终止只影响后代时 result.code仍可0、idle仍false，最终可 passed。 | U（需要显式产品语义/验收）。这不是 COMPLETE grace，但仍是一个早于600秒终止活跃工具的路径；可能切断测试/汇总后代且仍报告成功。建议区分“父终态+仍有活跃写者”和纯清理，不在杀过未完成工具后无条件按正常成功交接。 |
| 49 | NS:78–88,164–166；X:16–23,35–39,74–80,107–118；PROV:81 | 上游无进程组保证；本地只检查 -pid 原组，setsid/detached 脱组后代不在检查内。若它关闭 pipe 可组空后继续写且本地成功交接；若保留 pipe，父 exit 已清idle，可能一直等 close。 | U(D5/D8) 保证缺口，文档自己承认边界但承认不等于验收完成。本次未起真实进程验证，静态条件清楚。至少逐CLI受控测试真实工具后代、不能把 killpg 消失说成所有角色后代都结束；未经保证的现场应 blocked。 |
| 50 | OR:123–135,233–242；X:59–63,71–81,104–106,114–118 | 上游有确保清理/abort listener 移除；本地 onStart 在 try/finally 外调用、stdin.end也在外；若 onStart 同步抛错，进程已spawn但当前 execute 不走清理，registry仍有entry。 | U（潜在 API 缺陷，role 当前没传 onStart）。建议 spawn 后所有用户回调及输入初始化纳入同一 try/finally；不要将不可达当前主路径的风险夸为已发生交接 bug。 |
| 51 | NS:95–97；X:73–81,102,112 | 上游 spawn error 立即reject；本地记 failure 等close，随后抛原 Error；signal 保留(code可能null)，不像上游 code??0。 | O，保留信号比上游更安全。通常spawn失败会close；缺可执行项对用户可见。需要事件记录 spawn-failed，否则 role-start 无 role-end，见 #54。 |
| 52 | OR:149–158；EM:61–66；X:17–23,74–79,114–118 | 上游 observer异常隔离；本地 groupExists/signalGroup 仅吞 ESRCH，EPERM等抛错；exit事件内 groupExists不在try，finally中的检查也可能覆盖原错误。 | O/U 健壮性缺口。拒绝信号权限不能被当组不存在是正确，但异常应进入统一 unsafe/quarantine，而非未捕获回调可能结束编排、留下独立组。无需建立复杂故障平台。 |
| 53 | OR:191–209；NS:111–132；X:122–125,158 | 上游非零退出 message含provider/code及stderr→resultText→stdout末20非空行；本地 command非零用stderr/signal/code但不取stdout；role用providerError优先stderr，没有text/raw fallback，signal通常只呈现“退出 null”。 | O/U 排障和权限归因退化。保留结构错误优先合理，补限长诊断与signal字段，不把诊断变业务成果。 |
| 54 | OR:416,500,457–473；EM:16–35；X:131–132,151–158 | 上游 status显示agent started/stopped及idle/grace warning，typed事件时间；本地 role-start 在spawn之前，role-end仅execute正常resolve后，缺 attempt/pid/signal/provider 配置及错误异常路径末事件。 | O；正常结束时有duration，异常spawn/日志/termination失败时没有role-end，计时与定位不完整（D7/D8可见性）。E:333路径可关联attempt但不等于事件字段齐全。建议finally发统一terminal事件，明确启动尝试≠进程已起。 |
| 55 | NS:68–88,144–151；X:16–23,55；A:132–133 | 上游noSandbox有Windows cmd.exe路径；本地负PID组逻辑仅POSIX，入口明确拒Windows并要求Node>=22。 | O/G；本机Mac需求下合理收窄，不能宣称三CLI跨所有OS已覆盖。不得为了兼容移回shell而忽略安全/取消语义。 |

#### E. 结果契约、解析、验证、重试与恢复（56–65）

| # | 上游与本地精确位置 | 上游行为 → 本地行为 | 分类、影响与建议 |
|---|---|---|---|
| 56 | SO:119–139,154–161；S:6–27 | last complete tag扫描与可选 ```json/bare fence解包相同；本地导出辅助函数，去TS、删空行、折叠if花括号。 | R(D2/D6) 真实算法/源码提取。不是字节复制，`仅去除类型`忽略了格式压缩但没有语义改动。最后未闭合标签不会抹掉早先完整标签、嵌套标签非XML解析，这些是共同边界，不是本地新bug。 |
| 57 | SO:26–38,45–88,94–109；X:159–169；S:6–27 | 上游泛型Output.object/Output.string+自定义tag；本地固定afk-result JSON对象，无string模式、无外部definition。 | R(D6) 需要角色结构结果；具体固定封套为O，通用string/schema接口为G。不应为接口相似恢复没业务需求的框架。 |
| 58 | SO:72–87；X:164–168；E:322–345,414–436 | 上游Standard Schema可异步验证/变换，返result.value；本地JSON.parse后浅check，再engine验证tests各项、remaining、run/attempt/role、branch/realpath cwd、ticket/commits与Merger逐票布尔/summary。 | O；不能断言本地完全没有schema验证。省Standard Schema依赖合理，替代为手写多层领域验证。风险为重复检查漂移、角色模块单独调用只保证浅契约；建议集中纯验证入口，明确谁拥有最终契约。 |
| 59 | SO:8–14,52–69,75–84；X:160–168；E:335,343 | 上游抛StructuredOutputError带tag/rawMatched/cause/commits/branch/preservedWorktreePath/sessionId；本地返回failed+中文reason，无原匹配内容与机器错误code，部分第二层验证则throw。 | O，错误通道混合、诊断信息减少；原始日志仍可查。建议小型结构化诊断携带契约字段/原因/日志位置，不引入恢复账本。 |
| 60 | OR:209,547–557；SO:45–88；X:153–169 | 上游先执行成功再结构化提取；本地也只有code0且非idle/error/stop时解析，但权限blocked/failed优先会直接丢弃同时存在的业务payload。 | O/U恢复语义风险。Merger可能已实际完成summary/部分关闭，但一个错误事件让结果被整份丢弃；后续只见generic failed，容易丢失close-only进度。须把“执行异常不能passed”和“仍保留可信部分交付状态”分开设计，后者还需E/GitHub核验，不能仅信payload。 |
| 61 | RUN:59–88,842–889；X:160–169；E:330–345,354–365,402–410,505–510 | 上游可选output.maxRetries，需sessionId，可resume同会话只重发结构结果，不准改文件/命令，逐次递减，默认0；本地无结构输出纠错重试，普通failed下一批新CLI再做相应角色，Merger保留previous，Implementer/Reviewer失败没有同等纠错反馈。 | O，不能把删有限“格式纠错重试”说成规格要求（规格禁止的是总业务重试上限）。影响额外token/重复实现审查。可以不引入resume，但至少将前次契约错误带入下一次上下文；也可明确取舍不复用此通用能力。 |
| 62 | OR:355–359,575–602；X:128–169；E:455–510 | 上游有限iterations遇complete早退，agent错误通常结束该run；本地role单次执行返回状态，外层无限固定批次重选失败，1秒可中断退避，无总重试上限。 | R(D4) 业务重试/无总限；1秒退避为O。不要把API鉴权失败/权限unknown混为可重试失败（#27）；不得照搬上游max iterations。 |
| 63 | OR:406–414；RUN:59–88；P:24–26,53；E:314–320 | 上游支持!`command`预处理、skipPromptExpansion、纠错feedback；本地prompt原样stdin，业务模板+JSON context，固定afk-result提示，不执行prompt表达式。 | O/G；减少把Issue文本当shell的风险。无预处理不属于AFK缺失。来源中“上游prompt机制移植”如有泛称应收窄。 |
| 64 | RM:1–111；OR:359–375；X:31–46,153–169；E:397–410,517–523 | 上游RecoveryMessage是sync-out补丁应用失败的人类可复制git am/apply/cp/worktree命令，不是session恢复/业务账本；本地不做sandbox patch sync-out，保留本地worktree、Merger继续，没有这些恢复命令。 | G/R(D5) 删除正确。不能把没提取RecoveryMessage判“恢复能力违反规格”，也不能把它误当被禁止的持久化恢复账本。 |
| 65 | SO:72–87；OR:547–557；X:165–169；E:325–328,347–365,414–438 | 上游通用schema不认识AFK交付；本地增加run/attempt/role强绑定、票/branch/cwd、Reviewer tests passed、Merger summary/逐票状态，并通过Git/GitHub验证实际状态。 | R(D6/D4) 领域扩展，非上游源码复用。精确领域门禁应由E审计负责；本报告只确认消费者存在，未把这里几行就声称整条业务管线已验收。 |

#### 具体源码复用判定（不以概念类似冒充）

1. **确认真实提取**
   - AP:56–65 → P:61–70：`extractErrorMessage` 的分支顺序、字段访问、返回均相同；只有TS类型/注释变化。
   - SO:119–139 → S:6–21：相同open/close tag、searchFrom、indexOf、slice、lastContent算法。
   - SO:154–161 → S:23–27：相同正则与trim语义，另有格式/if折叠。
   - 本地MIT全文与 `/tmp/afk-sandcastle-full.Q1sYLq/upstream/LICENSE:1–21` 相同；本地位置 `/Users/rolex/Documents/Codes/githubProject/MyProject/rolex-skills/skills/personal/afk-issue-loop/scripts/LICENSE.sandcastle:1–21`。P/X/S头部来源+MIT引用齐全。
2. **确认有限结构改编，不是原样代码**
   - AP:71–108 → P:83–92,106–112：文本块循环/assistant/result路径保留，但切掉tool事件、加子代理过滤、换返回结构。
   - AP:557–565 → P:148–152；AP:585–606 → P:168–177：Pi delta与倒序最后assistant结构保留。guard和错误逻辑新增。
   - AP:708–719 → P:126–127：Codex类型/字段条件保留，text+result二事件压成一个texts元素。
   - 启动命令来自AP:650–653/809–813/1212–1215的CLI协议知识，但P:42–53是重新写的argv生成；`--cd`、缺省模型、stdin `-`、权限均不同，不能列作原文复制。
3. **不能确认具体源码提取，只能认定行为参考/新实现**
   - OR:147–185 → X:82–93,137–143：上游是sandbox.exec回调，Effect/事件类型派发/complete扫描；本地是readline回调再调用role闭包。可对应行为顺序，但没有可辨识的完整原函数/代码段保留。X剩余spawn/registry/killpg/timer/error/result均新写。
   - PROV:48称“移植处理顺序”、X:1称“顺序改编”尚可作为**设计来源**；若父报告以此计作“Orchestrator必要源码已提取”，证据不足。D2要求优先真实源码提取，本地只部分满足；不应强迫保留Effect来制造形式复用，但必须诚实披露重写范围与验证成本。
   - EM/TB/BT/RM均未提取。stderr slice与BT功能接近不构成BT源码复用；无需因未复用通用/UI/sync-out能力判业务违规。
4. **没有验证的内容**
   - 没有独立验证快照commit真实性、PROV所述联网获取过程、旧验收日志真实性。
   - 没有真实三CLI启动/权限/模型/进程树取消、600秒真实时间长运行、公用CLI完整Ticket交付验收。读上游Vitest mock测试不能替代这些。

#### 测试对应、覆盖与证据强度

##### 全文读过的上游直接相关测试

| 精确绝对路径 | 全文覆盖 | 主要对照断言 |
|---|---|---|
| `/tmp/afk-sandcastle-full.Q1sYLq/upstream/src/AgentProvider.test.ts` | 1–2588 | Claude 22–324：stdin/model/effort/env/permission/session/fork；Pi330–645：delta/tools/errors/最后assistant/session/thinking；Codex651–1013：stdin/resume/fork/auto-review/text+result/usage/errors；额外CLI1019–1958；usage1960–2067；capture2069–2107；sessionStorage2113–2588。均阅读，并按AFK范围区分保留/删除而非只找bug。 |
| `/tmp/afk-sandcastle-full.Q1sYLq/upstream/src/Orchestrator.test.ts` | 1–4127 | 基础迭代/结果200–813；Claude parser815–1029；tool/stream emitter1031–1369（1217吞观察器异常、1278所有raw行）；错误1371–1757（1415 raw fallback、1607 stdout尾诊断、1656 resultText fallback）；stream/prompt1759–2109；display/idle2111–2662（2335静默、2377重置、2443未知行、2503warn）；Pi2664–2973；Codex2975–3142；session3144–3715；AbortSignal3717–3868；completion grace3870–4127。 |
| `/tmp/afk-sandcastle-full.Q1sYLq/upstream/src/extractStructuredOutput.test.ts` | 1–362 | 59单标签，66最后匹配，77/90 fence，110缺标，127坏JSON，143schema失败，173/188错误上下文，222异步schema，243–285 string，291–343错误对象，349–362Output定义。 |
| `/tmp/afk-sandcastle-full.Q1sYLq/upstream/src/TextDeltaBuffer.test.ts` | 1–183 | 换行/句边界/80字/50ms debounce/reset/flush/dispose/empty。 |
| `/tmp/afk-sandcastle-full.Q1sYLq/upstream/src/boundedTail.test.ts` | 1–61 | 空tail、分隔符预算、10000条push、超大单chunk、默认65536。 |
| `/tmp/afk-sandcastle-full.Q1sYLq/upstream/src/RecoveryMessage.test.ts` | 1–224 | commits/diff/untracked失败及剩余步骤，branch worktree前导和相对patch路径。 |
| `/tmp/afk-sandcastle-full.Q1sYLq/upstream/src/sandboxes/no-sandbox.test.ts` | 1–213 | 本机输出/退出/cwd/env/Windows分支，155–201流式stdout/stderr限长；203 close no-op。**没有证明取消后后代结束的测试**。 |

- 没有单独 `AgentStreamEmitter.test.ts`；相关断言在上表 Orchestrator.test.ts:1132–1369，已经全文读取。
- `/tmp/afk-sandcastle-full.Q1sYLq/upstream/src/run.test.ts:966–1505` 完整阅读该连续区间：结构输出入口、sessionId错误上下文、maxRetries条件/非法值、feedback、resume纠错/耗尽/默认0。文件其他区间只做标题搜索，**未宣称全文读过run.test.ts**。
- 在本地 `skills/personal/afk-issue-loop/scripts` 未发现专用测试文件；规格明确“不新增专门runner test脚本”，因此不能用仓库没有test文件直接判不合格。验收证据应来自明确可复核公共入口fixture/真实运行记录，本子审计没有核验所有实施记录。
- 上游tests验证的是固定版本行为，不是本地改编正确性。尤其所有hang/abort的Effect mock测试，不验证真实killpg或CLI detached工具；删除grace以后不能把上游grace通过当本地取消通过。

##### 本次实际运行的纯函数探针

仅 `node --input-type=module` import 本地 P/S；没有spawn角色、写仓库或写fixture。

1. `{bad` → `claude JSON 流行格式损坏`。
2. 带前导空格的合法Claude result → 正常texts，体现相对上游扩展。
3. Pi `message_end`、assistant `stopReason: aborted` → 普通error，没有stopped标记。
4. 普通stdout `permission denied` → texts空，无error/permissionDenied。
5. Codex failed command output `test expected EPERM but got OK` → permissionDenied=true（误分类的可复现输入）。
6. 一个含passed封套的Claude result，随后另一个无封套的result；按X同样累加后findLastTagContent仍取旧passed。这只证明结果选择边界，不是已证明真实CLI必然产生该序列。

#### 已读源码覆盖（明确不夸大）

##### 全文

- P:1–199；X:1–171；S:1–27。
- AP:1–1267；OR:1–604；SO:1–161；EM:1–69；TB:1–73；BT:1–69；RM:1–111。
- NS:1–171。
- PROV:1–81。
- 上游与本地MIT各1–21。
- 规格JSON完整body/title/comments（文件第1行）。

##### 为避免错误归因而补读的连续片段

- RUN:1–230（stdin/结构纠错反馈/日志命名/接口）、261–317（raw sink）、812–894（resume/fork/结构输出重试）；其余仅定点rg检索行号，不称全文。
- E:220–524（选批、现场、完整结果契约和消费者、角色管线、Merger、失败重试/cleanup）；E:1–219未全文读，本报告不独立裁定整个engine。
- A:55–144（控制/停止/结果/入口平台和日志位置）；A其余不在本子任务全文范围。

#### 建议优先级（不修改，仅供后续裁决）

1. **先解决/验证取消与完成边界**：脱组后代、父exit立即清理后还能passed、signal/user aborted归类；用受控fixture经公开入口验证，再做获授权的三CLI取消测试。
2. **修结果选择与错误归因**：保留final snapshot语义，区分可恢复/终端错误，避免陈旧封套通过；补raw诊断tail但不混入业务结果；权限匹配附来源证据。
3. **完善异常路径记录与安全清理**：所有spawn后初始化放入保证cleanup范围；terminal event包含失败/信号/attempt/时长；kill检查异常进入unsafe而不是未捕获回调。
4. **来源声明收窄**：真正提取的三个helper与解析结构明确列出；Processes标为重写监管层，只参考上游顺序。不要为了提高“复用比例”引入与AFK无关session搬运、UI、RecoveryMessage或Effect框架。

总计65项行为/结构对照，包含合理适配、通用能力删减、共同边界和条件性风险；不是65个bugs。最终接受与否必须结合D2真实复用要求和T公开入口验收，不以概念相似或单CLI短冒烟代替。


## 附录二：角色正文 / Prompt 处理链逐项原始审计

以下保留逐角色全部条目、动态参数/命令/编码/上下文差异与测试证据。历史不完整快照不再作为上游缺文件依据；当前四MD真正在运行中读取，但不是上游完整promptFile机制。

### AFK / Sandcastle 提示词只读源码审计

#### 0. 范围、证据等级与结论

审计日期：2026-09-12。只读现有实现、固定上游归档和测试源码；未改实现、未启动角色、未操作业务 Issues、未派代理。唯一交付写入为本临时报告。

**结论**：本地恢复了运行时真实读取的四份 Markdown，角色业务内容是可追溯的中文改编及 AFK 边界增强；但 `engine.mjs` 的模板加载/`prompt()` **没有提取或复用** `PromptResolver` → `PromptArgumentSubstitution` → `PromptPreprocessor` 的源码或行为。它是“固定正文快照 + 配置文字 + JSON 上下文”的新实现。确有原函数级提取的是结果解析中的 `findLastTagContent`、`unwrapFences`，不能把该事实外推到 promptFile 机制。

关键区别：

1. 上游最近十条提交、Reviewer diff/log 是**角色启动前代码自动展开**；本地改为**角色启动后自行读取的自然语言指令**。目的相似，执行保证、失败时点、token/idle 归属均不同。
2. 上游 `@.sandcastle/CODING_STANDARDS.md` **不是这三个 Prompt 模块实现的递归文件包含**。上游模板将该引用交给 agent；测试只锁定文件存在和引用文本，不能据此声称 SDK 自动内联文件内容。
3. 删除 LLM planner、Docker、硬编码模型、固定总轮数、COMPLETE grace、改为 GitHub/Worktrunk/中文 summary/逐票结构化结果，均有明确规格依据。
4. 去掉通用 promptArgs API 等不自动构成 AFK 缺陷；但把本模板已使用的预注入 Git 上下文改为 agent 临场补读，是**非规格必需的行为偏离**，不能以“只移除 Docker”或“MD 恢复”解释为原机制复用。
5. 本地 reviewer 仍覆盖上游绝大多数审查清单；没有根据可以声称整份审查标准丢失。明确删除的是独立 CODING_STANDARDS 路径约定，且其上游默认内容只是注释示例。

分类：

- **A 明确适配**：Issue #7 或提供的用户/项目约束明确要求的变化。
- **O 可选改动**：兼容目标但不是规格唯一要求的设计选择，应如实说明。
- **D 无依据偏离/缺口**：改变上游已用行为，规格没有要求，现有理由不能证明为必要适配；不等于一律必须恢复，也不等于已证明运行失败。
- **N 非目标通用能力**：Sandcastle 通用库能力，不应因 AFK 没有完整移植而直接记为功能缺陷。
- **= 保留**：职责/算法语义保留；若传输/时机不同另行指出，不作字节原样复制声明。

#### 1. 路径与行号索引

下文简写均对应以下**绝对路径**，`Lx–y` 为文件真实物理行号，不是本报告行号。

##### 本地

- `L/C` = `/Users/rolex/Documents/Codes/githubProject/MyProject/rolex-skills/skills/personal/afk-issue-loop/reference/common-prompt.md`
- `L/I` = `/Users/rolex/Documents/Codes/githubProject/MyProject/rolex-skills/skills/personal/afk-issue-loop/reference/implementer-prompt.md`
- `L/R` = `/Users/rolex/Documents/Codes/githubProject/MyProject/rolex-skills/skills/personal/afk-issue-loop/reference/reviewer-prompt.md`
- `L/M` = `/Users/rolex/Documents/Codes/githubProject/MyProject/rolex-skills/skills/personal/afk-issue-loop/reference/merger-prompt.md`
- `L/E` = `/Users/rolex/Documents/Codes/githubProject/MyProject/rolex-skills/skills/personal/afk-issue-loop/scripts/engine.mjs`
- `L/P` = `/Users/rolex/Documents/Codes/githubProject/MyProject/rolex-skills/skills/personal/afk-issue-loop/scripts/providers.mjs`
- `L/X` = `/Users/rolex/Documents/Codes/githubProject/MyProject/rolex-skills/skills/personal/afk-issue-loop/scripts/processes.mjs`
- `L/S` = `/Users/rolex/Documents/Codes/githubProject/MyProject/rolex-skills/skills/personal/afk-issue-loop/scripts/structured-output.mjs`
- `L/Notes` = `/Users/rolex/Documents/Codes/githubProject/MyProject/rolex-skills/docs/plans/afk-role-prompt-files-implementation-notes.md`
- `L/Source` = `/Users/rolex/Documents/Codes/githubProject/MyProject/rolex-skills/docs/research/afk-local-cli-source-provenance.md`

##### 上游，全部相对同一固定目录

前缀 `U/` = `/tmp/afk-sandcastle-full.Q1sYLq/upstream/`。

- `U/I` = `U/src/templates/parallel-planner-with-review/implement-prompt.md`
- `U/R` = `U/src/templates/parallel-planner-with-review/review-prompt.md`
- `U/M` = `U/src/templates/parallel-planner-with-review/merge-prompt.md`
- `U/Plan` = `U/src/templates/parallel-planner-with-review/plan-prompt.md`
- `U/Standards` = `U/src/templates/parallel-planner-with-review/CODING_STANDARDS.md`
- `U/Main` = `U/src/templates/parallel-planner-with-review/main.mts`
- 其他 `U/src/<文件>` 直接按此前缀展开。

规格：`/tmp/afk-sandcastle-audit-issue7.json`。JSON 的整个 `body` 在物理 **L1**，所以引用以 `L1 → Implementation Decisions §编号/小节` 表示，不虚构解码正文的文件行号。简称 `Spec §1` 至 `§8` 对应该八个 Implementation Decisions；Testing Decisions、Out of Scope 直接按节名引用。

#### 2. 源码真实性及复用声明边界

##### 2.1 固定归档核对

提供目录无 `.git`，`git rev-parse HEAD` 不能验证 commit。未擅自改用 main/latest，也未联网补查。现有 `/tmp/afk-sandcastle-full.Q1sYLq/upstream.tar.gz` 的顶层目录是 `mattpocock-sandcastle-e99f832`。

本次用 `tar -xOzf` 只读提取、Node Buffer 字节比较，以下 **18 文件全部 MATCH**：

- 模板目录全部 7 文件：五份 MD（含 CODING_STANDARDS）、`main.mts`、`template.json`。
- `PromptResolver.ts`、`PromptPreprocessor.ts`、`PromptArgumentSubstitution.ts`，以及对应全部三份 `.test.ts`。
- `run.ts`、`createSandbox.ts`、`Orchestrator.ts`、`InitService.ts`、`extractStructuredOutput.ts`。

因此可确认本报告核心源码等同现有固定归档；完整 40 位 commit 来源仍以用户指定归档为准，**未独立作远端签名/commit 真实性认证**。这里的字节检查是审计取证，不是给产品新增哈希交接协议。

##### 2.2 能成立与不能成立的声明

| 对象 | 可确认事实 | 定性 |
|---|---|---|
| 四份本地 MD | `L/E:78–85` 真实读取并保存；`314–320` 真实拼入输入；`L/X:129–135,105` 经 stdin 交 CLI | 不是死文档；“运行用 MD 已恢复”成立 |
| promptFile 管线 | 上游有来源判别、占位符、内建键、命令标记、sandbox 预展开；本地均未调用/提取，`L/E:315` 明确声明不执行表达式 | 新加载/拼接实现，不是 PromptResolver/Preprocessor 复用 |
| 角色正文 | Reviewer 列表及 I/M 步骤有逐项语义对应，但全部重新组织、翻译、加入边界 | 内容改编，不是原文复制 |
| 批次接线 | `U/Main:114–162` 和 `L/E:354–366,488` 都是逐票 I→R / allSettled；状态及门禁大幅扩展 | 控制流适配；本报告不把整个 engine 宣称直接提取 |
| 结果纯函数 | `L/S:6–21` 对应 `U/src/extractStructuredOutput.ts:119–139`；`L/S:23–27` 对应上游 `154–161`，去 TS/调整形式后算法一致 | 真实函数级源码提取 |
| schema 验证 | 上游 Standard Schema `extractStructuredOutput.ts:72–87`；本地手工条件 `L/X:164–168`、`L/E:322–345,414–436` | 本地扩展/重写，不是完整上游输出模块提取 |

`L/Notes:10` 所谓“指定快照中 PromptResolver/PromptPreprocessor 不存在”描述的是当时不完整材料；当前全量归档明确存在两个文件，不能把该旧记录用作上游无此能力的结论。`L/Notes:28` 已承认“不复用 Sandcastle API 或预处理实现；只适配文件与参数分离”，这句话与当前源码一致，应优先采用，不应扩大成“promptFile 恢复”。`L/Source:47–53` 对纯函数提取/控制流改编的界限也比“整库复用”准确。

#### 3. 逐角色内容变化清单

##### 3.1 新 common（上游没有对应 common-prompt.md）

上游不是把这些边界集中在公共 MD；不能寻找一份不存在的上游 common 再声称逐段复制。

| 项 | 上游对应 | 本地 | 变化与类别 |
|---|---|---|---|
| C01 执行身份 | `U/Main:73–87,125–147,208–221` 各 run/角色；另有 LLM planner | `L/C:3` | 独立 CLI 执行者、不是调度者；A，Spec §1/§6 |
| C02 范围/不可信需求内容 | `U/I:5–7,62` 单任务；无 Ticket 内容不得改运行边界规则 | `L/C:3` | 限 context，Ticket/评论/SPEC 仅需求上下文；固定范围 A，注入防护措辞 O |
| C03 SPEC | `U/I:5` 拉父 PRD；没有统一只读/不关父项规则 | `L/C:3`、`L/M:22` | SPEC 不作为交付票、不关闭；A，Spec §3/§4 |
| C04 目录/写者 | `U/Main:116–121,139–147` 共享 sandbox/branch，无绝对 cwd prompt 契约 | `L/C:7` | 写前核对 repo/cwd/branch，所有动作定位 cwd；相关写入结束再交接；A，Spec §1/§5/§7 |
| C05 失败进度 | `U/Plan:25` 确定分支保累积进度 | `L/C:8` | 明确保留 dirty/历史 commits，未知归属报告；A，Spec §5 |
| C06 暂存规则 | `U/I:42–50` 仅 commit 要求，无逐路径暂存 | `L/C:9` | 禁 `git add -A/.`、禁提交日志；逐路径规则 O；日志不入交付与权限/现场边界兼容 |
| C07 禁额外调度 | `U/Main` 本来脚本编排，但模板无禁原生 Agent/dynamic workflow | `L/C:10` | 禁原生 Agent/另起调度；A（Spec §1）；禁 dynamic workflow 来自提供的用户规则 |
| C08 本机边界 | 上游 Docker，模板 `hooks npm install`（`U/Main:46–55`） | `L/C:10` | 禁 push/PR/fetch/pull/改目标/worktree/全局 Git/越权；A，Spec §2/§3/§5/§8；worktree 操作由脚本持有 |
| C09 读失败/权限/停止 | 上游各角色模板无统一规定 | `L/C:11` | 原授权重试、未知不当空列表、拒绝 blocked、停止不绕过；A，Spec §3/§5/§6 |
| C10 验证 | `U/I:38`、`U/R:50`、`U/M:11` 固定测试/类型检查 | `L/C:15` | config 注入、缺省读项目规范、适用测试/构建/检查、必要时具体人工检查；项目验证 A（Spec §1/§4），人工替代及格式 O；代码再变重验 =/细化 |
| C11 close-only 例外 | 上游没有 | `L/C:15` | 已完成交付只补关闭，不重验；A，Spec §4 |
| C12 提交/失败评论 | `U/I:44–50` RALPH+任务/PRD/决策/文件/阻碍；`54` 未完成评论 | `L/C:17` | 改项目规范/中文 Conventional；中文 summary A，普通角色 commit 格式另有用户/项目依据；未完成评论语义 =，新增“权限允许/失败如实报告” A |
| C13 结果事实 | I/R/M 都以 COMPLETE 收尾（`U/I:58`,`U/R:55`,`U/M:26`） | `L/C:17` | 结构化成果/测试/remaining/目录分支，正常返回不代表业务成功；A，Spec §6 |

##### 3.2 Implementer

| 项 | 上游 | 本地 | 变化与类别 |
|---|---|---|---|
| I01 任务绑定 | `U/I:3,7,9,62`，`{{TASK_ID}}/{{ISSUE_TITLE}}/{{BRANCH}}` | `L/I:3,13,21`；`L/E:355` | 单票/指定分支职责 =；参数由就地替换改 context；绝对现场及禁止跨角色 A |
| I02 获取需求 | `U/I:5` 执行 VIEW_TASK_COMMAND，父 PRD 也拉取 | `L/I:7`，`L/E:110–128,156–170` | 引擎预读 Ticket/评论/显式 specs，角色不足再 gh 补读；A 角色有明确输入，O 预读实现。没有自动发现所有父 SPEC 的引擎代码；显式 specs 才预注入，父关系不足由角色补读 |
| I03 最近提交 | `U/I:13–19` 自动运行 `git log -n 10 --format="%H%n%ad%n%B---" --date=short`，附 recent-commits 标签 | `L/I:7` 仅“读取最近 10 个 commits” | 删除预注入、标签、hash/date/full body 格式；保留阅读意图。D：去 Docker 不要求去掉此能力；本地没有等效启动前采集 |
| I04 探索 | `U/I:23` “fill your context window” | `L/I:7,9` 相关代码、验收/现有行为、缺业务决定 | 探索职责 =；去“填满上下文窗口” O（更克制），新增明确完成条件 O |
| I05 测试关注 | `U/I:25` 重点相关测试 | `L/I:7,9` | = |
| I06 RGR | `U/I:29–34` RED 单测试/GREEN/REPEAT/REFACTOR | `L/I:13` | 保留适用时 RGR 及循环，压缩成一段；=，非整段删除 |
| I07 验证命令 | `U/I:38` commit 前 npm typecheck/test | `L/I:13,15` + `L/C:15` | 改项目验证，A；不再保证固定两条 npm 命令（不能把针对 Node 模板的命令当通用 AFK 必须） |
| I08 commit 内容契约 | `U/I:42–50` RALPH、PRD reference、决策、文件、阻碍、简洁 | `L/C:17`、`L/I:19` | RALPH 替换有本地规范依据；**决策/改动文件/PRD reference 必须在 commit message 内出现**不再硬性要求，改摘要/剩余问题：O，非 Spec 必须删除 |
| I09 历史成果门禁 | 模板只说 make commit；`U/Main:137–157` 当前 run commits | `L/I:3,7,13–15,19` | 接受整个分支历史未交付成果、不要求本轮新增、无成果不造空提交、clean；A，Spec §4/§5 |
| I10 未完成评论 | `U/I:54` | `L/C:17` | 迁入 common，=，并非丢失 |
| I11 不关闭 | `U/I:56` | `L/I:21` | =；新增不 merge、不 summary、不自行 Reviewer，A 职责界限 |
| I12 收尾 | `U/I:58` COMPLETE | `L/I:19–21`、`L/E:309–320` | afk-result/写者退出后独立 Reviewer，A；不是 COMPLETE 改名即成功 |

##### 3.3 Reviewer

| 项 | 上游 | 本地 | 变化与类别 |
|---|---|---|---|
| R01 独立接力 | `U/Main:139–147` 同 sandbox 新 run | `L/R:3`；`L/E:362` | 同票现场新独立角色 =/A；新增 previous 实现结果及明确写者终止边界 A |
| R02 自动 diff | `U/R:7–9` 预展开 `git diff {{TARGET_BRANCH}}...{{BRANCH}}` | `L/R:7` 让角色运行 `git diff <target>...<branch>` | 保留三点 diff，删除**代码自动预注入**；D（同 I03） |
| R03 自动 log | `U/R:11–13` 预展开 `git log {{TARGET_BRANCH}}..{{BRANCH}} --oneline` | `L/R:7` 同算法自然语言指令 | 两点 log =；时机/保证改变 D；没有改成错误 SOURCE_BRANCH 自 diff |
| R04 理解意图 | `U/R:17` 读上述 diff/commits | `L/R:7–9` Ticket、parent、规范、完整未交付 diff/commits | =；显式验收上下文增强 A/O；历史分支完整范围 A |
| R05 可维护性全部清单 | `U/R:19–26` 复杂/嵌套、冗余、命名、整合、显而易见注释、嵌套三元、清晰胜紧凑 | `L/R:15` | **七类意图全部保留**，压缩为一条；仅不再写“prefer switch or if/else”具体替代语句，O |
| R06 正确性 | `U/R:28–32` intent/edge/tests/unsafe casts/any/unchecked/security | `L/R:16–17` | intent/边界/测试/类型/假设/安全 =；新增错误处理、相邻接口 O；unsafe casts、any 专名泛化为“类型”，细度减少 O，不等于删除类型检查 |
| R07 平衡 | `U/R:34–39` clarity/clever/many concerns/helpful abstractions/debug/extend | `L/R:18` | 保留有用抽象、避免职责混杂/巧妙难调试，清晰/维护项已在15；“extend”不再单列，O 压缩 |
| R08 编码规范文件 | `U/R:41` `@.sandcastle/CODING_STANDARDS.md` | `L/R:7,20` 项目规范，`L/C:3,15,17` | 删固定专用文件路径与 reviewer-only token 约定，改沿用本机项目说明；A 方向（Spec §6），O 具体删除，不可声称该文件字节仍被加载 |
| R09 功能保持冲突修正 | `U/R:3,43` “preserving exact functionality / Never change what code does” | `L/R:18` 保留**预期**行为，按验收修行为错误 | 不只是文字翻译；允许改错行为，A，Spec §4 Reviewer 直接修复测试提交 |
| R10 直接改代码 | `U/R:47–51` 分支直接改/测试类型检查/commit | `L/R:20–22` | =；独立审查不退回实现者 A；代码再变重验 =/增强 |
| R11 无需新提交 | `U/R:53` clean 则 do nothing | `L/R:20` 合格无需新 commit，但列全分支摘要 | =；仍要审查/验证/返回；A 强化可检查成果，不允许用“do nothing”跳过验证 |
| R12 失败处理 | 上游模板无 pass/fail 输出字段，`U/Main:175–182` fulfilled+commits | `L/R:22,26`；`L/E:363–365` | 失败不得只交实现部分；显式 passed + tests + deliverable 门禁，A，Spec §4 |
| R13 收尾 | `U/R:55` COMPLETE | `L/R:26–28` | afk-result，禁止 merge/close/summary/调度，退出后交接，A |

##### 3.4 Merger

| 项 | 上游 | 本地 | 变化与类别 |
|---|---|---|---|
| M01 输入和写者 | `U/M:3–5` branches → current branch；`U/Main:208–220` | `L/M:3,7`；`L/E:402` | 明确 target cwd、固定 items/tickets/order、mode/batch/previous；唯一写者；A，Spec §1/§4 |
| M02 原批身份 | 上游每外轮一个 Merger，没有续作 phase | `L/M:7,10` | 原批延期仍同 summary，不混后批；A（不重复 summary/续作）及 O（具体分组设计） |
| M03 close-only | 上游无 | `L/M:9` | 只 GitHub 补评论/关闭，不代码/merge/test/summary，沿用 subject；A，Spec §4 |
| M04 未完成合并恢复 | 上游无 previous/merge phase | `L/M:10,16` | 先处理归属进度，读历史防重复 summary，失败现场不 reset/abort 掩盖；A，Spec §4/§5 |
| M05 merge 命令 | `U/M:7–9` `git merge <branch> --no-edit` | `L/M:14` | 命令 =；明确不 squash、已合入不重复，O/A（续作不重做） |
| M06 冲突 | `U/M:10` 读双方智能解决 | `L/M:16` | = |
| M07 每分支验证 | `U/M:11–12` 解决冲突后 npm 两命令，失败修好再下一分支 | `L/M:16`、`L/C:15` | 失败先修语义 =；每次按项目验证强化 A（Spec §4），固定 npm 改通用项目验证 A |
| M08 summary | `U/M:14` 所有分支合并后一个总结 commit | `L/M:18` | 保留单 summary =；中文 Conventional、clean/验证通过、可 allow-empty、不能提前关票，A |
| M09 “everything you can” | `U/M:26` 尽可能合并后 COMPLETE | `L/M:18` 强调所有给定分支，失败 summary=false/null | A 防止半交付冒充完成；但“所有给定”比 Spec §4“全部可处理分支”措辞更严格，不能单凭 prompt 确认 blocked 分支是否会使整个原批长期不 summary，需调度分组专项核验 |
| M10 关票命令 | `U/M:18–24` CLOSE_TASK_COMMAND + issue markdown 列表 | `L/M:22` | 明确 gh、--repo、target、实际验证 comment、只仍 OPEN 指定 tickets、不关 SPEC；A，Spec §3/§4 |
| M11 一票关闭失败 | 上游模板无继续其他票/close-only规则 | `L/M:24` | 独立继续、待关闭、拒绝 blocked 不越权；A |
| M12 关票执行方/时机 | `U/M:16–26` 合并后 agent 关闭 | `L/M:22–26` | agent 自己关 =；summary/验证后且返回前明示 A；不交脚本代关 |
| M13 收尾 | `U/M:26` COMPLETE | `L/M:30–32`、`L/E:312,414–438` | 逐票 merged/verified/closed + summaryCreated/subject + tests/remaining，实际退出再下一批；A |
| M14 worktree | 上游关闭 sandbox 由脚本（`U/Main:158–160`），无 merger prompt 保留指令 | `L/M:32` | 不清理现场，由脚本生命周期；A，Spec §5 |

##### 3.5 删除 Planner 与 CODING_STANDARDS 的准确含义

| 项 | 上游 | 本地替代/无对应 | 分类 |
|---|---|---|---|
| P01 issue 列表预注入 | `U/Plan:3–11` `!\`{{LIST_TASKS_COMMAND}}\`` 包 issues-json | `L/E:130–150,156–170` 固定初始范围/API刷新 | A，Spec §3；不再 planner token |
| P02 LLM 依赖图 | `U/Plan:15–23` 代码/基础设施、重叠文件、决策/API 依赖 | `L/E:168–170,227–239` 原生 blocked_by/确定排序 | A，Spec §1/§3；不会再由 LLM 因重叠文件新增依赖，这是明确适配，不是漏 planner |
| P03 deterministic branch | `U/Plan:25` `sandcastle/issue-{id}` | `L/E:286` `afk/issue-${number}` | 确定性和历史保留 =；前缀改名 O，产品适配合理 |
| P04 plan 输出 | `U/Plan:29–37` `<plan>` JSON、空计划退出、全阻塞单候选 | `L/E:227–239,467–488` 代码选批，无 plan role | LLM/schema 移除 A；最多4/单票即开/内部 fallback A；具体排序需调度专项，不在本报告认定整个选批实现正确 |
| S01 专用规范默认内容 | `U/Standards:1–27` Customize、Style/Testing/Architecture 及注释示例 | 无本地同名文件；`L/R:7,20`、`L/C:15,17` 项目说明 | O/A 适配；不能把注释示例当所有项目强制 camelCase/public function test/composition 规则 |
| S02 reviewer-only 规范 token | `U/Standards:3–5` 只 reviewer 加载，不耗 implement token | `L/C` 对所有角色注入；各角色自行读项目规范 | O；成本/上下文隔离策略改变，未保留上游 reviewer-only 文件机制 |

#### 4. 动态参数、命令、文件包含、编码及时机

##### 4.1 上游完整接线（不是单看 MD）

1. **初始化生成期**：`U/src/InitService.ts:875–910` 在 scaffold 文本文件中按 issue tracker 的 `templateArgs` 替换 `{{KEY}}`；`1087–1090` 先替换再处理标签。GitHub 默认 `LIST_TASKS_COMMAND / VIEW_TASK_COMMAND / CLOSE_TASK_COMMAND` 在 `535–537`，Beads 在 `549–551`。它们不是 `run()` 的内建 branch 参数。
2. **每次 run 加载期**：`U/src/run.ts:596–603` 调 `resolvePrompt`，`PromptResolver.ts:28–60` 对 inline/file 二选一、缺失报错、读文件返回 `source`。文件路径按发起进程 cwd 而非目标 repo cwd（`run.ts:350–355`）。I/R 用的是 `sandbox.run`，对应 `createSandbox.ts:367–402`，不能只检查顶层 run。
3. **运行参数替换期**：`run.ts:713–734` 和 `createSandbox.ts:383–402` 将 SOURCE_BRANCH/TARGET_BRANCH + 用户 args 送 substitute。inline 不替换，且禁止非空 promptArgs。`TARGET_BRANCH` 来源是宿主当前 branch（`run.ts:628–639`、`createSandbox.ts:375–393`），不是固定 main。
4. **角色每 iteration 启动前**：`Orchestrator.ts:406–414` 在已取得 sandbox 的 repo cwd 中做 `preprocessPrompt`；它处于 iteration 体内，故实现者上游100次运行可以每 iteration 重算 git log，不是整个任务只展开一次。
5. **交给 provider**：`Orchestrator.ts:140–147,187–188` buildPrintCommand + stdin；Claude/Pi/Codex 分别 `AgentProvider.ts:1212–1215,650–653,809–813` 都有 `stdin: prompt`。这里没有“提示词先 base64 编码”链路。
6. **结果阶段**：`run.ts:842–860` 在 orchestration 完成后提取 output；模板只有 Planner 配置 Output.object（`U/Main:83–86`），I/R/M 没配业务 JSON schema。

##### 4.2 本地完整接线

1. `L/E:77–85`：按 `import.meta.url` 定位 skill 内四个固定文件，`readFileSync(path,'utf8')`；缺失/读失败/纯空白即启动失败；此时尚未 `--version`/GitHub/auth 等外部命令（86–88）。四份全加载，即便初始无角色工作或最终无需 Merger 也要求文件都有效。
2. 每个独立编排 run 固定 `templates` 快照；没有每次角色派发重新读模板，不支持运行中修改 MD 影响下一票。
3. `L/E:314–320`：公共正文原样 + 对应角色正文原样 + 可选 verify 文字 + 固定输出要求 + `JSON.stringify({contract,context,repository,target,specs},null,2)`。
4. `L/E:330–334`：每次派发赋 `run/attempt/role`，生成上下文和 prompt，送 `processes.role`。
5. `L/P:24–54`：构 argv，`input:prompt`；`L/X:55,105,129–136` 本地 cwd、继承 process.env、pipe stdin，随后关闭 stdin。未以 shell 执行 prompt；没有 shell:true。
6. 角色自己执行最近提交/diff/log/项目规范读取；其执行输出属于角色 stdout/600秒 idle，而非引擎 prompt 预处理任务。

##### 4.3 逐项差异矩阵

| 维度 | 上游精确证据 | 本地精确证据 | 结论/分类 |
|---|---|---|---|
| inline 与模板区分 | `PromptResolver.ts:13–20,28–60` | `L/E:78–85,314–320` | 本地只有固定文件正文组合，没有 source 枚举/二选一 API；N 通用 API，D 若声称原 promptFile 机制复用 |
| 路径基准 | `run.ts:350–355`；`PromptResolver.ts:51` | `L/E:79` | caller cwd → skill 模块 URL；A skill 自带/宿主 cwd 无关，Spec §2 |
| 读文件方式 | 上游 Effect FileSystem readFileString；`PromptResolver.ts:49–60` | 同步 Node utf8 `L/E:81` | O 去 Effect 依赖适配，不是直接拷贝原函数 |
| 空文件/白名单 | Resolver 不 trim/nonempty，接受已提供空字符串 `36–37`；文件无非空检查 | 四名固定/trim检测 `L/E:78,83` | O 启动期 fail-fast 更严 |
| 正文保留 | 上游进入替换/命令输出替换后才交 agent | `L/E:316` 文件字串完整拼接 | 本地原始 MD 保留更字面，但失去上游动态模板语义；不是“更原样所以复用” |
| 模板加载时机 | 每个 `run`/`sandbox.run` 分别 resolve | `L/E:78–85` 一次快照 | O；热改模板下一角色是否生效不同 |
| 用户参数类型 | `PromptArgumentSubstitution.ts:13,150–153` scalar.toString | `L/E:320` 任意上下文对象 JSON | O 新数据模型；数字/布尔保 JSON 原类型，数组/嵌套对象新增 |
| 占位符语法 | `PromptArgumentSubstitution.ts:24` 大小写/下划线/数字，支持括号内空白 | `L/E:315–320` 没有扫描 | N 若不提供兼容 API；对旧 MD 原样搬入会漏替换，D 兼容/复用声明 |
| 缺参数/空值 | 上游 `118–136` missing/null/undefined fail | 无通用输入 key 验证；固定 code 构 context | N 通用模板校验未实现；不能声称同等 fail-fast |
| 多余参数/内建键 | 上游 `139–147` warn；`47–60` 禁覆盖；run 注入 builtins | 本地无该机制；context 最后由 runRole 赋身份 `L/E:332` | N；运行身份匹配是新的业务保证，不是内建 branch API |
| 单次替换安全性 | 上游 `95–105,150–153` 先标记原模板 shell，单次 replace；值不递归扫描 | 本地 JSON 序列化且不扫描 | 两者都不会把参数中后出现的 `{{...}}` 再递归替换；不能声称必须删预处理才能保持 issue 中字面占位符 |
| 命令标记来源 | `PromptPreprocessor.ts:16–21` `\x01`；substitute `95–105` 清原输入/args伪造标记 | 无标记/无命令识别 `L/E:315` | N 安全机制不需要原样移植到无展开实现；但上游已有防参数中新命令块执行的机制 |
| 模板命令插参 | 上游原模板 `!\`cmd {{KEY}}\`` 会插参再执行；没有通用 shell 参数转义（substitute `151–153`） | JSON 数据不交 shell | O 本地缩小代码级攻击面；上游来源标记不是任意 shell 参数安全转义，应避免夸大其安全性 |
| 执行位置 | `PromptPreprocessor.ts:48–49` sandbox.exec(command,{cwd})；Orchestrator `410–414` sandboxRepoDir | agent 执行任务工具；`L/I:7`,`L/R:7`；CLI cwd `L/X:134` | A sandbox → 本地目录；**D 自动采集 → agent 自行采集**是另一变化，不是前者必然结果 |
| 命令并发 | `PromptPreprocessor.ts:42–79` concurrency unbounded | 无预处理命令 | N 并发通用能力；Reviewer 两命令自动并发不再保证 |
| 命令失败/超时 | 上游 `7,51–74` 每表达式30秒，nonzero携stderr报错，角色尚未启动 | 本地无采集门禁，角色读失败按 common 报告；角色600秒idle | D 原模板上下文可得性保证改变；30秒预处理 timeout **不属于**角色总时长限制，不能以规格禁角色固定时长为由认定它必须删除 |
| 命令输出变换 | `PromptPreprocessor.ts:75,81–98` trimEnd/token估算/逆序按位置替换 | 无对应 | N；git上下文文本格式与token可见性实际改变 |
| `@file` | `U/R:41` 字面引用；三 Prompt 模块无解析/读 include 实现 | `L/R:7,20` 泛化项目规范，common真实读入 | 上游并无已验证 SDK 递归文件包含；本地 common 是显式文件组合而非 `@` 解析复用 |
| 编码/转义 | upstream 直接字符串→stdin，无 JSON wrapper 必需；替换无通用HTML/shell编码 | UTF-8读文件，JSON转义 context 的换行/引号/控制符；正文+verify不JSON包裹 | O；`${x}`、`$(x)`、反引号/花括号在需求值不会被 JS 再执行；JSON不是LLM指令安全隔离 |
| 输入长度 | 上游 git diff 可大，插入正文；角色stdin无此处截断机制 | 全 issue API 对象+comments+specs+previous+contract，`JSON.stringify` 无截断/预算 | O 新成本；未发现代码层截断防上下文溢出。不能保证 CLI/model 一定能接受任意长上下文 |
| 结果契约可编辑性 | 上游 promptFile 自身包含 COMPLETE/plan 输出要求 | 本地角色文件写“按注入契约”，真正字段/平铺要求在 `L/E:309–320` | O 明确职责/协议分离；“角色职责 MD 真源”不等于全部 prompt 真源，代码仍持有结果指令 |

#### 5. 实际上下文及新鲜度

| 内容 | 上游 | 本地 | 判断 |
|---|---|---|---|
| Ticket id/title | `U/Main:130–134` 插标量 | `L/E:355` 整 ticket | A 角色明确输入，表示方式 O |
| Ticket 正文/评论 | Planner 列表可有正文/评论，Implementer 收 id/title 后自己 view（`U/I:5`） | `L/E:156–170` 刷新票/评论，传完整对象 | A/O，减少角色补拉需求 |
| 父 PRD/SPEC | `U/I:5` 条件读取父 PRD，Reviewer模板无独立要求 | `L/E:120–128` 仅配置 specs 预读；`L/I:7`,`L/R:7` 父上下文 | A 父SPEC只上下文；不能声称已自动遍历父子API或每票唯一绑定，所有显式 specs 统一注入 |
| SPEC新鲜度 | Implementer按角色执行时读 | `L/E:120–128` 只初始读；refresh `156–177` 不刷新 specContext | O 运行级快照；长运行父SPEC更新不自动注入后续角色 |
| Ticket新鲜度 | agent view时读取 | 引擎refresh形成当前票对象；I→R复用同 context `355–362` | O；Reviewer不会自动拿实现期间新增评论，需自行补读 |
| 分支历史 | I的上游运行前最近十条，R运行前全部target差异 | prompt不带实际Git文字；实现/审查被要求自己读 | D，最重要的上下文接线差异 |
| 先前实现结果 | 上游 reviewer prompt无 implement结果，只动态git；上游最后把两次commits合并 `U/Main:149–154` | `L/E:362` previous implement + 全ticket/spec | A Spec §1要求前序结果；评审可能受实现自报影响，独立CLI不等于盲审 |
| Merger前序结果 | 上游只branches/issues列表 | `L/E:402` items中的review、previous、summarySubject、mode/batch | A 续作/close-only/结构化交接 |
| Implementer重试前序 | 上游 iterations重新跑prompt | `L/E:355–356` 新I context无 previous实现失败结果；靠现场Git/dirty和Ticket评论 | 不声称有所有角色对话历史重放；Spec要求复用进度不必持久会话，N/O；若“所有前序结果均注入”则描述过度 |
| 项目验证 | 上游固定 npm / 专用review standards | `L/E:317` config.verify文字；`L/C:15` 自读项目说明 | A；引擎没有展开实际项目规范正文，因此可读性由角色执行保障 |
| 模型/会话 | `U/Main:81,128,142,213` 固定Claude Opus/Sonnet；上游run还有resume/fork能力 | `L/P:24,47–53` 统一config模型/effort，本地无该会话重放 | 固定模型删除 A（Spec §6）；通用resume/fork未移植 N |

#### 6. 结果契约、成功判定及 COMPLETE

##### 6.1 上游真实契约

- Planner：`U/Plan:29–37` 的 `<plan>` JSON；`U/Main:32–36,83–86` 的 Zod issues(id/title/branch strings) + Output.object。
- Implementer/Reviewer/Merger：模板只要求 `<promise>COMPLETE</promise>`；没有每票 passed/failed、tests、cwd、summaryCreated、closed schema。`U/Main:137–157,175–182` 依据返回 commits 和 Promise fulfilled 收集分支，不是新 AFK 的独立评审通过证明。
- `U/src/Orchestrator.ts:246–248` 默认 COMPLETE / 600秒idle / 60秒completion timeout；`89–120,174–185` COMPLETE出现后改用grace并随后续stdout重置。它不是固定“打印COMPLETE后无论输出一律60秒杀”。
- `U/src/run.ts:842–860` 结构化提取是结束后的独立步骤，不能把 completionSignal 与 JSON schema 通过混同。通用输出支持 Standard Schema、string、resume后重发校正（`842–886`），模板planner未显式配置重试次数。

##### 6.2 本地契约及其扩展

`L/E:309–320`：

- common：run、attempt、role、status（passed/failed/blocked）、summary、tests[{command,status,summary}]、remaining。
- I/R：ticket整数、branch、绝对cwd、commits文字摘要（非SHA，允许历史未交付成果）。
- M：branch/cwd、summaryCreated布尔、summarySubject字符串或null、tickets[{ticket,branch,merged,verified,closed}]。
- 明确平铺对象，不回显 contract/context/repository/target/specs 包装；这一部分是新写的模型协议，并非来自上游角色模板。

`L/X:152–169` 先检查实际执行结束/停止/权限/provider错误/idle/退出码，再从assistant文本取最后完整afk-result、拆fence、JSON parse、验身份。`L/E:326–345` 进一步校验通用字段、cwd/branch、ticket/commits。

门禁差别：

1. `L/E:359` Implementer要status passed/commits非空/实际branch deliverable clean；**这里没有调用 passedTests(implement)**。因此不能声称引擎强制每个I结果tests全部passed；文档要求其满足验证，硬门禁在Reviewer（`365`）。这不是已证明业务不交付，但prompt要求与强制校验强度不同。
2. Reviewer `L/E:365` 必须 tests至少一项passed且全部passed，实际成果/clean；合格无新commit仍须报告全分支摘要。A，Spec §4。
3. Merger `L/E:414–436` 固定票清单、布尔关系、summary条件、实际subject、目标clean、close-only既有subject/HEAD。closed自报后还依Github刷新（`437–438`）。这是新本地业务校验，不是通用 Standard Schema 原样复用。
4. 无 COMPLETE 信号/grace计时；`L/X:13,136,158–160` 始终角色600秒stdout idle与真实结束，文本COMPLETE不会提前交接。A，Spec §6/§7。
5. 结果解析仍“最后完整标签赢”，并非真的强制整次stdout只出现一个标签：`L/S:6–21`。角色指令“最后仅返回一个”是输出要求，parser有意容忍provider重复最终文本；`L/Source:33` 也明确这一点。
6. 本地没有上游 `Output.string`、异步 Standard Schema、自带结构化输出重发修复/会话恢复接口。N；AFK失败重选不等同恢复原会话只纠正JSON。

##### 6.3 不应扩大解读的边界

- 本报告仅确认 prompt 与相关校验接线，不据此认定停止/进程后代/600秒真实时间测试已通过。
- tags+JSON不是抗prompt injection的绝对安全隔离；它避免代码层求值，不阻止模型把上下文误当指令。
- 标题/测试/commit文字自报并非代码证明；规格也明确不要求SHA/tree证明交接。不能为了填这类“可信度”差异要求新建哈希账本。

#### 7. 测试源码覆盖与不能宣称的验证

本次读取测试源码、核对其断言与调用路径，**未重新运行上游Vitest、未执行本地公开CLI验收**。没有把文档中的历史“17项通过”冒充本轮实测。

##### 7.1 三份指定 Prompt 测试（完整读取）

- `U/src/PromptResolver.test.ts:14–26` inline/file text+source；`28–42` 两者同时提供/两者缺失。**没有**直接覆盖readFile错误、空文件、编码异常。
- `U/src/PromptArgumentSubstitution.test.ts:41–77` 单/多/重复key、数字/布尔；`79–111` missing/undefined/null；`113–129` unused/无占位符；`131–141` shell内插参/来源marker；`143–196` 空格/tab/命名及错误；`198–235` 多余参数/silent builtin；`239–303` builtin覆盖/inline args/内建键表；`306–371` missing预检查去重/空值/builtin排除。
- `U/src/PromptPreprocessor.test.ts:30–43` 测试helper先substitute再preprocess，真实模拟生产顺序，而非拿未标记原文直接执行。
- 同文件 `46–65` 无命令/单/多stdout替换；`67–86` nonzero/exitCode；`88–93` cwd；`95–141` 并行；`144–160` token日志；`163–177` 原模板命令插参；`179–209` 参数携带shell和伪造marker不能执行；`211–249` TestClock 30秒超时及实测elapsed；`252–257` 无命令不taskLog。

##### 7.2 模板生成与 run 接线测试

- `U/src/InitService.test.ts:1083–1106` parallel-planner-with-review四角色MD/main输出；`1119–1168` 共享sandbox、I→R、两次commits、allSettled；`1171–1205` 1/100/1/1 iterations；`1208–1242` 参数仍在运行模板；`1280–1317` 标准文件生成、`@`字面引用、target三点diff/两点log。
- 同文件 `1928–1958,2010–2083` 生成期tracker替换GitHub/Beads命令、运行期TASK_ID保留；这些区间由定位结果确认测试名称及相关断言，未将所有区间逐行完整展开。足以与已读InitService替换实现互证，不能声称已运行测试。
- `U/src/run.test.ts:669–688` 声称验证promptFile基于process.cwd而非options.cwd，但断言仅 `.toThrow(relativePromptFile)`，两个基准均不存在时也会满足，**测试本身不强证明路径基准**；实际依据是run不改写promptFile直接交Resolver及API注释。
- `run.test.ts:693–742` inline+非空args报错、literal braces不报替换错、空args允许；后两项捕获异常只排除某类错误，**不是端到端成功传输测试**。
- `U/src/Orchestrator.test.ts:2091–2107` 捕获stdin确证skipPromptExpansion下shell/braces原样传输，此证据比前述弱断言更直接。
- `createSandbox.ts:367–402,477` 已核对I/R实际加载/替换/skip接线；未以createSandbox交互式prompt测试冒充本任务print路径覆盖。
- `Orchestrator.test.ts:3870–4124` 已定位completion timeout tests：hang后成功、无signal不能用grace、trailing输出续期、正常退出不等大grace、timeout warning；本报告completion结论以已完整读取的Orchestrator实现为主，不冒充运行这些时间测试。

##### 7.3 输出提取与本地历史验收

- `U/src/extractStructuredOutput.ts` 已完整读；其 `.test.ts` 已定位单/末标签、json/bare fence、缺标签/非法JSON/schema error、异步schema、string模式等测试名称/行号（`59–222,244–279`）。未逐行展开全测试文件，未执行；函数真实性以双方已读源码逐句比较为依据。
- `L/Notes:15–24` 记录历史公开CLI17项：从/tmp启动、实际stdin含common/role全文、上下文字面量、12类文件不可读/空失败、close-only。该文档说明有 `/tmp/afk-issue7-acceptance.role-prompts.lMwvTj/` 证据；**本次未读取/重跑该fixture结果**，不能把它列作本轮测试通过。
- 当前本地真实代码足以静态确认读取/拼接/stdin链；尚未本轮实测Unicode边界、超长Ticket、文件中途修改、实际CLI读项目规范与Git上下文保证。

#### 8. 分类汇总及后续处置优先级

##### A 规格明确要求，不应作为“偏离上游即错误”

- 删 LLM Planner / 原生调度、Docker、固定模型/上游总迭代上限；固定范围/四票/确定性blocked_by。
- 绝对worktree现场、失败历史保留、唯一写者、拒绝和停止不绕过。
- Reviewer独立且直接修复/测试/提交，不回实现者；历史成果计入、无新增review commit仍可过。
- 项目适配验证、单中文summary、summary/验证后Merger关票、失败关其他票、close-only/unfinished merge续作、不关SPEC、不push/PR。
- 明确结构化逐票结果，真实执行结束后交接、COMPLETE/grace不提前强制成功。

##### O 合理可选，但不是“规格规定必须如此”

- 共用Markdown合并规则、固定四文件预读/空白fail-fast、整个run快照、import.meta.url寻址的具体实现。
- JSON context代替scalar插值、所有显式SPEC统一注入、正文压缩重排、删除“fill context window”。
- 不再强制普通commit带PRD/决策/文件列表、unsafe casts/any改泛称、专用standards文件改项目说明、无自动测试的具体人工验证表示。
- 手写业务schema、平铺afk-result封套、日志不暂存/逐路径暂存的具体防护措辞。

##### D 需明确记录，而不能称为原样提取/必需适配

**D1（高：复用真实性）** `L/E:78–85,314–320` 是新加载/拼接器，上游三个Prompt模块一个都没复用。若对外说“MD恢复因此promptFile处理机制恢复”，与源码相反；`L/Notes:28` 的窄声明才准确。

**D2（中：执行保证）** `U/I:17`、`U/R:9,13` 的启动前Git证据预注入被改为 `L/I:7`、`L/R:7` 的agent自主读取。Spec没有要求删此能力，上游防参数中新shell块执行已有测试。零依赖/去Docker不能独自证明放弃自动采集是必要。应明确接受这个保证下降，或在后续实现任务用窄本地只读采集替代；本次不改代码。

**D3（中：材料完整性）** `L/Notes:10` 当时没拿到两个上游模块，不应继续当“固定commit无文件”。全归档已确认存在，且load/substitute/expand链完整。保留历史记录可以，但后续结论须注明当时材料不完整。

**观察项（不直接判规格失败）** I prompt要求验证而engine未硬判I passedTests；SPEC只初始化预读不刷新；I重试无previous失败JSON；M所有给定分支比“可处理分支”更严格。这些需按主审计负责人的状态/调度范围交叉核验，不把静态观察夸成已复现故障。

##### N 不要求补齐的通用库能力

- 通用inline/promptFile二选一API、任意用户promptArgs、unused-key显示、missing-key交互补问、通用命令扩展平台。
- Beads/custom tracker scaffold、任意Output.string/Standard Schema、session resume/fork/结构化纠错重发、其他CLI providers、Display token估算UI。
- 递归`@file`包含：在被审计上游Prompt模块中根本没有实现，不应凭模板中的`@`要求AFK“恢复SDK内联”。

#### 9. 覆盖清单

- [x] 本地common、implementer、reviewer、merger全部正文逐项。
- [x] engine模板加载、快照、prompt函数、输入来源、I/R/M派发及直接相关结果门禁。
- [x] 上游parallel-planner-with-review全部五份MD（含Planner、CODING_STANDARDS）与main.mts实际调用。
- [x] PromptResolver / PromptArgumentSubstitution / PromptPreprocessor全部实现及三份完整tests。
- [x] InitService生成期tracker命令替换；run与createSandbox运行期args/builtins；Orchestrator迭代期命令展开。
- [x] 文本编码/JSON转义/stdin路径、`@file`非SDK内联边界、动态Git证据时机和context新鲜度。
- [x] COMPLETE与60秒grace/600秒idle区别，afk-result及上游结构化提取纯函数真实性。
- [x] 固定归档18文件字节核对；历史来源/验收记录只作声明证据，未冒充本轮实测。
- [x] A/O/D/N分类，测试断言强弱及未覆盖处明确标注。
- [ ] 本轮未运行公开CLI、真实LLM、GitHub、Vitest或600秒场景；这是只读源码审计边界，不是遗漏未报告的实测。
