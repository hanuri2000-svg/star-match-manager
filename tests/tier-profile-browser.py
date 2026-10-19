"""Check the actual tier renderer and preview handlers with iPhone-style WebKit taps."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]

async def main():
    html = (ROOT / 'index.html').read_text()
    renderer = html[html.index('function tierPanel(){'):html.index('const renderBeforeTier=render;')]
    async with async_playwright() as playwright:
        browser = await playwright.webkit.launch()
        context = await browser.new_context(**playwright.devices['iPhone 13'])
        # No calls to real streaming services or app data stores.
        await context.route('**/*', lambda route: route.fulfill(
            status=200, content_type='text/html',
            body='<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>'))
        page = await context.new_page()
        await page.goto('https://tier-test.example/')
        await page.evaluate("""() => {
            window.s={tierLevels:[],tierFilter:'ALL'};
            window.TIER_DATA=[{tier:'8티어',players:[
                {name:'방송 종료 선수',race:'P'},
                {name:'주소 없는 선수',race:'T'},
                {name:'방송 중 선수',race:'Z'}
            ]}];
            window.PLAYER_META={
                '방송 종료 선수':{s:'offline_fixture'},
                '주소 없는 선수':{},
                '방송 중 선수':{s:'live_fixture'}
            };
            window.liveForTierPlayer=p=>p.name==='방송 중 선수'?'https://play.sooplive.com/live_fixture/12345':'';
            window.tierLiveStatus='확인';window.tierLiveLoading=false;
            window.esc=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
        }""")
        await page.add_script_tag(content=renderer)
        await page.evaluate("document.body.innerHTML=tierPanel()")
        await page.add_script_tag(content=(ROOT / 'tier-live-preview.js').read_text())
        assert not await page.evaluate("matchMedia('(hover: hover) and (pointer: fine)').matches")
        messages = []
        async def accept_notice(dialog):
            messages.append(dialog.message)
            await dialog.accept()
        page.once('dialog', accept_notice)
        await page.get_by_role('button', name='주소 없는 선수 방송국 주소 미등록 안내').tap()
        assert messages and '방송국 주소가 아직 등록되지 않았어' in messages[0]
        assert page.url == 'https://tier-test.example/'
        await page.locator('.native-live').tap()
        assert await page.locator('.tier-live-preview').is_visible()
        assert await page.locator('.tier-live-preview iframe').count() == 1
        await page.get_by_role('button',name='미리보기 닫기').tap()
        await page.get_by_role('link',name='방송 종료 선수 방송국 보기',exact=True).tap()
        await page.wait_for_url('https://www.sooplive.com/station/offline_fixture')
        assert len(context.pages) == 1
        print('PASS: WebKit iPhone touch — offline station navigation, missing-channel feedback, LIVE preview')
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
