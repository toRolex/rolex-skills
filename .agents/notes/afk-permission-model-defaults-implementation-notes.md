# AFK 默认权限与 Pi 模型选择 implementation notes

## 范围与决策

- 用户明确要求对齐 Sandcastle 默认放权：Claude skip-permissions、Codex bypass approvals/sandbox，Pi 不添加权限 flag。仅修改 AFK 子进程 argv；保留保护环境变量、身份、外层 sandbox 与拒绝处理。不启动真实 AI CLI，不改本机配置，不 commit/push，不清旧现场。
- CLI 默认仍 Claude。Pi 省略模型采用 `cliproxy/gpt-5.6-luna`，该默认模型省略 effort 使用 `max`；显式其他模型不补 max，显式参数优先。
- 模糊模型表达由 skill 启动者结合本机可用模型解析；唯一匹配才补全，歧义询问。后端保持准确 flags seam，不解析任务正文。
- 已检查初始 git status；既有用户修改及旧临时现场保持不动。已读 writing-for-agents/SKILL-MECHANICS、ask-rolex（流程位置不变，无需修改）、CONTEXT 和现行 ADR 引用；ADR 0004/0005 默认存在冲突，将用后继决策记录替代范围。

## 验证 seam

按用户已指定的公开 `start/status/stop`，仅新临时目录 fixture；替身外部 CLI 捕获实际 argv，不调用真实 AI、GitHub 或 Worktrunk，不新增仓库 runner test。先测权限 red/green，再测 Pi 默认 red/green，最后补覆盖矩阵。受控结果不能证明真实 CLI/EPERM 修复或自然语言路由实测成功。

## 进度

- `providers.mjs` 恢复上游 Claude/Codex 默认权限 flags，Pi 不变；没有改动环境继承、拒绝分类或进程监管。
- `afk.mjs start` 在唯一入口解析 Pi 默认模型与 effort，三角色共用配置；`started` 返回及事件携带有效 provider/model/effort，`null` 表示沿用 CLI 本机配置而非已探测模型。help 同步。
- SKILL 明确选择顺序、CLI/API provider 区别、仅启动选项参与消歧、唯一匹配/effort 支持证据、启动前展示和默认权限边界；EXAMPLES 覆盖简称、歧义、准确 flags 优先和任务正文反例。workspace-binding 改为指向权威规则。
- 新建 ADR 0006，ADR 0004/0005 与来源研究仅加后继指针，历史事实不改。未触碰顶层 README、CLAUDE.md、link-skills 或其他原有用户改动；ask-rolex 流程位置不变。

## 测试证据

所有 fixture 与记录在独立临时目录 `/tmp/afk-permission-model.Weyn90`。仅替身 git/wt/gh/claude/codex/pi，外部命令白名单遇未知即失败；没有真实 AI、GitHub 或 Worktrunk 调用，也无仓库 runner test。每例实际走公开 start，捕获角色进程 argv，再公开 stop/status 确认 `stopped`，现场保留。

- 权限 red：`permissions-1789237654218.json`，Claude/Codex 分别因缺少预期权限 flag 失败。
- 权限 green：`permissions-1789237699674.json`，2/2 通过。
- Pi red：`pi-1789237702540.json`，缺少默认模型与 thinking 导致失败。
- 最终 green：`node /tmp/afk-permission-model.Weyn90/check.mjs matrix`，`matrix-1789238034733.json`，9/9 通过：Pi 默认、仅 effort 覆盖、显式同一默认模型、其他模型省略 effort、其他模型与 effort 同时覆盖、Claude/Codex 默认、Claude/Codex 同时覆盖模型与 effort。
- 最终矩阵逐例核对完整 argv、CLI 身份、绑定 cwd、保护环境变量 `CLAUDECODE` 原样继承、started 的有效模型/effort，以及运行中 status 和 stop 后终态。Pi 完整 argv 证明未加权限 flag；Claude/Codex 默认无 Pi 模型泄漏。
- 两个修改的 mjs 均 `node --check` 通过；`git diff --check` 通过。
- strong-model-consultant 只读复核未发现阻塞缺陷或重要遗漏；主 agent 仍需后续独立审查。

## 限制

受控测试只覆盖公开入口与参数传递/停止，不覆盖真实三 CLI、自然语言路由、真实模型可用性或 EPERM 修复。本次不改变重试编排、worktree 生命周期，不运行既有 `/tmp/afk-spec8-real-cli.ha7ju8` 初始化，不清旧现场，不 commit/push。

## Deviations

- 无产品范围偏离。fixture 的 cwd 断言按 macOS `/tmp`→`/private/tmp` 的 realpath 比较，避免路径别名导致测试假失败。
