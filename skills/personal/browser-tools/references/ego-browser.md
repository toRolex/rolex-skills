# ego-browser 能力画像

> ego-browser (ego-lite)：基于用户 Chrome 进程的 Node.js CLI，task space 隔离浏览器上下文，共享浏览器进程。其完整 API、helper 列表、Caveats、task space 详解都在它自己的 skill 里。本文件只描述它的能力边界；选型裁决见 [../SKILL.md](../SKILL.md) 分类树。

## 影响选型的能力

- **继承用户已登录态**（GitHub / Notion / 后台系统等）
- **task space 跨 heredoc 复用**，适合多次访问同一站点、深入调研时多开并行
- **`cdp()` 直连 CDP 任意 domain** —— 性能 / 网络 / 控制台 / 内存诊断的唯一入口
- **共享 Chrome 进程**（低内存），`@N` ref 跨 snapshot 稳定，对自动化脚本友好
- **handoff 可把控制权交还用户**（用户接管是正常交接，见 ../SKILL.md 回退节）

能力边界：不改浏览器指纹 —— Cloudflare Turnstile / DataDome / Kasada / 运行时 CDP 检测需要 CloakBrowser 穿透（判型与穿透矩阵见 [anti-bot-field-guide.md](anti-bot-field-guide.md)）。

不复制 helper 清单 —— 完整 helper（`snapshotText` / `click` / `js` / `cdp` / task space / handoff）通过 `Skill("ego-browser")` 一次加载。

### 诊断 CDP 示例

当前 API：page 域命令走 `page.cdp()`，Target/Browser 域命令走 `task.cdp()`。

- 网络请求排查：`page.cdp('Network.enable')` → `page.cdp('Network.getResponseBody', { requestId })`
- 性能指标：`page.cdp('Performance.enable')` → `page.cdp('Performance.getMetrics')`
- 控制台报错：`page.cdp('Log.enable')` 后消费 `Log.entryAdded` 事件（consoleAPICalled 是事件不是可调命令）

## 与 CloakBrowser 互补

ego-browser = 通用页面 + 登录态继承 + CDP 诊断。CloakBrowser = 反爬穿透。

| 需求 | 组合 |
|------|------|
| 登录态站点但有反爬 | 先 CloakBrowser `launch_context()` 拿到隐身 Chromium，再让 ego-browser 走隐身进程 |
| 普通登录态站点 | 单 ego-browser 即可 |

## 委派语法

```bash
# 完整能力一次性加载
Skill("ego-browser")
```

## Task space 速记

完整规则在 ego-browser skill。这里只列容易忘的两条：

- **起始**：`const task = await taskSpace('短名')` — 同一个用户目标的多轮 heredoc 必须复用同一 task（传短名或已存在的 spaceId）
- **收尾**：`await task.finish({ keep: [] })` — 默认不留 Agent 管理的页面；只有用户明确要保留某页面才 `keep: ["p2"]`；`finish()` 恰好调一次

如果收到 `"user is controlling"` 错误：硬停止，按 ego-browser skill 的 handoff 流程等待用户确认。
