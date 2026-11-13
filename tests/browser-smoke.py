"""Read-only UI regression checks against an isolated, locally served app."""
import asyncio
import functools
import http.server
import json
from pathlib import Path
import threading

from playwright.async_api import async_playwright
from party_scoreboard import check_party_scoreboard

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
    requested_urls = []
    # Do not send requests or data to live stats services during a UI test.
    async def route(request):
        requested_urls.append(request.request.url)
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

        assert await page.locator('[data-tab="tier"]').count() == 0
        assert await page.locator('[data-schedule-dashboard]').count() == 0
        assert await page.locator('.schedule-shell [data-notification-center]').count() == 0
        await page.locator('[data-open-notifications]').click()
        assert await page.locator('#notification-dialog').is_visible()
        await page.get_by_role('button', name='알림센터 닫기', exact=True).click()
        assert not await page.locator('#notification-dialog').is_visible()

        # Exercise tab rerenders and ensure each navigation control is reachable.
        tabs = await page.locator('.app-tabs [data-tab]').evaluate_all("els => els.map(el => el.dataset.tab)")
        for tab_name in tabs:
            tab = page.locator(f'.app-tabs [data-tab="{tab_name}"]')
            # Locator.click already scrolls and reacquires nodes after a render.
            # A separate scroll resolves an ElementHandle that can detach.
            await tab.click()
            assert await page.locator(".season-hero-badge").count() == 0
            if tab_name == 'spwn':
                sponsor = page.frame_locator('[data-spwn-native-host] iframe')
                await sponsor.locator('#home.active').wait_for()
                assert not await sponsor.locator('#nameGuide').is_visible()
                assert await sponsor.locator('#profileName').inner_text() == '최도랑'
                frame_bounds = await page.locator('[data-spwn-native-host] iframe').evaluate("""frame => {
                  const r=frame.getBoundingClientRect();
                  return {top:r.top,bottom:r.bottom,height:r.height,viewport:innerHeight,
                    documentHeight:document.documentElement.scrollHeight};
                }""")
                assert frame_bounds['height'] > 200, frame_bounds
                assert frame_bounds['bottom'] <= frame_bounds['viewport'] + 1, frame_bounds
                assert frame_bounds['documentHeight'] <= frame_bounds['viewport'] + 1, frame_bounds
                assert await sponsor.locator('img[src*="newcatsle-logo"]').count() == 0
                assert not await sponsor.locator('#welcomeNotice').is_visible()
                assert await sponsor.locator('#updateCheck').count() == 0
                assert await sponsor.locator('#calendar').count() == 0
                assert await sponsor.locator('#nav a[href="#stats"]').count() == 0
                assert await sponsor.locator('#home #stats').count() == 1
                await sponsor.locator('#stats').get_by_role('button', name='맵별', exact=True).click()
                assert await sponsor.locator('#stats button.selected').inner_text() == '맵별'
                assert await sponsor.locator('.race-summary-card').count() == 3
                assert '0승 0패' in await sponsor.locator('.race-summary-card[data-race="P"]').inner_text()
                await sponsor.locator('#nav a[href="#settings"]').click()
                await sponsor.locator('#settings.active').wait_for()
                assert await sponsor.locator('#settingsForm [name="name"]').count() == 0
                assert await sponsor.locator('#settingsForm [name="race"]').count() == 0
                assert '최도랑 · 프로토스' in await sponsor.locator('#settingsForm').inner_text()
                await sponsor.locator('#nav a[href="#home"]').click()
                await sponsor.locator('#home.active').wait_for()
                await sponsor.get_by_role('button', name='＋ 오늘의 경기 기록하기', exact=True).click()
                assert await sponsor.locator('#editor').is_visible()
                await sponsor.locator('button[onclick="closeForm()"]').first.click()
            if label in ['desktop', 'phone']:
                await page.screenshot(path=str(OUTPUT / f'{label}-{tab_name}.png'), full_page=True)
        await page.wait_for_function("window.HARINA_MASTER_SYNC_STATUS?.status==='ok'")
        party = await check_party_scoreboard(page, width)
        await page.screenshot(path=str(OUTPUT / f'{label}-duck-scoreboard.png'), full_page=True)
        await page.locator('.app-tabs [data-tab="schedule"]').click()

        # Fixed lavender appearance: no seasonal engine, controls, or decorations.
        assert await page.locator('[data-season-theme-open]').count() == 0
        assert await page.locator('#season-scene').count() == 0
        assert await page.locator('html').get_attribute('data-season-month') is None
        assert '이쁜 도랑아! 오늘도 반가워!' in await page.locator('.dorang-welcome').inner_text()
        await page.reload(wait_until="networkidle")
        assert await page.locator('[data-season-theme-open]').count() == 0
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
        assert not any("/api/elo/" in url or "spawn-note-elo-relay" in url or "dorang-live" in url or "eloboard.co.kr" in url for url in requested_urls), requested_urls
        assert not errors, errors
        return {"viewport": label, "geometry": geometry, "tabs": tabs, "fixedTheme": True,
                "calendarButtons": toolbar_geometry, "saveReachability": reachability,
                "partyScoreboard": party, "pageErrors": errors}
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
    async def tap_visual(locator, scroll=True):
        # Renders replace the header, and WebKit can report a zero viewport
        # scale during that transition. Reacquire a visible target before tap.
        for attempt in range(5):
            await locator.wait_for(state='visible')
            if scroll:
                await locator.evaluate("el => el.scrollIntoView({block:'center',inline:'center',behavior:'instant'})")
            await page.wait_for_timeout(100)
            point = await locator.evaluate('''el => {
              const r=el.getBoundingClientRect(),v=visualViewport;
              if(!el.isConnected || !r.width || !r.height || !v.scale)return null;
              const x=(r.left+r.width/2-v.offsetLeft)*v.scale;
              const y=(r.top+r.height/2-v.offsetTop)*v.scale;
              return x>0 && y>0 ? {x,y} : null;
            }''')
            if point:
                await page.touchscreen.tap(point['x'], point['y'])
                return point
        raise AssertionError('Mobile tap target did not stabilize')
    try:
        await page.goto(origin, wait_until='networkidle')
        # Startup deliberately schedules a player DB render after 1.2 seconds
        # on WebKit. Network-idle alone precedes that render.
        await page.wait_for_function("window.HARINA_MASTER_SYNC_STATUS?.status==='ok'")
        assert await page.locator('html').get_attribute('data-screen-mode') == 'mobile'
        await page.locator('#schedule-title').fill('화면 전환 중 작성 내용')
        await page.locator('.screen-mode-controls [data-screen-mode="pc"]').click()
        await page.wait_for_function("matchMedia('(min-width:1200px)').matches")
        assert await page.locator('#schedule-title').input_value() == '화면 전환 중 작성 내용'
        assert await page.evaluate("visualViewport.scale") > 0
        assert await page.evaluate("document.documentElement.scrollWidth") >= 1280
        assert 'maximum-scale' not in await page.locator('meta[name="viewport"]').get_attribute('content')
        columns = await page.locator('.schedule-main-layout').evaluate("el => getComputedStyle(el).gridTemplateColumns.split(' ').length")
        assert columns == 2, columns
        # Mobile pans the visual viewport inside the wide layout viewport;
        # window.scrollTo only moves the latter and cannot simulate a swipe.
        geometry = await page.evaluate('({visual:visualViewport.width, layout:document.documentElement.clientWidth, scale:visualViewport.scale})')
        # WebKit may initially fit the desktop viewport to the phone; zoom
        # remains unrestricted, while Chromium keeps initial-scale=1.
        assert geometry['layout'] >= geometry['visual'] - 1, geometry
        if browser.browser_type.name == 'chromium':
            session = await context.new_cdp_session(page)
            await session.send('Input.dispatchTouchEvent', {
                'type':'touchStart','touchPoints':[{'x':340,'y':80}]})
            for x in [300,260,220,180,140,100,60]:
                await session.send('Input.dispatchTouchEvent', {
                    'type':'touchMove','touchPoints':[{'x':x,'y':80}]})
                await page.wait_for_timeout(40)
            await session.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
            await page.wait_for_timeout(200)
            assert await page.evaluate('scrollX + visualViewport.offsetLeft') > 0, geometry
            await session.detach()
        await page.screenshot(path=str(OUTPUT / f'{label}-pc-panned.png'))
        back_geometry = await page.locator('.screen-mode-return').evaluate('''el => {
          const r=el.getBoundingClientRect(),v=visualViewport;
          return {visible:r.left>=v.offsetLeft && r.right<=v.offsetLeft+v.width &&
            r.top>=v.offsetTop && r.bottom<=v.offsetTop+v.height,
            left:r.left,top:r.top,visualWidth:v.width,visualHeight:v.height};
        }''')
        assert back_geometry['visible'], back_geometry
        await tap_visual(page.locator('.screen-mode-return'), scroll=False)
        await page.wait_for_function("document.documentElement.dataset.screenMode==='mobile'")
        assert await page.locator('#schedule-title').input_value() == '화면 전환 중 작성 내용'
        await page.locator('.screen-mode-controls [data-screen-mode="pc"]').click()
        await page.reload(wait_until='networkidle')
        await page.wait_for_function("window.HARINA_MASTER_SYNC_STATUS?.status==='ok'")
        assert await page.locator('html').get_attribute('data-screen-mode') == 'pc'
        assert await page.evaluate("matchMedia('(min-width:1200px)').matches")
        for tab_name in await page.locator('.app-tabs [data-tab]').evaluate_all('els => els.map(el => el.dataset.tab)'):
            tab = page.locator(f'.app-tabs [data-tab="{tab_name}"]')
            point = await tap_visual(tab)
            await page.wait_for_function("name => document.querySelector('.app-tabs [data-tab=\"'+name+'\"]')?.classList.contains('active')", arg=tab_name, timeout=5000)
            assert 'active' in (await tab.get_attribute('class') or ''), (tab_name, point)
            assert await page.locator('.screen-mode-controls').count() == 1
            assert await page.locator('.screen-mode-controls [data-screen-mode="pc"]').get_attribute('aria-pressed') == 'true'
        # Return from the final tab using the always-visible control.
        await page.locator('.app-tabs [data-tab="schedule"]').evaluate('el => el.click()')
        await tap_visual(page.locator('.screen-mode-return'), scroll=False)
        await page.wait_for_function("document.documentElement.dataset.screenMode==='mobile'")
        await page.reload(wait_until='networkidle')
        await page.wait_for_function("window.HARINA_MASTER_SYNC_STATUS?.status==='ok'")
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


async def check_compact_broadcast(browser, origin, width, height):
    context = await browser.new_context(viewport={"width": width, "height": height})
    # Isolated five-game set with completed, current, and waiting states.
    await context.add_init_script("""(() => {
      if (location.origin === 'null') return;
      const matches=Array.from({length:5},(_,i)=>({
        id:'game-'+i,set:1,a:'a'+i,b:'b'+i,map:'실피드',
        winner:i<2?'A':null
      }));
      localStorage.setItem('star-match-manager-v1',JSON.stringify({
        title:'6회차 아이렌즈',mode:'CK',teamA:'도랑팀',teamB:'너거팀',
        playersA:matches.map((_,i)=>({id:'a'+i,name:'도재욱'+i,race:'P'})),
        playersB:matches.map((_,i)=>({id:'b'+i,name:'박성균'+i,race:'T'})),
        matches,setGames:[5],setModes:['normal'],aces:[],activeTab:'match',
        broadcast:{bg:'dark',size:'480x270'}
      }));
    })()""")
    page = await context.new_page()
    try:
        await page.goto(origin + '?broadcast=1', wait_until='networkidle')
        assert await page.locator('.broadcast-set-row').count() == 5
        assert await page.locator('.broadcast-set-row i').all_text_contents() == [
            '도랑팀 승','도랑팀 승','진행 중','대기','대기']
        boxes = await page.locator('.broadcast-set-row').evaluate_all("""rows => rows.map(row => {
          const box=row.getBoundingClientRect();
          const children=[...row.children].map(el=>el.getBoundingClientRect());
          return {top:box.top,bottom:box.bottom,left:box.left,right:box.right,
            columnsFit:children.every(c=>c.left>=box.left-1&&c.right<=box.right+1)};
        })""")
        assert all(b['columnsFit'] for b in boxes), boxes
        assert boxes[0]['top'] < boxes[-1]['top'], boxes
        assert boxes[-1]['bottom'] <= height + 1, boxes
        assert await page.evaluate("document.documentElement.scrollWidth") <= width + 1
        await page.screenshot(path=str(OUTPUT / f'broadcast-{width}x{height}.png'))
    finally:
        await context.close()


async def check_tier_board(browser, origin):
    """The full roster loads first; LIVE needs a matching SOOP channel response."""
    context = await browser.new_context()
    payload = {'tierOrder': ['갓', '유스'], 'players': [
        {'eloId': 463, 'name': '엔돌핀', 'tier': '갓', 'race': 'Z', 'active': True, 'soopId': 'dmsgkdn12'},
        {'eloId': 828, 'name': '유즈', 'tier': '유스', 'race': 'P', 'active': True, 'soopId': 'yuzzzz'},
        {'eloId': 6312, 'name': '탱크', 'tier': '갓', 'race': 'P', 'active': True, 'soopId': ''},
    ]}
    errors = []
    page = await context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    async def route(request):
        url = request.request.url
        if '/players.json' in url:
            await request.fulfill(json=payload)
        elif 'api-channel.sooplive.co.kr' in url:
            data = {'broadNo': 123, 'userId': 'dmsgkdn12'} if '/dmsgkdn12/' in url else {}
            await request.fulfill(json=data, headers={'access-control-allow-origin': '*'})
        elif url.startswith(origin):
            await request.continue_()
        else:
            await request.abort()
    await context.route('**/*', route)
    try:
        await page.goto(origin, wait_until='domcontentloaded')
        await page.locator('[data-tab="tiers"]').click()
        await page.locator('.shared-tier-player').first.wait_for()
        assert await page.locator('.shared-tier-player').count() == 3
        assert await page.locator('.shared-tier-live').count() == 0
        await page.locator('[data-tier-live]').click()
        await page.wait_for_function('document.querySelector(".shared-tier-head p")?.textContent.includes("LIVE 1명")')
        assert await page.locator('.shared-tier-player').count() == 1
        assert await page.locator('.shared-tier-player a[href="https://eloboard.com/players/463"]').count() == 1
        assert not errors, errors
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
                await check_tier_board(browser, origin)
                for popup_width,popup_height in [(320,180),(480,270)]:
                    await check_compact_broadcast(browser, origin, popup_width, popup_height)
                results.append(await check_screen_mode(browser, origin, 'phone-chromium', 390, 844))
                for viewport in VIEWPORTS:
                    results.append(await check_viewport(browser, origin, *viewport))
                    print(json.dumps(results[-1], ensure_ascii=False), flush=True)
            finally:
                await browser.close()
            # Check the complete app on Safari's engine too, not just a phone-
            # sized Chromium viewport or the isolated tier-link fixture.
            browser = await playwright.webkit.launch()
            try:
                results.append(await check_screen_mode(browser, origin, 'iphone-webkit', 390, 844))
                results.append(await check_screen_mode(browser, origin, 'ipad-webkit', 820, 1180))
                for viewport in [
                    ('iphone-webkit', 390, 844, True),
                    ('ipad-webkit', 1180, 820, True),
                ]:
                    results.append(await check_viewport(browser, origin, *viewport))
                    print(json.dumps(results[-1], ensure_ascii=False), flush=True)
            finally:
                await browser.close()
    finally:
        server.shutdown()
        (OUTPUT / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    asyncio.run(main())

