# AFK Issue Loop — Reference

## 依赖解析

issue 的 body 中使用 `Blocked by` 字段声明依赖（格式：`- #<id> — <描述>` 或 `None - can start immediately`）。

解析规则：
1. 从每个 issue body 提取 `Blocked by` 列表
2. `None` 或只有已关闭 issue 的 → **可立即分派**，互不依赖的可以并行
3. 有未关闭依赖 issue 的 → **等待**，放入等待队列
4. 每个 issue `DONE` 后，重新检查等待队列中被它阻塞的 issue 是否所有依赖都已满足

展示分组：
```
可立即开始（可并行）：
  #90 M2M迁移
  #82 ShortLink 模型

等待依赖：
  #91 报名合并支付 ← 等待 #90
  #92 支付页 ← 等待 #90
  #93 前端串联 ← 等待 #91, #92
```

## 状态处理

子 agent 汇报四种状态之一，按以下方式处理：

| 状态 | 动作 |
|---|---|
| `DONE` | 子 agent 已在 worktree 内用 `git merge --no-ff --no-squash` 本地合入 develop，清理 worktree 并删分支。控制者检查依赖图解锁被阻塞的 issue |
| `DONE_WITH_CONCERNS` | 阅读疑虑；正确性相关的分派修复 agent（不手动修）；观察性疑虑记录后 merge，检查依赖图 |
| `NEEDS_CONTEXT` | 保留 worktree，提供缺失信息后重新分派 |
| `BLOCKED` | 保留 worktree，评估原因后：补上下文 / 换强模型 / 拆分 issue / 上报。**绝不忽视** |

## 阶段 3：收尾

所有 issue 实现完成后，报告统计（实现了几个 issue、生成几个 commit），然后提示用户进行 code review 和 QA：

> 所有 issue 已实现并合并。建议先进行 **code review**（审查代码正确性、风格、安全性），再执行 **QA 测试**（端到端行为、回归验证）。经典流程：code review 通过 → 部署到测试环境 → QA 测试。

如有新 issue，提示可再次运行 `/afk-issue-loop`。

## 模型选择

按任务复杂度信号选择模型，不纯按文件数：

| 信号 | 模型 | 典型 issue |
|---|---|---|
| 单文件、纯机械操作（删除文件、提取常量、重命名、import 更新） | Haiku | 清理临时文件、品牌 Logo 提取为 include |
| 需理解现有模式、1-3 文件、中等复杂度 | Sonnet | 新增模型字段+Admin、Django 模板修改 |
| 跨模块集成、架构决策、调试、>3 文件 | Opus | M2M 迁移、合并支付逻辑 |

**AFK 场景下失败的代价高于交互式场景**——如果 Haiku 搞砸了，需要重新分派，浪费的不仅是 token 还有时间。不确定时向上取整（宁可用 Sonnet 不用 Haiku，宁可用 Opus 不用 Sonnet）。

## 红线

**绝不：**
- 并行分派有依赖关系的 issue（会冲突）——互不依赖的 issue 可并行分派
- 让 agent 自己去读 issue（提供完整文本）
- 跳过 `CONTEXT.md` 注入
- 忽略 agent 的疑问（先回答再继续）
- **控制者手动实现 issue**——每个 issue 必须通过 Agent 分派，无论看起来多简单
- **控制者手动修复子 agent 的产出**——发现 bug 后分派修复 agent（可换更强模型），不在主会话里直接改代码
- **控制者推送到远程 develop**——`git push origin develop` 在任何情况下都不执行。本地 develop 与 origin/develop 分歧时，保留分歧，不影响后续 worktree 创建
- **控制者手动解决 develop 与 origin/develop 的冲突**——不 push、不 merge origin/develop、不解决冲突。分歧是预期状态，由项目维护者决定何时同步
- **使用 Agent 的 `isolation: "worktree"` 参数**——worktree 已由 `wt switch -c` 创建，agent 直接在工作目录中运行，不需要再创建隔离环境
- **使用 `git worktree add` 代替 `wt switch -c`**——必须用 `wt` 命令创建 worktree，保证分支管理和清理的一致性
- **使用 `git -C` 跨 worktree 执行 merge**——应在 worktree 内用 `git checkout develop && git merge --no-ff --no-squash <分支>` 完成。`git -C` 跨 worktree merge 会丢失分支关系，生成直 commit
- **控制者在不重建 worktree 的情况下手动 re-merge**——revert 后通过 `wt switch -c` 重建 worktree 再分派 agent，或手动用 `git merge --no-ff --no-squash` 重做

**agent 行为红线（写在 implementer-prompt 中，控制者不越俎代庖）：**
- Agent **只能在 worktree 目录内工作**，禁止 `cd` 回主仓库或从主仓库执行 git 命令
- **Seam 确认**是硬性检查点：列出 seam → 等待控制者确认 → 控制者确认后才允许开始写测试或实现代码
- **严格执行完整步骤链：测试 → commit → merge → 清理 → 关 issue**。任何步骤未完成即汇报 DONE 视为流程违规，控制者检查后要求补做
- **禁止创建 GitHub PR**：`gh pr create`、通过 GitHub Web UI 合并、或任何形式的远程 merge 都是违规。merge 唯一允许的方式是 worktree 内 `git checkout develop && git merge --no-ff --no-squash <分支名>`
- **Merge 后必须验证**：`git cat-file -p HEAD | grep "^parent" | wc -l` 应为 2。只有 1 个 parent 说明 merge 没成功，不得关闭 issue
- **全量测试结果必须贴实际命令输出**（含通过/失败数量），禁止只说"测试通过"而无证据

**agent 失败或产出有问题时**：
- 分派修复 agent 并提供具体失败信息，不手动修
- 如果是模型能力不足，换更强模型重新分派

**控制者的角色**：只做编排——扫描、分派、验证 commit、合并 worktree。不写任何实现代码。

## 与 Sandcastle Ralph loop 的对应

| Sandcastle | afk-issue-loop |
|---|---|
| `pnpm ralph` | 用户调用 `/afk-issue-loop` |
| Docker 沙箱 | `wt switch -c` worktree |
| 依赖驱动的并行分派 | 控制者解析 `Blocked by`，无依赖 issue 并行分派 |
| 本地 merge develop（不推送） | `git merge --no-ff --no-squash` 在 worktree 内本地合入 develop |
| Ralph 信号完成 | agent 报告 `DONE` |
| Code review / QA | 提示用户手动执行 |

## herdr 模式注意事项

### herdr agent start 三要素

```bash
herdr agent start <名称> \
  --cwd "$(pwd)" \                # 必需：否则 agent 在 / 根目录启动
  --env "PATH=$PATH" \            # 必需：否则 nvm node、uv 等工具找不到
  --workspace "$WS" --tab "$TAB"  # 必需：缺省会新建 tab 而非分割本 tab
  --split right                   # 先 right 开列，列满 3 改 down 堆叠
  -- claude
```

### 新启动 agent 的等待顺序

claude 初始化需要时间，不能立即 wait：

```bash
sleep 15                         # 等 claude 加载插件和 skill
herdr agent wait <agent名称> --until idle --timeout 300000
# 注意：命令是 `herdr agent wait <目标> --until <状态>`，不是 `herdr wait agent-status`
```

### 发送指令（两种方式）

**方式 A（推荐）：`herdr pane send-text + send-keys Enter`**

```bash
herdr pane send-text $WS:pX "完整prompt文本"
sleep 1
herdr pane send-keys $WS:pX Enter
```

**方式 B：`herdr agent prompt`**

```bash
herdr agent prompt <agent名称> "prompt文本" --wait --timeout 600000
```
注意：**不要加 `&` 后台化**，必须前台等待提交完成。agent prompt 等待的是 idle 状态（Claude Code 完成后回到 idle 不是 done）。

`herdr pane run` 在某些场景下只粘贴不提交，推荐优先使用上面的显式方式。

### 发后验证（新增——必须执行）

下发指令后 10s 内验证 agent 确实开始工作：

```bash
sleep 5
herdr agent list | grep <agent名称>
# 确认:
# - agent_status = working（不是 idle）
# - terminal_title 变为实现标题（不是 "Claude Code"）
# - state_change_seq 有变化
# - 可选：cwd 显示已在 worktree 内
```

验证不通过（agent 仍 idle、标题未变）→ 重试发送，可换 `send-text + Enter` 方式。

### 轮询协议（新增——必须执行）

herdr agent 完成后回到 idle 状态但**不会通知控制者**。控制者必须主动轮询。

**基础轮询**（每 5 分钟执行）：

```bash
herdr agent list | grep <agent名称>
# 重点检查 agent_status 和 terminal_title
```

**轮询时机**：
- 简单 issue（单文件、机械操作）：dispatch 后 2-3 分钟开始轮询
- 中等问题（1-3 文件）：dispatch 后 5-10 分钟开始轮询
- 复杂 issue（跨模块、>3 文件）：dispatch 后 10-20 分钟开始轮询

**发现完成后的验证**：

```bash
# 1. 读取 agent 最终输出
herdr agent read <agent名称> --source recent-unwrapped | tail -80

# 2. 检查汇报格式：应有 DONE 状态、测试结果、merge commit、issue 关闭
# 3. 外部验证三项：
gh issue view <id> --json state           # → CLOSED
git log --oneline develop -5              # → 含对应 merge commit
wt list | grep <issue-id>                 # → 无匹配（worktree 已清理）

# 4. 完成 → 关闭 pane，解锁依赖
herdr pane close $WS:pX
```

**关闭所有未验证 agent 的 pane**：issue 全部完成后，执行 `herdr pane list | grep "issue-"` 确认无残留。

### 场景：Seam 确认等待

agent 需要 seam 确认时会等待控制者输入。此时 agent 状态为 idle 但 terminal_title 显示正在等待。控制者读取输出后发送确认：

```bash
herdr pane read <pane> --source recent-unwrapped | tail -30
# 看到 seam 列表后确认
herdr pane send-text <pane> "Seam 确认通过。开始 TDD 实现。"
sleep 0.5
herdr pane send-keys <pane> Enter
```

确认后 agent 从 idle 变为 working。如果 10s 后仍 idle，重试确认发送。

---

## 完整 dispatch 流程（herdr 模式速查）

```
1. pane split --direction right       # 创建 pane
2. agent start <名称> --kind claude   # 启动 agent
3. sleep 15                           # 等待初始化
4. agent wait <名称> --until idle     # 确认就绪
5. pane run / send-text+Enter         # 发送 prompt
6. sleep 5 + agent list 验证          # 确认 agent 开始工作
7. 5分钟后开始轮询                     # 主动检查完成
8. agent read + 外部验证              # 验证完成
9. pane close                         # 关闭 pane
10. 解锁依赖, dispatch 被阻塞的 issue
```
