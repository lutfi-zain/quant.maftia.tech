#!/usr/bin/env python3
"""
Screenshot capture script for Ichimoku Terminal.
Uses system chromium-browser via Playwright.
"""
import time
import os
from playwright.sync_api import sync_playwright

URL = "http://localhost:8888/"
OUT_FULL = "/tmp/ichimoku_terminal_full.png"
OUT_MAX = "/tmp/ichimoku_terminal_maximized.png"
CHROMIUM_PATH = "/usr/bin/chromium-browser"

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROMIUM_PATH,
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-first-run',
            ]
        )
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1,
        )
        page = context.new_page()

        # Collect console messages
        console_msgs = []
        page.on("console", lambda msg: console_msgs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: console_msgs.append(f"[pageerror] {err.message}"))

        print(f"1. Navigating to {URL}...")
        page.goto(URL, wait_until="domcontentloaded", timeout=30000)

        # Wait for React to mount
        print("2. Waiting for React to mount...")
        mounted = False
        for i in range(30):
            time.sleep(1)
            child_count = page.evaluate("() => document.getElementById('root')?.children.length || 0")
            if child_count > 0:
                print(f"   Root populated after {i+1}s with {child_count} children")
                mounted = True
                break

        if not mounted:
            print("   WARNING: React root still empty after 30s")
            print("   Console messages:")
            for msg in console_msgs[:20]:
                print(f"     {msg}")
            # Take screenshot anyway
            page.screenshot(path=OUT_FULL, full_page=False)
            print(f"   Saved diagnostic screenshot: {OUT_FULL}")

        # Wait for data to load
        print("3. Waiting for data to load...")
        time.sleep(5)

        # Take full dashboard screenshot
        print("4. Capturing full dashboard screenshot...")
        page.screenshot(path=OUT_FULL, full_page=False)
        print(f"   Saved: {OUT_FULL}")

        # Find and click Ichimoku Terminal tab
        print("5. Looking for Ichimoku Terminal navigation...")
        ichimoku_found = False

        # Try sidebar nav items
        nav_items = page.query_selector_all('nav a, nav button, [role="tab"], button')
        for item in nav_items:
            text = item.inner_text().strip()
            if 'ichimoku' in text.lower() or 'terminal' in text.lower():
                print(f"   Found nav item: '{text}'")
                item.click()
                ichimoku_found = True
                break

        if not ichimoku_found:
            # Try clicking by text content
            try:
                page.click('text=Ichimoku', timeout=3000)
                ichimoku_found = True
                print("   Clicked 'Ichimoku' by text match")
            except:
                print("   Could not find Ichimoku nav item, trying other selectors...")
                try:
                    page.click('text=Terminal', timeout=3000)
                    ichimoku_found = True
                    print("   Clicked 'Terminal' by text match")
                except:
                    print("   Could not find Ichimoku/Terminal navigation")

        # Wait for Lightweight Charts to render
        print("6. Waiting for charts to render...")
        time.sleep(3)

        # Take Ichimoku Terminal screenshot
        page.screenshot(path=OUT_FULL, full_page=False)
        print(f"   Saved Ichimoku Terminal: {OUT_FULL}")

        # Try to find and click maximize button
        print("7. Looking for maximize button...")
        max_found = False
        try:
            # Try various maximize selectors
            for selector in ['[title="Maximize"]', '[aria-label="Maximize"]', 'button:has-text("Maximize")', '.maximize-btn', '[data-maximize]']:
                try:
                    btn = page.query_selector(selector)
                    if btn:
                        btn.click()
                        max_found = True
                        print(f"   Clicked maximize: {selector}")
                        break
                except:
                    continue

            if not max_found:
                # Try finding by SVG icon or class
                buttons = page.query_selector_all('button')
                for btn in buttons:
                    try:
                        title = btn.get_attribute('title') or ''
                        aria = btn.get_attribute('aria-label') or ''
                        cls = btn.get_attribute('class') or ''
                        if 'max' in title.lower() or 'max' in aria.lower() or 'maximize' in cls.lower():
                            btn.click()
                            max_found = True
                            print(f"   Clicked maximize button (title='{title}', aria='{aria}')")
                            break
                    except:
                        continue
        except Exception as e:
            print(f"   Error finding maximize: {e}")

        if not max_found:
            print("   Could not find maximize button")

        # Wait for animation
        print("8. Waiting for maximized view...")
        time.sleep(2)

        # Take maximized screenshot
        page.screenshot(path=OUT_MAX, full_page=False)
        print(f"   Saved maximized: {OUT_MAX}")

        # Report dimensions and elements
        print("\n9. Reporting dimensions and elements...")
        dims = page.evaluate("""() => {
            const canvases = document.querySelectorAll('canvas');
            const charts = document.querySelectorAll('[class*="chart"], [class*="Chart"]');
            const panels = document.querySelectorAll('[class*="panel"], [class*="Pane"]');
            const sidebar = document.querySelector('nav, [class*="sidebar"], [class*="Sidebar"]');
            return {
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight,
                canvasCount: canvases.length,
                canvasSizes: Array.from(canvases).map(c => ({w: c.width, h: c.height})),
                chartElements: charts.length,
                panelElements: panels.length,
                hasSidebar: !!sidebar,
                bodyClasses: document.body.className,
                rootChildTags: Array.from(document.getElementById('root')?.children || []).map(c => c.tagName + '.' + (c.className || '').substring(0, 40)),
            };
        }""")
        print(f"   Window: {dims['windowWidth']}x{dims['windowHeight']}")
        print(f"   Canvases: {dims['canvasCount']} ({dims['canvasSizes']})")
        print(f"   Chart elements: {dims['chartElements']}")
        print(f"   Panel elements: {dims['panelElements']}")
        print(f"   Has sidebar: {dims['hasSidebar']}")
        print(f"   Root children: {dims['rootChildTags']}")

        # Screenshot file sizes
        for path in [OUT_FULL, OUT_MAX]:
            if os.path.exists(path):
                size = os.path.getsize(path)
                print(f"   {path}: {size:,} bytes")

        # Print any console errors
        errors = [m for m in console_msgs if 'error' in m.lower() or 'fail' in m.lower()]
        if errors:
            print(f"\n   Console errors ({len(errors)}):")
            for e in errors[:5]:
                print(f"     {e}")

        browser.close()
        print("\nDone.")

if __name__ == "__main__":
    main()
