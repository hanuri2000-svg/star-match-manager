import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const StarlogNotes = createRequire(import.meta.url)('../starlog/elo-notes.js');

const code = fs.readFileSync(new URL('../starlog/app.js', import.meta.url), 'utf8');
const part = (from, to) => code.slice(code.indexOf(from), code.indexOf(to));
const manual = {
  id: 'manual-ladder', date: '2026-11-16', type: '래더', result: 'W', race: 'T', myRace: 'P',
  opponent: '손수 입력', map: '투혼', build: '나의 빌드', enemyBuild: '상대 빌드',
  memo: '보존할 복기', tags: '정찰', star: true
};
const snapshot = () => ({
  fetchedAt: '2026-11-16T04:00:00.000Z', complete: false, stale: false, loading: false,
  warning: '일부 날짜는 공개 화면에 표시된 경기만 확인했어요.',
  matches: Array.from({ length: 50 }, (_, index) => ({
    id: 1000 + index, date: index < 25 ? '2026-11-16' : '2026-11-15',
    opponent: index === 6 ? '찾을 상대' : '자동 상대', opponentId: 513,
    race: index % 2 ? 'T' : 'Z', result: index % 2 ? 'L' : 'W', map: '폴리포이드',
    type: index % 3 ? '스폰' : '특별 대회'
  }))
});

function setup() {
  const nodes = new Map(['#records', '#recordsTable', '#resultCount', '#recordsTypeFilter', '#recordSyncStatus']
    .map(key => [key, { innerHTML: '', textContent: '' }]));
  const requests = [];
  let destroyed = 0;
  const initial = { version: 1, matches: [manual], trash: [{ ...manual, id: 'trashed' }], settings: { name: '최도랑' } };
  const ctx = vm.createContext({
    nodes, initial: structuredClone(initial), structuredClone,
    document: { getElementById: id => nodes.get('#' + id) },
    window: { StarlogNotes, StarlogElo: { mountRecent(_host, options) {
      requests.push(options);
      return { destroy() { destroyed++; } };
    } } }
  });
  vm.runInContext(`
    const $=selector=>nodes.get(selector);
    const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let db=initial,syncedRecords=null,eloRecordsController=null,page='records';
    let filters={q:'',type:'',race:'',result:'',from:'',to:''};
    ${part('const sorted=', 'function toast(')}
    ${part('function empty(', 'function drawHome(')}
    ${part('function recordRows(){', 'function drawStats(')}
  `, ctx);
  return {
    ctx, nodes, requests, initial,
    run: script => vm.runInContext(script, ctx),
    saved: () => JSON.parse(vm.runInContext('JSON.stringify(db)', ctx)),
    destroyed: () => destroyed
  };
}

test('the records view places 50 automatic rows under the existing search and filters', () => {
  const app = setup();
  app.run('drawRecords()');
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].fixedId, 443);
  const layout = app.nodes.get('#records').innerHTML;
  assert.equal((layout.match(/id="recordsTable"/g) || []).length, 1);
  assert.ok(layout.indexOf('id="search"') < layout.indexOf('id="recordsTable"'));
  assert.ok(layout.indexOf('id="recordsTypeFilter"') < layout.indexOf('id="recordsTable"'));
  app.requests[0].onData(snapshot());
  const table = app.nodes.get('#recordsTable').innerHTML;
  assert.equal((table.match(/data-synced-record=/g) || []).length, 50);
  assert.equal((table.match(/data-elo-note=/g)||[]).length,50);
  assert.match(table, /openForm\('manual-ladder'\)/);
  assert.doesNotMatch(layout, /data-record-source|record-sources/);
  assert.equal((table.match(/data-manual-record=/g)||[]).length,1);
  assert.match(app.nodes.get('#resultCount').textContent, /^51경기/);
  assert.match(app.nodes.get('#recordsTypeFilter').innerHTML, /특별 대회/);
  assert.deepEqual(app.saved(), app.initial);
});

test('automatic records respect opponent, original type, race, result and date filters', () => {
  const app = setup();
  app.run('drawRecords()');
  app.requests[0].onData(snapshot());
  app.run("setFilter('type','특별 대회')");
  assert.match(app.nodes.get('#resultCount').textContent, /^17경기/);
  app.run("setFilter('q','찾을 상대');setFilter('race','Z');setFilter('result','W');setFilter('from','2026-11-16');setFilter('to','2026-11-16')");
  assert.match(app.nodes.get('#resultCount').textContent, /^1경기/);
  assert.match(app.nodes.get('#recordsTable').innerHTML, /data-synced-record="1006"/);
  app.run("setFilter('from','2026-11-17')");
  assert.match(app.nodes.get('#resultCount').textContent, /^0경기/);
  assert.doesNotMatch(app.nodes.get('#recordsTable').innerHTML, /data-synced-record=/);
  assert.deepEqual(app.saved(), app.initial);
});

test('all saved game types appear in the same table and remain editable', () => {
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

test('automatic record labels are escaped while retaining the original source type', () => {
  const app = setup();
  const value = snapshot();
  value.matches[0] = { ...value.matches[0], opponent: '<img src=x onerror=alert(1)>', type: '<대회>' };
  app.run('drawRecords()');
  app.requests[0].onData(value);
  assert.doesNotMatch(app.nodes.get('#recordsTable').innerHTML, /<img/);
  assert.match(app.nodes.get('#recordsTable').innerHTML, /&lt;대회&gt;/);
  assert.match(app.nodes.get('#recordsTypeFilter').innerHTML, /&lt;대회&gt;/);
  assert.deepEqual(app.saved(), app.initial);
});


test('saving a manual game after filtering automatic records reveals the saved game', () => {
  const app = setup();
  app.nodes.set('#editor', { close() {} });
  app.run('drawRecords()');
  app.requests[0].onData(snapshot());
  app.run("setFilter('q','자동 상대');setFilter('type','특별 대회');setFilter('from','2026-11-17')");
  app.ctx.manualInput = { ...manual, id: '', opponent: '새 수동 상대' };
  vm.runInContext(`
    const form={};
    const crypto={randomUUID:()=> 'new-manual'};
    const localStorage={removeItem(){}};
    const DRAFT='draft';
    function formData(){return {...manualInput}}
    function validMatch(){return true}
    function change(fn){fn(db);return true}
    function toast(){}
    function render(){drawRecords()}
    ${part('form.onsubmit=', '\nfunction removeMatch(')}
    form.onsubmit({preventDefault(){}});
  `, app.ctx);
  assert.doesNotMatch(app.nodes.get('#records').innerHTML,/data-record-source/);
  assert.equal(app.run('filters.q'), '');
  assert.equal(app.run('filters.type'), '');
  assert.equal(app.run('filters.from'), '');
  assert.match(app.nodes.get('#recordsTable').innerHTML, /openForm\('new-manual'\)/);
  assert.match(app.nodes.get('#resultCount').textContent, /^52경기/);
});
