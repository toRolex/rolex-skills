# 浏览器工具完整参考

环境入口、五个工具（ego-browser / OpenCLI / CloakBrowser / firecrawl / anysearch）的 API、命令表、独占能力。**路由判断见 [../SKILL.md](../SKILL.md)，本文件不重复。**

## 环境与入口

| 工具 | Python / CLI 路径 | 说明 |
|------|------------------|------|
| **ego-browser** | `Skill("ego-browser")` | 基于用户 Chrome 进程的 Node.js CLI，task space 隔离；`cdp()` 直连 CDP 任意 domain |
| **CloakBrowser** | `~/.agent-venv/bin/python` | 全局 agent venv，所有 agent 共用；安装见 [cloakbrowser.md](cloakbrowser.md) 安装节 |
| **OpenCLI** | `opencli browser <session>` | Chrome 扩展桥接；扩展需先装：`chrome://extensions` → 开发者模式 → 加载已解压。桥接型命令需先 bind（见下方 bind-first）；`[api]` adapter 无需 |
| **firecrawl** | `firecrawl` | 托管网页数据服务（非本地浏览器）。首次使用先 `firecrawl --status` 验证 |
| **anysearch** | `Skill('anysearch')` | 实时搜索 API（非浏览器）。CLI 自动加载 skill 目录 `.env`（`ANYSEARCH_API_KEY`），无 key 匿名可用（限流更低）；垂直域覆盖金融 / 学术 / 健康 / 代码 / 法律等 |

## ego-browser

**加载**：`Skill("ego-browser")` — 完整 API / helper / task space 在其自身 skill，此处只列要点。

```bash
# 起始（当前 API；同一目标的多轮 heredoc 必须复用同一 task）
const task = await taskSpace('短名')
# 操作：snapshotText / click / fill / js 均为 helper
# CDP 直连（诊断、任意 CDP domain）：page 域命令 page.cdp()，Target/Browser 域命令 task.cdp()
await page.cdp('Network.enable')
await page.cdp('Network.getResponseBody', { requestId })
# 收尾：finish 只调一次
await task.finish({ keep: [] })
```

**独占能力**：继承用户登录态、共享 Chrome 进程（低内存）、`@N` ref 跨 snapshot 稳定、handoff 交还控制权、`cdp()` 直连协议层（性能/网络/控制台/内存诊断都走这里）

## OpenCLI

**加载**：`Skill("opencli")`（总入口；browser/adapter/autofix 是其 references/ 披露文件）

**bind-first（桥接型命令的唯一操作来源）**：opencli 的桥接型命令（需浏览器的，含 google / brave / duckduckgo 的 search）走 Chrome 扩展桥接；浏览器没连就报 `BROWSER_CONNECT`，命令全废。`[api]` adapter 直接调 HTTP，不需要 bind。opencli 自己不会启动 Chrome，桥接的是用户日常 Chrome（Browser Bridge 扩展已装在默认 profile），用 macOS `open` 命令拉起：

```bash
# 1. 拉起用户日常 Chrome 并加载页面（默认 profile，扩展、登录态全在；Chrome 已在运行则只是新开标签页）
open -a "Google Chrome" "https://www.google.com"

# 2. 等 Chrome 起来后绑定当前标签页
sleep 2
opencli browser default bind

# 3. 之后 opencli 命令全部可用
opencli google search "sites like namethatui" -f md
```

检查条件：`opencli browser default bind` 返回当前页 url + title（无 `BROWSER_CONNECT` 报错）即算已 bind。绑定后本会话内持续有效。

**协议差异**：OpenCLI 通过 Chrome 扩展桥接，**不走 CDP `Runtime.enable()`**。对检测 CDP 调试域的站点（如 Boss直聘），OpenCLI 的协议面比直连 CDP 更安全。

### 查找已有 adapter

```bash
# 列出全部可用命令（含站点名和子命令）
opencli list

# 查特定站点是否有 adapter
opencli list | grep -i "boss\|zhipin\|bilibili\|zhihu\|1688"

# 站点 adapter 的标签类型（不需要浏览器的优先）
# [public]   — 无需登录，直接可用
# [cookie]   — 需要浏览器已有登录态
# [api]      — 纯 API 调用，零浏览器开销
```

适配决策：

| adapter 标签 | 含义 | 例子 |
|-------------|------|------|
| `[public]` | 公开数据，无需登录 | `opencli 12306 stations` |
| `[cookie]` | 需浏览器已登录 | `opencli boss search` |

> **反爬相关**：`[cookie]` adapter 不代表它走浏览器反爬——多数 adapter 封装了站点私有 API，直接调 HTTP 接口，根本不经过反爬层。

| 场景 | 命令 |
| --- | --- |
| 已有 adapter | `smart-search` 或 `opencli <site>` |
| adapter 失效 | opencli skill 的 references/autofix.md |
| 临时任务 | opencli skill 的 references/browser.md |
| 新 adapter | opencli skill 的 references/adapter-authoring/index.md |

**独占能力**：站点专用命令封装、结构化输出（JSON/CSV/Markdown），已有 adapter 的站点反爬已被 adapter 作者消化

## CloakBrowser

**入口**：`~/.agent-venv/bin/python`

```python
from cloakbrowser import launch
browser = launch(headless=False)
page = browser.new_page()
page.goto("https://target.com/", wait_until="domcontentloaded")
```

**核心函数**：`launch()` · `launch_async()` · `launch_context()` · `launch_persistent_context()` · `binary_info()` · `cloakserve`

**独占能力**：C++ 级浏览器指纹消除、Cloudflare Turnstile/DataDome/Kasada/Akamai 穿透

## firecrawl

**加载**：`Skill("firecrawl")`

**命令**：`scrape`（URL → clean markdown，JS 渲染 / 反爬 / PDF / json schema 结构化）、`search --scrape`（搜索 + 全文一步拿）、`map` / `crawl` / `batch scrape` / `download`（站点批量、URL 发现与落盘）、`monitor`（变化监控）、`interact`（点击/填表/登录/分页交互）、`parse`（本地文件解析）

**无需本地浏览器进程。** keyless 仅 `search` / `scrape` / `parse` / `interact` 可用，`crawl` / `map` / `batch` 需 key。

**独占能力**：托管反爬与 JS 渲染、整站批量、全网变化监控、单调用带 Highlights 段落的搜索+全文

## anysearch

**加载**：`Skill("anysearch")`

**命令**：`get_sub_domains` / `search`（含 `--sdp` 垂直目录驱动）/ `batch_search`（2-5 条并行）/ `extract`（单篇静态 HTML → Markdown）。统一 JSON-RPC 端点，无需 MCP server，免浏览器。

**能力边界**：返回的是**搜索结果/条目**（搜索引擎，尤其垂直域结构化标识符查询）强；`extract` 轻量读单页可用——50k 截断、仅 HTML、无 JS，深度 / 整站不行。与 firecrawl 分工：anysearch 出条目，firecrawl 出页面 markdown。

## 独占能力对照

只列谁有什么别人没有的；场景裁决一律回 [../SKILL.md](../SKILL.md) 分类树。

| 工具 | 独占能力 |
|------|------|
| ego-browser | 继承用户登录态、`cdp()` 直连诊断、task space、handoff 交还控制权 |
| OpenCLI | 站点 adapter、API 层绕过反爬与 CDP 检测、结构化输出 |
| CloakBrowser | C++ 级指纹消除、Turnstile/DataDome/Kasada/Akamai 穿透 |
| firecrawl | 托管 JS 渲染、整站 crawl/map/batch、monitor、search+全文单调用 |
| anysearch | 搜索结果条目、垂直域 `--sdp`、batch_search 并行 |
