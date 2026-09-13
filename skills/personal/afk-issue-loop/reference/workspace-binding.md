# 工作现场与执行生命周期

本文件表达业务边界。公开启动、查询、停止接口见 [afk.mjs](../scripts/afk.mjs) 的 `help`；调度及角色输入/结构化结果契约以 [engine.mjs](../scripts/engine.mjs) 为唯一真源。角色使用引擎注入的契约，本参考不另定义字段或恢复协议。

## 分派

独立脚本串行准备 Worktrunk 现场，再通过所选本机 CLI 并发启动角色。daemon 和角色均不依赖宿主原生子代理接口。Provider 默认 claude，模型及 effort 省略时沿用该 CLI 本机配置；显式配置与权限按用户输入传递。

1. 新 run 先读取 Ticket 当前状态并分类标准现场。closed 跳过；open 且已有唯一 `afk/issue-{N}` worktree 时原地恢复；只有分支时由 Worktrunk 恢复同一分支 worktree；两者都不存在才从目标创建。`--reuse` 仅保留显式归属兼容信息，不覆盖 writer、锁定或 quarantine 判断。
2. 恢复继承已有 commits 与 dirty 进度。writer socket 按当前连接事实核实；socket 遗留时以 recovery guard 串行接管，并从既有结构化事件取得候选 PID/PGID 后用 signal 0 重核当前进程组。活跃、未知响应或 EPERM 使本票等待／quarantine，只有拒绝连接且候选进程组均为 ESRCH 才移除遗留 socket。已成为目标祖先的分支进入 `merged-unverified`，由 Merger 继续验证和关闭。
3. 每个 CLI 角色收到 Ticket 正文/评论、父 SPEC 上下文、目标与任务分支、绝对工作目录、前序结果及项目验证要求。角色启动前自动采集 Implementer 最近十条提交、Reviewer 相对目标的完整 diff/log；只执行可信模板命令，参数中的命令、伪标记和占位符不二次求值，命令插参安全转义。沿用指定现场，不再增加宿主隔离层。

Merger 使用目标分支现场，缺少时由脚本通过 Worktrunk 创建；上批自身保留的合并进度交给 Merger 继续，无关 dirty 或其他占用等待用户。Worktrunk hooks 审批由用户在本机完成，不使用 `--yes` 自动批准。

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

本机平台与所选 Provider 须以实际运行结果核验，不能用一个 CLI 成功代替其他 CLI 通过。
