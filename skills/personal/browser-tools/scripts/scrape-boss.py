#!/usr/bin/env -S ~/.agent-venv/bin/python
"""
Boss直聘反爬抓取 — 运行时 CDP 检测

对标官方 examples/stealth_test.py 的 wait_for_function 模式 + launch_context 指纹定制。

用法:
    ~/.agent-venv/bin/python scripts/scrape-boss.py
    ~/.agent-venv/bin/python scripts/scrape-boss.py --city 北京
    ~/.agent-venv/bin/python scripts/scrape-boss.py --search "Python"
"""
import json, sys, time
from cloakbrowser import launch_context

CITY = "广州"
SEARCH = None
for i, a in enumerate(sys.argv):
    if a == "--city" and i + 1 < len(sys.argv):
        CITY = sys.argv[i + 1]
    if a == "--search" and i + 1 < len(sys.argv):
        SEARCH = sys.argv[i + 1]

# ── 启动（指纹定制） ──
# 对标官方 launch_context 模式，指定屏幕尺寸 + 时区
ctx = launch_context(
    headless=False,
    args=[
        "--fingerprint-screen-width=1920",
        "--fingerprint-screen-height=1080",
        "--fingerprint-timezone=Asia/Shanghai",
    ],
)
page = ctx.new_page()

# ── 导航 ──
url = f"https://www.zhipin.com/web/geek/job?city=100010000" if SEARCH else "https://www.zhipin.com/"
page.goto(url, wait_until="domcontentloaded")
time.sleep(5)

# ── 验证未被拦截（对标官方 wait_for_function 模式） ──
try:
    page.wait_for_function(
        "() => document.body.innerText.length > 500",
        timeout=10000,
    )
except:
    print(f"FAIL: 被 Boss直聘反爬拦截 (body={page.evaluate('document.body.innerText.length')} chars)")
    ctx.close()
    sys.exit(1)

print(f"PASS: {page.url} — {page.evaluate('document.body.innerText.length')} chars\n")

# ── 如有搜索词，执行搜索 ──
if SEARCH:
    search_input = page.locator("input[placeholder*='搜索'], input.search-input, [class*='search'] input")
    if search_input.count() > 0:
        search_input.first.fill(SEARCH)
        search_input.first.press("Enter")
        time.sleep(3)
        print(f"搜索 [{SEARCH}] 完成\n")

# ── 提取职位 ──
jobs = page.evaluate("""() => JSON.stringify(
  Array.from(document.querySelectorAll('[class*="job-card"], [class*="job-card"], .job-primary'))
    .slice(0, 20)
    .map(card => ({
      title: card.querySelector('[class*="name"], [class*="title"]')?.innerText?.trim() || '',
      salary: card.querySelector('.red, [class*="salary"]')?.innerText?.trim() || '',
      company: card.querySelector('[class*="company"], .company-text')?.innerText?.trim() || '',
      tags: Array.from(card.querySelectorAll('.tag-item, [class*="tag"]')).slice(0,5).map(t => t.innerText.trim()).join(' | '),
    }))
    .filter(j => j.title)
)""")

data = json.loads(jobs)
for i, j in enumerate(data[:15]):
    print(f"{i+1}. {j['title'][:60]}")
    print(f"   {j['salary']} | {j['company']} | {j['tags']}")
    print()

ctx.close()
