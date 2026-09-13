# AFK Dashboard UI Prototype

> **THROWAWAY PROTOTYPE**：只使用 synthetic data，不读取、不修改、不停止真实 AFK run。

用户已选中 `B · Ticket Kanban`。本轮将它作为唯一 base，比较三种 selected Agent 中间输出监控方式；三者都保留工单行与 `Implementer → Reviewer → Merger / 交付` 列。

- `B1 · 底部 Output Dock`：完整 Kanban + 底部可调整 Output Dock。
- `B2 · 右侧 Output Inspector`：Kanban 主区 + 右侧持续可见 Output Inspector；用户已选中，作为正式实现的信息架构基底。
- `B3 · Output Workbench 聚焦模式`：压缩 Kanban + 宽屏已选 Agent 聚焦工作台与状态上下文。

旧 URL `?variant=B` 与无参数地址均映射到已选中的 `B2`。视觉风格和 design system 尚未确定，当前颜色、边框、状态标签密度只属于 throwaway prototype。

输出监控展示 selected Agent identity、`live` / `final` / `stale`、输出行序号与时间、`assistant text`、`tool-call`、`tool result`、`system/process`、`stderr/error`、`Gate`、连续文本、脱敏标记、最近输出时间、输出条数及 `FOLLOW-TAIL` / `PAUSED` 状态。页面文案使用中文；Role、Gate、SSE、PID、provider、工具名、命令、stdout/stderr、git diff 等技术术语保留英文。

## 启动

```sh
uv run python -m http.server 4173 \
  --bind 127.0.0.1 \
  --directory skills/personal/afk-issue-loop/prototypes/dashboard-ui
```

打开任一方案：

```text
http://127.0.0.1:4173/?variant=B1
http://127.0.0.1:4173/?variant=B2
http://127.0.0.1:4173/?variant=B3
```

也可以直接双击 `index.html`。页面在浏览器内模拟只读中间输出，约 20 秒进入 `final` 并冻结 synthetic stream。

## 原型边界

- 没有 `stop`、`retry`、`approve`、`resume` 等真实 run 控制入口；`自动 follow-tail` 开关仅改变 output view。
- 秘密、完整参数、环境变量、提示词与绝对路径使用占位脱敏文案。
- `process alive`、`tool-call observed`、角色自报、Gate verdict 与 delivery 分开表达。
- 这是 UI/state prototype，不包含生产 localhost server、SSE、token、静态导出或 runtime；正式 AFK 调度代码未改动。
