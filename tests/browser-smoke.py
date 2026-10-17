"""Read-only UI regression checks against an isolated, locally served app."""
import asyncio
import functools
import http.server
import json
from pathlib import Path
import threading

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "test-results" / "browser-smoke"
VIEWPORTS = [
    ("desktop", 1440, 900, False),
    ("laptop", 1024, 768, False),
    ("short-desktop", 1280, 600, False),
    ("desktop-breakpoint", 961, 800, False),
    ("tablet-breakpoint", 960, 800, True),
    ("tablet-landscape", 1180, 820, True),
    ("tablet-portrait", 820, 1180, True),
    ("phone", 390, 844, True),
]


async def check_viewport(browser, origin, label, width, height, touch):
    context = await browser.new_context(
        viewport={"width": width, "height": height},
        has_touch=touch, is_mobile=touch, device_scale_factor=1,
        locale="ko-KR", timezone_id="Asia/Seoul",
    )
    # Do not send requests or data to live stats services during a UI test.
    async def route(request):
        if request.request.url.startswith(origin):
            await request.continue_()
        else:
            await request.abort()
    await context.route("**/*", route)
    page = await context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        await page.goto(origin, wait_until="networkidle")
        await page.wait_for_function("window.__appBootReady === true")
        assert await page.evaluate("document.compatMode") == "CSS1Compat"
        assert await page.locator("#app > .head").count() == 1
        assert await page.locator(".season-hero-badge").count() == 0
        geometry = await page.evaluate("""() => {
          const head=document.querySelector('#app > .head');
          const r=head.getBoundingClientRect();
          const logo=head.querySelector('.harina-signature').getBoundingClientRect();
          return {width:innerWidth, docWidth:document.documentElement.scrollWidth,
            head:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},
            logo:{left:logo.left,right:logo.right,top:logo.top,bottom:logo.bottom},
            appHeight:document.querySelector('#app').getBoundingClientRect().height,
            documentScroll:getComputedStyle(document.documentElement).overflowY};
        }""")
        assert geometry["docWidth"] <= width + 1, geometry
        assert geometry["head"]["left"] >= -1, geometry
        assert geometry["head"]["right"] <= width + 1, geometry
        assert geometry["logo"]["top"] >= geometry["head"]["top"] - 1, geometry
        assert geometry["logo"]["bottom"] <= geometry["head"]["bottom"] + 1, geometry
        if width > 960 and (touch or height <= 700):
            assert geometry["documentScroll"] == "auto", geometry

        # Exercise tab rerenders and ensure each navigation control is reachable.
        tabs = await page.locator('.app-tabs [data-tab]').evaluate_all("els => els.map(el => el.dataset.tab)")
        for tab_name in tabs:
            tab = page.locator(f'.app-tabs [data-tab="{tab_name}"]')
            # Locator.click already scrolls and reacquires nodes after a render.
            # A separate scroll resolves an ElementHandle that can detach.
            await tab.click()
            assert await page.locator(".season-hero-badge").count() == 0
            if tab_name == 'tier':
                card = page.locator('.native-tier-player').first
                await card.wait_for()
                profile_layout = await card.evaluate("""card => {
                  const a=card.querySelector('.native-avatar-link').getBoundingClientRect();
                  const info=card.querySelector('.native-tier-identity').getBoundingClientRect();
                  const badge=card.querySelector('.native-live')?.getBoundingClientRect();
                  const parent=card.getBoundingClientRect();
                  return {avatar:a.width, avatarHeight:a.height,
                    identityRight:info.right, cardRight:parent.right,
                    badgeBelow:badge ? badge.top >= info.bottom-2 : true,
                    identityRightOfProfile:info.left >= a.right-2,
                    columnCount:getComputedStyle(card).gridTemplateColumns.split(' ').length};
                }""")
                assert 59 <= profile_layout['avatar'] <= 61, profile_layout
                assert 59 <= profile_layout['avatarHeight'] <= 61, profile_layout
                assert profile_layout['columnCount'] == 2, profile_layout
                assert profile_layout['identityRightOfProfile'], profile_layout
                assert profile_layout['identityRight'] <= profile_layout['cardRight'] + 1, profile_layout
                assert profile_layout['badgeBelow'], profile_layout
        await page.locator('.app-tabs [data-tab="schedule"]').click()

        # Change each month through the real controls, including repeated opens.
        for month in range(1, 13):
            await page.locator('[data-season-theme-open]').click()
            await page.locator('[data-season-mode]').select_option(str(month))
            await page.keyboard.press("Escape")
            assert await page.locator('html').get_attribute('data-season-month') == str(month)
            assert await page.locator('.season-hero-badge').count() == 0
            assert await page.locator('.season-calendar-symbol').count() == 1
            if label == 'desktop':
                await page.screenshot(path=str(OUTPUT / f'theme-{month:02d}.png'), full_page=True)
        await page.reload(wait_until="networkidle")
        assert await page.locator('html').get_attribute('data-season-month') == '12'
        assert await page.locator('.season-hero-badge').count() == 0
        for mode in ['off', 'auto']:
            await page.locator('[data-season-theme-open]').click()
            await page.locator('[data-season-mode]').select_option(mode)
            await page.keyboard.press('Escape')
            assert await page.locator('.season-hero-badge').count() == 0
        await page.screenshot(path=str(OUTPUT / f'{label}.png'), full_page=True)
        toolbar_geometry = await page.locator('.schedule-toolbar').evaluate("""toolbar => {
          const r=toolbar.getBoundingClientRect();
          return [...toolbar.querySelectorAll('button')].map(button => {
            const b=button.getBoundingClientRect();
            return {text:button.textContent,inside:b.top>=r.top && b.bottom<=r.bottom,
              left:b.left,right:b.right};
          });
        }""")
        assert all(button['inside'] for button in toolbar_geometry), toolbar_geometry
        # Check actual scroll reachability, including mobile visual viewports;
        # a full-page screenshot alone cannot prove that lower controls work.
        save = page.locator('.schedule-save')
        await save.hover()  # Auto-scroll with locator retry; do not submit data.
        reachability = await save.evaluate("""button => {
          const r=button.getBoundingClientRect();
          const x=r.left+r.width/2,y=r.top+r.height/2;
          const hit=document.elementFromPoint(x,y);
          return {top:r.top,bottom:r.bottom,height:innerHeight,
            reachable:hit===button || button.contains(hit)};
        }""")
        assert reachability['reachable'], reachability
        await page.screenshot(path=str(OUTPUT / f'{label}-scrolled.png'))
        assert not errors, errors
        return {"viewport": label, "geometry": geometry, "tabs": tabs, "months": 12,
                "calendarButtons": toolbar_geometry, "saveReachability": reachability,
                "pageErrors": errors}
    except Exception:
        await page.screenshot(path=str(OUTPUT / f'{label}-failure.png'), full_page=True)
        raise
    finally:
        await context.close()


async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}/'
    results = []
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch()
            try:
                for viewport in VIEWPORTS:
                    results.append(await check_viewport(browser, origin, *viewport))
                    print(json.dumps(results[-1], ensure_ascii=False), flush=True)
            finally:
                await browser.close()
    finally:
        server.shutdown()
        (OUTPUT / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    asyncio.run(main())
