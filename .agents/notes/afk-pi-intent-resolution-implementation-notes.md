# AFK Pi 选择意图解析实施记录

## 范围与边界

- 用户要求 Pi 默认为 `luna + max` 意图，每次 start 查询当前完整可用注册元数据，唯一且能力明确才启动；同 run 三角色固定准确选择。显式完整模型/effort 优先，显式其他模型省略 effort 不补 max。CLI 默认 Claude、已授权权限 defaults 不变。
- 已检查 git status 和相关 diff；保留本轮前一任务及所有无关改动。不 commit/push、不真实付费推理、不写全局配置、不动旧 quarantine。
- 已读 CONTEXT、ADR 0004/0005/0006；调用 pre-implement、tdd、writing-for-agents（含 SKILL-MECHANICS）、domain-modeling。
- 用户已确认测试 seam 为公开 start/status/stop；临时 fixture `/tmp/afk-pi-intent.RPqUSt`，旧 `/tmp/afk-permission-model.Weyn90` 只读借鉴。

## 发现与决策（进行中）

- Context7 `/earendil-works/pi` 查询官方 ModelRegistry、CLI `--list-models`、RPC `get_available_models` 文档；文档混有旧版 `@mariozechner` API，需以本机 0.85.1 安装源码核实。
- 本机 `dist/cli/list-models.js` 仅输出 provider/id、reasoning yes/no 等列，不能证明 max；不可由 thinking=yes 推断 max。
- 本机 RPC 返回完整 Model snapshot，但进入 RPC 会绑定扩展 session 生命周期；正核查是否存在不创建 AgentSession、不发推理、不写配置且覆盖扩展的安全发现入口。
- 不直接读取或输出凭据文件、整份模型配置；加载元数据需收窄白名单，错误不透传底层文本。

## TDD 证据

- 首个 red：复制旧公开 seam fixture 到独立目录，仅将默认期望改为 `current/gpt-5.7-luna`。`node /tmp/afk-pi-intent.RPqUSt/check.mjs pi` 退出 1；证据 `red.log` 及目录内 JSON。该测试目前仅证明旧硬编码不满足新的默认映射，不证明发现接口或覆盖完整模型源。

## 安全门审查与阻断

- 顾问只读复核 0.85.1 `core/agent-session-services.js`、`model-runtime.js`、`package-manager.js`、`settings-manager.js`、`extensions/loader.js`：无 Session services 能合并扩展注册，但 resource loader 会解析包，缺包可能安装，并执行扩展模块/factory。禁止 Session 不等于禁止任意扩展自行联网或写全局。
- `allowModelNetwork:false` 仅限制模型 runtime 自身刷新；`PI_OFFLINE` 仅阻止内建安装且可能跳过缺包，不能据此保证完整注册集或扩展无副作用。SettingsManager 默认 projectTrusted=true，不能不经 CLI 信任判定直接采用。
- `getSupportedThinkingLevels` 可确认注册元数据支持：reasoning=true，且 thinkingLevelMap 对应级别非 undefined/null。max 映射为其他值也算注册支持，不代表真实后端原生 max 或调用成功。
- 因当前约束同时要求完整扩展覆盖、无隐式安装、不付费推理、不写全局配置，不能把裸 services 或 RPC 当安全只读接口。可选后续方向：受限独立进程禁止网络/全局写入并严格检查完整性，或在无法证明安全/完整发现时 fail-closed；未擅自引入隔离框架或放宽权限。

## 继续实现：声明式发现＋动态来源 fail-closed

协调者后续要求继续最小声明式方案，不引入 OS 沙箱。新增 `scripts/model-selection.mjs` 小 seam；默认 start 强制调用，公开 `resolve-selection` 复用，选择通过 IPC 传 daemon 并保存 `selection.json`，start/status/最终结果显示固定选择及来源。providers 原有权限/argv 接线未改。

- 安装定位只读 PATH 的 pi 文件：npm 符号链接或 pnpm 字面 `cmd-shim-target`，不执行 shell。仅已核实 `@earendil-works/pi-coding-agent`/`pi-ai` 0.85.1；缺依赖/未知安装布局失败，不安装。
- 动态门：全局与目标项目 settings 的 extensions/packages、自动 extensions 目录；保守检查项目祖先，即便可能禁用/不可信也不执行来判断。任何来源存在或检查失败即拒绝自动选择。配置目录支持绝对、~、file URL；相对覆盖值拒绝，避免角色 cwd 改变配置来源。
- 纯目录 `models.generated.js` 经 provider 数据 JSON 和 `flattenModelCatalog` 只构造对象；`ModelConfig` 只加载/校验 JSONC。其 paths→child-process 是传递导入，没有顶层 spawn。未加载 runtime、auth、provider-composer、扩展或 Pi CLI；配置内 apiKey/header 等必要 schema 校验只留内存，不求值、不投影输出。
- 合并按安装源码：内置目录→models 同 ID 替换（reasoning 省略 false，不继承旧 map）→modelOverrides 最后应用、thinkingLevelMap 按级别合并；API/baseUrl 仅内部检查，不输出/解析命令。
- 匹配仅 ID 内由首尾或 `.`、`_`、`/`、`-` 分隔的完整 luna token、忽略大小写，不用 provider/display/fuzzy。先判所有注册模型唯一，再检查 effort；不能剔除无能力候选后伪造唯一。
- 默认 effort=max，显式 effort 优先；reasoning=false 时非 off 不支持，map[level]=null 不支持，max/xhigh 映射缺失能力未知；其他等级依据 0.85.1 明确能力规则。注册 map 把 max 映射为 high/xhigh 仍算注册支持，不声称后端原生 max。
- 显式完整 Pi model 绕过默认发现，来源 `explicit-unverified`，不证明认证/能力。仅旧完整 `cliproxy/gpt-5.6-luna` 保留省略 effort 补 max 的覆盖语义；其他显式模型不补。Claude/Codex 行为保持。

## TDD 与最终证据

- `/tmp/afk-pi-intent.RPqUSt/selection-check.mjs`：公开 start/status/stop，Pi/Claude/Codex/Git/gh/wt 全为临时受控 CLI。Pi 安装外部边界用临时 package 元数据/模型目录，配置校验复用真实已安装 ModelConfig，不 mock 编排器内部。
- `declarative-red.log`：第一组默认/歧义/能力/动态来源/配置错误/显式覆盖 red。`declarative-green-1.log` 暴露 null 观测值误传原 provider 校验，修复为运行配置 undefined、外部观测 null；`declarative-green-2.log` 13项通过。
- 顾问发现 file://配置目录漏检/相对 cwd 漂移；`paths-red.log` 复现，修复后 `paths-green.log` 20项通过。
- 最终 `final-green.log` 与 `/tmp/afk-pi-intent.RPqUSt/declarative-DGdWZx/report.json`：**29项全部通过**。覆盖唯一、新 ID、新 provider、同/跨 provider 歧义、零匹配、未知/不支持 max、reasoning=false、全局扩展配置/目录、项目包、file URL、相对目录拒绝、非法 JSON/schema、模型路径不可读、未知版本、custom/builtin override map、显式完整/effort/旧模型与其他模型省略语义、Claude/Codex 默认/显式。
- 同一临时 repo 反复改列表后 start：新 ID/provider 被采用、歧义/删除被拒，非缓存。三角色测试 Implementer 结束即把 models.json 改为空，Reviewer/Merger 仍实际以同一完整 model/max argv 启动，status 固定；经 stop/status 到 stopped。记录位于上述最终 fixture 的 `roles.jsonl`、`repo/.afk/logs/*/selection.json` 与 events。
- `three-roles-check.log` 是中间 fixture 错误（/tmp 与 /private/tmp 比较及 staged diff stub 过宽），不是生产失败；当次已终止 waiting-user，无存活角色。修正临时 stub 后 `three-roles-green.log`、最终29项通过。
- 本机无推理检查：`local-readonly.stderr` 显示动态来源拒绝，stdout 为空；没有绕过本机扩展。
- 实际安装纯导入探针：`readonly-guard.mjs` 阻断 child_process、网络常用接口、文件写 API、auth.json 读取；临时 agentDir `!touch` 哨兵未执行。`readonly-import.stderr` 报注册模型歧义（不是禁用操作异常）。`builtin-luna-metadata.json` 仅白名单元数据：实际内置目录已有 **14个** Luna token 模型。因此即无扩展、全声明式注册口径在当前0.85.1目录也会歧义；没有认证过滤来隐蔽消歧。此哨兵不是 OS 沙箱或所有副作用路径的形式化证明。
- `node --check`（afk/model-selection/providers）及 `git diff --check` 通过；无新增仓库 runner test，无付费请求、全局配置写入、commit/push。

## Deviations 与限制

- 最初在生产实现前暂停安全边界；后按协调决策继续，采用**声明式注册**而非“认证可用/扩展完整注册”。默认在本机动态来源与当前内置多 Luna 下清晰拒绝；不宣称真实本机默认已成功启动。
- 只保存同 run 准确 flags，不冻结外部 CLI 可执行文件、模型后端或运行期间用户更改的配置；不逐角色重新选择或静默换模型。
- 未真实运行 Pi/Claude/Codex 角色推理；自然语言路由为文档规则，不是端到端自然语言实测。未做未知 Pi 版本适配，不增加 OS 沙箱、registry framework 或隐式依赖安装。
