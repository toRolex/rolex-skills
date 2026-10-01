# 组合使用模式

原则：不同工具的页面状态不同步，切换前先 snapshot 确认。反爬穿透的参数与试错路径单一来源在 [anti-bot-field-guide.md](anti-bot-field-guide.md)，本文件只写多工具衔接。

## 场景 A：功能测试 + 问题诊断

```
ego-browser 执行流程 → cdp() 查错 → js() 提取
```

1. ego-browser 在 task space 内执行用户流程（click / fill）
2. 发现异常 → `page.cdp('Log.enable')` 查控制台、`page.cdp('Performance.getMetrics')` 看性能
3. `js()` 提取验证结果

## 场景 B：登录态操作 + 网络审计

```
ego-browser（登录态）→ cdp('Network.*') 审计 → js() 提取
```

1. ego-browser task space 复用登录态进入目标页
2. `page.cdp('Network.enable')` + `page.cdp('Network.getResponseBody')` 分析 API 调用
3. `js()` 提取 DOM 内容

## 场景 C：定期监控

```
公开页 → firecrawl monitor（托管）
登录态页 → ego-browser task space 定期打开比对
```

## 场景 D：反爬站点穿透 + 提取

```
CloakBrowser 穿透 → page.evaluate() 提取
```

1. CloakBrowser 穿透（Turnstile / 运行时 CDP 检测的完整参数与实战案例见 [anti-bot-field-guide.md](anti-bot-field-guide.md)）
2. `page.evaluate()` 提取结构化数据
3. 封装脚本：[scripts/scrape-linuxdo.py](../scripts/scrape-linuxdo.py) / [scripts/scrape-boss.py](../scripts/scrape-boss.py)

## 场景 E：搜索 → 深读 → 落盘

```
anysearch 条目 → firecrawl scrape 全文 → firecrawl crawl 整站
```

1. anysearch `search` / `--sdp` 拿候选条目（额度大，先广撒网）
2. 筛出目标 URL → firecrawl `scrape` 拿整页 markdown
3. 要整站 → firecrawl `map` 发现 URL + `crawl` 批量落盘
