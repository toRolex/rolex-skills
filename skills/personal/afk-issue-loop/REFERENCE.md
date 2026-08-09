# AFK Issue Loop — Reference

> `${TARGET_BRANCH}` 由 SKILL.md 阶段 0 的分支模型检测决定：有 `develop` 分支（本地或远程）→ Git flow（`develop`）；只有 `main` → trunk-based（`main`），不新建 `develop`。它是 worktree 创建与 Merger squash merge 的目标分支。

## 依赖解析

**主判定：issue body 的 `Blocked by` 字段**（格式：`- #<id> — <描述>` 或 `None - can start immediately`）。

**三条补充**（`Blocked by` 未列出但满足以下任一条也算被阻塞）——issue B 被 issue A 阻塞，当：

1. **资源依赖**：B 需要 A 引入的代码或基础设施（A 未合入则 B 无法开始或无法测试）
2. **空间冲突**：B 与 A 修改重叠的文件/模块，并行工作必然产生 merge 冲突
3. **契约依赖**：B 依赖 A 将确定的 API 或决策形态（A 未定则 B 的实现会返工）

**解析规则**：
1. 从每个 issue body 提取 `Blocked by` 列表
2. `None` 或只依赖已关闭 issue 的 → **unblocked**，可立即分派
3. 有未关闭依赖 issue 的 → **blocked**，本轮不派
4. 每轮 Merger 关 issue 后回到 Planner **重新 Plan**（依赖图可能变化）

**PRD 规则**：有实现 issue 链接的 PRD 不可作为实现对象（由 Merger 在子 issue 完成后统一关闭）。

展示分组：

```
unblocked（可并行，≤4）：
  #90 M2M迁移 → afk/issue-90
  #82 ShortLink 模型 → afk/issue-82

blocked（本轮等待）：
  #91 报名合并支付 ← 等待 #90
  #92 支付页 ← 等待 #90
  #93 前端串联 ← 等待 #91, #92
```

## 协议机制

四角色之间的机器可读信号，控制者据此编排：

| 信号 | 生产者 | 格式 / 含义 |
|------|--------|-------------|
| `<plan>` | Planner | `<plan>{"issues":[{"number","title","branch"}]}</plan>`，只含当前 unblocked |
| `<promise>COMPLETE</promise>` | Implementer / Reviewer / Merger | 权威完成信号 |

- **确定性分支名**：`afk/issue-{N}`。同 issue 每轮重 Plan 恒得同名分支，进度自然保留（resume / 中断恢复依赖此特性）
- **`<promise>COMPLETE</promise>` 是权威完成信号**：Implementer 发出 = 分支可审查；Reviewer 发出 = 审查完成或跳过；Merger 发出 = 全部合并 + issue 已关。`DONE` 等自然语言只是人读摘要（见[状态处理](#状态处理)）
- **真正完成判定（关 issue）只在 Merger**；Implementer / Reviewer 都不关 issue

控制者解析 `<plan>`：正则提取 `<plan>([\s\S]*?)</plan>`，`JSON.parse`，校验每项 `number/title/branch`。

## 模型选择

按任务复杂度信号选择，不纯按文件数：

| 信号 | 模型 | 典型 issue |
|---|---|---|
| 单文件、纯机械操作（删除文件、提取常量、重命名、import 更新） | Haiku | 清理临时文件、品牌 Logo 提取为 include |
| 需理解现有模式、1-3 文件、中等复杂度 | Sonnet | 新增模型字段+Admin、Django 模板修改 |
| 跨模块集成、架构决策、调试、>3 文件 | Opus | M2M 迁移、合并支付逻辑 |

**角色建议**：Planner / Merger 建议 Opus（依赖分析与冲突解决需要全局视野）；Reviewer 与 Implementer 同级或高一档；Implementer 按上表。

**AFK 场景下失败的代价高于交互式场景**——如果 Haiku 搞砸了，需要重新分派，浪费的不仅是 token 还有时间。不确定时向上取整（宁可用 Sonnet 不用 Haiku，宁可用 Opus 不用 Sonnet）。

## 红线

控制者与角色子代理的行为规则（完整清单）：

**分派前**
- 只有 unblocked 的 issue 才分派；跨 issue 并行 ≤4（信号量）；同 issue 内 Implementer→Reviewer 严格串行
- 分派时注入 issue 完整文本（含 comments）与 `CONTEXT.md`（如存在），agent 不自己读 issue
- 分支名必须用 Planner 输出的确定性 `afk/issue-{N}`，不另造名称

**控制者角色**
- 控制者只做编排——分派、解析 `<plan>`、验证、异常处置，**不写实现代码**；发现产出 bug 时分派修复 agent（可换更强模型），主会话不直接改代码
- Seam 预确认：分派时预确认，agent 不等待

**本地 squash merge（不推送、不建 PR）**
- 唯一权威 merge 方式：主仓库（已检出 `${TARGET_BRANCH}`）内 `git merge --squash <分支>`；**不在 worktree 内执行**（git 禁止同一分支在两个 worktree 同时检出）；`wt` 的 merge 子命令不再作为权威
- `git push origin ${TARGET_BRANCH}` 在任何情况下都不执行；`gh pr create`、Web UI 合并或任何远程 merge 都是违规
- 本地 `${TARGET_BRANCH}` 与 `origin/${TARGET_BRANCH}` 分歧时保留分歧，不 merge origin、不解决冲突——分歧是预期状态，由项目维护者决定何时同步
- squash commit message：`feat/chore/fix: <标题>（#N）`（功能前缀，延续中文风格）；前缀由 issue label 推导——`enhancement`→`feat`、`bug`→`fix`、其他（chore/refactor/无 label）→`chore`
- 分支内 commit 用中文描述，不带任何英文字母前缀（不沿用上游 sandcastle 的英文前缀风格）
- squash 后删除分支（`git branch -D afk/issue-{N}`）+ 清理 worktree
- 验证：`${TARGET_BRANCH}` 出现 **1-parent** squash commit（`git cat-file -p HEAD | grep "^parent"` 只输出 1 行）
- **PR 误判修正**：只有匹配 `Merge pull request #N` 才是 GitHub PR merge；agent 自写 message 带 `（#N）` 不算
- 冲突解决：读两侧再选正确结果，**禁 `-X theirs/ours`**

**worktree 与 Agent 环境**
- 统一用 `wt switch -c afk/issue-{N} -b ${TARGET_BRANCH}` 创建 worktree（不用 `git worktree add`）
- 分派 Agent 时不带 `isolation` 参数——worktree 已由 `wt switch -c` 创建

**agent 行为红线**
- Agent 只在 worktree 目录内工作，不 `cd` 回主仓库
- 严格执行步骤链：TDD（红→绿→循环）→ 全量测试（贴实际输出，含通过/失败数量）→ commit（中文）→ `<promise>COMPLETE</promise>`
- **不关 issue**（关闭只在 Merger）
- 全量测试是硬性要求，零回归才可输出 COMPLETE

**agent 失败或产出有问题时**
- 分派修复 agent 并提供具体失败信息，不手动修
- 模型能力不足时换更强模型重新分派（同分支，进度保留）

## 状态处理

**`<promise>COMPLETE</promise>` 与状态的关系**：`<promise>` 是权威完成信号——角色发出即视为本轮求值完成；`DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED` 是自然语言状态摘要，供控制者做异常分类与处置。

| 状态 | 含义 | 控制者动作 |
|------|------|-----------|
| `DONE` + `<promise>COMPLETE</promise>` | Implementer 完成：TDD→全量测试→commit，分支可审 | 触发同分支 Reviewer |
| `DONE_WITH_CONCERNS` | 完成但有疑虑 | 阅读疑虑；正确性相关→分派修复 agent（不手动修）；观察性→记录后仍进 Reviewer |
| `NEEDS_CONTEXT` | 缺少信息无法继续 | 保留 worktree，提供缺失信息后重新分派（同分支，进度保留） |
| `BLOCKED` | 无法完成，需要帮助 | 保留 worktree，评估原因后：补上下文 / 换强模型 / 拆分 issue / 上报。**绝不忽视** |
| 超时（无状态） | 后台计时器先于 `<promise>` 触发 | 见[超时协议](#超时协议) |

Merger 后验证三件事：
- `gh issue view <id> --json state` 返回 CLOSED
- `wt list` 中不再出现该 worktree
- `${TARGET_BRANCH}` 出现对应的 1-parent squash commit（非 `origin/${TARGET_BRANCH}` 上的 commit）；若发现 GitHub PR merge（`Merge pull request #N`），标记流程错误，按红线回滚重做

## 超时协议

**时间分级**（两载体统一，按复杂度预判）：

| 复杂度 | 时限 |
|--------|------|
| 简单（单文件、机械操作） | 2-3 分钟 |
| 中等（1-3 文件） | 5-10 分钟 |
| 复杂（跨模块、>3 文件） | 10-20 分钟 |

**subagent 模式**：
1. 分派时记录 deadline + 后台计时器：`Bash: sleep <分钟> && echo "<agent名> timeout"`（`run_in_background: true`）
2. 计时器先响（先于 `<promise>COMPLETE</promise>`）→ `TaskStop` 终止 agent
3. 查分支 commit：
   - **有** → 按部分完成处理，进 Reviewer 判断
   - **无** → 标记超时，下轮 Planner 重分析或重派

**herdr 模式**：沿用现有轮询协议（`herdr agent list` 查 `agent_status`），见[herdr 模式注意事项](#herdr-模式注意事项)。agent 完成回到 idle 但不会通知控制者，必须主动轮询。

## 并行冲突处理

- 跨 issue 并行 ≤4（信号量）；同 issue 内 Implementer→Reviewer 严格串行
- 空间冲突的 issue 由 Planner 判为 blocked 避免并发；已并行的重叠分支由 Merger 统一合并时读两侧解决
- 分支冲突**禁 `-X theirs/ours`**，必须读两侧再选正确结果
- Merger 合并顺序：每分支合完立即跑全量测试，失败先修复再继续下一个

## agent 中断恢复

- Agent 终止后 `name` 不可达，用 **agentId** resume（Agent 工具分派后记录的原始 agentId）
- 恢复前先查分支 commit 判断进度：有 commit → 从断点继续（同分支重派 Implementer 或直接进 Reviewer）；无 commit → 重派
- 中断不丢已提交进度——确定性分支名 `afk/issue-{N}` 保证 resume 落到同一分支

## CONTEXT.md 缺失策略

- 控制者基于 `CLAUDE.md` + `docs/adr/` 创建 `CONTEXT.md`
- 或用其替代注入：把 CLAUDE.md 核心内容 + 相关 ADR 拼成「领域上下文」段注入角色 prompt

## herdr 模式注意事项

（适配四角色：每个角色一个 pane / agent，命名建议 `planner` / `impl-{N}` / `review-{N}` / `merger`，遵守 `/herdr-instances` 布局规则——主编排 pane 不可上下分割，左右/上下分割各自不超过 3。）

### agent start 三要素

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
herdr agent wait <名称> --until idle --timeout 300000
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
herdr agent prompt <名称> "prompt文本" --wait --timeout 600000
```
注意：**不要加 `&` 后台化**，必须前台等待提交完成。agent prompt 等待的是 idle 状态（Claude Code 完成后回到 idle 不是 done）。

`herdr pane run` 在某些场景下只粘贴不提交，推荐优先使用上面的显式方式。

### 发后验证（必须执行）

下发指令后 10s 内验证 agent 确实开始工作：

```bash
sleep 5
herdr agent list | grep <名称>
# 确认:
# - agent_status = working（不是 idle）
# - terminal_title 变为实现标题（不是 "Claude Code"）
# - state_change_seq 有变化
# - 可选：cwd 显示已在 worktree 内
```

验证不通过（agent 仍 idle、标题未变）→ 重试发送，可换 `send-text + Enter` 方式。

### 轮询协议（必须执行）

herdr agent 完成后回到 idle 但**不会通知控制者**。控制者必须主动轮询。

**基础轮询**（每 5 分钟执行）：

```bash
herdr agent list | grep <名称>
# 重点检查 agent_status 和 terminal_title
```

**轮询时机**（与[超时协议](#超时协议)分级一致）：
- 简单 issue：dispatch 后 2-3 分钟开始
- 中等问题：dispatch 后 5-10 分钟开始
- 复杂 issue：dispatch 后 10-20 分钟开始

**发现完成后的验证**：

```bash
# 1. 读取 agent 最终输出
herdr agent read <名称> --source recent-unwrapped | tail -80

# 2. 检查汇报格式：应有 <promise>COMPLETE</promise>、测试结果
# 3. 外部验证三项：
gh issue view <id> --json state           # → CLOSED（Merger 后）
git log --oneline ${TARGET_BRANCH} -5     # → 含 1-parent squash commit
wt list | grep afk/issue-<N>              # → 无匹配（Merger 后已清理）

# 4. 完成 → 关闭 pane，继续下一角色
herdr pane close $WS:pX
```

**关闭所有未验证 agent 的 pane**：全部完成后，执行 `herdr pane list | grep "afk/issue-"` 确认无残留。

### 场景：Seam 确认兜底

新架构下控制者分派时**预确认 seam**，agent 不等待。若 agent 仍进入等待确认状态（idle 但 terminal_title 显示等待），控制者读取输出后发送确认兜底：

```bash
herdr pane read <pane> --source recent-unwrapped | tail -30
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
7. 按复杂度分级开始轮询               # 主动检查完成
8. agent read + 外部验证              # 验证完成
9. pane close                         # 关闭 pane
10. 回到 Planner / 进入 Merger        # 推进循环
```

## 收尾流程

所有 issue 实现完成后，报告统计（实现了几个 issue、生成几个 squash commit），然后提示用户进行 code review 和 QA：

> 所有 issue 已实现并合并。建议先进行 **code review**（审查代码正确性、风格、安全性），再执行 **QA 测试**（端到端行为、回归验证）。经典流程：code review 通过 → 部署到测试环境 → QA 测试。

如有新 issue，提示可再次运行 `/afk-issue-loop`。
