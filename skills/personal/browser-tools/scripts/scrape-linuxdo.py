#!/usr/bin/env -S ~/.agent-venv/bin/python
"""
linux.do 反爬抓取 — Cloudflare Turnstile

对标官方 examples/basic.py + persistent_context.py 模式。
支持 --persistent 保存登录态。

用法:
    ~/.agent-venv/bin/python scripts/scrape-linuxdo.py
    ~/.agent-venv/bin/python scripts/scrape-linuxdo.py --persistent ./linuxdo-profile
    ~/.agent-venv/bin/python scripts/scrape-linuxdo.py --tab hot    # 热门/最新/排行榜
"""
import json, sys, time
from cloakbrowser import launch, launch_persistent_context

TAB = "热门"  # 热门 | 最新 | 排行榜
PROFILE = None  # --persistent <dir>
for i, a in enumerate(sys.argv):
    if a == "--tab" and i + 1 < len(sys.argv):
        TAB = sys.argv[i + 1]
    if a == "--persistent" and i + 1 < len(sys.argv):
        PROFILE = sys.argv[i + 1]

# ── 启动 ──
if PROFILE:
    ctx = launch_persistent_context(PROFILE, headless=False)
    page = ctx.new_page()
else:
    ctx = launch(headless=False)
    page = ctx.new_page()

# ── 导航 + 等 Cloudflare challenge ──
page.goto("https://linux.do/", wait_until="domcontentloaded")
time.sleep(3)

# ── 切换 tab ──
page.evaluate(f"""(tab) => {{
    for (const a of document.querySelectorAll('a')) {{
        if (a.innerText.trim() === tab) {{ a.click(); return; }}
    }}
}}""", TAB)
time.sleep(2)

# ── 提取 ──
topics = page.evaluate("""() => JSON.stringify(
  Array.from(document.querySelectorAll('tr[data-topic-id]')).slice(0, 30).map(row => ({
    title: row.querySelector('a.title')?.innerText?.trim() || '',
    url:   row.querySelector('a.title')?.href || '',
    category: row.querySelector('.badge-category__name')?.innerText?.trim() || '',
    replies: row.querySelector('.posts')?.innerText?.trim() || '0',
    views:  row.querySelector('.views')?.innerText?.trim() || '0',
  }))
)""")

data = json.loads(topics)
print(f"linux.do [{TAB}]: {len(data)} 条\n")

for i, t in enumerate(data[:20]):
    print(f"{i+1}. [{t['category']}] {t['title'][:70]}")
    print(f"   {t['replies']} 回复 | {t['views']} 浏览")
    if i < 5:
        print(f"   {t['url']}")
    print()

ctx.close()
