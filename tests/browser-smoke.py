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
                assert 71 <= profile_layout['avatar'] <= 73, profile_layout
                assert 71 <= profile_layout['avatarHeight'] <= 73, profile_layout
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


async def check_screen_mode(browser, origin, label, width, height):
    context = await browser.new_context(viewport={"width": width, "height": height},
                                        is_mobile=True, has_touch=True)
    async def route(request):
        if request.request.url.startswith(origin):
            await request.continue_()
        else:
            await request.abort()
    await context.route("**/*", route)
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        await page.goto(origin, wait_until='networkidle')
        assert await page.locator('html').get_attribute('data-screen-mode') == 'mobile'
        await page.locator('#schedule-title').fill('화면 전환 중 작성 내용')
        await page.locator('.screen-mode-controls [data-screen-mode="pc"]').click()
        await page.wait_for_function("matchMedia('(min-width:1200px)').matches")
        assert await page.locator('#schedule-title').input_value() == '화면 전환 중 작성 내용'
        assert await page.evaluate("visualViewport.scale") >= 0.99
        assert await page.evaluate("document.documentElement.scrollWidth") >= 1280
        assert 'maximum-scale' not in await page.locator('meta[name="viewport"]').get_attribute('content')
        columns = await page.locator('.schedule-main-layout').evaluate("el => getComputedStyle(el).gridTemplateColumns.split(' ').length")
        assert columns == 2, columns
        # Mobile pans the visual viewport inside the wide layout viewport;
        # window.scrollTo only moves the latter and cannot simulate a swipe.
        geometry = await page.evaluate('({visual:visualViewport.width, layout:document.documentElement.clientWidth, scale:visualViewport.scale})')
        assert geometry['layout'] > geometry['visual'], geometry
        if browser.browser_type.name == 'chromium':
            session = await context.new_cdp_session(page)
            await session.send('Input.synthesizeScrollGesture', {
                'x': 200, 'y': 400, 'xDistance': -300, 'yDistance': 0,
                'speed': 600, 'gestureSourceType': 'touch'})
            await page.wait_for_timeout(200)
            assert await page.evaluate('scrollX + visualViewport.offsetLeft') > 0, geometry
            await session.detach()
        await page.screenshot(path=str(OUTPUT / f'{label}-pc-panned.png'))
        await page.locator('.screen-mode-return').click()
        await page.wait_for_function("document.documentElement.dataset.screenMode==='mobile'")
        assert await page.locator('#schedule-title').input_value() == '화면 전환 중 작성 내용'
        await page.locator('.screen-mode-controls [data-screen-mode="pc"]').click()
        await page.reload(wait_until='networkidle')
        assert await page.locator('html').get_attribute('data-screen-mode') == 'pc'
        assert await page.evaluate("matchMedia('(min-width:1200px)').matches")
        for tab_name in await page.locator('.app-tabs [data-tab]').evaluate_all('els => els.map(el => el.dataset.tab)'):
            await page.locator(f'.app-tabs [data-tab="{tab_name}"]').click()
            assert await page.locator('.screen-mode-controls').count() == 1
            assert await page.locator('.screen-mode-controls [data-screen-mode="pc"]').get_attribute('aria-pressed') == 'true'
        await page.locator('.app-tabs [data-tab="schedule"]').click()
        await page.set_viewport_size({"width": height, "height": width})
        assert await page.evaluate("matchMedia('(min-width:1200px)').matches")
        await page.locator('.screen-mode-return').click()
        await page.set_viewport_size({"width": width, "height": height})
        await page.reload(wait_until='networkidle')
        assert await page.locator('html').get_attribute('data-screen-mode') == 'mobile'
        assert await page.evaluate('document.documentElement.scrollWidth') <= width + 1
        assert await page.locator('.screen-mode-return').is_hidden()
        await page.screenshot(path=str(OUTPUT / f'{label}-mobile-restored.png'), full_page=True)
        # A saved PC preference must never alter the broadcast-only viewport.
        await page.evaluate("localStorage.setItem('dorang.screenMode.v1','pc')")
        await page.goto(origin + '?broadcast=1', wait_until='networkidle')
        assert await page.locator('html').get_attribute('data-screen-mode') is None
        assert await page.locator('.screen-mode-controls').count() == 0
        assert not errors, errors
        return {"screenMode": label, "pcColumns": columns, "persistence": True, "pageErrors": errors}
    except Exception:
        await page.screenshot(path=str(OUTPUT / f'{label}-mode-failure.png'), full_page=True)
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
                results.append(await check_screen_mode(browser, origin, 'phone-chromium', 390, 844))
            finally:
                await browser.close()
            # Check the complete app on Safari's engine too, not just a phone-
            # sized Chromium viewport or the isolated tier-link fixture.
            browser = await playwright.webkit.launch()
            try:
                for viewport in [
                    ('iphone-webkit', 390, 844, True),
                    ('ipad-webkit', 1180, 820, True),
                ]:
                    results.append(await check_viewport(browser, origin, *viewport))
                    print(json.dumps(results[-1], ensure_ascii=False), flush=True)
                results.append(await check_screen_mode(browser, origin, 'iphone-webkit', 390, 844))
                results.append(await check_screen_mode(browser, origin, 'ipad-webkit', 820, 1180))
            finally:
                await browser.close()
    finally:
        server.shutdown()
        (OUTPUT / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    asyncio.run(main())

