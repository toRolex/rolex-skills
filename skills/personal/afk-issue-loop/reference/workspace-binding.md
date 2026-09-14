# 工作现场与执行生命周期

本文件表达业务边界。公开启动、查询、停止接口见 [afk.mjs](../scripts/afk.mjs) 的 `help`；调度及角色输入/结构化结果契约以 [engine.mjs](../scripts/engine.mjs) 为唯一真源。角色使用引擎注入的契约，本参考不另定义字段或恢复协议。

## 分派

独立脚本串行准备 Worktrunk 现场，再通过所选本机 CLI 并发启动角色。daemon 和角色均不依赖宿主原生子代理接口。执行 CLI 默认 claude；Pi 默认 Luna/max 意图每次 start 解析，每个角色的准确选择保存于本 run 的 `selection.json`，角色启动时不再重选（不保证外部 CLI/配置在运行期间被更改后的行为）。daemon 崩溃后的恢复同样只读这份冻结结果，不重新解析模型，使同一 Run 的配置全程一致。声明式发现边界、按角色语法、逐字段继承与 effort 交集见 [模型选择](../SKILL.md#模型选择)。[默认角色权限](../SKILL.md#默认角色权限) 对齐 Sandcastle，仅影响角色 CLI 自身审批/sandbox；本机身份、保护环境变量、外层限制及权限拒绝处理不变。

1. 新 run 先读取 Ticket 当前状态并分类标准现场。closed 跳过；open 且已有唯一 `afk/issue-{N}` worktree 时原地恢复；只有分支时由 Worktrunk 恢复同一分支 worktree；两者都不存在才从目标创建。`--reuse` 仅保留显式归属兼容信息，不覆盖 writer、锁定或 quarantine 判断。
2. 恢复继承已有 commits 与 dirty 进度。writer socket 按 liveness-first 的正向活跃证据核实：只有 ownership channel 可连接且返回当前 AFK 标识时才认为 writer 仍在运行，该票进入 `waiting-writer`；连接拒绝时以 recovery guard 串行接管。stale/unreachable socket、未知响应、历史 PID/PGID、`EPERM` 和不完整历史事件都只作 Recovery Observation，不再单独阻止派发。`waiting-writer` 期间 run 定期重新做正向活跃检测，active writer 消失后自动恢复派发，无需重新调用 skill；其他独立 Ticket 不受影响。已成为目标祖先的分支进入 `merged-unverified`，由 Merger 继续验证和关闭。
3. 每个 CLI 角色收到 Ticket 正文/评论、父 SPEC 上下文、目标与任务分支、绝对工作目录、前序结果及项目验证要求。角色启动前自动采集 Implementer 最近十条提交、Reviewer 相对目标的完整 diff/log；只执行可信模板命令，参数中的命令、伪标记和占位符不二次求值，命令插参安全转义。沿用指定现场，不再增加宿主隔离层。

Merger 使用目标分支现场，缺少时由脚本通过 Worktrunk 创建；上批自身保留的合并进度交给 Merger 继续。目标工作区的未提交改动不阻止 Merger（Git merge 自身对重叠修改、未跟踪文件被覆盖等会丢失改动的场景 fail-closed），只有未完成的 merge/rebase/冲突或其他占用才等待用户。Worktrunk hooks 审批由用户在本机完成，不使用 `--yes` 自动批准。

Worktrunk 管理 worktree，Git 管理提交与合并。worktree 只隔离代码目录，不隔离系统权限、进程、网络或共享服务；无 Docker。不自动 fetch/pull、push、创建 PR、安装依赖、更改全局 Git 或权限配置。

## 实时输出与 idle

- 脚本直接持有各角色 stdout；收到每一行真实原始输出时，自动追加目标仓库 `.afk/logs/` 下对应运行日志，并重置该执行当前阶段期限：完成信号前 **600 秒 idle**，信号后默认 **60 秒 grace**。日志可关联 Ticket、角色及尝试；解析器不认识的行同样落盘并续期，解析摘要不能替代原始日志。
- 每执行独立计时，从实际启动起覆盖首行前等待。stderr 仅作诊断；其他角色、脚本状态、心跳、历史回放均不续期。不通过文件时间、Git 活动或资源使用推断输出。
- 检测完成信号前连续静默满 600 秒触发 idle；检测上游 COMPLETE 信号后切到默认 **60 秒 completion grace**，每条后续真实 stdout 继续重置 grace。持续输出可无限持续，没有角色总时长或总批次上限；正常退出不额外等满 grace。
- grace 到期主动收尾，确认受管执行结束且结果、实际成果有效时可接受；不因自身收尾的信号退出码一律失败。idle、外部异常死亡、权限拒绝、坏结果或终止不明不走 grace 成功候选路径。
- stdout EOF、完成文本或退出码 0 均不单独代表角色成功或 Tickets 已交付。实际执行结束才取消计时，按最终结构化结果和必要的 Git/GitHub 核实推进；最终答复缺少合法结果时不回退接纳历史 passed。
- idle 到期先确认进程状态；仍运行则终止本次执行，**确认角色及相关写者实际结束才交接**。无法确认时保留占用、报告用户待办；只发终止请求不能释放现场。实现/审查走 [失败与下一批](../REFERENCE.md#失败与下一批)，Merger 保留合并或关闭进度。
- 自动日志与计时是核心能力，接流/记录失败须报告并停止受管执行；事件日志写入失败不能跳过停止，不静默禁用日志继续工作。普通测试输出中的 EPERM 等文字不等于用户拒绝，错误按来源归因。

## 写入前与交接

角色先核对实际仓库、目录、分支；Git 和测试均定位到指定目录。同一现场一次只由一个角色写入，Implementer 结束后 Reviewer 才接手；全批 settled 后才由唯一 Merger 写目标。

角色按引擎注入的结构化契约报告实际成果、提交摘要、测试与遗留问题并结束相关写入进程。业务结果和进程结束共同决定交接，不增加 SHA/tree、目标内容快照、HEAD 钉死或 summary 标题计数证明。

本机监管使用 POSIX 原进程组与继承 pipe 结束确认；父 CLI 退出不等于同组后代或持有管道的写者退出。组/管道终止未确认时保留现场、报告受限，不交接。此机制不能证明所有已经脱组且未保留管道的后代均已结束；三种真实 CLI 的工具后代行为须分别验收，不能宣传为完整进程安全沙箱。

## 现场收尾

现场清理与核心交付分离。I→R、排队、合并、验证和关闭路径均保留任务 worktree、branch、commits 与 dirty 进度，不执行 reset、stash、force 删除或 abort 掩盖成果。后续清理只能处理本 run 明确创建、clean、已合并且写者确认结束的现场；恢复现场、未知所有权、dirty、quarantine 或终止未确认的现场永久排除自动清理。清理失败单独报告，不撤销交付或重做实现。

## 独立运行与停止

入口启动握手最多 120 秒，普通前置命令默认 30 秒；这些是启动/步骤期限，不是角色总时长。启动握手成功后发起会话可结束，编排器继续管理角色、接力及后续批次。用户用公开 `status --run` 看状态、`stop --run` 请求停止本次编排及全部受管角色。停止后不启动新角色；收到 `stopping` 只表示请求受理，须确认最终 `stopped` 才复用现场，控制连接失败则状态未知。

日志、运行身份和控制信息不是完整持久化任务状态机；批次和旧 Reviewer 结论仍在内存中。新 run 依据当前 GitHub、Git、Worktrunk 与 writer 事实恢复代码现场，不恢复旧进程内存或历史 PID；未合并成果重新 I/R，已在目标中的成果进入验证/关闭。`status` 与 `events.jsonl` 公开逐票 `skipped-closed`、`recovered-worktree`、`recovered-branch`、`created`、`waiting-writer`、`merged-unverified` 等分类。最终区分已启动、角色完成、全部交付、等待用户；`completed` 要求范围内 Tickets 实际交付并关闭，失败 I/R 的误关票不能仅凭全 closed 掩盖；阻碍须列明。

## 只读 Dashboard

每个 run 拥有一个独立的只读 Dashboard companion：仅监听 `127.0.0.1`、由 OS 分配端口、使用与 control capability 分离的 per-run read token；它不参与调度，也没有 stop/retry/approve/resume 等 mutation endpoint。`start` 结果与 `status` 都返回当前 URL；`dashboard --run <绝对日志目录>` 可按 run identity 重建 companion 并复用原 read token。浏览器自动打开是 best-effort，失败不影响 run。

- 核心 `events.jsonl` 继续服务调度、Recovery 与终态证据，写入失败仍使 run 可见失败。与之分离的 `observations.jsonl` 是 best-effort 旁路事实源：AFK daemon 是运行期唯一 writer 与 `seq` 分配者，provider 原始 payload 在 provider-specific 解析前写入；它不被 engine 用作调度或 Recovery 的依赖。
- Recovery、Process lifecycle、provider text delta、tool-call、tool result、stdout、stderr 与 Merger 逐票结果共享同一 run-level 单调 `seq`；SSE event ID 等于该 `seq`，重连按最后已见 ID 只补发后续记录。
- `Attempt` 是 per-Ticket/per-Role（Merger 为 per-Batch）完整 Recovery/派发 cycle 序号，`Invocation` 是实际 spawn 的 Role CLI 全局序号；planned Attempt 在 spawn 前可见且 Invocation/PID 为空，只有 spawn 成功才分配 Invocation。Role 退出不等于 Ticket 交付；看板逐票状态从 Merger 逐票结果与 Git 祖先关系推导。
- provider 观测标签（`provider/<name>`）与流解析器取该 Invocation 所属**角色**冻结的 harness，而不是 run 级单值：混 harness 时不同 CLI 的 stream-json 格式完全不同，标签与实际载体必须一致，否则 Dashboard 与排障会误导。
- 采集与排版忠实于 provider 与进程实际发出的完整内容，不摘要、不截断、不改写、不脱敏，也不提供独立 Raw 标签页。Dashboard 故障、慢客户端、断线、journal 写入失败或导出失败都不进入 run 失败路径；完整性损失必须在 `status` 与页面显式标记 `degraded/incomplete`。
- run 终态后 journal 冻结，companion 导出自包含 `dashboard.html` 并继续提供页面 24 小时；静态文件在 server 退出后仍可直接打开。Observation journal、read-token metadata 与最终 HTML 均为 owner-only `0600`，read token 不进入 events、Role 日志、access log 或最终 HTML。

本机平台与所选 Provider 须以实际运行结果核验，不能用一个 CLI 成功代替其他 CLI 通过。
