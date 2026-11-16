"""Public ELO UI smoke tests with fully mocked upstream data and isolated storage."""
import asyncio
import functools
import http.server
import json
from pathlib import Path
import re
import threading
from urllib.parse import urlparse, parse_qs

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'starlog' if (ROOT / 'starlog' / 'elo-public.js').exists() else ROOT
APP_PATH = '/starlog' if APP != ROOT else ''
OUTPUT = ROOT / 'test-results' / 'elo-public-smoke'
STAMP = '2026-11-16T04:00:00.000Z'
PLAYERS = [
    {'name': '최도랑', 'race': 'P', 'eloId': 443, 'aliases': ['도랑'], 'tier': '3'},
    {'name': '정소이', 'race': 'Z', 'eloId': 513, 'aliases': ['소이', '동명이인'], 'tier': '4'},
    {'name': '만다', 'race': 'T', 'eloId': 441, 'aliases': ['동명이인'], 'tier': '4'},
]
STATS = {'wins': 22, 'losses': 16, 'games': 38, 'winRate': 57.9}


def summary(player_id):
    player = next(row for row in PLAYERS if row['eloId'] == player_id)
    return {
        'schemaVersion': 1, 'source': 'ELOBOARD', 'fetchedAt': STAMP,
        'sourceUrl': 'https://eloboard.com/players/' + str(player_id),
        'player': {'id': player_id, 'name': player['name'], 'race': player['race'], 'elo': 1464},
        'overall': STATS, 'races': [{'race': 'Z', 'label': '저그', **STATS}],
        'maps': [{'id': 1, 'label': '투혼', **STATS}],
        'types': [{'key': 'sponsored', 'label': '스폰', **STATS}],
        'opponents': [{'id': 441, 'name': '만다', 'race': 'T', **STATS}],
    }


def rival(player_id, opponent_id):
    return {
        'schemaVersion': 1, 'fetchedAt': STAMP,
        'player': summary(player_id)['player'], 'opponent': summary(opponent_id)['player'],
        'headToHead': {**STATS, 'from': '2023-01-01', 'to': '2026-11-14'},
        'maps': [{'id': 1, 'label': '투혼', **STATS}], 'types': [],
    }


def recent():
    return {
        'schemaVersion': 1, 'fetchedAt': STAMP, 'playerId': 443, 'complete': False,
        'warning': '일부 날짜는 공개 화면에 표시된 경기만 확인했어요.',
        'matches': [
            {'id': 1000 + index, 'date': '2026-11-14', 'opponentId': 513, 'opponent': '정소이',
             'race': 'Z', 'result': 'W' if index % 2 else 'L', 'map': '투혼', 'type': '스폰'}
            for index in range(50)
        ],
    }


def journal():
    match = {'id': 'manual-ladder', 'date': '2026-11-15', 'type': '래더', 'opponent': '손수 입력',
             'race': 'T', 'myRace': 'P', 'map': '투혼', 'result': 'W', 'build': '나의 빌드',
             'enemyBuild': '상대 빌드', 'memo': '보존할 복기\n다음 줄', 'tags': '정찰', 'star': True}
    return {'version': 1, 'matches': [match], 'trash': [{**match, 'id': 'deleted-note'}],
            'settings': {'name': '최도랑', 'race': 'P', 'maps': ['투혼'], 'builds': ['더블']}, 'lastBackup': None}


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


async def prepare(browser, origin, width, harness=False, delay_owner=False, directory_fail=False):
    context = await browser.new_context(viewport={'width': width, 'height': 844}, locale='ko-KR',
                                        timezone_id='Asia/Seoul', service_workers='block')
    source = (APP / 'app.js').read_text()
    key = re.search(r"const KEY='([^']+)'", source).group(1)
    raw = json.dumps(journal(), ensure_ascii=False)
    await context.add_init_script('localStorage.setItem(' + json.dumps(key) + ',' + json.dumps(raw) + ');')
    if directory_fail:
        saved_directory = json.dumps({'players': [PLAYERS[0]]}, ensure_ascii=False)
        await context.add_init_script('localStorage.setItem("starlog-player-directory-v1",' + json.dumps(saved_directory) + ');')
    flags, requests, gate = {'fail': False, 'directoryFail': directory_fail, 'directoryCalls': 0}, [], asyncio.Event()

    async def route(request):
        url = request.request.url
        if url == origin + '/__elo-harness__':
            html = ('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
                    '<link rel="stylesheet" href="' + APP_PATH + '/style.css"><link rel="stylesheet" href="' + APP_PATH + '/elo-public.css">'
                    '<div id="target" style="max-width:1100px;margin:auto;padding:20px"></div>'
                    '<script src="' + APP_PATH + '/elo-public.js"></script><script>'
                    'function showPlayer(name,race){document.getElementById("target").innerHTML="<div id=elo></div>";'
                    'StarlogElo.mount(document.getElementById("elo"),{site:"independent-smoke",name,race});}'
                    'showPlayer(' + ('"정소이","Z"' if directory_fail else '"최도랑","P"') + ');</script></html>')
            await request.fulfill(body=html, content_type='text/html')
            return
        if url.startswith(origin):
            await request.continue_()
            return
        if '/players.json' in url:
            flags['directoryCalls'] += 1
            if flags['directoryFail']:
                await request.fulfill(status=503, json={'error': 'unavailable'})
                return
            await request.fulfill(json={'players': PLAYERS})
            return
        if '/api/elo/public/' in url:
            requests.append(url)
            parsed = urlparse(url)
            params = parse_qs(parsed.query)
            player_id = int(params['playerId'][0])
            kind = parsed.path.split('/')[-1]
            if delay_owner and kind == 'summary' and player_id == 443:
                await gate.wait()
            if flags['fail']:
                await request.fulfill(status=503, json={'error': 'unavailable'})
                return
            data = summary(player_id) if kind == 'summary' else recent() if kind == 'recent' else rival(player_id, int(params['opponentId'][0]))
            await request.fulfill(json=data)
            return
        await request.abort()

    await context.route('**/*', route)
    page, errors = await context.new_page(), []
    page.on('pageerror', lambda error: errors.append(str(error)))
    await page.goto(origin + ('/__elo-harness__' if harness else APP_PATH + '/index.html'), wait_until='domcontentloaded')
    return context, page, key, raw, flags, requests, gate, errors


async def check_dashboard(browser, origin, width):
    context, page, key, raw, flags, requests, gate, errors = await prepare(browser, origin, width)
    try:
        await page.locator('.elo-public-metrics').wait_for()
        assert '22' in await page.locator('.elo-public-metrics').inner_text()
        assert await page.evaluate('(key)=>localStorage.getItem(key)', key) == raw
        await page.locator('[data-elo-form] input').fill('소이')
        await page.locator('[data-elo-form] button').click()
        await page.locator('.elo-public-versus').wait_for()
        assert '정소이' in await page.locator('.elo-public-versus').inner_text()
        await page.locator('[data-elo-form] input').fill('동명이인')
        await page.locator('[data-elo-form] button').click()
        await page.wait_for_function("document.querySelectorAll('[data-elo-choice=opponent]').length===2")
        await page.locator('[data-elo-choice=opponent][data-player-id="513"]').click()
        await page.locator('.elo-public-versus').wait_for()
        if APP != ROOT:
            await page.wait_for_function("document.querySelectorAll('.elo-public-recent tbody tr').length===50")
            assert await page.locator('.elo-public-warning').is_visible()
        else:
            assert not any('/recent?' in url for url in requests)
        flags['fail'] = True
        await page.locator('[data-elo-refresh]').click()
        await page.wait_for_function("document.querySelector('[data-elo-status]').textContent.includes('마지막으로 확인한')")
        assert '22' in await page.locator('.elo-public-metrics').inner_text()
        assert await page.evaluate('(key)=>localStorage.getItem(key)', key) == raw
        geometry = await page.evaluate('({doc:document.documentElement.scrollWidth,width:innerWidth})')
        assert geometry['doc'] <= geometry['width'] + 1, geometry
        await page.locator('.elo-public').scroll_into_view_if_needed()
        await page.screenshot(path=str(OUTPUT / ('dashboard-' + str(width) + '.png')))
        assert not errors, errors
    finally:
        await context.close()


async def check_owner_change(browser, origin):
    context, page, key, raw, flags, requests, gate, errors = await prepare(browser, origin, 390, harness=True, delay_owner=True)
    try:
        await page.wait_for_function("document.querySelector('[data-elo-rival]').hidden===false")
        await page.evaluate('showPlayer("정소이","Z")')
        await page.locator('.elo-public-metrics').wait_for()
        gate.set()
        await page.wait_for_timeout(100)
        assert '정소이' in await page.locator('.elo-public-heading').inner_text()
        assert '저그' in await page.locator('.elo-public-metrics').inner_text()
        assert not any('/recent?' in url for url in requests)
        await page.evaluate('showPlayer("내닉네임","P")')
        await page.wait_for_function("document.querySelector('[data-elo-status]').textContent.includes('찾지 못했어요')")
        assert await page.locator('.elo-public-metrics').count() == 0
        await page.evaluate('showPlayer("동명이인","P")')
        await page.wait_for_function("document.querySelectorAll('[data-elo-choice=owner]').length===2")
        assert await page.locator('.elo-public-metrics').count() == 0
        await page.locator('[data-elo-choice=owner][data-player-id="513"]').click()
        await page.locator('.elo-public-metrics').wait_for()
        assert '정소이' in await page.locator('.elo-public-heading').inner_text()
        assert await page.evaluate('(key)=>localStorage.getItem(key)', key) == raw
        assert not errors, errors
    finally:
        gate.set()
        await context.close()


async def check_directory_recovery(browser, origin):
    context, page, key, raw, flags, requests, gate, errors = await prepare(
        browser, origin, 390, harness=True, directory_fail=True)
    try:
        await page.wait_for_function("document.querySelector('[data-elo-status]').textContent.includes('찾지 못했어요')")
        assert await page.locator('.elo-public-metrics').count() == 0
        before = flags['directoryCalls']
        flags['directoryFail'] = False
        await page.locator('[data-elo-refresh]').click()
        await page.locator('.elo-public-metrics').wait_for()
        assert flags['directoryCalls'] > before
        assert '정소이' in await page.locator('.elo-public-heading').inner_text()
        assert await page.evaluate('(key)=>localStorage.getItem(key)', key) == raw
        assert not errors, errors
    finally:
        await context.close()


async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = 'http://127.0.0.1:' + str(server.server_address[1])
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch()
            try:
                for width in [1440, 390]:
                    await check_dashboard(browser, origin, width)
                await check_owner_change(browser, origin)
                await check_directory_recovery(browser, origin)
            finally:
                await browser.close()
    finally:
        server.shutdown()
    print('ELO UI smoke passed: desktop/mobile, identity changes, stale data, rivals, private journal preservation.')


if __name__ == '__main__':
    asyncio.run(main())
