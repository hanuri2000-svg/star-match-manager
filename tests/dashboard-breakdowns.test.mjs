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
test('맵·빌드·상대별 전적을 저장된 일지로 집계한다',()=>{
 const {context,root,note}=setup();context.records=[{map:'<투혼>',opponent:'상대',myBuild:'더블',result:'승',date:'2026-11-08'},{map:'<투혼>',opponent:'상대',myBuild:'더블',result:'패',date:'2026-11-07'}];
 context.renderDashboardBreakdowns();
 assert.match(root.innerHTML,/&lt;투혼&gt;/);assert.match(root.innerHTML,/1승 1패/);assert.match(root.innerHTML,/상대/);
 assert.doesNotMatch(root.innerHTML,/ELO 기준|조회 중|연결 실패/);assert.match(note.textContent,/저장된 스폰일지/);
});
