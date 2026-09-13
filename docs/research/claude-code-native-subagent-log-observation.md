# Claude Code 原生子代理：日志落盘、实时行观察与输出流边界

日期：2026-09-12。研究对象：本机 Claude Code **2.1.228**、已安装官方 TypeScript Agent SDK **0.3.220**，以及当日官方滚动文档。沿用 `docs/research/` 的小写 kebab-case 主题命名；创建前已确认目标不存在。

本轮仅研究：读取源码、少量既存记录结构和公开官方资料；不启动业务 agent 实验，不恢复 session，不改权限或 hooks 配置，不安装包，不实现 observer/test 脚本，不做 SHA/哈希验证，不 commit/push。下文所有接线均为建议，未执行。

## 结论先行

**原生 Agent 子代理有自动日志；并非只有独立 CLI 才有。保留已打开 session 与原生派发，外部公共脚本可以只读跟随其 transcript，以文件事件构造“每条新增完整 JSONL 行回调”。但这不是直接订阅子代理执行 stdout，也不能保证 600 秒无新增行就代表 agent 停滞。** [L1–L4、L6、W1、W2、W5]

必须分三层：

1. **自动落盘：确定有。** 子代理独立 JSONL；已有异步 Agent 返回的 `output_file` 实际是它的软链接，而非仅完成后才出现的结果文件。[L2–L4]
2. **实时读取完整新增行：机制可行，组合未实测。** 文件系统事件唤醒 reader，按字节偏移补读、保留半行；公共脚本可以记录到 `<目标仓库>/.afk/logs/` 并按新增完整行更新 600 秒 idle。无需 mtime 轮询，无需 SDK 接管或恢复当前 session。[W5；由 L2–L6 推导]
3. **直接订阅原生子代理执行输出流：本轮未证实可从任意普通交互 session 外部直接接入。** 已确认内部 progress、SDK stream 和内部 mirror 存在，不能写成“原生没有输出事件”；但检查到的 Agent/TaskOutput schema 没有注册回调或提供输出流句柄的能力。内部事件存在，不等于 skill/scripts 获得公开订阅入口。[L1、L5、L6、S1–S4]

## 能力矩阵

| 渠道 | 自动产生什么 | 公共脚本如何接收 | 保留当前原生派发 | 每行重置 600 秒 | 与 Sandcastle stdout `onLine` 的关系 |
|---|---|---|---|---|---|
| 原生会话/子代理文件 | 主 session 与子代理 JSONL；子代理含 assistant、thinking、tool_use、tool_result 等记录 | 已知路径后只读；`output_file` 可指向 transcript | 是 | 单靠落盘不行，需 reader | 是持久化会话记录，不是原始 stdout [L2–L4、W1] |
| 文件事件驱动的行观察 | observer 从新增字节拼出完整 JSONL 行 | OS 文件/目录通知 → 补读 → 行回调 → `.afk/logs/` | 是，不必启动另一个 Claude | 可以实现“观察到新完整行即重置”；未实测 | 回调形状可相同，事件内容、时序、完整性不同 [L6、W5；推断] |
| 原生内部输出/progress | `agent_progress`、内部转发、任务汇总、部分场景工具 heartbeat | 当前工具 schema 不暴露外部 callback；SDK stream 需已有宿主连接 | 内部自然存在；外部接当前普通 session 未证实 | 不可把 progress/heartbeat 全当 stdout 行或有效工作 | 既有内部事件不是稳定的公共 `onLine` [L1、L5、S1] |
| hooks | 开始/停止、工具执行前后等离散事件 | command hook stdin JSON，或 HTTP hook；可唤醒/通知 observer | 可以；skill frontmatter 不必改全局配置，但有作用域边界 | 只能按 hook 活动重置，不覆盖所有 token/执行输出 | 是生命周期/工具边界，不是连续输出流 [W2、L7、S2] |
| 独立 CLI stdout / SDK query stream | print-mode stream-json、可选 partial events/子代理文本；SDK 异步消息 | 宿主持有 stdout 或 Query iterator | 默认是另一次 CLI 执行，不是被动附加现有 session | 可按其输出行重置，仍不等于所有内部活动 | 最接近 Sandcastle 的宿主模型；不是获得日志的唯一方式 [W3、W4、W6、S3] |

## 1. 自动日志与 Agent `output_file` 的真实语义

### 已核实的记录

仅输出了选定记录的 `type`、版本、ID、内容块类型和返回路径，未摘录业务正文或凭据。

- 主会话 `0bb9a8a7-…jsonl` **第 44 行**：Agent 结果为 `status: async_launched`，带 `agentId`、`outputFile`。既存 `.output` 经过只读 `readlink`，目标正是同一 session 的 `subagents/agent-ae572b6ad8574e678.jsonl`。[L2]
- 该子代理文件**第 1–4 行**：`version: 2.1.228`、`isSidechain: true`，依次有 user、assistant thinking、assistant tool_use 等结构。另一个子代理**第 1–4 行**还直接观察到 `tool_result`。[L2、L3]
- 同步完成的 Agent 也有独立 transcript：主会话 `20f215d2-…jsonl` **第 18 行**为 `completed`，对应子代理文件已经存在。因此日志不是后台运行独有。[L3]
- 第二个异步样本的临时输出路径中 session 目录与实际 transcript 所属 session 不一致，而软链接指向正确子代理文件。**不要仅从 `/tmp/.../tasks/` 路径猜当前 session。** 优先使用实际返回路径/真实链接目标和 transcript 元数据。[L4]

### 类型与源码交叉核实

2.1.228 的 `sdk-tools.d.ts` 将异步结果的 `outputFile` 注释为 “Path to the output file for checking agent progress”；Agent 输入不提供输出目录、自定义 stdout callback 或订阅参数。[L1]

内嵌实现中，任务注册 `QJd` 调用 `u6e(e, OA(Wu(e)))`，`u6e` 建立 task output → agent transcript 的软链接。渲染给模型的 `output_file:` 后明确说明它是 **full subagent JSONL transcript**，不要 Read/tail 全文以免塞爆上下文。这个阅读提醒不是“公共脚本不能只读观察文件”。[L5a]

因此：

- `output_file` 是进行中的持久化日志入口，不是 stdout pipe，不是保证仅含最后结果的纯文本文件。
- 文件随原生机制生成，但**原生不会因此自动复制到任意目标仓库的 `.afk/logs/`**。当前 Agent schema 没有此路径选项，仍需公共 observer/转存接线。[L1、L5a]
- 日志存在不保证每个时间点都含最新内容，也不代表所有 token、Bash 输出 chunk 都会逐个持久化。[L6、W2]

## 2. 文件事件可构造 onLine，但不能伪装成 stdout

### 可行的最小观察模型（推断，未实现）

利用已有 Node 运行时的 OS 文件通知能力；不引入 Sandcastle、不下载依赖。Node 官方说明：macOS 文件监听使用 kqueue，目录监听使用 FSEvents；`fs.watchFile` 才是 stat polling，本建议不用后者。[W5]

逻辑链路：

`已知当前 session / agent transcript → 注册文件及必要父目录事件 → 补读新增字节 → 缓存未完成行 → 每个完整 JSONL 行 → .afk/logs/<session>-<agent>.jsonl + idle deadline`

必要边界：

- **文件事件不是一行。** 一次通知可能覆盖多行、一次写入也可能尚未读到完整行；通知本身不重置 idle。读取到新增 `\n` 分隔的完整记录才回调。UTF-8 跨 chunk 必须保留边界；先缓存半行再解析，不能把半个 JSON 当损坏日志。[W5；由 JSONL 与 L6 写入结构推导]
- **源保持追加写入期间，只处理新增内容。** 接入时确定 byte offset；历史回填可以另行记录，但不应使旧行反复续命。注册监听与初始补读需要避免空隙，读循环串行化，合并重复通知。此追加写入路径只需进程内偏移和尾部缓冲，不需要恢复账本；发生重写时，不能继续保证仅靠 offset 无遗漏、无重复。[推断]
- **明确目标仓库。** 输出根来自本批次已绑定的绝对仓库路径，不用子代理可能变化的 `cwd` 猜；按 session/agent 区分，避免 observer 的日志被自己再次监听。[推断]
- **只读接入当前 session 是成立的文件能力。** reader 无需修改 Claude 内存、不发 prompt、不 `resume`；可以在子代理已经运行时附加已有文件。但 reader 本身需被启动并持续存活，发现路径也需显式输入或生命周期接线。[L2–L4、W5；推断]
- **监听失败不能静默改成 mtime 轮询。** 权限不足、源文件消失或无法重新绑定，应报告“观测失效”；没有新事件不能当作活性证明。[W5；推断]

### 缓冲与持久化延迟：已看到具体代码

2.1.228 的 transcript writer 具有 `writeQueues`、`FLUSH_INTERVAL_MS=100`、`scheduleDrain`、串行 `drainChain`；积累序列化记录后 `appendToFile`，并有写失败处理。**100ms 是该实现的调度参数，不是端到端可见性 SLA。** 本轮没有把其他 debug logger 的 1000ms 缓冲误当成 transcript 的参数。[L6]

官方 hooks 文档也明确提醒：`transcript_path` 对应文件异步写入，可能落后内存，hook 触发时可能还没有当前轮最新消息；要取最终助手文本，使用 Stop/SubagentStop 的 `last_assistant_message`。[W2]

更长的空白可能发生在：模型正在生成但还未形成持久化消息、工具正在执行但结果未返回、事件合并/reader 延迟、写盘错误。部分原因由源码/文档直接支持，具体最长空白未测。**逐条完整 transcript 行重置 600 秒，是“日志静默超时”，不是“agent 确认 idle”。** 不能承诺不误杀。[L5b、L6、W2；活性判断为推断]

### 轮转/截断只需处理必要影响

官方说明主会话压缩不影响独立子代理 transcript；不要因此假定任意源文件永远 append-only。2.1.228 源码还存在 transcript 物理压缩/重写路径，但本轮没有验证普通子代理在什么条件下走该路径。[W1、L6]

Node 官方明确：macOS/Linux 的 watcher 绑定 inode；删除再创建同名文件后，旧 watcher 不自动覆盖新 inode。最小 reader 需在 rename/delete/目录事件后重新确认源路径，在截断时处理 offset 失效。若同 inode 重写后大小仍不小于旧 offset，仅凭长度和偏移也不能可靠判断连续性；重新打开不能解决所有重写情况。发现或怀疑连续性失效时应标记“观察中断/未知”，不承诺重绑后无遗漏、无重复续命。本方案不为此增加 SHA、恢复账本或通用轮转平台。[W5；接线及限制为推断]

## 3. progress：确实有，不能等同公开订阅或全量日志

2.1.228 内部有 `progress` / `agent_progress`，携带子代理 ID、父工具调用 ID 和消息。转发路径会把部分子代理消息转换为 assistant/user SDK 消息；后台转发及嵌套文本还受上下文/`forwardSubagentText` 等条件影响。原生内部“完全没有实时事件”的结论不成立。[L5b]

SDK 0.3.220 明确定义：

- `SDKTaskProgressMessage`：task ID、usage、duration、last tool、summary，是任务汇总，不是原始输出行。
- `SDKToolProgressMessage`：tool ID、父工具 ID、elapsed time、可选 heartbeat/retry 信息，不是每个 token 或每个 stdout chunk。
- `SDKThinkingTokensMessage`：估计 thinking token 进度；其存在不证明这些估计会写入原生子代理 JSONL。[S1]

现有 Agent 工具输入只有派发控制等字段，没有 `onLine` / subscribe / stream 参数；`TaskOutput` 是按 task ID 读取、可等待完成的调用，不是持续回调注册。当前工具层的能力边界可以据 schema 判定；**不能据此否认其他宿主协议可能转发事件**。[L1]

另外，transcript writer 本身有内存 `addMirror/fireMirror`；这是找到的反证线索，证明内部有镜像机制。该函数存在于内嵌实现，不是当前 Agent schema 暴露的脚本入口；本轮未建立无需改宿主、从普通 shell 接入它的支持路径。[L6]

## 4. hooks：能记录什么、归谁、skill 是否能局部接线

| Hook | 可得到的信息 | 不能推出的能力 |
|---|---|---|
| `SubagentStart` | 新子代理 `agent_id`、`agent_type`，父 session 公共字段；适合通知 observer 开始发现/跟随 | 没有逐行输出；开始 payload 本身不保证含 `agent_transcript_path`，文件可能尚未创建 [W2、S2、L7] |
| `SubagentStop` | 子代理 ID、`agent_transcript_path`、最终 `last_assistant_message`；停止边界 | 不是持续流；不能先等它再做运行期 idle；不是进程 stdout EOF，不能凭 hook 时刻认定文件已全部刷新 [W2、S2] |
| 子代理内部 `PreToolUse` | 工具名/输入/调用 ID；公共字段中的 `agent_id`/`agent_type` 标识子代理 | 工具尚未完成，没有运行中全部输出；不覆盖纯模型生成 [W2、S2] |
| 子代理内部 `PostToolUse` | 成功工具执行后的 `tool_response` 等；可记录结构化结果 | 不是执行期间的 stdout chunk；失败需另看 `PostToolUseFailure`，不可声称覆盖全部活动 [W2、S2] |
| 父线程 `PostToolUse` 匹配 `Agent` | Agent 返回的结构化结果，可取得异步 `outputFile` | async_launched 的返回是派发完成，不是子代理工作完成 [L1、L2、W2] |

### 归属字段

`session_id` 不足以区分同一 session 的多个子代理；用 `agent_id` 区分主线程和子代理，并结合 tool_use_id/parent-tool ID 关联。仅 `agent_type` 不够：主 session 通过 `--agent` 运行时也可带这个字段。2.1.228 的公共 hook 构造 `zh` 确实填入 `agent_id:r?.agentId`，不是仅依赖最新文档推断。[S2、L7]

对 SubagentStop，`transcript_path` 是主会话，`agent_transcript_path` 才是子代理。Start 的父 transcript 路径结合 ID 可以推导常规子代理文件位置，但 `OA` 支持额外子目录，不能将固定字符串拼接当成所有模式的保证；拿到实际 `outputFile` 后校正更可靠。[W2、L5a]

### skill frontmatter 可注册，但“局部”不等于自动继承/自动卸载

**可以不修改全局 settings：skill frontmatter 支持 hooks，调用 skill 时注册。** 当前官方文档说 skill hooks 持续到 session 结束；`once: true` 才在首次成功后移除。不要沿用“skill 一结束 hooks 都自动移除”的旧假设。2.1.228 源码的 `Ydp` 注册及 once 移除逻辑与此一致。[W2、L7]

**重要的版本源码边界：不能把“父 skill 已注册”直接等同“子代理内部所有 hooks 自动继承”。**

- settings/managed/plugin hooks 会进入子代理，这是官方明确列出的继承范围。[W2]
- 2.1.228 skill 注册用主 `Dt()` 作为 sessionHooks 索引；执行 hooks 时使用 `toolUseContext.agentId ?? Dt()`，`ETt` 按该键取条目。子代理定义 frontmatter 的 hooks 则按该子代理 ID 注册、结束时清理。[L7]
- `SubagentStart` 走带父 getAppState、无子代理 toolUseContext 的路径，可取父 session 注册的 Start hook；子代理工具 hooks 与正常 Stop 路径使用子代理上下文。**静态源码因此不支持承诺父 skill 的 Pre/PostToolUse 或 SubagentStop 自动覆盖子代理内部。** 本轮未运行对照实验，特殊 fork/继承路径仍未验证。[L7]

最小方案可依赖父 skill 的 `SubagentStart` 或父 `PostToolUse(Agent)` 获取映射，再让文件 observer 独立存活；不要把父 skill 的 Stop hook 当成已验证的完整清理机制。若确需子代理内部工具 hooks，研究选项是子代理定义 frontmatter，或明确允许的 settings/plugin hooks；本轮均不修改。预加载 skill 文本也不等于已证明其 hooks 以子代理 ID 注册。[L7；方案为推断]

## 5. SDK query、附加协议与主动寻找的反证

### 默认 query 不是被动附加

官方 hosting 文档说明 query 通过新 CLI 子进程及 stdio 执行。SDK 0.3.220 源码 `ProcessTransport.spawnLocalProcess` 实际使用三路 pipe；`query → pO` 建立 transport，resume 继续上下文而非只读监听已有进程。`spawnClaudeCodeProcess` 可换 VM/容器等进程提供者，但接管的是宿主 transport 合约，不能由此推出“传当前 session ID 就能偷听其 stdout”。[W3、S3]

官方 `includePartialMessages`/CLI partial flags 提供模型流事件，`forwardSubagentText` 提供子代理文本转发，是**持有该 Query/CLI 输出的宿主**的能力。也不等于单个子代理内部所有工具 stdout。[W3、W4、L5b、S1]

### 查到的反证，不隐去

- 已安装 SDK 实际 JS 导出 `DirectConnectTransport`、`parseDirectConnectUrl`。源码会请求服务器 `/sessions`，接收 `session_id/ws_url` 后建立 WebSocket，也存在 sessionKey、可选关闭时删除 session 等逻辑。这证明“SDK 一切场景只能本地 spawn”过强；但这是特定 server transport，不是已证明可连接任意已开的 TUI session 的只读 observer。[S4]
- 官方包还有 `attachBridgeSession`，类型说明其使用既有 bridge/CCR session 与 worker 凭据，可重新连接/镜像。它是明确的“可以 attach”的反证，但需要已建立 bridge 协议及凭据，不能偷换为普通本地 session 的无需配置输出订阅。[S4]
- SDK 有 `getSessionMessages`、`listSubagents`、`getSubagentMessages` 等历史读取接口。它们支持只读读取存储的结论，却是 Promise 返回的读取操作，不是实时订阅 iterator；也不是引入 SDK 的必要理由，直接文件观察更小。[S5]

所以应表述为：**默认 query 管理另一次执行；某些 bridge/server transport 能 attach。对用户这个已开的普通原生 session，本轮只证实文件只读观察路径，未证实无需额外宿主接线的公开原始输出流订阅。** 未尝试连接服务器、创建 remote session、索取凭据或激活桥接。

## 6. 与 Sandcastle 的精确差异

固定版本 Sandcastle `Orchestrator.ts` 在 `sandbox.exec(..., {onLine})` 中先转发原始 stdout 行，再解析 provider 事件，最后 `resetTimer()`。源码要求连 parser 丢弃的行也交给 raw-line 接收者。这不是通过 stat/mtime 观察日志。[W6]

可移植的是**策略接口**：`收到一行 → 保存 → 更新 deadline`。不能声称等价的是**被观察通道**：

- Sandcastle 收到自己启动的命令的 stdout 行；transcript observer 收到 Claude 选择持久化、再经异步写盘的会话记录。
- stdout 的一条 stream-json 事件和 transcript 的一条 JSONL 记录不是一一映射；partial events、内部 progress、工具输出分块均可能不同。[W3、W4、W6、L5b、L6]
- 二者都不是“所有 token/所有活动”的万能活性证明；即使 stdout onLine 也可能在未换行或命令不输出时静默。transcript 额外增加持久化与观察延迟。[W6；由通道定义推断]

## 7. 推荐最小路径与未验证项

**推荐：保留原生 Agent + 单个会话级 transcript observer；将 600 秒定义为“新增完整日志行静默阈值”，不是硬性的无误杀判据。** [综合前述证据的工程推断]

最小接线，不要求重构派发：

1. skill 开始时明确目标仓库和当前 session；启动已存在运行时上的公共 observer。它只读源 transcript，只向目标 `.afk/logs/` 写镜像。若只是挂接既有 agent，直接传现有 `output_file` 即可，不需任何 hook。
2. 后续子代理通过父 skill `SubagentStart`/父 `PostToolUse(Agent)` 通知 observer 身份/实际路径，或让 observer 监听已知 subagents 目录的创建事件。Start 时文件可能尚不存在；不靠 mtime 寻找“最新会话”。
3. 源保持追加写入且观察连续性成立时，只对各子代理新增完整行更新其 600 秒计时；旧行回填、其他子代理输出、observer 自身日志、重复文件通知不续命。当前进程内状态足够，不要恢复账本/SHA；连续性无法确认时改报观察未知，而不是保证重写后仍无遗漏或无重复。
4. 既有编排负责明确结束/取消 observer。不能用父 skill 的 SubagentStop 覆盖假设兜底；父 PostToolUse 的异步派发返回也不是终止事件。
5. 到 600 秒先报告“observer 600 秒未观察到该 agent 的新完整行”。纯事件驱动不能保证及时发现所有新增；没有显式错误不证明监听正常。若未再次补读源文件，不能区分源静默与通知漏失。可以研究在超时边界做一次补读（不是 mtime 周期轮询），但它也只能核验当时文件状态，不能证明 agent 停滞。若产品坚持此时自动 TaskStop，那是接受误杀可能性的策略，不是研究已经证明 agent 真 idle。纯只读 observer 本身不具备停止原生 agent 的权限或流控制句柄。

**未验证**：本机事件延迟/丢失率、运行期日志最长空白、Start/返回路径/文件创建的所有竞态、特殊 fork 子目录与 skill hook 继承、停止时最终刷盘与 observer 退出顺序、从当前普通 TUI 直接附加 native 输出流的公开接口。未为填补这些空白启动实验。

若需求必须同时满足“保留任意既开原生 session”与“等价 Sandcastle 原始 stdout、逐行无遗漏、600 秒绝不误杀”，**本轮证据不足以承诺**；不能以“只能独立 CLI”替代这个精确边界。

## 来源索引

### 官方网页（滚动版本，检索于 2026-09-12）

- **W1**：[Claude Code subagents：resume/persistence](https://code.claude.com/docs/en/sub-agents#resume-subagents)，并读 `https://code.claude.com/docs/en/sub-agents.md` 第 1087–1099 行：子代理路径、独立持久化、清理与压缩。
- **W2**：[Hooks reference](https://code.claude.com/docs/en/hooks)，重点 `#where-hooks-live`、`#hooks-in-skills-and-agents`、`#common-input-fields`、`#subagentstart`、`#subagentstop`、`#pretooluse`、`#posttooluse`；当日 `.md` 第 267、688–714、748–768、1965–1967、2328–2387 行。最新文档还包含高于 2.1.228 的字段，本文不将其全部倒推为本机能力。
- **W3**：[SDK hosting / subprocess model](https://code.claude.com/docs/en/agent-sdk/hosting)、[SDK sessions](https://code.claude.com/docs/en/agent-sdk/sessions)、[Streaming output](https://code.claude.com/docs/en/agent-sdk/streaming-output)。先经 Context7 resolve→query 查询，再结合本机源码核实。
- **W4**：[CLI reference](https://code.claude.com/docs/en/cli-reference)：`--output-format`、`--include-partial-messages`、`--forward-subagent-text`、`--no-session-persistence`。这些是研究选项，未执行。
- **W5**：[Node.js fs.watch caveats](https://nodejs.org/api/fs.html#fswatchfilename-options-listener)，对应 [官方 Markdown](https://nodejs.org/api/fs.md) 当日第 5359–5405 行：OS 事件、stat polling 区别、inode 重建、filename 不保证存在。
- **W6**：[Sandcastle 原作者源码，固定 commit e99f832f26dc9d245c019a9ddd19fa5dee792427，Orchestrator.ts 第 138–185 行](https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/Orchestrator.ts#L138-L185)。本轮直接读取对应 raw 官方仓库内容，未做哈希验证。本地既有节选 `/private/tmp/sandcastle-scout-dikZWN/Orchestrator.ts:138–185` 辅助阅读。

### Claude Code 2.1.228：本机路径与行号

- **L1**：`/Users/rolex/Library/pnpm/global/v11/7455-19ff73f750f-d906513539fbaf9b/node_modules/@anthropic-ai/claude-code/package.json:1–5`（版本）；同目录绝对文件 `/Users/rolex/Library/pnpm/global/v11/7455-19ff73f750f-d906513539fbaf9b/node_modules/@anthropic-ai/claude-code/sdk-tools.d.ts:151–205,489–526,559–572`（Agent output/input 与 TaskOutput）。本轮会话工具 schema 也未提供 subscribe/onLine 参数。
- **L2**：`/Users/rolex/.claude/projects/-Users-rolex-Documents-Codes-githubProject-MyProject-rolex-skills/0bb9a8a7-d94d-4aa3-8433-8afe167394f6.jsonl:44`；`/Users/rolex/.claude/projects/-Users-rolex-Documents-Codes-githubProject-MyProject-rolex-skills/0bb9a8a7-d94d-4aa3-8433-8afe167394f6/subagents/agent-ae572b6ad8574e678.jsonl:1–4`。只读链接 `/private/tmp/claude-501/-Users-rolex-Documents-Codes-githubProject-MyProject-rolex-skills/0bb9a8a7-d94d-4aa3-8433-8afe167394f6/tasks/ae572b6ad8574e678.output` 指向该子代理 JSONL。
- **L3**：`/Users/rolex/.claude/projects/-Users-rolex-Documents-Codes-githubProject-MyProject-rolex-skills/20f215d2-67eb-4f6d-9356-8ef64969a25f.jsonl:18`；`/Users/rolex/.claude/projects/-Users-rolex-Documents-Codes-githubProject-MyProject-rolex-skills/20f215d2-67eb-4f6d-9356-8ef64969a25f/subagents/agent-a044cc658fca0c93b.jsonl:1–4`。
- **L4**：`/Users/rolex/.claude/projects/-Users-rolex-Documents-Codes-githubProject-MyProject-rolex-skills/2c8b2ffe-4c23-4652-b16d-e607ccbc7e1a.jsonl:46`；该结果的 `/private/tmp/claude-501/-Users-rolex-Documents-Codes-githubProject-MyProject-rolex-skills/76975a0a-c909-4326-b9d9-4bfd10bf5a30/tasks/a798844e4996af0aa.output` 实际链接到 `/Users/rolex/.claude/projects/-Users-rolex-Documents-Codes-githubProject-MyProject-rolex-skills/2c8b2ffe-4c23-4652-b16d-e607ccbc7e1a/subagents/agent-a798844e4996af0aa.jsonl`。

**L5–L7 共用源码文件**：`/Users/rolex/Library/pnpm/global/v11/7455-19ff73f750f-d906513539fbaf9b/node_modules/@anthropic-ai/claude-code/bin/claude.exe`。这是本机二进制中可读的内嵌 JS，不是完整未压缩源仓库。下列行号按该文件原始 LF 计数，额外给十进制字节偏移和符号，便于定位，不需要倾倒二进制或计算哈希。

- **L5a**：第 **1303704** 行 / byte **257384654** `u6e` 建软链接；第 **1306150** 行 / **261591162** `OA` 生成 transcript 路径；第 **1306157** 行 / **261609409** `QJd` 注册绑定；第 **1318739** 行 / **264230656** `output_file` 渲染说明。
- **L5b**：第 **1306150** 行 / **261598518** `Xkr` 发 task_progress；第 **1306274** 行 / **261880985** `agent_progress` 转 SDK 消息；第 **1306976** 行 / **262582760** 后台子代理进度转发；第 **1318727** 行 / **264224393** 按消息/选项过滤 progress。
- **L6**：第 **1324696** 行 / **268933301–268936475**：transcript 队列、100ms 调度、串行 append、mirror、失败处理；第 **1324700** 行 / **268942983**：`performCompactTranscript` 重写路径。后者仅证明有该机制，不声称每个子代理都会触发。
- **L7**：第 **1306961** 行 / **262525868** `Ydp` 注册/once；第 **1306974** 行 / **262564791** skill 使用 `Dt()`；第 **1306976** 行 / **262573450–262583766** Start 调用、agent frontmatter 注册清理、子代理上下文；第 **1324660** 行 / **268831849** `iIe` Stop 选键；第 **1324666** 行 / **268839904** `zh` 公共输入；第 **1324677–1324678** 行 / **268858379、268864550** hooks 汇总与 `agentId ?? Dt()` 选键。

### 官方 Agent SDK 0.3.220：已安装源码/类型

以下 **S1–S5** 的公共绝对目录为：

`/Users/rolex/Library/pnpm/store/v11/links/@anthropic-ai/claude-agent-sdk/0.3.220/bbddf420da3b8d92b10721ca95c5857e3ad00f6e60340cb4046c1b7149dddd6b/node_modules/@anthropic-ai/claude-agent-sdk/`

目录中的长标识是现有路径，不是本轮计算的校验值。引用文件与行号：

- **S1**：`sdk.d.ts:4476–4572`：task_progress、thinking_tokens、tool_progress。
- **S2**：`sdk.d.ts:164–189,2199–2265,6798–6826`：公共 agent 字段、工具 hooks、SubagentStart/Stop 输入。
- **S3**：`sdk.d.ts:2034–2053`：自定义 spawn；`sdk.mjs:108` 的 ProcessTransport / spawnLocalProcess / resume 参数；`sdk.mjs:136–137` 的 pO/query 调用链。
- **S4**：`sdk.mjs:126–128,140`：DirectConnectTransport、服务器创建/连接与真实 exports；`bridge.d.ts:24–82,96–196,284–296`：bridge handle、attach 及凭据需求。此处仅承认协议存在，不推荐接入或执行。
- **S5**：`sdk.d.ts:759–796,1009`；`sdk.mjs:137–140`：getSessionMessages/listSubagents/getSubagentMessages 存储读取。

工具说明：已先调用 `research`、`browser-tools`；已执行站点 adapter gate，现有 claude/github adapter 的登录/身份命令不覆盖官方文档和源码阅读；未使用标准 WebSearch。主要使用 Context7、本地只读源码、公开官方 URL 的只读获取。
