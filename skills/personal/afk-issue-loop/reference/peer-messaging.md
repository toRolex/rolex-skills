# Herdr 跨 session 通信

本协议只用于 `mode=herdr`；subagent 沿用原生任务通知。Herdr 管面板、cwd 启动、交互阻塞 UI、退出与进程核验；`ListAgents` 发现 peer，`SendMessage` 传身份、初始任务、进度、恢复、完成和问答。控制者仍独占 dispatch/runbook、已验收 plan、四 Ticket 槽与唯一串行 Merger。

## 发现与身份握手

1. 启动前检查 `HERDR_ENV=1`，加载 Herdr skill 并核对当前接口；确认控制者与角色可用 `ListAgents` / `SendMessage`。缺能力时等待，不自动改用 UI 传业务任务。
2. 控制者持久化启动 intent：`run_id`、`role`、`ticket`（Planner 为 null）、`unit_id`、`stage`、`attempt`、唯一 `binding_nonce`、预期绝对目录/branch、模型、模板与 runbook 绝对路径。Herdr 启动后补 `pane_id`、`herdr_name`、可获取的 session/task ID；未知值标记未知，不伪造。
3. Herdr `agent prompt` 仅给本次准确 pane 的角色发送**只读握手引导**：本协议绝对路径、上述身份参数、nonce，要求检查现场并等待 TASK，不能夹带执行角色模板的指令。随后 `ListAgents` 发现候选；仅向本次可关联的候选发只读 IDENTIFY 挑战，不群发业务任务、不根据名字猜归属。候选关联不足则通过该 pane 的握手回报核对，不向无关会话泄露任务材料。
4. 角色通过 `SendMessage` 回复 IDENTITY，回显 nonce 与身份，报告实际 cwd、branch、session 标识（若可获取）及实际模型证据。控制者交叉核对本次 pane/启动记录、现场和 nonce，身份匹配后才保存 `binding: ready`。缺任一关键证据继续等待；自报模型名称不能替代可核实的运行证据。
5. `ListAgents` 的 name 才是消息地址；Herdr name、pane ID 均不是。复制发现结果的 name；仅同名歧义或工具错误要求时附准确 ` [ref]`。首次明确未送达的歧义错误，按返回地址重发同一消息，不创建新业务 attempt。回复复制收到的 `<cross-session-message from="...">` 的完整 from 值作为 to，并核对是否仍是已绑定发送方。
6. IDENTITY 已由原生消息返回、现场和模型门通过后，控制者才发 TASK（恢复为 RESUME），携带完整角色参数与模板路径。角色 ACK 后按模板执行。握手不是角色业务任务，不能触发 Planner 写 plan 或其他业务写入。

**完成标准**：dispatch 中存在可验证的 pane ↔ session/peer ↔ role/attempt ↔ 现场映射，且写任务发送前完成双向身份握手。单次发送 success 不构成闭环验收。

## 消息信封与持久化

所有消息使用同一信封；握手前未知的 session/base 字段显式 null 并注明原因，TASK/RESUME 前补齐该阶段必需信息：

```text
protocol: afk-peer-v1
type: IDENTIFY | IDENTITY | TASK | RESUME | ACK | PROGRESS | QUESTION | ANSWER | BLOCKED | COMPLETE | STOP | STOPPED
run_id, role, ticket, unit_id, stage, attempt
message_id, reply_to, binding_nonce, session_id
expected_dir, expected_branch, implementation_base_sha, review_base_sha, target_before_sha
prompt_path, runbook_path
payload: 参数、证据位置或问题
```

- `message_id` 是发送前生成并持久化的应用消息 ID；重传沿用。工具返回的 `msg_id` 另存为 transport ID，不能混为 attempt/task ID。`reply_to` 关联被回复消息。
- 控制者在 dispatch 记录 `peer_name`、`peer_ref`（无则 null）、准确 `peer_address`、发现时间、绑定身份与证据；消息日志记录方向、应用/transport ID、发送结果、ACK、处理/验收状态、证据路径。只有控制者写运行记录，角色通过消息请求登记。
- 接收先匹配实际发送方绑定，以及 `run_id + role + ticket/unit + stage + attempt + session`；再按 message ID 去重。过期、身份不符、重复消息只归档，不推进状态、不重复业务副作用；重复 COMPLETE 即使用新 ID，也由当前单元已验收标记去重。
- ACK 仅证明接收，不能推进阶段；COMPLETE 仅触发各角色原有证据验收。Planner 的 payload 保留 `<plan>`，其他角色保留 `<promise>COMPLETE</promise>`；提交、测试、GitHub、清理与退出仍分别核验。短输出约定指 payload，不省略信封与证据引用。
- Merger 等待控制者对精确 revision/SHA 的“证据已持久化” ANSWER 后才清理；运输 success 或普通 ACK 不替代该确认。

## 超时、重启与权限

送达成功但无 ACK：先查发送结果、绑定、角色存活及交互阻塞；可发送关联原消息的只读状态询问。结果不明时不盲目重发写任务或另起角色。只有明确未送达，或已绑定角色确认未执行且可去重时，才重传原 message ID。消息故障不计业务失败或模型升级次数。

peer 重启或控制者恢复后重新 `ListAgents`，重新握手核对原现场；历史 ref 只作审计，不能直接复用。旧角色及写入子进程未核实退出时，不启动替代写者；恢复新角色增加 attempt，沿用 Ticket/stage/现场/槽位和固定基线。旧 attempt 通知只归档。

`Herdr done`、settled、idle、STOPPED 自报均不证明进程退出。STOP 后角色停止新业务并报告残留进程与现场；控制者按 Herdr 契约退出本次角色，核实会话及写入子进程退出，再交接。working 时 `recent-unwrapped` 的 `agent_not_idle` 是观察限制；必要时用 visible 取 UI 证据，常规业务通信不用滚屏。

消息工具明确拒绝走权限门：不修改其他 peer 权限，不把本会话被拒动作转交 peer，也不换 UI 绕过。分类服务暂不可用等明确服务故障与用户拒绝分别登记，先核实服务；已有具体拒绝仍保留，模型门仍有效。requested model 与实际证据不符或必需模型不可确认时报告 `MODEL_UNAVAILABLE`、暂停业务，不在 prompt 中冒充模型或擅改策略。

## 隔离验收矩阵

在只读模拟记录或专用隔离测试现场逐项记录输入、预期、观察、结论；不覆盖产品运行证据。文档走查/静态检查不能声称真实双向通信通过。

| 场景 | 必须观察到的结果 |
|---|---|
| Herdr name 与 peer name 不同；同名需 ref | 从发现/错误复制准确地址；nonce 与现场匹配后才发 TASK |
| 送达但无 ACK | 不推进、不重派；查交付与存活 |
| IDENTITY 返回 | 原生双向消息可关联；身份不符不发写任务 |
| 旧 attempt 通知、重复 COMPLETE | 只归档；阶段/关闭/清理不重复 |
| peer 重启 | 重新发现/握手；不复用旧 ref；旧写者退出才重派 |
| Herdr done 但进程仍在 | 不交接、不释放槽 |
| 0 运行角色、4 recovering | 显示两种计数；无第五 Ticket |
| 多 Ticket reviewed | 唯一 Merger 串行；不等全批 barrier |
| 消息权限阻塞／服务暂不可用 | 分别登记；不绕过权限、不记业务失败 |
| MODEL_UNAVAILABLE | 暂停业务；不以启动参数或自报冒充实际模型 |
