import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../spwn-native.js',import.meta.url),'utf8');
function setup(){
  const root={innerHTML:''},note={textContent:''};
  const context={records:[{myBuild:'더블',result:'승'},{myBuild:'더블',result:'패'},{myBuild:'',result:'승'}],Map,Set,Number,String,Math,
    esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
    stat:list=>{const w=list.filter(r=>r.result==='승').length,l=list.filter(r=>r.result==='패').length;return {w,l,t:w+l,p:w+l?Math.round(w/(w+l)*1000)/10:0}},
    $:selector=>selector==='#dashboardBreakdowns'?root:note,getBasePlayer:()=> '최도랑',eloDashboardError:'',normalizeName:v=>String(v).replace(/\s/g,'').toLowerCase()};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function localBuildRows()'),source.indexOf('\nfunction renderTable()',source.indexOf('function localBuildRows()'))),context);
  return {context,root,note};
}
test('상세전적은 기존 일지의 빌드별 승패를 집계한다',()=>{
  const {context}=setup(),rows=context.localBuildRows();
  assert.equal(rows[0].label,'더블');assert.equal(rows[0].w,1);assert.equal(rows[0].l,1);assert.equal(rows[0].p,50);
  assert.equal(rows[1].label,'빌드 미입력');
});
test('공식전과 일지 출처를 나누고 상대는 중복 없이 최근 20명만 표시한다',()=>{
  const {context,root,note}=setup();
  const opponents=Array.from({length:23},(_,i)=>({label:`선수${i}`,wins:1,losses:0,winRate:100,lastPlayedOn:`2026-10-${String(i+1).padStart(2,'0')}`}));
  opponents.push({...opponents[22]});
  context.renderDashboardBreakdowns({player:{name:'최도랑'},detailGames:500,maps:[{label:'<투혼>',wins:3,losses:1,winRate:75}],opponents});
  assert.match(root.innerHTML,/&lt;투혼&gt;/);assert.match(root.innerHTML,/3승 1패/);assert.match(root.innerHTML,/빌드별 전적/);
  assert.equal((root.innerHTML.match(/<b>선수/g)||[]).length,20);assert.equal((root.innerHTML.match(/<b>선수22<\/b>/g)||[]).length,1);
  assert(!root.innerHTML.includes('<b>선수0</b>'));assert.match(note.textContent,/500경기/);
});
test('조회 실패 시 공식전 수치를 만들지 않고 일지 통계만 유지한다',()=>{
  const {context,root}=setup();context.eloDashboardError='연결 실패';context.renderDashboardBreakdowns(null);
  assert.match(root.innerHTML,/연결 실패/);assert.match(root.innerHTML,/더블/);assert.match(root.innerHTML,/스폰일지 기준/);
});
