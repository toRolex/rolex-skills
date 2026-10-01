#!/usr/bin/env -S ~/.agent-venv/bin/python
"""
CloakBrowser 连通性测试 — 对标官方 examples/stealth_test.py

用法:
    ~/.agent-venv/bin/python scripts/test-cloakbrowser.py
    ~/.agent-venv/bin/python scripts/test-cloakbrowser.py --headed
    ~/.agent-venv/bin/python scripts/test-cloakbrowser.py --no-screenshots
"""
import json, sys, time, re
from cloakbrowser import launch

HEADED = "--headed" in sys.argv
SCREENSHOTS = "--no-screenshots" not in sys.argv

# ── 测试函数（7 个检测站点） ──

def test_bot_sannysoft(page):
    """bot.sannysoft.com — 经典 bot 检测"""
    page.goto("https://bot.sannysoft.com", wait_until="networkidle", timeout=30000)
    time.sleep(3)
    results = page.evaluate("""() => {
        const rows = document.querySelectorAll('table tr');
        const data = {};
        rows.forEach(r => {
            const cells = r.querySelectorAll('td');
            if (cells.length >= 2) {
                const key = cells[0].innerText.trim();
                const cls = cells[1].className || '';
                data[key] = !cls.includes('failed');
            }
        });
        return data;
    }""")
    failed = [k for k, v in results.items() if not v]
    return {"passed": len(results) - len(failed), "total": len(results), "failed": failed}


def test_incolumitas(page):
    """bot.incolumitas.com — 30+ 检测项"""
    page.goto("https://bot.incolumitas.com", wait_until="networkidle", timeout=30000)
    last_total = 0
    results = {}
    for _ in range(15):
        time.sleep(2)
        results = page.evaluate("""() => {
            const text = document.body.innerText;
            const ok = (text.match(/"\\w+":\\s*"OK"/g) || []);
            const fail = (text.match(/"\\w+":\\s*"FAIL"/g) || []);
            return {passed: ok.length, failed: fail.length, total: ok.length + fail.length};
        }""")
        if results["total"] >= 30 and results["total"] == last_total:
            break
        last_total = results["total"]
    return results


def test_browserscan(page):
    """browserscan.net/bot-detection — WebDriver/UA/CDP 检测"""
    page.goto("https://www.browserscan.net/bot-detection", wait_until="networkidle", timeout=30000)
    time.sleep(5)
    text = page.evaluate("document.body.innerText")
    return {"normal": len(re.findall(r"Normal", text)), "abnormal": len(re.findall(r"Abnormal", text))}


def test_deviceandbrowserinfo(page):
    """deviceandbrowserinfo.com/are_you_a_bot"""
    page.goto("https://deviceandbrowserinfo.com/are_you_a_bot", wait_until="domcontentloaded", timeout=30000)
    time.sleep(8)
    text = page.evaluate("document.body.innerText")
    return {"isBot": re.search(r'"isBot":\s*(true|false)', text).group(1) if re.search(r'"isBot":\s*(true|false)', text) else "unknown"}


def test_fingerprintjs(page):
    """demo.fingerprint.com/web-scraping — 行业标准检测"""
    page.goto("https://demo.fingerprint.com/web-scraping", wait_until="domcontentloaded", timeout=30000)
    time.sleep(8)
    try:
        page.click("button:has-text('Search')", timeout=5000)
        time.sleep(5)
    except:
        pass
    text = page.evaluate("document.body.innerText")
    return {"passed": "Price per adult" in text or "$" in text, "isBlocked": "blocked" in text.lower()}


def test_recaptcha(page):
    """recaptcha-demo.appspot.com — Google 官方 reCAPTCHA v3"""
    page.goto("https://recaptcha-demo.appspot.com/recaptcha-v3-request-scores.php", wait_until="domcontentloaded", timeout=30000)
    score = None
    for _ in range(15):
        time.sleep(2)
        score = page.evaluate("""() => {
            const m = document.body.innerText.match(/"score":\\s*(\\d+\\.\\d+)/);
            return m ? parseFloat(m[1]) : null;
        }""")
        if score is not None:
            break
    return {"score": score}


def test_creepjs(page):
    """abrahamjuliot.github.io/creepjs — 全面指纹分析"""
    page.goto("https://abrahamjuliot.github.io/creepjs/", wait_until="domcontentloaded", timeout=30000)
    time.sleep(30)
    scores = page.evaluate("""() => {
        const t = document.body.innerText;
        return {
            likeHeadless: t.match(/(\\d+)%\\s*like headless/i)?.[1] || null,
            headless: t.match(/(\\d+)%\\s*headless:/i)?.[1] || null,
            stealth: t.match(/(\\d+)%\\s*stealth:/i)?.[1] || null,
        };
    }""")
    return {k: int(v) if v else None for k, v in scores.items()}


TESTS = [
    ("bot.sannysoft.com", test_bot_sannysoft, lambda r: len(r["failed"]) == 0, lambda r: f"{r['passed']}/{r['total']}  {', '.join(r['failed']) if r['failed'] else 'ALL GREEN'}"),
    # incolumitas: WEBDRIVER + connectionRTT 是已知 false positive（官方标注）
    ("bot.incolumitas.com", test_incolumitas, lambda r: r.get("failed", 0) <= 2, lambda r: f"{r.get('passed',0)}/{r.get('total',0)}"),
    ("BrowserScan", test_browserscan, lambda r: r.get("abnormal", 1) == 0, lambda r: f"Normal:{r['normal']} Abnormal:{r['abnormal']}"),
    ("deviceandbrowserinfo", test_deviceandbrowserinfo, lambda r: r.get("isBot") == "false", lambda r: f"isBot={r['isBot']}"),
    ("FingerprintJS", test_fingerprintjs, lambda r: r["passed"] and not r["isBlocked"], lambda r: "PASS (flights)" if r["passed"] else "BLOCKED" if r["isBlocked"] else "NO FLIGHTS"),
    ("reCAPTCHA v3", test_recaptcha, lambda r: (r.get("score") or 0) >= 0.7, lambda r: f"Score: {r.get('score', 'N/A')}"),
    ("CreepJS", test_creepjs, lambda r: (r.get("headless") or 0) <= 30 and (r.get("stealth") or 0) <= 30, lambda r: f"like-headless:{r.get('likeHeadless')}% headless:{r.get('headless')}% stealth:{r.get('stealth')}%"),
]

# ── 主流程 ──

def main():
    print("=" * 60)
    print("CloakBrowser Stealth Test Suite")
    print(f"Mode: {'headed' if HEADED else 'headless'}")
    print(f"Screenshots: {'on' if SCREENSHOTS else 'off'}")
    print("=" * 60)

    browser = launch(headless=not HEADED, geoip=True)
    page = browser.new_page()

    # 指纹信息
    info = page.evaluate("""async () => {
        const ua = navigator.userAgent;
        const gl = document.createElement('canvas').getContext('webgl');
        const dbg = gl ? gl.getExtension('WEBGL_debug_renderer_info') : null;
        return {ua: ua.substring(0,80), platform: navigator.platform, cores: navigator.hardwareConcurrency,
                gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'N/A',
                vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : 'N/A'};
    }""")
    print(f"UA: {info['ua']}")
    print(f"Platform: {info['platform']} | Cores: {info['cores']} | GPU: {info['vendor']} — {info['gpu']}")

    print(f"\nRunning {len(TESTS)} tests...\n")

    results = []
    for name, runner, check, fmt in TESTS:
        print(f"--- {name} ---")
        try:
            r = runner(page)
            passed = check(r)
            results.append((name, passed, fmt(r)))
            print(f"  [{'PASS' if passed else 'FAIL'}] {fmt(r)}")
            if SCREENSHOTS:
                page.screenshot(path=f"/tmp/stealth_{name.replace('.','_').replace(' ','_')}.png")
        except Exception as e:
            results.append((name, False, str(e)[:80]))
            print(f"  [ERROR] {e}")

    browser.close()

    print("\n" + "=" * 60)
    for name, passed, msg in results:
        icon = "+" if passed else "!"
        print(f"  [{icon}] {name}: {msg}")
    passed = sum(1 for _, p, _ in results if p)
    print(f"\n  {passed}/{len(results)} passed")
    print("=" * 60)
    return 0 if passed == len(results) else 1

if __name__ == "__main__":
    sys.exit(main())
