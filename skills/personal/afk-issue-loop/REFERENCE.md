# AFK Issue Loop 参考

独立本地脚本是唯一调度者，角色由本机 CLI 执行；本文件是业务规则，不是发起 agent 的操作步骤。角色输入和结构化输出遵循 [引擎内嵌契约](scripts/engine.mjs)，这里不维护第二套字段定义。

## 角色执行配置

每个角色各有一份 `{provider, model, effort, selectionSource}`（Role Selection）。顶层 `--provider/--model/--effort` 定义 Run 默认值，`--<role>-*` 按角色逐字段覆盖，未写则继承顶层；缺省角色**只**跟随顶层默认，不跟随其他已指定角色，以免只指定 Implementer 时 Reviewer 被悄悄拉到同源模型而 Reviewer 失去独立性。完全不写角色前缀时三角色完全相同。

每份配置在 `start` 时解析一次并写入 `selection.json` 的 `roles`，角色启动时只读该冻结结果，不重选；daemon 崩溃恢复后同样不重新解析。既有单份读取方读顶层扁平三字段（与 `default` 键同为 Run 默认值）。`start` 返回的 `roles` 与 `resolve-selection` 返回的 `display` 逐角色展示 harness / 模型 / effort / 来源 / 能力是否已验证。当前 Run 实际用到的全部 harness（去重后）都必须在启动期通过可执行文件检查。全局最大轮次默认 10（`--max-rounds` 可配），是 run 有界性的唯一机制；达到即正常结束当前 run。

公共 effort 契约取三家交集 `low`/`high`/`max`；各家更多档位不被拒绝，校验以该 harness（Pi 到具体模型）的实际支持面为准，不支持即启动期失败并给出合法值。Pi 遇不支持的档位会静默降级，因此显式 Pi 模型同样按声明式元数据校验。语法、继承与示例见 [模型选择](SKILL.md#模型选择) 与 [按角色指定](EXAMPLES.md#按角色指定-harness-与模型)。

## 固定批次

脚本每批一次选择固定范围内当前全部未 blocked 且可执行的票，无并发数量上限；成员固定、不补位，一票就绪也开工。现场串行准备后并发 Implementer；Implementer 有提交摘要才进 Reviewer，没有就直接归入本轮结果，其余实现继续。Reviewer 结果直接与 Implementer 提交合并进入待合集。

Reviewer 在同一现场直接修复、测试并提交，不与 Implementer 往返；已有代码合格可无新增 commit。实现/审查失败或无提交摘要均使本票本批 settled；settled 表示管线结束，包含失败，不等于通过。

全批 settled 是 barrier。待合集只收“正常完成且提交非空”（上游 fulfilled + commits.length > 0，同义：分支相对目标确有提交）；有待合集、未完成目标合并或待关闭票时，启动唯一 Merger，否则免去 Merger。Merger 单次调用完成合并、验证、summary、逐个 `gh issue close`、再用 `wt` 清理已合入分支/worktree，最后输出 `<promise>COMPLETE</promise>`；脚本只做 spawn 与下轮调度。

批末刷新固定范围内 open Tickets 及依赖，继续下一批，直至全局最大轮次（默认 10）。全部给定 Tickets 关闭才算完成；只剩权限、范围外前置、不可用现场、writer 冲突、目标 in-progress 等用户待办时，记录具体阻碍并结束自动推进，不冒充交付。网络抖动、瞬时失败只会重试到轮次上限，不再被定性为业务死结。

## 输入与依赖

显式编号去重，引用保留目标仓库归属；一次运行针对一个 `--repo`。默认范围来自首次完整分页读取的 open `ready-for-agent` Issues；排除 PR 和用户标明的 SPEC，已关闭票无需执行，后续只刷新此范围，不吸入新票。跨仓同号不是同一票。目标分支优先用显式值，否则已有 develop、其次 main，不自动同步 origin。

执行依赖以 GitHub 原生 blocked-by 为准。范围外开放前置票不自动纳入；报告前置票及受影响 Tickets，等待用户处理。受影响票的下游也等待，其余独立票继续。

parent SPEC 通过原生 parent、正文 Parent 链接或用户提供的信息读取；没有原生父子关系不影响开工。只有上下文缺失确实妨碍实现时才说明缺少的决定。

读取 EOF、超时等临时错误时，用原有授权方式重试；仍无法读取就说明未知内容，等待受影响票，其余继续。读取失败不是空列表。权限拒绝、认证失败及用户停止交给用户处理，遵守宿主边界。

## Git 现场恢复

每个新 run 在固定范围后、创建新任务现场前按当前事实分类。closed Ticket 记为 `skipped-closed`，不派角色且保留遗留现场；open Ticket 优先复用唯一标准 `afk/issue-N` worktree，只有分支时由 Worktrunk 恢复同一分支，两者都不存在才创建。恢复分类、cwd、dirty、Git operation 与 writer 阻碍写入 `status` 和结构化事件。

任务 worktree 的 dirty 内容是待继承成果。Implementer 在原目录检查并续做，不执行 reset、stash、删除或覆盖；已有实现完整时可不新增提交，Reviewer 仍审查当前成果。恢复现场不自动视为本 run 所有，I/R 结束后保留 worktree 和分支；清理与交付分离。

writer 采用 liveness-first：只有 writer ownership channel 可连接、且返回当前 AFK 标识时，才认为该 worktree 仍有活跃写者，该票进入 `waiting-writer`；连接拒绝时先用 recovery guard 串行接管。stale/unreachable socket、未知 socket 响应、历史 PID/PGID、`EPERM` 与不完整历史事件都只作为 Recovery Observation 记录，不再单独阻止派发，也不保留 `unknown writer` 阻塞状态。历史 PID 只作观察事实，不直接 kill，也不创建第二现场绕过。`waiting-writer` 期间 run 定期重新做正向活跃检测，一旦不再检测到 active writer 就自动恢复派发，无需重新调用 skill。局部 writer 阻碍不冻结其他安全 Ticket。

多个 worktree、错误仓库绑定、locked/prunable、Git conflict/merge/rebase 等非 writer 阻碍继续沿用既有语义，不因 writer 策略变化而放宽。

任务分支已成为目标祖先时记为 `merged-unverified`，跳过重复实现与 merge，交 Merger 只做目标验证和关闭，不再重复合并。目标工作区存在未提交改动**不阻止 Merger**：Git merge 对会丢失工作区改动的场景自身 fail-closed（本地修改与合并内容重叠、或未跟踪文件将被合并覆盖时拒绝并中止，且不改动用户文件），非重叠的脏改动可安全合并并原样保留。因此只有目标处于未完成的 merge/rebase/冲突时才保留现场等待用户；`targetPreexisting` 基线保护仍在（summary 不得吞并目标原有的未提交改动）。

## 就绪选择与全阻塞停止

就绪票按项目优先级、同级编号升序稳定排序，全部纳入本批，不截断低优先级就绪票。`--priority-labels` 按高到低给出项目已约定的标签；无映射时全部同级按编号，本仓库当前没有现存优先级映射。

没有进行中的管线、可推进的 Merger 或待关闭交付，且剩余票全部 blocked 时，记录各票具体阻碍并结束本次运行。删除全内部 blocked 的单候选 fallback，不强行实现依赖未满足的票，也不永久监控等待外部变化。

本批前置票仍在实现、审查、合并或关闭时，先完成在途工作与可推进交付，再刷新判断下游；不能提前以剩余下游全 blocked 结束。范围外开放前置、未知依赖和权限问题只阻止受影响票，不自动扩大输入范围。

## 失败与下一批

单票实现或审查失败时，结束当前执行，将该 pipeline 排除出本批合并，其余 pipelines 继续。未完成时在权限允许下给 Issue 留简短说明：已做内容、剩余工作和阻碍。评论失败照实报告。

普通临时失败只结束当前尝试，不进入永久 block；准备失败释放自身锁，下次写入前重新核对现场绑定。下一批或新 run 重新读 open 票并按当前依赖、优先级选择，包括失败票；用同名任务分支及现场进度继续。每次由新派角色读当前代码和 Ticket 开工，不恢复旧 agent、历史 PID 或旧 Reviewer 文字结论。

用户停止或权限拒绝仍需用户处理，不因进入下一批而重新尝试被拒操作。

## 测试与提交

按项目配置、规范及用户要求选择测试、类型检查等验证；适用时采用 RGR。代码改动后重新验证，返回实际命令、结果和未执行项。没有自动测试时按原项目约定执行具体可说明的检查，不新增免测接口或豁免机制；实际失败按失败处理。

管线是否推进只看角色结果里的 commits 摘要与 Git 事实（分支相对目标是否有提交、是不是目标祖先）。未跟踪文件永远不进入 merge，因此角色留下的安装产物、校验缓存或笔记不否决交付（现场保留由用户处置），不会被自动提交。

提交遵循项目规范与用户全局中文 Conventional Commit，概括任务、重要决定及必要上下文。角色输入与结构化结果由引擎内嵌契约传递，使用分支 diff、commits 与测试结果说明成果；退出码或完成文本不能代替业务结果。

## 合并未完成

合并冲突、测试失败先由 Merger 修复再继续。若仍无法解决，保留目标当前内容并报告；目标仍有未解决冲突或失败修改时，先处理该目标问题，再继续后续批次的合并。

已合并通过的部分保留，未交付分支保留待续做；目标合并尚待修复的票由 Merger 继续处理现有合并进度，无需重做实现。每批成员固定，上批未完成的 merge/close 仍属于原批，不把新成功分支混入其 summary。目标可处理时，优先由 Merger 续做旧批合并或补关闭，暂不启动新 Implementer；只有目标存在明确用户阻碍时，现场可用的独立票才可先继续实现与审查，其成功集按原固定批次排队。Merger 按原批分组串行交付，各批仅有一次 summary。剩余任务全部有明确阻碍时记录 waiting-user 并结束自动推进。同次运行保留完整合并队列；跨运行不恢复旧内存队列，而按分支祖先关系重建 `merged-unverified`，或对未合并成果重新执行当前 I/R。Merger 职责见实际加载的 [Merger prompt](reference/merger-prompt.md)：完成判定只看 `<promise>COMPLETE</promise>` 字符串与载体层进程语义，不设形状门；关闭失败的整单下轮幂等重跑（已合入沿用），见下节。

## 关闭失败整单重跑

Merger 单次调用未走完（合并、验证、summary、关闭、`wt` 清理任一步未完成），下轮整单幂等重跑：已合入分支跳过重复合并、沿用已有 summary，直接由 Merger 继续验证、关闭与清理；未合入分支保留现场并上报 remaining。单票关闭失败仍继续其他可关闭票。角色可能已产生副作用但结果损坏时，结合 Git 历史、现场和 GitHub 核实，能确定则续作，不能确定则报告待核实项；不靠历史 passed 猜成功，不增加目标内容快照、HEAD 钉死或 summary 标题计数证明。

关闭权限尚未恢复时等待用户，其余独立工作继续。调度者只接收和核对结果，Issue 关闭始终由 Merger 执行。

## Dashboard 终态回收与 reopen

run 进入终态（`result.json` 出现）后 companion 立即回收 live 面板：worker 发出 `final` 信号，先留约 2 秒宽限让最终 SSE `event: final` 送达已连接浏览器，再 `SIGTERM` worker 并退出，不再保留 24 小时。`dashboard.html` 静态导出保留（零 CPU 离线文件），权限 0600。`dashboard.json` 置 `state: 'final-export'`，`status`/`dashboardPublic` 如实报告"面板已回收，静态导出在 X 路径"，原 URL 失效不再给出。终态后再执行 `dashboard --run <logDir>` 不拉起新 server，直接返回 `state: 'final-export'` 与 `finalExport` 路径。回滚逃生口：显式设置 `AFK_DASHBOARD_RETENTION_MS=<正值>`（毫秒）恢复旧保留期行为；默认 0 即立即回收。run 现场目录被移除时 companion 仍自行退出（既有 liveness 检查保留）。
