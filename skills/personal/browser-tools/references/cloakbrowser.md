# CloakBrowser

隐身 Chromium，Playwright/Puppeteer 的直接替换。源码级 C++ 补丁消除自动化指纹。

## 安装

```bash
# 全局 agent venv（推荐）
uv venv ~/.agent-venv
uv pip install cloakbrowser "httpx[socks]" --python ~/.agent-venv/bin/python
~/.agent-venv/bin/python -m cloakbrowser install  # 下载二进制 ~200MB

# 项目内
uv add cloakbrowser
uv run python -m cloakbrowser install
```

**macOS 首次启动**：`xattr -cr ~/.cloakbrowser/chromium-*/Chromium.app`

## API

### launch() — 全部参数

```python
from cloakbrowser import launch

browser = launch(
    headless=False,          # 反爬站点建议 False
    proxy="socks5://user:pass@host:1080",
    geoip=True,              # 代理 IP 自动匹配时区
    humanize=True,           # 贝塞尔鼠标 + 逐字输入
    human_preset="careful",  # "default" | "careful"
    license_key=None,        # Pro (Chromium 148)
    args=["--fingerprint=42069"],  # 固定指纹
)
```

### 关键函数

| 函数 | 用途 |
|------|------|
| `launch()` / `launch_async()` | 基础浏览器 |
| `launch_context(user_agent=..., viewport=..., storage_state=...)` | 浏览器 + 上下文一步创建 |
| `launch_persistent_context("./profile", headless=False)` | 保持 cookie/localStorage 跨会话 |
| `binary_info()` | 版本、平台、安装状态 |
| `ensure_binary()` | Docker build 时预下载 |

### 重要参数

| 参数 | 默认 | 说明 |
|------|------|------|
| `headless` | `True` | 反爬站点设 `False` |
| `wait_until` | `load` | **反爬站点必须用 `"domcontentloaded"`**，`networkidle` 永不触发 |
| `stealth_args` | `True` | 自动注入指纹伪装参数 |
| `proxy` | `None` | 支持 `http://` 和 `socks5://` |

## CDP 服务模式

`cloakserve` 把隐身 Chromium 暴露为标准 CDP 端口，供其他工具/脚本接入：

```bash
~/.agent-venv/bin/python -m cloakbrowser cloakserve --port 9222
# 之后任意 CDP 客户端（含 ego-browser / playwright connect_over_cdp）可连 ws://127.0.0.1:9222
```

## 平台版本差异

| 平台 | Free (v146) | Pro (v148) |
|------|-------------|------------|
| macOS arm64 | 26 patches | 59 patches |
| Linux x86_64 | 58 patches | 59 patches |

macOS arm64 free 补丁偏少，过激进检测可能需要 Pro。

## 环境变量

| 变量 | 说明 |
|------|------|
| `CLOAKBROWSER_LICENSE_KEY` | Pro 激活 |
| `CLOAKBROWSER_BINARY_PATH` | 跳过下载，用本地 Chromium |
| `CLOAKBROWSER_CACHE_DIR` | 二进制缓存目录（默认 `~/.cloakbrowser`） |
| `CLOAKBROWSER_AUTO_UPDATE` | `false` 禁止后台更新检查 |
| `CLOAKBROWSER_VERSION` | 锁定 Chromium 版本 |

## 实测数据

| 站点 | 反爬类型 | 普通自动化浏览器 | CloakBrowser |
|------|---------|----------------|-------------|
| linux.do | Cloudflare Turnstile | ❌ 永久卡 | ✅ |
| Boss直聘 | CDP 检测 → about:blank | ❌（CDP 直连被检测） | ✅ |

## 资源配置

- 二进制：~140MB（macOS arm64）
- 内存：~190MB 空闲，~280MB 3 个 tab，每个额外 tab ~30MB
