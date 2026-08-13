# herdr 模式注意事项（afk-issue-loop）

> 仅 `mode=herdr` 时阅读；subagent 模式无需本文件。`${TARGET_BRANCH}` 由 SKILL.md 阶段 0 决定。


（适配四角色：每个角色一个 pane / agent，命名建议 `planner` / `impl-{N}` / `review-{N}` / `merger`，遵守 `/herdr-instances` 布局规则——主编排 pane 不可上下分割，左右/上下分割各自不超过 3。）

> **反馈闭环与 messaging 依赖**：subagent 模式的直连是会话内 `SendMessage`，不依赖额外开关；herdr 模式里 impl-N / review-N 是独立 pane，直连需跨会话 messaging——受服务端 `agents_cross_session_inbox` flag 门控（官方未灰度到本环境时不可用，需官方模型/账号环境实测）。不可用时 herdr 反馈闭环退回控制者中转（沿用状态处理表 `DONE_WITH_CONCERNS`）。

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

**轮询时机**（与[超时协议](../REFERENCE.md#超时协议)分级一致）：
- 简单 issue：dispatch 后 2-3 分钟开始
- 中等问题：dispatch 后 5-10 分钟开始
- 复杂 issue：dispatch 后 10-20 分钟开始

**发现完成后的验证**：

```bash
# 1. 读取 agent 最终输出
herdr agent read <名称> --source recent-unwrapped | tail -80

# 2. 检查汇报格式：应有 <promise>COMPLETE</promise>、测试结果
# 3. 外部验证三件事（CLOSED / 无残留 worktree / 1-parent squash commit）——
#    命令与判定标准见 SKILL.md 阶段 3

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
