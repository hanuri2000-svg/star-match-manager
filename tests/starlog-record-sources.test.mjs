import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

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
    window: { StarlogElo: { mountRecent(_host, options) {
      requests.push(options);
      return { destroy() { destroyed++; } };
    } } }
  });
  vm.runInContext(`
    const $=selector=>nodes.get(selector);
    const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let db=initial,recordSource='elo',syncedRecords=null,eloRecordsController=null,page='records';
    let filters={q:'',type:'',race:'',result:'',from:'',to:''};
    ${part('const sorted=', 'function toast(')}
    ${part('function empty(', 'function drawHome(')}
    ${part('function filtered(){', 'function drawStats(')}
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
  assert.doesNotMatch(table, /onclick=|<button|removeMatch|openForm|toggleStar/);
  assert.match(app.nodes.get('#resultCount').textContent, /^50경기/);
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

test('source switching restores editable ladder records without importing automatic rows', () => {
  const app = setup();
  app.run('drawRecords()');
  app.requests[0].onData(snapshot());
  app.run("setFilter('q','찾을 상대');setRecordSource('manual')");
  assert.equal(app.run('filters.q'), '');
  assert.equal(app.destroyed(), 1);
  assert.equal(app.requests.length, 1, 'manual source does not start a recent request');
  assert.match(app.nodes.get('#resultCount').textContent, /^1경기/);
  assert.match(app.nodes.get('#recordsTypeFilter').innerHTML, /래더/);
  assert.match(app.nodes.get('#recordsTable').innerHTML, /openForm\('manual-ladder'\)/);
  assert.match(app.nodes.get('#recordsTable').innerHTML, /removeMatch\('manual-ladder'\)/);
  assert.doesNotMatch(app.nodes.get('#recordsTable').innerHTML, /data-synced-record=/);
  app.run("setFilter('q','보존할 복기');setFilter('type','래더')");
  assert.match(app.nodes.get('#resultCount').textContent, /^1경기/);
  assert.deepEqual(app.saved(), app.initial);
});

test('late automatic results cannot replace the selected manual records view', () => {
  const app = setup();
  app.run('drawRecords()');
  app.run("setRecordSource('manual')");
  const before = app.nodes.get('#recordsTable').innerHTML;
  app.requests[0].onData(snapshot());
  assert.equal(app.nodes.get('#recordsTable').innerHTML, before);
  assert.match(app.nodes.get('#resultCount').textContent, /^1경기/);
  assert.deepEqual(app.saved(), app.initial);
  app.run("setRecordSource('elo')");
  assert.equal((app.nodes.get('#recordsTable').innerHTML.match(/data-synced-record=/g) || []).length, 50);
  assert.deepEqual(app.saved(), app.initial);
});

test('unavailable first data is shown as unknown instead of a fabricated zero record count', () => {
  const app = setup();
  app.run('drawRecords()');
  assert.doesNotMatch(app.nodes.get('#resultCount').textContent, /0경기/);
  app.requests[0].onData({ matches: [], fetchedAt: null, error: true, loading: false });
  assert.doesNotMatch(app.nodes.get('#resultCount').textContent, /0경기/);
  assert.match(app.nodes.get('#recordsTable').innerHTML, /불러오지 못했어요/);
  app.requests[0].onData({ ...snapshot(), matches: [], complete: true, error: false });
  assert.match(app.nodes.get('#resultCount').textContent, /^0경기/);
  assert.deepEqual(app.saved(), app.initial);
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
  assert.equal(app.run('recordSource'), 'manual');
  assert.equal(app.run('filters.q'), '');
  assert.equal(app.run('filters.type'), '');
  assert.equal(app.run('filters.from'), '');
  assert.match(app.nodes.get('#recordsTable').innerHTML, /openForm\('new-manual'\)/);
  assert.match(app.nodes.get('#resultCount').textContent, /^2경기/);
});
