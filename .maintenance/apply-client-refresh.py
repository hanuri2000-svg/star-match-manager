from pathlib import Path
import hashlib
import json

app = Path('starlog') if Path('starlog/elo-public.js').exists() else Path('.')
p = app / 'elo-public.js'
assert hashlib.sha256(p.read_bytes()).hexdigest() == 'a3de67b4486984b022e52a2a4d8e16972090818ac3a51fd19be0431300c980bb'
s = p.read_text().replace('12 * 60 * 60 * 1000', '6 * 60 * 60 * 1000').replace('12시간', '6시간')
helper = '''  // A real browser reload asks each endpoint once for fresh data. Hash navigation,
  // focus, rerenders and normal visits continue to use the six-hour snapshot.
  function navigationReloadToken() {
    let token = 0;
    for (const candidate of [global, (() => { try { return global.top; } catch { return null; } })()]) {
      try {
        const performance = candidate?.performance;
        const navigation = performance?.getEntriesByType?.('navigation')?.[0];
        if ((navigation?.type === 'reload' || (!navigation && performance?.navigation?.type === 1)) &&
            Number.isFinite(performance?.timeOrigin)) token = Math.max(token, performance.timeOrigin);
      } catch { /* Cross-origin embedding must not affect the journal. */ }
    }
    return token ? String(token) : '';
  }
'''
s = s.replace('  function createClient(options = {}) {', helper + '  function createClient(options = {}) {', 1)
s = s.replace('    const ttl = options.ttl ?? REFRESH_INTERVAL;\n    const timeouts', "    const ttl = options.ttl ?? REFRESH_INTERVAL;\n    const reloadToken = options.reloadToken === undefined ? navigationReloadToken() : String(options.reloadToken || '');\n    const reloadClaims = new Set();\n    const timeouts", 1)
s = s.replace('      const previous = peek(kind, playerId, opponentId);', '''      const reloadKey = cacheKey + ':reload';
      if (reloadToken && !reloadClaims.has(cacheKey) && readJSON(storage, reloadKey) !== reloadToken) {
        reloadClaims.add(cacheKey); writeJSON(storage, reloadKey, reloadToken); force = true;
      }
      const previous = peek(kind, playerId, opponentId);''', 1)
s = s.replace("          if (kind === 'recent') params.set('limit', '50');", "          if (kind === 'recent') params.set('limit', '50');\n          if (force) params.set('refresh', '1');", 1)
s = s.replace('저장된 전적을 다시 확인해요. 원본 갱신은 6시간 간격이에요', '6시간을 기다리지 않고 최신 전적을 다시 조회해요')
s = s.replace('opponentMatch };', 'opponentMatch, navigationReloadToken };')
p.write_text(s)
assert hashlib.sha256(p.read_bytes()).hexdigest() == '2eac13e72e1fb80a27b179651a58ee004c8800ede9aa86d864c41dfd0aa3f124'

p = Path('tests/elo-public.test.mjs')
s = p.read_text().replace('12-hour', '6-hour').replace('12 elapsed hours', '6 elapsed hours').replace('12 hours', '6 hours').replace('12 * 60 * 60 * 1000', '6 * 60 * 60 * 1000')
s += '''

test('manual and browser reload bypass a fresh snapshot only when requested', async () => {
  const storage = store(), before = storage.values.get('my-starlog-v1');
  const calls = []; let now = NOW;
  const options = { site: 'six-hour-refresh', storage, now: () => now, fetch: async url => {
    calls.push(new URL(url)); return response({ ...summary(), fetchedAt: new Date(now).toISOString() });
  } };
  const client = createClient(options);
  await client.get('summary', 443);
  now += 60_000;
  await client.get('summary', 443);
  assert.equal(calls.length, 1);
  await client.get('summary', 443, null, true);
  assert.equal(calls[1].searchParams.get('refresh'), '1');
  const reload = createClient({ ...options, reloadToken: 'navigation-2' });
  await reload.get('summary', 443);
  assert.equal(calls[2].searchParams.get('refresh'), '1');
  await reload.get('summary', 443);
  await createClient({ ...options, reloadToken: 'navigation-2' }).get('summary', 443);
  assert.equal(calls.length, 3);
  await createClient({ ...options, reloadToken: 'navigation-3' }).get('summary', 443);
  assert.equal(calls.length, 4);
  assert.equal(storage.values.get('my-starlog-v1'), before);
});

test('failed browser reload retains the previous snapshot and personal notes', async () => {
  const storage = store(), before = storage.values.get('my-starlog-v1'); let calls = 0;
  const options = { site: 'reload-failure', storage, now: () => NOW, fetch: async () => {
    calls++; return calls === 1 ? response(summary()) : { ok: false, status: 503 };
  } };
  await createClient(options).get('summary', 443);
  const client = createClient({ ...options, reloadToken: 'reload-1' });
  const value = await client.get('summary', 443);
  assert.equal(value.stale, true); assert.equal(value.error, true);
  assert.deepEqual(value.data.overall, stats); assert.equal(value.data.fetchedAt, stamp);
  await client.get('summary', 443);
  assert.equal(calls, 2);
  assert.equal(storage.values.get('my-starlog-v1'), before);
});
'''
p.write_text(s)

p = Path('tests/elo-public-smoke.py')
s = p.read_text()
fn = '''async def check_manual_and_browser_refresh(browser, origin):
    state = await prepare(browser, origin, 1440)
    page = state['page']
    try:
        await wait_total(page)
        await page.wait_for_function("!document.querySelector('#journalStatistics [data-elo-refresh]').disabled")
        assert '6시간' in await page.locator('#journalStatistics').inner_text()
        initial = len(state['requests'])
        await page.locator('#journalStatistics [data-elo-refresh]').click()
        await page.wait_for_function("!document.querySelector('#journalStatistics [data-elo-refresh]').disabled")
        await wait_total(page)
        for kind in ['summary', 'activity']:
            urls = [url for url in state['requests'][initial:] if '/' + kind + '?' in url]
            assert len(urls) == 1, urls
            assert parse_qs(urlparse(urls[0]).query).get('refresh') == ['1'], urls
        await assert_journal(state)
        initial = len(state['requests'])
        await page.reload(wait_until='domcontentloaded')
        await wait_total(page)
        await page.wait_for_function("!document.querySelector('#journalStatistics [data-elo-refresh]').disabled")
        for kind in ['summary', 'activity']:
            urls = [url for url in state['requests'][initial:] if '/' + kind + '?' in url]
            assert len(urls) == 1, urls
            assert parse_qs(urlparse(urls[0]).query).get('refresh') == ['1'], urls
        count = len(state['requests'])
        await page.evaluate("window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('focus'))")
        await page.wait_for_timeout(250)
        assert len(state['requests']) == count
        await assert_journal(state)
        assert not state['errors'], state['errors']
        print('PASS manual refresh, browser reload, six-hour labels and preserved journal')
    finally:
        await state['context'].close()


'''
s = s.replace('async def main():', fn + 'async def main():', 1)
s = s.replace('                await check_owner_change(browser, origin)', '                await check_manual_and_browser_refresh(browser, origin)\n                await check_owner_change(browser, origin)', 1)
p.write_text(s)

if app != Path('.'):
    p = Path('schedule-play-records.js')
    p.write_text(p.read_text().replace('12 * 60 * 60 * 1000', '6 * 60 * 60 * 1000').replace('12시간', '6시간').replace('12-hour', '6-hour').replace('v=2.0.20', 'v=2.0.21'))
    for name in ['index.html', 'version.json']:
        p = Path(name); p.write_text(p.read_text().replace('5.24.31', '5.24.32'))
    for name in ['app.js', 'index.html', 'version.json']:
        p = app / name; p.write_text(p.read_text().replace('2.0.20', '2.0.21'))
    p = Path('version.json'); d = json.loads(p.read_text())
    d.update(releasedAt='2026-11-16T16:30:00Z', notes='전적 6시간 갱신 · 수동 다시 확인 및 브라우저 새로고침으로 최신 조회')
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
    p = Path('tests/schedule-play-smoke.py'); s = p.read_text()
    s = s.replace("state={'calls':0,'fail':False}", "state={'calls':0,'fail':False,'requests':[]}")
    s = s.replace("            state['calls']+=1", "            state['calls']+=1\n            state['requests'].append(url)")
    s = s.replace("        assert state['calls']==2", "        assert state['calls']==2\n        assert 'refresh=1' in state['requests'][-1]")
    p.write_text(s)
else:
    assert Path('sw.js').exists(), 'Only the intended standalone repository is supported'
    for name in ['app.js', 'index.html', 'version.json', 'sw.js']:
        p = Path(name); p.write_text(p.read_text().replace('2.2.14', '2.2.15'))
