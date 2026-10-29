# ego-browser 能力画像

> ego-browser (ego-lite)：基于用户 Chrome 进程的 Node.js CLI，task space 隔离浏览器上下文，共享浏览器进程。其完整 API、helper 列表、Caveats、task space 详解都在它自己的 skill 里。本文件只描述它的能力边界；选型裁决见 [../SKILL.md](../SKILL.md) 分类树。

## 影响选型的能力

- **继承用户已登录态**（GitHub / Notion / 后台系统等）
- **task space 跨 heredoc 复用**，按其当前指南同一目标复用单 space / 多 page
- **`cdp()` 直连 CDP 任意 domain** —— 性能 / 网络 / 控制台 / 内存诊断可通过 CDP 协议直连排查
- **共享 Chrome 进程**（低内存），`@N` ref 跨 snapshot 稳定，对自动化脚本友好
- **handoff 可把控制权交还用户**（用户接管是正常交接，见 ../SKILL.md 回退节）

能力边界：不改浏览器指纹 —— Cloudflare Turnstile / DataDome / Kasada / 运行时 CDP 检测需要 CloakBrowser 穿透（判型与穿透矩阵见 [anti-bot-field-guide.md](anti-bot-field-guide.md)）。

不复制 API / helper 清单 —— 完整用法与命令以 `Skill("ego-browser")` 及其当前安装版本文档为准一次加载。

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

完整规则见 ego-browser skill 及其当前安装版本文档。核心原则：
- 同一用户目标复用同一 task space，跨页面探索在 space 内复用或新增 page；仅在用户明确要求时开启多 space。
- 生命周期与收尾（如 `finish()` 及保留页面判定）、人控交接（`"user is controlling"`）严格按已安装版本手册执行，不作静态假设。
