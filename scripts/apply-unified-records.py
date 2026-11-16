from pathlib import Path
import json

p=Path('starlog/app.js');s=p.read_text()
assert "recordSource='elo'" in s and "const APP_VERSION='2.0.21'" in s
s=s.replace(",recordSource='elo',syncedRecords=null",",syncedRecords=null")
s=s.replace("function filterDate(date){recordSource='manual';", "function filterDate(date){")
start=s.index('function filtered(){');end=s.index('function openSyncedNote(id){',start)
s=s[:start]+r'''// Combine views, never import source matches into the user's journal.
function recordRows(){
 const linked=window.StarlogNotes.enrich(syncedRecords?.matches||[],db.eloNotes).map(m=>({...m,officialId:Number(m.id),manualEntries:[]}));
 const byId=new Map(linked.map(m=>[m.officialId,m])),extra=[];
 for(const m of sorted()){
  // A shared date/opponent/map is not an identity: rematches must survive.
  const ref=m.eloMatchId??m.eloRecordId??(m.source==='eloboard'?m.sourceId:null);
  const id=/^[1-9]\d*$/.test(String(ref))&&Number.isSafeInteger(Number(ref))?Number(ref):null;
  const existing=id&&byId.get(id);
  if(existing)existing.manualEntries.push(m);
  else extra.push({...m,officialId:null,manualEntries:[m]});
 }
 return [...linked,...extra].map(m=>({...m,
  build:m.build||m.manualEntries.map(v=>v.build).filter(Boolean).join(' / '),
  searchText:[m,...m.manualEntries].map(v=>[v.opponent,v.map,v.build,v.enemyBuild,v.memo,v.feedback,v.tags].filter(Boolean).join(' ')).join(' ')
 })).sort((a,b)=>b.date.localeCompare(a.date));
}
function filtered(){return recordRows().filter(m=>(!filters.q||m.searchText.toLowerCase().includes(filters.q.toLowerCase()))&&(!filters.type||m.type===filters.type)&&(!filters.race||m.race===filters.race)&&(!filters.result||m.result===filters.result)&&(!filters.from||m.date>=filters.from)&&(!filters.to||m.date<=filters.to))}
function unifiedTable(rows){
 return `<div class="table-wrap"><table><thead><tr><th>날짜</th><th>상대</th><th>맵</th><th>결과</th><th>유형</th><th>내 빌드</th><th>메모 · 피드백</th><th>관리</th></tr></thead><tbody>${rows.map(m=>{
  const automatic=Boolean(m.officialId),local=m.manualEntries;
  const memo=[m,...(automatic?local:[])].flatMap(v=>[v.memo,v.feedback]).filter(Boolean).join(' · ');
  const note=automatic?`<button type="button" class="btn small" data-elo-note="${m.officialId}" onclick="openSyncedNote(${m.officialId})">${m.memo||m.feedback?'보기 / 수정':'작성'}</button>`:`<button type="button" class="btn small" onclick="openForm('${m.id}')">${memo?'보기 / 수정':'작성'}</button>`;
  const management=local.map(v=>`<button class="star-button ${v.star?'on':''}" onclick="toggleStar('${v.id}')" aria-label="다시 보기 ${v.star?'해제':'표시'}">${v.star?'♥':'♡'}</button><button class="icon-btn" onclick="openForm('${v.id}')">수정</button><button class="icon-btn danger" onclick="removeMatch('${v.id}')">삭제</button>`).join('');
  return `<tr ${automatic?`data-synced-record="${m.officialId}"`:`data-manual-record="${esc(m.id)}"`}><td>${esc(m.date)}</td><td>${['P','T','Z','R'].includes(m.race)?`<span class="race ${m.race}">${m.race}</span>`:''}${esc(m.opponent)}</td><td>${esc(m.map||'맵 미등록')}</td><td><span class="badge ${m.result==='W'?'win':'loss'}">${m.result==='W'?'승리':'패배'}</span></td><td>${esc(m.type||'기타')}</td><td>${esc(m.build||'—')}</td><td>${note}${memo?`<small style="display:block;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(memo.slice(0,70))}</small>`:''}</td><td>${management||'<span class="date-label">—</span>'}</td></tr>`;
 }).join('')}</tbody></table></div>`;
}
''' +s[end:]
start=s.index('function drawRecordRows(){');end=s.index('function setFilter(k,v)',start)
s=s[:start]+r'''function drawRecordRows(){
 const target=$('#recordsTable'),count=$('#resultCount');if(!target||!count||page!=='records')return;
 const rows=filtered(),s=info(rows),known=Boolean(syncedRecords?.fetchedAt);
 const types=[...new Set([...typeOptions,...recordRows().map(m=>m.type).filter(Boolean),...(filters.type?[filters.type]:[])])];
 const typeFilter=$('#recordsTypeFilter');if(typeFilter)typeFilter.innerHTML='<option value="">모든 유형</option>'+types.map(v=>`<option value="${esc(v)}" ${filters.type===v?'selected':''}>${esc(v)}</option>`).join('');
 count.textContent=(known||rows.length?`${s.n}경기 · ${s.w}승 ${s.l}패`:'')+(!known?(rows.length?' · ':'')+(syncedRecords?.error?'연동 전적 확인 필요':'연동 전적 확인 중…'):'');
 target.innerHTML=rows.length?unifiedTable(rows):!known?empty('⌛',syncedRecords?.error?'최근 경기를 불러오지 못했어요':'최근 경기를 확인하고 있어요',syncedRecords?.error?'저장된 경기는 그대로 유지돼요. 다시 확인을 눌러 주세요.':'저장된 경기는 먼저 표시하고, 확인된 전적을 같은 목록에 추가해요.'):empty('🔎','찾은 경기가 없어요','검색 조건을 바꾸거나 새로운 경기를 기록해 보세요.');
}
function drawRecords(){
 eloRecordsController?.destroy();eloRecordsController=null;
 $('#records').innerHTML=heading('경기 기록 📖','최도랑의 연동 경기와 래더·스폰·연습·CK 기록을 날짜순으로 함께 확인해요.')+`<div id="recordSyncStatus"></div><div class="filters"><input id="search" value="${esc(filters.q)}" placeholder="상대, 맵, 빌드, 메모 검색" aria-label="경기 검색" oninput="setFilter('q',this.value)"><select id="recordsTypeFilter" aria-label="유형 필터" onchange="setFilter('type',this.value)"></select><select aria-label="종족 필터" onchange="setFilter('race',this.value)"><option value="">모든 종족</option>${Object.entries(raceNames).map(([k,v])=>`<option value="${k}" ${filters.race===k?'selected':''}>${v}</option>`).join('')}</select><select aria-label="결과 필터" onchange="setFilter('result',this.value)"><option value="">모든 결과</option><option value="W" ${filters.result==='W'?'selected':''}>승리</option><option value="L" ${filters.result==='L'?'selected':''}>패배</option></select><input type="date" aria-label="시작 날짜" value="${filters.from}" onchange="setFilter('from',this.value)"><input type="date" aria-label="종료 날짜" value="${filters.to}" onchange="setFilter('to',this.value)"><button class="btn small" onclick="resetFilters()">초기화</button></div><div class="panel"><div class="panel-title"><h3 id="resultCount"></h3><span class="date-label">날짜순 · 연동 최근 50경기와 저장된 경기</span></div><div id="recordsTable"></div></div>`;
 drawRecordRows();
 eloRecordsController=window.StarlogElo?.mountRecent(document.getElementById('recordSyncStatus'),{site:'dorang-integrated',name:'최도랑',race:'P',fixedId:443,onData(snapshot){syncedRecords={...syncedRecords,...snapshot};drawRecordRows()}});
 if(!eloRecordsController){syncedRecords={...syncedRecords,error:true};drawRecordRows()}
}
''' +s[end:]
s=s.replace("if(recordSource==='elo')filters={q:'',type:'',race:'',result:'',from:'',to:''};recordSource='manual';", "filters={q:'',type:'',race:'',result:'',from:'',to:''};")
s=s.replace("const existing=db.matches.find(m=>m.id===v.id);v.id=", "const existing=db.matches.find(m=>m.id===v.id);for(const k of ['eloMatchId','eloRecordId','source','sourceId','legacyRecord'])if(existing&&Object.hasOwn(existing,k))v[k]=existing[k];v.id=")
assert 'recordSource' not in s and 'data-record-source' not in s
p.write_text(s.replace('2.0.21','2.0.22'))
for name in ['starlog/index.html','starlog/sw.js','starlog/version.json','starlog-embed.js']:
 p=Path(name);p.write_text(p.read_text().replace('2.0.21','2.0.22'))
p=Path('index.html');p.write_text(p.read_text().replace('5.24.32','5.24.33'))
p=Path('version.json');d=json.loads(p.read_text());d.update(version='5.24.33',releasedAt='2026-11-16T22:35:00Z',notes='경기 기록을 한 목록으로 통합 · 자동연동 및 직접 작성 경기 함께 표시');p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')

# Keep existing test scaffolding; replace the obsolete source-switch expectations.
p=Path('tests/starlog-record-sources.test.mjs');s=p.read_text()
s=s.replace("let db=initial,recordSource='elo',syncedRecords=null", "let db=initial,syncedRecords=null")
s=s.replace("${part('function filtered(){', 'function drawStats(')}", "${part('function recordRows(){', 'function drawStats(')}")
s=s.replace("assert.doesNotMatch(table, /removeMatch|openForm|toggleStar/);", "assert.match(table, /openForm\\('manual-ladder'\\)/);\n  assert.doesNotMatch(layout, /data-record-source|record-sources/);\n  assert.equal((table.match(/data-manual-record=/g)||[]).length,1);")
s=s.replace("/^50경기/", "/^51경기/")
a=s.index("test('source switching");b=s.index("test('automatic record labels",a)
s=s[:a]+r'''test('all saved game types appear in the same table and remain editable', () => {
  const app=setup();app.run('drawRecords()');app.requests[0].onData(snapshot());
  for(const type of ['스폰','연습','CK','기타'])app.run(`db.matches.push({...db.matches[0],id:'extra-${type}',type:'${type}'})`);
  app.run('drawRecordRows()');
  assert.match(app.nodes.get('#resultCount').textContent,/^55경기/);
  app.run("setFilter('q','보존할 복기');setFilter('type','래더')");
  assert.match(app.nodes.get('#resultCount').textContent,/^1경기/);
  assert.match(app.nodes.get('#recordsTable').innerHTML,/removeMatch\('manual-ladder'\)/);
  assert.equal(app.requests.length,1);
});

test('late official results preserve the active filters and local matches', () => {
  const app=setup();app.run('drawRecords();setFilter("type","래더");setFilter("q","보존할 복기")');
  const before=app.nodes.get('#recordsTable').innerHTML;
  app.requests[0].onData(snapshot());
  assert.equal(app.nodes.get('#recordsTable').innerHTML,before);
  assert.equal(app.run('filters.type'),'래더');
  assert.deepEqual(app.saved(),app.initial);
  app.run('resetFilters()');
  assert.match(app.nodes.get('#resultCount').textContent,/^51경기/);
});

test('missing source data never hides local records or invents zero totals', () => {
  const app=setup();app.run('drawRecords()');
  assert.match(app.nodes.get('#resultCount').textContent,/^1경기.*확인 중/);
  app.requests[0].onData({matches:[],fetchedAt:null,error:true,loading:false});
  assert.match(app.nodes.get('#recordsTable').innerHTML,/manual-ladder/);
  assert.match(app.nodes.get('#resultCount').textContent,/연동 전적 확인 필요/);
  app.run('db.matches=[];drawRecordRows()');
  assert.doesNotMatch(app.nodes.get('#resultCount').textContent,/0경기/);
  app.requests[0].onData({...snapshot(),matches:[],complete:true,error:false});
  assert.match(app.nodes.get('#resultCount').textContent,/^0경기/);
});

test('only explicit official IDs merge rows; rematches and all notes are preserved', () => {
  const app=setup();app.run('drawRecords()');app.requests[0].onData(snapshot());
  app.ctx.explicit={...manual,id:'linked',eloMatchId:1000,memo:'연결 메모',type:'스폰'};
  app.run('db.matches.push(explicit);drawRecordRows()');
  assert.match(app.nodes.get('#resultCount').textContent,/^51경기/);
  assert.match(app.nodes.get('#recordsTable').innerHTML,/openForm\('linked'\)/);
  app.run('setFilter("q","연결 메모")');
  assert.match(app.nodes.get('#recordsTable').innerHTML,/data-synced-record="1000"/);
  app.run('filters.q="";db.matches.push({...explicit,id:"rematch",eloMatchId:undefined});drawRecordRows()');
  assert.match(app.nodes.get('#resultCount').textContent,/^52경기/);
  assert.equal(app.saved().matches.length,3);
});

test('one table is date sorted without changing the source order of same-day rematches', () => {
  const app=setup();app.run('drawRecords()');app.requests[0].onData(snapshot());
  app.run('db.matches.push({...db.matches[0],id:"newer",date:"2026-11-17"});drawRecordRows()');
  const rows=JSON.parse(app.run('JSON.stringify(recordRows())'));
  assert.equal(rows[0].id,'newer');
  assert.deepEqual(rows.filter(r=>r.officialId).map(r=>r.id),snapshot().matches.map(r=>r.id));
});

''' +s[b:]
s=s.replace("assert.equal(app.run('recordSource'), 'manual');", "assert.doesNotMatch(app.nodes.get('#records').innerHTML,/data-record-source/);")
s=s.replace("/^2경기/", "/^52경기/")
p.write_text(s)

# Existing browser checks retain statistics, reload, notes, backup and storage cases.
p=Path('tests/elo-public-smoke.py');s=p.read_text()
a=s.index('async def check_records(');b=s.index('\n\nasync def check_statistics(',a)
s=s[:a]+'''async def check_records(state, width):
    page, requests = state['page'], state['requests']
    assert not any('/recent?' in url for url in requests)
    await page.locator('#nav a[href="#records"]').click()
    await page.wait_for_function("document.querySelectorAll('#recordsTable [data-synced-record]').length===50")
    assert await page.locator('[data-record-source]').count() == 0
    assert await page.locator('#records #recordsTable').count() == 1
    assert await page.locator('#recordsTable tbody tr').count() == 51
    assert '51경기' in await page.locator('#resultCount').inner_text()
    assert '일부 날짜' in await page.locator('#recordSyncStatus').inner_text()
    assert await page.locator('#recordsTable [data-elo-note]').count() == 50
    assert await page.locator('#recordsTable button.danger').count() == 1
    dates = await page.locator('#recordsTable tbody tr td:first-child').all_text_contents()
    assert dates == sorted(dates, reverse=True)
    geometry = await page.evaluate("""() => ({
      search:document.getElementById('search').getBoundingClientRect().bottom,
      filter:document.getElementById('recordsTypeFilter').getBoundingClientRect().bottom,
      table:document.getElementById('recordsTable').getBoundingClientRect().top
    })""")
    assert geometry['search'] <= geometry['table'] and geometry['filter'] <= geometry['table']
    await page.locator('#recordsTypeFilter').select_option('특별 대회')
    assert await page.locator('#recordsTable [data-synced-record]').count() == 17
    await page.locator('#search').fill('찾을 상대')
    assert await page.locator('#recordsTable tbody tr').count() == 1
    await page.locator('#recordsTypeFilter').select_option('래더')
    await page.locator('#search').fill('보존할 복기')
    assert await page.locator('#recordsTable tbody tr').count() == 1
    assert '나의 빌드' in await page.locator('#recordsTable').inner_text()
    await page.locator('#recordsTable .icon-btn').filter(has_text='수정').click()
    assert await page.locator('#matchForm [name="memo"]').input_value() == '보존할 복기\\n다음 줄'
    await page.locator('#editor [aria-label="닫기"]').click()
    await page.evaluate('resetFilters()')
    await page.wait_for_function("document.querySelectorAll('#recordsTable tbody tr').length===51")
    assert len([url for url in requests if '/recent?' in url]) == 1
    await assert_journal(state)
    await page.screenshot(path=str(OUTPUT / ('records-' + str(width) + '.png')))
    await page.locator('#nav a[href="#home"]').click()
    await wait_total(page)
''' +s[b:]
a=s.index('async def check_late_recent(');b=s.index('\n\nasync def check_synced_notes(',a)
s=s[:a]+'''async def check_late_recent(browser, origin):
    state = await prepare(browser, origin, 390, delay_recent=True)
    page = state['page']
    try:
        await wait_total(page)
        await page.locator('#nav a[href="#records"]').click()
        await asyncio.wait_for(state['started'].wait(), timeout=10)
        assert await page.locator('#recordsTable [data-manual-record]').count() == 1
        await page.locator('#recordsTypeFilter').select_option('래더')
        await page.locator('#search').fill('보존할 복기')
        before = await page.locator('#recordsTable').inner_html()
        state['gate'].set()
        await page.wait_for_function("document.querySelector('#recordSyncStatus')?.textContent.includes('50경기')")
        assert await page.locator('#recordsTable').inner_html() == before
        assert await page.locator('#search').input_value() == '보존할 복기'
        await page.evaluate('resetFilters()')
        await page.wait_for_function("document.querySelectorAll('#recordsTable tbody tr').length===51")
        state['fail'] = True
        await page.locator('#recordSyncStatus [data-elo-refresh]').click()
        await page.wait_for_function("document.querySelector('#recordSyncStatus')?.textContent.includes('마지막')")
        assert await page.locator('#recordsTable tbody tr').count() == 51
        await assert_journal(state)
        assert not state['errors'], state['errors']
    finally:
        state['gate'].set()
        await state['context'].close()
''' +s[b:]
p.write_text(s)
print('Applied unified-records patch; no shared statistics, relay or independent sites changed.')
