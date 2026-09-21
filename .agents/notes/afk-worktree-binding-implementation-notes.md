# AFK Worktree 现场绑定修复

## 目标

修复 Worktrunk 指定现场与 Agent 原生隔离现场冲突；仅修改 skill，不操作 Research OS Studio 既有会话或 Tickets。

## 决策与进度

- 历史证据：session `e699b13f-8ca6-459c-ac8c-18d693aea9b9` 主日志 496 行同时传入 `isolation: worktree` 与外部 WORKTREE；恢复子代理 `a46f599ffa5c4a38e` 日志 15 行明确拒绝跨现场 Git 操作。普通 Read 成功。
- 当前 Agent schema 强制 isolation，不能虚构 `none` 或 `cwd` 参数。采用能力选择：可复用现场的 subagent；否则在可用 Herdr 内以目标 cwd 启动独立角色。默认模式在启动前自动选择；显式模式及已被拒绝的历史运行不静默切换。
- 已查询 Claude Code 官方 Context7 文档及本机 `claude --help`、Herdr 帮助。独立 Herdr 角色启动不加 `--worktree`，保留正常权限与项目配置；不修改权限设置。
- 现场绑定以独立 reference 为权威，四角色在业务写入前加载；命令显式寻址，避免 subagent cwd 跨工具调用不持久。

## 验证

- 统一契约已落在 `reference/workspace-binding.md`；主步骤及四角色通过带触发条件的指针进入，ask-rolex 同步默认载体选择。
- 顾问首轮发现三处阻断并已修复：Planner 前准备目标分支；所有角色（含 Planner）完成后退出并核实；plan 未验收时恢复 Planner attempt 而非跳过。二轮复核通过。
- 既有脚本测试：55 通过、0 失败；本地链接及锚点：49 个、0 错误；`git diff --check` 通过。首版临时链接检查把合法目录链接误报为缺失，修正检查器后通过，未修改合法链接。
- 真实 Herdr 验证：新建 `w2Q:p2`，从本仓库绝对路径以 `claude --model sonnet` 启动 `afk-binding-check`，session `df8abd9f-b5c8-4828-a08a-eea0b2145c70`。角色实际 cwd 与 main 匹配，四条只读 shell/Git 检查成功，无隔离器拒绝。模型名称由本机配置解析，不据命令行别名声称实际服务模型。
- 验证角色输出 ready 后仍 idle，证实必须显式退出。`/exit` 后进程检查仅剩 shell，再关闭本次 pane；未控制历史项目会话。
- 验证局限：此次真实测试使用本仓库主 checkout，只证明精确 cwd 启动、只读 Git 与退出清理；未在外部 linked worktree 验证写入、commit 或完整 Ticket 审查合并闭环。没有修改权限配置。
- 已安装 skill 经软链接直达本仓库，无新增或重命名 skill，不需要重新链接。未提交或推送，保留用户既有改动。

## Deviations

- 不承诺消除一切权限阻塞；修复配置冲突不等于授权任意路径。当前任务不自动恢复或控制原项目 session。
