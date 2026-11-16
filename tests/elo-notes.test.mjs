import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const notes = createRequire(import.meta.url)('../starlog/elo-notes.js');
const match = {id:123,date:'2026-11-16',opponentId:513,opponent:'정소이',race:'Z',result:'W',map:'투혼',type:'스폰'};
test('annotations follow official IDs, without mutating or duplicating match records',()=>{
 const original=JSON.stringify(match);
 const saved=notes.save(undefined,match,'메모\n둘째 줄','피드백',true,0);
 const refreshed={...match,map:'수정된 맵',result:'L'};
 const rows=notes.enrich([refreshed,{...match,id:124}],saved);
 assert.equal(rows[0].memo,'메모\n둘째 줄');assert.equal(rows[0].feedback,'피드백');assert.equal(rows[0].map,'수정된 맵');assert.equal(rows[0].result,'L');
 assert.equal(rows[1].memo,'');assert.equal(rows.length,2);assert.equal(JSON.stringify(match),original);
 assert.equal(notes.validNotes(saved),true);
});
test('notes remain available through review and a JSON backup when no longer in latest 50',()=>{
 const saved=notes.save({},match,'<script>alert(1)</script>','다음 경기 피드백',true,0);
 assert.deepEqual(notes.enrich([],saved),[]);
 const restored=JSON.parse(JSON.stringify({version:1,matches:[],trash:[],eloNotes:saved}));
 assert.equal(notes.validNotes(restored.eloNotes),true);
 assert.equal(notes.reviewRows(restored.eloNotes)[0].eloMatchId,123);
 assert.match(notes.reviewRows(restored.eloNotes)[0].memo,/피드백/);
 assert.equal(restored.matches.length,0);
});
test('legacy backups are accepted; wrong identities and malformed annotations are rejected',()=>{
 assert.equal(notes.validNotes(undefined),true);assert.equal(notes.validNotes({}),true);
 const saved=notes.save({},match,'','',false,0);
 assert.equal(notes.validNotes({...saved,'443:124':saved['443:123']}),false);
 assert.equal(notes.validNotes({'443:123':{...saved['443:123'],feedback:34}}),false);
 assert.equal(notes.validNotes(null),false);
 assert.throws(()=>notes.save({},match,'x'.repeat(10001),'',false));
 assert.throws(()=>notes.keyFor('123 onclick=alert(1)'));
});
test('separate same-day games and memo updates never erase another game annotation',()=>{
 const one=notes.save({},match,'첫 경기','피드백1',false,0);
 const two=notes.save(one,{...match,id:124},'두 번째','피드백2',false,1);
 const three=notes.save(two,match,'수정','다시 피드백',true,2);
 assert.equal(notes.get(three,124).memo,'두 번째');assert.equal(notes.get(one,123).memo,'첫 경기');
 assert.equal(Object.keys(three).length,2);
});
