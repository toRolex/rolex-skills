# 反爬现场指南

## 反爬类型分类

### 类型 A — 网关验证码（Cloudflare Turnstile / reCAPTCHA / hCaptcha）

**特征**：页面标题 "请稍候…" / "Checking your Browser…" / "Verify you are human"，body 为空，URL 带 `challenges.cloudflare.com`

**检测机制**：浏览器指纹（WebGL、Canvas、navigator 属性）、JS challenge、无头检测

| 工具 | 结果 | 原因 |
|------|------|------|
| ego-browser / 普通 Chrome 自动化 | ❌ 指纹未改 | 干净自动化指纹，部分站点可靠已有 clearance 通过 |
| OpenCLI adapter | ✅（有 adapter 时） | API 层调用，根本不进浏览器 |
| CloakBrowser | ✅ | C++ 补丁消除自动化指纹 |

---

### 类型 B — 运行时 DOM 清空（Boss直聘）

**特征**：页面最初加载到真实 URL，1-3 秒后重定向到 `about:blank`，body.children=0，URL 栏不变但 JS 窗口上下文变了

**检测机制**：CDP 协议检测、`navigator.webdriver`、Chrome DevTools 端口扫描

| 工具 | 结果 | 原因 |
|------|------|------|
| 走 CDP 的直连方案 | ❌ about:blank | CDP 连接被检测 |
| OpenCLI adapter | ✅（有 adapter 时） | API 层，无 CDP 信号 |
| CloakBrowser | ✅ | Chromium 补丁消除 webdriver 指纹 |

---

### 类型 C — HTTP 层反爬（403 / 验证码页面）

**特征**：HTTP 4xx，或返回验证码 HTML（即使带了 User-Agent）

**检测机制**：TLS 指纹 (JA3/JA4)、HTTP/2 指纹、header 顺序

| 工具 | 结果 |
|------|------|
| 任何 HTTP 库直调 | ❌ 可能 403 |
| CloakBrowser | ✅ 完整浏览器 TLS 指纹 |

---

## 快速诊断流程

```
页面加载后：

0. 先排除非反爬原因：网络故障（curl/直接重开一次）、页面未加载（wait 后重试）、登录/权限问题
   （这些也会产生空页/报错，误判成反爬会白费一次穿透）

1. page.url() 检查 URL
   ├─ URL = 真实站 → 跳到 2
   └─ URL = about:blank / challenges.cloudflare.com → 反爬，按类型换方案

2. page.evaluate("document.body.children.length")
   ├─ > 0 → 页面正常，继续 page.evaluate("document.body.innerText") 检查内容
   └─ = 0 → 运行时 DOM 清空（类型 B），确认 CloakBrowser 指纹参数后重试

3. 反复失败 → 查目标站是否有 OpenCLI adapter（API 层绕过反爬）
```

## 工具选择决策矩阵

按站点类型 × 工具的穿透结果（✅ = 已测试案例/版本下通过，非通用保证；❌ = 已证实失败）：

| 站点类型 | 检测方式 | CloakBrowser | OpenCLI | ego-browser |
|---------|---------|-------------|---------|-------------|
| Cloudflare Turnstile（例: linux.do） | 网关验证码 | ✅ | ✅ `bind` / adapter | ⚠️ 指纹未改，靠已有 clearance，不稳 |
| 运行时 DOM 清空（例: Boss直聘） | CDP 检测 → `about:blank` | ✅ | ✅ adapter（API 层，非浏览器） | ⚠️ 需 cloaked 模式配合 |
| HTTP 403 | TLS/HTTP2 指纹 | ✅ | — | — |
| 无保护 | — | ✅ | ✅ | ✅ |

本表只提供穿透能力数据（谁对哪类检测已知通过 / 已知失败）；选型裁决见 [../SKILL.md](../SKILL.md) 反爬节。

## 实战案例

### linux.do — Cloudflare Turnstile

```
试错路径：
1. 普通自动化浏览器 → ❌ "请稍候…" 永久卡
2. CloakBrowser → ✅ 标题 "🐴 LINUX DO - 新的理想型社区"

最终流程：CloakBrowser launch(headless=False) + goto(wait_until="domcontentloaded")
+ sleep 让反爬 JS 执行完 + page.evaluate 提取
（封装脚本：scripts/scrape-linuxdo.py）
```

### Boss直聘 — 运行时 CDP 检测

```
试错路径：
1. CDP 直连 → page.url 正确，但 JS 返回空、body=0（DOM 被清空）
2. CloakBrowser launch_context()（指纹定制 + wait_for_function 拦截验证）→ ✅ 完整页面
3. OpenCLI boss adapter → ✅ API 层，最省 token

最终流程：优先 opencli boss；无 adapter 时 CloakBrowser + 正则解析
（封装脚本：scripts/scrape-boss.py）
```

### CloakBrowser 通用模板

```python
from cloakbrowser import launch
import time

browser = launch(headless=False)
page = browser.new_page()
page.goto("https://target.com/", wait_until="domcontentloaded")
time.sleep(3)  # 让反爬 JS 执行完
print(page.title())
body = page.evaluate("document.body.innerText")
browser.close()
```

## 可执行脚本

所有脚本通过 `~/.agent-venv/bin/python` 运行（该 venv 用 uv 管理：`uv venv ~/.agent-venv`）。**脚本用 `sys.argv` 手写解析，没有 `--help`** —— 传 `--help` 会被忽略并触发真实抓取；参数只在下表。

| 脚本 | 用途 | 用法 |
|------|------|------|
| [scripts/test-cloakbrowser.py](../scripts/test-cloakbrowser.py) | **7 站点隐身测试套件** — bot.sannysoft、incolumitas、BrowserScan、deviceandbrowserinfo、FingerprintJS、reCAPTCHA v3、CreepJS | `~/.agent-venv/bin/python scripts/test-cloakbrowser.py [--headed] [--no-screenshots]` |
| [scripts/scrape-linuxdo.py](../scripts/scrape-linuxdo.py) | linux.do 热门话题（Cloudflare Turnstile）— 支持 `--tab 最新/热门/排行榜`、`--persistent <dir>` 保持登录态 | `~/.agent-venv/bin/python scripts/scrape-linuxdo.py [--tab hot] [--persistent ./profile]` |
| [scripts/scrape-boss.py](../scripts/scrape-boss.py) | Boss直聘职位抓取（CDP 检测反爬）— 支持 `--city`、`--search`，使用 `launch_context` 指纹定制 + `wait_for_function` 拦截验证 | `~/.agent-venv/bin/python scripts/scrape-boss.py [--city 北京] [--search Python]` |
