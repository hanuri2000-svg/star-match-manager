"""Selected-date official games and local ladder, with no external data writes."""
import asyncio
import functools
import http.server
import json
import os
from pathlib import Path
import threading
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'test-results'/'schedule-play-smoke'
STAMP='2026-11-16T05:00:00.000Z'
KEY='my-starlog-dorang-v1'

def data():
    return {'schemaVersion':1,'playerId':443,'requested':50,'complete':True,'fetchedAt':STAMP,'stale':False,
            'matches':[{'id':100+i,'date':'2026-11-14' if i<5 else '2026-11-01',
                        'opponentId':513,'opponent':'정소이' if i<3 else '햇살',
                        'race':'Z' if i<3 else 'T','map':'투혼','type':'스폰','result':'L' if i==3 else 'W'} for i in range(50)]}

def journal():
    m={'id':'ladder-local','date':'2026-11-14','type':'래더','opponent':'래더 상대','race':'P','myRace':'P','map':'투혼',
       'result':'W','build':'더블','enemyBuild':'','memo':'지켜야 할 개인 메모','tags':'','star':False}
    return {'version':1,'matches':[m,{**m,'id':'manual-sponsored','type':'스폰'}],'trash':[],
            'settings':{'name':'최도랑','race':'P','maps':['투혼'],'builds':['더블']},'lastBackup':None}

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

async def check(browser,origin,width):
    ctx=await browser.new_context(viewport={'width':width,'height':900},locale='ko-KR',timezone_id='Asia/Seoul',service_workers='block')
    raw=json.dumps(journal(),ensure_ascii=False)
    await ctx.add_init_script("""(() => {const NativeDate=Date;const time=Date.parse('2026-11-16T05:00:00Z');
      window.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:[time]))}static now(){return time}};
      if(!localStorage.getItem('my-starlog-dorang-v1'))localStorage.setItem('my-starlog-dorang-v1',__RAW__);
    })();""".replace('__RAW__',json.dumps(raw)))
    gate=asyncio.Event();state={'calls':0,'fail':False};errors=[]
    master=json.loads((ROOT/'players.json').read_text())
    async def route(req):
        url=req.request.url
        if '/api/elo/public/recent?' in url:
            state['calls']+=1
            assert 'playerId=443' in url and 'limit=50' in url
            await gate.wait()
            await req.fulfill(status=503 if state['fail'] else 200,json={'error':'unavailable'} if state['fail'] else data())
        elif '/api/elo/' in url:
            await req.fulfill(status=503,json={'error':'not needed'})
        elif '/players.json' in url:
            await req.fulfill(json=master)
        elif 'api-channel.sooplive.co.kr' in url:
            await req.fulfill(status=200,body='')
        elif url.startswith(origin):
            await req.continue_()
        else:
            await req.abort()
    await ctx.route('**/*',route)
    page=await ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    try:
        await page.goto(origin,wait_until='domcontentloaded')
        await page.wait_for_function("window.HARINA_MASTER_SYNC_STATUS?.status==='ok' && window.SchedulePlayRecords && window.SpawnScheduleStats")
        await page.locator('.calendar-day[data-date="2026-11-14"]').click()
        await page.locator('#schedule-title').fill('자동 조회 중에도 남길 일정 제목')
        await page.locator('#schedule-note').fill('자동 조회로 지워지면 안 되는 일정 메모')
        gate.set()
        await page.wait_for_function("document.querySelector('[data-schedule-play-summary] .spawn-day-head strong')?.textContent==='6전 5승 1패'")
        assert await page.locator('.schedule-play-records .schedule-play-row').count()==6
        assert await page.locator('#schedule-title').input_value()=='자동 조회 중에도 남길 일정 제목'
        assert await page.locator('#schedule-note').input_value()=='자동 조회로 지워지면 안 되는 일정 메모'
        assert '래더' in await page.locator('.schedule-play-records').inner_text()
        assert '3전 3승 0패' in await page.locator('.spawn-race-card.race-Z').inner_text()
        assert '2전 1승 1패' in await page.locator('.spawn-race-card.race-T').inner_text()
        assert await page.evaluate('(key)=>localStorage.getItem(key)',KEY)==raw
        assert state['calls']==1
        await page.locator('[data-schedule-play-summary]').scroll_into_view_if_needed()
        await page.screenshot(path=str(OUTPUT/f'selected-day-{width}.png'),full_page=True)
        await page.locator('.calendar-day[data-date="2026-11-15"]').click()
        assert '0전 0승 0패' in await page.locator('[data-schedule-play-summary] .spawn-day-head').inner_text()
        assert await page.locator('.schedule-play-row').count()==0
        await page.locator('.calendar-day[data-date="2026-11-01"]').click()
        assert '확인분 45전' in await page.locator('[data-schedule-play-summary] .spawn-day-head').inner_text()
        await page.locator('[data-act="schedule-prev"]').click()
        await page.locator('.calendar-day[data-date="2026-10-01"]').click()
        assert '확인 범위 밖' in await page.locator('[data-schedule-play-summary] .spawn-day-head').inner_text()
        assert state['calls']==1
        await page.locator('[data-act="schedule-next"]').click()
        await page.locator('.calendar-day[data-date="2026-11-14"]').click()
        state['fail']=True
        await page.locator('[data-schedule-play-refresh]').click()
        await page.wait_for_function("document.querySelector('[data-schedule-play-summary]')?.textContent.includes('마지막 확인 자료')")
        assert '6전 5승 1패' in await page.locator('[data-schedule-play-summary] .spawn-day-head').inner_text()
        assert state['calls']==2
        await page.locator('[data-tab="tiers"]').click()
        await page.locator('[data-tier-all]').click()
        target=page.locator('.shared-tier-player a[href="https://eloboard.com/players/830"]')
        assert await target.count()==1
        assert await target.inner_text()=='려은'
        assert await page.evaluate('(key)=>localStorage.getItem(key)',KEY)==raw
        assert not errors,errors
        print(f'PASS {width}: selected date, ladder, zero/unknown, draft preservation, stale fallback, 려은',flush=True)
    finally:
        gate.set();await ctx.close()

async def main():
    OUTPUT.mkdir(parents=True,exist_ok=True)
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch(executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE'))
            try:
                for width in [1440,820,390]:await check(b,f'http://127.0.0.1:{server.server_port}/',width)
            finally:await b.close()
    finally:server.shutdown()

if __name__=='__main__':asyncio.run(main())
