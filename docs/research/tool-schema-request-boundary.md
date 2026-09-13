# Tool schema 来源：请求边界核对

日期：2026-09-10。只读检查既存日志与路由配置；未修改配置、未启用抓包、未新增 Agent 实验。

## 已确认

工具原始定义由 Claude Code 提供。现有 CPA 日志同时记录了入站与转发请求：两端均保留 Agent.isolation 可选，不能把当前模型看到的必填规则归因于这条记录中的 Claude Code 或本机 CPA 转换。

证据：本机 `~/.cli-proxy-api/logs/error-v1-messages-2026-09-10T190629-bed17b2f.log`。

| 位置 | Agent required | Bash required |
|---|---|---|
| REQUEST BODY，第 33 行 | description、prompt | command |
| API REQUEST 1，第 50 行 | description、prompt | command |

CPA 出站使用 Chat Completions 格式：`messages`、`tools[].type=function`、`tools[].function.parameters`。Agent/Bash 的 function 对象均未设置 strict。不是 Responses 格式，不能以 Responses 默认严格模式直接解释。

当前模型可调用工具接口则把 isolation 等字段列为必填；以上是日志与本会话工具元数据的差异，不是同一次成功请求的完整抓取。该日志请求最终返回 503，不能宣称已追踪到当前成功回复的服务端处理。

## 已定位的上游

`~/.cli-proxy-api/config.yaml:255–277` 中，模型 gpt-6-astra 位于 `openai-compatibility` 的 `lfs` 路由。该路由目标与上述 API REQUEST 的目的地址一致。目标使用 `/v1/chat/completions`。

通过本机 Tailscale 状态只提取目标匹配结果：目标是另一台在线 macOS 设备，不是当前机器。不在本文复制 IP、密钥、完整配置或请求正文。

因此，所查链路为：

```text
Claude Code（isolation 可选）
 → 本机 CLIProxyAPI 7.2.150（出站仍可选）
 → 另一台设备上的 lfs 上游 /v1/chat/completions
 → 尚未可见的服务端适配/模型输入处理
 → 当前模型工具接口（isolation 必填）
```

## 结论边界

- 原始工具定义：Claude Code。
- 已记录请求中 CPA 未把 isolation 加入 required。
- 当前必填版本的确切生成函数/进程尚未查明；调查范围已缩小到 CPA 出站之后及当前工具呈现层，仍需同一成功请求证据确认。
- 不应称为已确认 CPA bug，也不应称为已确认 lfs bug。
- 下一步需要该远端 lfs 服务的源码或既有脱敏入站/出站 schema 记录；没有自动登录远端、抓包或修改设置。

## 本机会话续查（2026-09-10）

- 新会话模型工具接口仍显示 Agent.isolation 必填；Read 的 offset/limit/pages 也均为必填。该现象不限于 Agent，尚不能确定改写者。
- 当前进程的 ANTHROPIC_BASE_URL 指向 HTTP 回环端口 2317；lsof 确认监听进程仍为 PID 23350 的 cliproxyapi。
- 既存错误日志 `error-v1-messages-2026-09-10T190633-7305fffa.log`、`190638-3f308824.log`、`190647-c60a141d.log`、`190706-a80945f1.log` 的第 33 行均显示：Agent required 仅 description/prompt，Bash 仅 command，Read 仅 file_path。第一份日志第 42 行为 Status: 503，未发现 API REQUEST 段。
- 先前引用的 `190629-bed17b2f.log` 已不在当前日志目录列表；其出站结论本轮只能引用先前笔记，不能称为再次核验。
- 当前 `main.log` 扫描时包含本日 650 条 `/v1/messages` 的 200 状态记录，但没有 input_schema/additionalProperties/JSON required 字样。成功状态记录不是成功请求 schema，且未建立与本会话调用的唯一关联。
- 配置中 debug 为 false、logging-to-file 为 true。未修改开关。按当前会话 ID 查找的 `~/.claude/debug/<session-id>.txt` 不存在；不据此推断所有调试资料均不存在。
- 本机候选 `deepseek-harness/packages/host/apiproxy` 的 package.json 标明是 `@deepseek-ai/dsh-host-apiproxy`，职责为该项目自身 API gateway。其 src 关键词检查未找到工具 schema 全字段必填转换，也没有证据将它接入当前 CPA 链路，不将其视为 lfs 实现。
- 本轮未找到本机改写函数，未取得同一成功请求的前后 schema。下一项有区分力的证据是本机 CPA 成功请求出站 schema；获得它若需开启日志或临时插桩，须先获得授权，仅采集工具 schema 白名单，不采集对话或凭证。

## 授权后的主动差分实验（2026-09-10）

用户授权除破坏性写入/删除以外的调查，并授权并发子代理。未修改运行中的 CPA 配置、模型映射或安装包。

### 1. 同二进制、本机模拟上游、成功请求

命令：`node /tmp/schema-boundary-local-probe-20260910.cjs`。

脚本在随机临时目录写独立配置，用已安装 CPA 7.2.150 Homebrew 二进制启动仅回环监听的临时实例；上游为本机 HTTP mock，无真实凭证或对话。请求成功 200，mock 直接收到 `/v1/chat/completions`：

- Agent.required 入站/出站均为 description、prompt；isolation/run_in_background 保持可选。
- Read.required 入站/出站均为 file_path；pages 保持可选。
- function.strict 未设置。

结果：`/var/folders/d9/_0gbv97x6332wsrqhr4fcyj80000gn/T/schema-boundary-AMI87o/result.json`。脚本结束时终止自己创建的临时 CPA 并关闭 mock，不删除文件、不停止原服务。

这排除“此二进制普通 Claude→OpenAI 兼容转换必然把所有属性必填化”，不等于捕获了生产同一请求。

### 2. 绕过 Claude Code 和本机 CPA，直连配置的上游

命令：`node /tmp/schema-direct-probe-20260910.cjs`。使用现有路由凭证，仅在内存读取，发送自编合成消息及无执行功能的 schema_probe；没有发送真实会话或执行返回的工具调用。

两组共六次成功 200。输入 schema 始终仅 marker 必填；保持相同提示和字段，只切换 function.strict：

| strict 输入 | 次数 | 返回工具实参 |
|---|---:|---|
| 未设置 | 3 | marker、isolation、optional_count 全部返回 |
| false | 3 | 仅 marker；isolation、optional_count 成功省略 |

第二组交错顺序 false→未设置→false→未设置，结果一致。原始合成结果保存在 `/tmp/schema-direct-probe-result-20260910-11472.json` 和 `/tmp/schema-direct-probe-result-20260910-12477.json`。

**结论：不经过 Claude Code 和本机 CPA，目标下游路径仍稳定出现受 strict 开关控制的可选字段行为差异。** 显式 strict:false 是该合成场景的有效规避条件。这是行为差分，不能冒充 lfs 内部入站/出站 schema 捕获，尚不能定位具体进程/函数，不能排除模型工具呈现层。

### 3. 并发只读调查补充

- 配置调查代理：PID 23350 打开 `~/.cli-proxy-api/config.yaml`，`/opt/homebrew/etc/cliproxyapi.conf` 软链接到该文件；全文件非注释文本未匹配 payload/override/filter/strict/schema/isolation/required/tool。未读进程内存，因此不保证内存配置与磁盘逐字相同。
- 客户端调查代理：真实安装 `bin/claude.exe` 的 0-based 字节偏移 264206300 处 Agent 运行时 schema 是 `isolation:Dr(["worktree","remote"]).optional()`；264208200 附近 getter 绑定此 schema。不是仅 d.ts。静态路径未发现 shell wrapper 全字段必填化，仍不等于完整动态追踪。
- 下游入口代理：没有匹配目标的已有 SSH alias，也未定位本机对应第一方源码。主执行器用 BatchMode、StrictHostKeyChecking=yes 尝试默认 SSH 入口，仅查询监听者，连接被拒绝；未绕过主机校验、未更改认证配置、未进入远端。
- 固定版本公开源码 `internal/translator/openai/claude/openai_claude_request.go` 已通过 raw.githubusercontent.com 读取。`convertClaudeRequestToOpenAI` 将 input_schema 经 `normalizeObjectSchemaProperties` 放入 function.parameters；该辅助函数只为缺 properties 的 object 补空对象并递归，不增加 required；该工具转换段不设置 strict。与同二进制 mock 结果一致。

### 当前归因级别

从“只有失败日志，无法验证成功路径”推进为“同二进制成功转换保留 optional，直连下游成功请求可重复受 strict 影响”。**问题的可复现触发边界已定位到配置上游及其后续模型处理路径；确切 schema 改写函数仍未定位。** 不宣称是 lfs 某个已知实现的 bug，也不把 strict:false 探针成功当生产修复完成。

## 官方协议补充

OpenAI 官方 Function calling 文档：Chat Completions 默认 non-strict；Responses 在省略 strict 时尝试规范化为严格模式。本次已记录请求是 Chat Completions，不能套用后者作为已验证根因。

来源：https://developers.openai.com/api/docs/guides/function-calling （本日通过 WebFetch 查询；Context7 resolve 两次查询失败，未编造返回结果。）

## 本轮综合复核（2026-09-11）

本节合并四路本机调查及独立反证。未访问远端、未发送在线模型请求、未改生产配置/权限/安装包、未提交；lfs 仍只是可证伪工作假设，不是已确认归因。

### 新增证据

1. **Claude Code 2.1.228：未找到必填化点**

   - 二进制：`/Users/rolex/Library/pnpm/store/v11/links/@anthropic-ai/claude-code/2.1.228/af2d92c0d529948d6ce545d305de135c6d2974efd4af13e149baf52b590ce2e5/node_modules/@anthropic-ai/claude-code/bin/claude.exe`；SHA-256 `43484b1352cef03a08346f36ef0437755b1aad646ab9313ce187857b794b7247`。
   - 0-based 字节 `264204723–264206789`：Agent 的 `description`、`prompt` 为 required；`isolation` 为 `enum [worktree, remote]` 且 `.optional()`。
   - 字节 `264213854–264214245`：缺失 `isolation` 可流经 `s ?? G.isolation`；未见缺失即拒绝或强制补值。
   - 字节 `254544938–254547867`：optional 类型在 input JSON Schema 转换中不进入 required。字节约 `265741800–265743950` 的 strict 路径保留既有 required，未见全 properties 自动加入 required。
   - 回环原始探针 `/tmp/claude-isolation-raw-probe-QCJOp4DP/schema-result-stated-fable-default.json:19-56` 显示 Agent.required 仅 `description,prompt`；但独立复跑 `/tmp/independent-schema-review-claude-20260911.json:4-66`、`/tmp/independent-schema-review-claude-fable-20260911.json:4-66`、`/tmp/independent-schema-review-claude-agent-explicit-20260911.json:4-66` 未捕获 Agent，仅捕获 Bash/Read。故该运行时暴露证据不稳定，不能当作当前会话的确定入站 schema。

2. **CPA 7.2.150：发现 strict 形状差异，未发现 required 变异**

   - 路由配置 `/Users/rolex/.cli-proxy-api/config.yaml:255-281` 只能确认模型匹配名为 `lfs`；非注释配置中没有已确认的 payload/strict/schema/filter/override/required/isolation 改写项。
   - 同二进制回环矩阵 `/tmp/schema-cpa-matrix-20260911-FzScIj/strict-boundary-v2-result.json:4-76,78-437,498-559,682-743,808-855`：Anthropic/Chat Completions、stream/nonstream、strict 缺省/false/true 共 12/12 次 200。Anthropic 形状下 `function.strict` 未出现；Chat Completions 形状下显式 `false/true` 保留；Agent.required 始终 `description,prompt`，Read.required 始终 `file_path`。
   - required 变异矩阵 `/tmp/schema-cpa-required-matrix-KeS4yt/result.json:8-76,182-186,302-304,1114-1118,1143-1144`：24/24 次 200，输入/输出 required 不匹配 0；覆盖正常、空、全字段及省略 required，未自动加入 isolation 或其他 optional 属性。
   - 同名 `lfs` 回环路由结果 `/tmp/schema-cpa-lfs-name-s9ntqG/result.json:3,5-24,27-85,87-145,148-206,209-268`：4/4 次 200，仍只证明本机 CPA 同名路由的临时 mock 转发行为，不是实际 lfs 服务证据。

3. **本机中间层：只定位链路，未定位 schema 改写**

   - TCP/进程证据显示链为 Claude → ClashX Meta → CPA → 非回环上游；Clash 配置 `/Users/rolex/Library/Caches/com.MetaCubeX.ClashX.meta/cacheConfigs/6CBDAB24-3157-45E1-8ABD-ADC73A03163C.yaml:1,3`。无请求级 payload 或关联 ID，不能证明 Clash 改写。
   - CPAMP 与 CPA 均由 launchd 独立启动：`/opt/homebrew/opt/cpa-manager-plus/homebrew.mxcl.cpa-manager-plus.plist:23-35`、`/opt/homebrew/opt/cliproxyapi/sh.brew.cliproxyapi.plist:16-22`；CPAMP 同步/管理 CPA 的记录在 `/Users/rolex/.cpa-manager-plus/logs/cpa-manager-plus.err.log:67-68`，其 README `/opt/homebrew/opt/cpa-manager-plus/README.md:97` 自称不转发模型流量。未找到它参与 schema 改写的请求证据。
   - CPA、CPAMP、Clash 二进制均有 `strict`/`required` 等字符串候选，但只有静态字符串存在证据，没有运行时调用或前后 payload，不能归因。

### 显式校正前文结论

- `/tmp/schema-direct-probe-result-20260910-11472.json:2-30`、`/tmp/schema-direct-probe-result-20260910-12477.json:2-58` 的 strict 缺省/false 差异，**只能证明模型/工具实参行为差异**；输入 required 始终仅 `marker`，不能证明收到的 JSON Schema 被改写。
- 因此前文第 85 行“strict:false 是有效规避条件”只能保留为该合成场景的行为观察，不是 schema 修复；第 96 行“触发边界已定位到配置上游及其后续模型处理路径”降级为“该合成行为可在直连下游路径复现”，首次 required 改变点仍未知。
- 本轮 CPA 的 strict 丢失与 required 保持不变同时出现，进一步反证“strict 丢失 ⇒ required 被改写”。历史原始证据保留，不作删除或回写。

### 结论边界

- **本机已定位的具体改变点**：仅确认 Anthropic→OpenAI 形状转换中 `function.strict` 可能被省略；未定位任何把 Agent.isolation 加入 required 的具体函数/进程。
- **未发现/证据不足**：Claude Code 运行包普通 schema 转换、CPA 已测转换路径均未必填化；Clash、CPAMP、lfs 均没有同一成功请求的 schema 前后证据。不能确认 lfs 改写，也不能证明 lfs 没改写。
- **实际测试**：CPA 回环 12/12、required 矩阵 24/24、同名 lfs 临时路由 4/4 均成功；required 变异不匹配 0。Claude 原始回环探针曾捕获 Agent optional，但当前复跑暴露集合不稳定，不作为当前会话确定证据。
- **能否解释 isolation 变必选**：不能。现有证据既未找到 required 改写点，也未证明最终模型接收的就是 API `input_schema`；当前必填规则可能来自未捕获的下游/呈现层，但不得据此猜测。
- **下一项最小实验**：由 lfs 侧对一条可关联的成功合成请求提供两份仅含 `name`、`type`、`properties`、`required`、`strict`、`additionalProperties`、`enum`、`nullable`、`anyOf` 的入站/出站脱敏记录；比较首次改变 required 的边界，不记录 prompt、凭证或完整请求。
