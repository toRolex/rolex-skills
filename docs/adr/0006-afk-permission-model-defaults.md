# AFK 默认角色权限对齐 Sandcastle，Pi 默认 Luna/max

依据用户明确要求，恢复 Sandcastle 的角色 CLI 默认：Claude `--dangerously-skip-permissions`、Codex `exec --dangerously-bypass-approvals-and-sandbox`，Pi 不加权限 flag，以满足无人值守执行。权限决策仅替代 [ADR 0005](0005-afk-sandcastle-source-reuse.md) 的「不恢复危险 bypass」部分；不更换身份、不改本机/全局权限、不删除保护环境变量、不绕过外层 sandbox。角色仍可能被外层限制拒绝，拒绝后等待用户；worktree 不是安全沙箱，默认放权只适用于可信目标与任务。

执行 CLI 默认仍 Claude。仅替代 [ADR 0004](0004-afk-local-cli-orchestrator.md) 中 Pi 的「省略模型沿用本机配置」：Pi 省略模型采用 `luna + max` 选择意图，而非固定 `cliproxy/gpt-5.6-luna`。每次 start 查询最新声明式注册目录，按模型 ID 的完整 luna token 唯一匹配、确认 effort 能力后保存准确 provider/model/effort；同 run 三角色固定，不在角色启动时重选。完整显式模型优先、跳过自动发现，标记未自动验证；其他显式模型省略 effort 不补 max，仅显式旧 `cliproxy/gpt-5.6-luna` 保留补 max 的既有覆盖语义。其他 CLI 默认与权限不变。

## 声明式发现取舍

Pi 0.85.1 CLI 列表缺少分级 effort 能力；RPC/完整 SDK 服务会进入扩展生命周期或包解析，不能保证无推理、无安装、无全局写入。选择一个版本限定的小 seam，读取已安装 Pi 的纯内置模型目录和 `models.json` 校验/合并元数据，不加载 auth、不执行配置命令、不加载扩展、不安装依赖。全局/项目扩展或包配置、非空自动发现扩展目录（含保守祖先检查）一律阻断自动选择，不通过扫描扩展源码猜测是否参与注册。配置目录接受与 Pi 一致的绝对路径、`~` 和 file URL；相对覆盖值拒绝，避免角色切换 cwd 后漂移。

这证明的是**声明式注册模型唯一与声明能力**，不是认证可用、远端实际支持或扩展全覆盖。未知版本、非法/不可读配置、不能枚举、无匹配/歧义、effort 不支持/未知均 fail-closed；底层异常不透传，避免泄漏敏感配置。动态来源存在时用户仍可明确完整模型/effort 走未验证路径。此限制相较最初“当前全部可用模型”要求收窄，依据后续协调决策记录；不增加 OS 隔离框架。

自然语言仍由 skill 启动者理解；Pi Luna 复用公开 `resolve-selection` 与 start 的同一路径，不另写匹配器。预览不替代 start 的重新解析，任务正文不参与选择。受控 argv/三角色固定测试与真实 CLI、认证、自然语言路由实测分别记录；证据及限制见 [本次实施记录](../plans/afk-pi-intent-resolution-implementation-notes.md)。
