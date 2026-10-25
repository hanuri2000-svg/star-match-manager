"""Exercise Duck scoring and external pinball assignment through real controls."""


async def check_party_scoreboard(page, width):
    await page.locator('.app-tabs [data-tab="party"]').click()
    await page.locator('.duck-score-panel').wait_for()
    assert await page.locator('[data-party-team-add]').count() == 0
    assert await page.locator('[data-duck-pinball-team]').count() == 0
    for name in ['최도랑', '단솔', '유즈']:
        await page.locator('#partyPlayerName').fill(name)
        await page.locator('[data-party-act="add-player"]').click()
    # Switching games with freshly added, unassigned Duck participants must
    # still use the original Fall Guys table without a missing-team error.
    await page.locator('[data-party="game"]').select_option('폴가이즈')
    assert await page.locator('[data-party-team-add]').count() == 2
    await page.locator('[data-party="game"]').select_option('덕몽어스')
    assert await page.locator('[data-duck-pinball-team]').count() == 0
    ids = await page.locator('[data-duck-player]').evaluate_all(
        "rows => Object.fromEntries(rows.map(row => [row.querySelector('.party-name').textContent.trim(), row.dataset.duckPlayer]))")

    async def score(name, round_index, value):
        locator = page.locator(f'[data-party-score="{ids[name]}"][data-round="{round_index}"]')
        await locator.fill(str(value))
        await locator.press('Tab')

    async def total(name):
        return await page.locator(f'[data-party-total="{ids[name]}"]').input_value()

    await score('최도랑', 0, 10)
    await score('단솔', 0, 5)
    await page.locator('[data-duck-score-round]').select_option('1')
    await score('단솔', 1, 7)
    assert await total('단솔') == '12'
    assert await page.locator('[data-duck-player] .party-name').first.inner_text() == '단솔'
    # A previous manually entered total must not mask later round edits.
    await page.locator(f'[data-party-total="{ids["단솔"]}"]').fill('999')
    await page.locator(f'[data-party-total="{ids["단솔"]}"]').press('Tab')
    await score('단솔', 1, 8)
    assert await total('단솔') == '13'
    await score('유즈', 1, 13)
    assert await page.locator('.duck-score-table .party-rank').all_text_contents() == ['1', '1', '3']
    assert await page.locator('[data-duck-pinball-team]').count() == 0
    assert await page.locator('.duck-team-summary').count() == 0

    await page.locator('[data-party-round-count]').fill('30')
    await page.locator('[data-party-round-count]').press('Tab')
    await page.locator('[data-duck-score-round]').select_option('29')
    await score('유즈', 29, 4)
    assert await total('유즈') == '17'
    if width <= 760:
        assert await page.locator('[data-party-score]:visible').count() == 3
    target = page.locator(f'[data-party-score="{ids["유즈"]}"][data-round="29"]')
    await target.scroll_into_view_if_needed()
    geometry = await target.evaluate("""el => {
      const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      return {height:r.height,reachable:hit===el,docWidth:document.documentElement.scrollWidth};
    }""")
    assert geometry['height'] >= 20 and geometry['reachable'], geometry
    assert geometry['docWidth'] <= width + 1, geometry
    before = await page.evaluate("""() => {
      const labels=[],original=CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText=function(text,...args){labels.push(String(text));return original.call(this,text,...args)};
      try {const canvas=window.DORANG_DUCK_RANKING_CANVAS();return {labels,width:canvas.width}} finally {CanvasRenderingContext2D.prototype.fillText=original}
    }""")
    assert before['width'] == 1080
    assert '핀볼 홀짝 배정 전 · 개인 순위' in before['labels']
    assert not any('도랑팀' in text or '너거팀' in text for text in before['labels'])

    # Old saves may contain A/B teams. Reloading must not turn those into
    # pinball results or hide the existing individual scores.
    await page.reload(wait_until='networkidle')
    await page.wait_for_function("window.HARINA_MASTER_SYNC_STATUS?.status==='ok'")
    await page.locator('.app-tabs [data-tab="party"]').click()
    assert await total('유즈') == '17'
    assert await page.locator('[data-duck-pinball-team]').count() == 0
    await page.locator('[data-duck-show-teams]').click()
    assert await page.locator('[data-duck-pinball-team]').evaluate_all("els=>els.every(el=>el.value==='')")
    await page.locator(f'[data-duck-pinball-team="{ids["최도랑"]}"]').select_option('odd')
    await page.locator(f'[data-duck-pinball-team="{ids["단솔"]}"]').select_option('even')
    assert await page.locator(f'[data-duck-pinball-team="{ids["유즈"]}"]').input_value() == ''
    assert await page.locator('.duck-team-summary strong').all_text_contents() == ['10점', '13점']
    assert '미정 1명' in await page.locator('.duck-pinball-status').inner_text()
    await page.reload(wait_until='networkidle')
    await page.wait_for_function("window.HARINA_MASTER_SYNC_STATUS?.status==='ok'")
    await page.locator('.app-tabs [data-tab="party"]').click()
    assert await total('유즈') == '17'
    assert await page.locator(f'[data-duck-pinball-team="{ids["최도랑"]}"]').input_value() == 'odd'

    # Fall Guys keeps its original two team forms and score table.
    await page.locator('[data-party="game"]').select_option('폴가이즈')
    assert await page.locator('.duck-score-panel').count() == 0
    assert await page.locator('[data-party-team-add]').count() == 2
    assert await page.locator('.party-team-score').count() == 1
    assert await page.locator('[data-party-score]').count() == 90
    await page.locator('[data-party="game"]').select_option('덕몽어스')
    assert await total('유즈') == '17'
    return {'rounds': 30, 'players': 3, 'tiedRanks': True, 'pinballUnassigned': 1,
            'scoreInputReachability': geometry, 'persistence': True, 'fallGuysPreserved': True}
