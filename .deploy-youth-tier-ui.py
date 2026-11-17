"""Verify deployed tier UI; third-party status/record calls are isolated, not player data."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

OUT=Path('test-results/youth-production')
SITES=[('dorang','https://hanuri2000-svg.github.io/star-match-manager/',True),('spwn-note','https://hanuri2000-svg.github.io/spwn-note/#tiers',False),('my-starlog','https://my-starlog.pages.dev/#tiers',False)]
EXPECTED=[('수빛나','492877vv'),('김아린','skdidkfl')]

async def check(browser,label,url,integrated,width):
    context=await browser.new_context(viewport={'width':width,'height':1000},locale='ko-KR',timezone_id='Asia/Seoul',service_workers='block')
    # Avoid querying hundreds of actual broadcaster statuses during verification.
    await context.route('https://api-channel.sooplive.co.kr/**',lambda route:route.fulfill(status=200,content_type='application/json',body='{}'))
    await context.route('https://spawn-note-elo-relay.hajimayo8130.workers.dev/**',lambda route:route.abort())
    page=await context.new_page()
    requests=[]
    page.on('request',lambda request:requests.append(request.url))
    try:
        response=await page.goto(url,wait_until='domcontentloaded',timeout=60000)
        assert response and response.ok,(label,'page unavailable')
        await page.wait_for_timeout(1000)
        await page.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        if integrated:
            await page.locator('.app-tabs [data-tab="tiers"]').click(timeout=30000)
        await page.locator('[data-tier-all]').wait_for(timeout=45000)
        await page.locator('[data-tier-all]').click()
        await page.locator('[data-tier-filter="베이비"]').wait_for(timeout=45000)
        await page.locator('[data-tier-filter="베이비"]').click()
        for name,channel in EXPECTED:
            link=page.locator('[data-tier-player-name]').filter(has_text=name)
            assert await link.count()==1,(label,name,'not unique')
            assert (await link.inner_text()).strip()==name
            assert await link.get_attribute('href')=='https://www.sooplive.com/station/'+channel
            row=link.locator('..')
            assert await row.locator('.shared-tier-race').inner_text()=='Z'
            assert await link.is_visible(),(label,name,'not visible')
        assert any('/star-match-manager/tier-board.js' in x for x in requests),(label,'not shared renderer')
        assert any('/star-match-manager/players.json' in x for x in requests),(label,'not shared data')
        await page.screenshot(path=str(OUT/(label+'-'+str(width)+'.png')),full_page=True)
        return {'site':label,'width':width,'passed':True,'players':['수빛나','김아린'],'tier':'베이비 (유스)','race':'Z','liveStatusMocked':True,'playerDataMocked':False}
    except Exception:
        await page.screenshot(path=str(OUT/(label+'-'+str(width)+'-error.png')),full_page=True)
        raise
    finally:
        await context.close()

async def main():
    OUT.mkdir(parents=True,exist_ok=True)
    results=[]
    async with async_playwright() as p:
        browser=await p.chromium.launch()
        for label,url,integrated in SITES:
            for width in (1440,390):
                result=await check(browser,label,url,integrated,width)
                results.append(result)
                print(json.dumps(result,ensure_ascii=False),flush=True)
                (OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
        await browser.close()

asyncio.run(main())
