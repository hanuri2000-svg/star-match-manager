import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),api=require('../notification-center.js'),backup=require('../integrated-backup.js');
test('일정은 30분 전부터 한 번만 알리고 지난 일정·완료 일정·잘못된 시간을 제외한다',()=>{
 const s=api.blank(),now=new Date(2026,9,3,19,40);
 const list=[{id:1,date:'2026-10-03',time:'20:00',title:'CK'},{id:2,date:'2026-10-03',time:'19:00',title:'지난 일정'},{id:3,date:'2026-10-03',time:'20:00',title:'완료',done:true},{id:4,date:'2026-10-03',time:'미정',title:'시간 미정'},{id:5,date:'2026-10-03',time:'21:00',title:'아직 멀어'}];
 api.observeSchedules(s,list,now);assert.equal(s.items.length,1);assert.match(s.items[0].body,/20분 후/);api.observeSchedules(s,list,now);assert.equal(s.items.length,1);
 api.markRead(s);api.clearRead(s);api.observeSchedules(s,list,now);assert.equal(s.items.length,0);
 assert.equal(api.timeMinutes('오후 8시 10분'),1210);assert.equal(api.timeMinutes('오전 12시'),0);assert.equal(api.timeMinutes('저녁 8시'),1200);assert.equal(api.timeMinutes('24:00'),null);
});
test('처음 보는 기존 일정은 새 일정으로 알리지 않고 이후 등록된 일정만 알린다',()=>{
 const s=api.blank(),now=new Date(2026,9,3,10,0),list=[{id:1,date:'2026-10-04',title:'원래 일정'}];api.observeSchedules(s,list,now);assert.equal(s.items.length,0);
 api.observeSchedules(s,[...list,{id:2,date:'2026-10-04',title:'새 일정'}],now);assert.equal(s.items.length,1);assert.equal(s.items[0].title,'새 일정 등록');
});
test('ELO 실제 변동만 기록하고 같은 값의 재조회와 오류 상태는 점수 변경으로 취급하지 않는다',()=>{
 const s=api.blank();api.observeElo(s,{status:'cached',score:1200});assert.equal(s.items.length,0);api.observeElo(s,{status:'ok',score:1210});assert.equal(s.items.length,1);assert.match(s.items[0].body,/1200 → 1210 \(\+10\)/);
 api.observeElo(s,{status:'ok',score:1210});assert.equal(s.items.length,1);api.observeElo(s,{status:'error',score:1000,error:'시간 초과'});assert.equal(s.baseline.elo,1210);assert.equal(s.items[0].title,'ELO 동기화 오류');
 api.observeElo(s,{status:'ok',score:1200});api.observeElo(s,{status:'ok',score:1210});assert.equal(s.items.filter(x=>x.title==='최도랑 ELO 변경').length,3);
});
test('모듈 로드 순서가 달라도 확인된 이전 점수를 기준으로 알린다',()=>{
 const s=api.blank();api.observeElo(s,{status:'ok',score:1234.5,previousScore:1200});assert.equal(s.items.length,1);assert.match(s.items[0].body,/\+34.5/);
});
test('티어·티어표 버전 변화는 성공한 조회에서만 알린다',()=>{
 const s=api.blank();api.observeTier(s,{status:'ok',version:'3.62'},'4티어');assert.equal(s.items.length,0);
 api.observeTier(s,{status:'error'},'3티어');assert.equal(s.baseline.tier,'4티어');api.observeTier(s,{status:'ok',version:'3.63',sourceDate:'2026-10-03'},'3티어');assert.equal(s.items.filter(item=>item.title==='최도랑 티어 변경').length,1);assert.equal(s.items.filter(item=>item.title==='티어표 갱신').length,1);
});
test('같은 오류는 중복 알리지 않고 성공 후 다시 실패하면 새 오류로 알린다',()=>{
 const s=api.blank();for(let i=0;i<5;i++){api.observeFailure(s,'ELO','loading');api.observeFailure(s,'ELO','error','오류')};assert.equal(s.items.length,1);
 api.observeFailure(s,'ELO','ok');api.observeFailure(s,'ELO','error','다시 오류');assert.equal(s.items.length,2);
});
test('현재 버전보다 새로운 버전만 한 번 알린다',()=>{
 const s=api.blank();api.observeVersion(s,{version:'5.18.0'},'5.19.0');api.observeVersion(s,{version:'5.19.0'},'5.19.0');assert.equal(s.items.length,0);
 api.observeVersion(s,{version:'5.20.0',notes:'새 기능'},'5.19.0');api.observeVersion(s,{version:'5.20.0'},'5.19.0');assert.equal(s.items.length,1);assert.equal(s.items[0].target.version,'5.20.0');assert.equal(api.newer('invalid','5.19.0'),false);
});
test('알림 50개 제한·읽음 처리·읽은 알림 정리와 새로 열기 후 상태를 유지한다',()=>{
 const s=api.blank();for(let i=0;i<70;i++)api.add(s,'id'+i,'제목','내용',{kind:'sync'},i);assert.equal(s.items.length,50);
 api.markRead(s,'id69');assert.equal(s.items[0].read,true);api.clearRead(s);assert.equal(s.items.length,49);assert.equal(api.add(s,'id69','제목','내용',{}),false);
 const loaded=api.load({getItem:()=>JSON.stringify(s)});assert.equal(loaded.items.length,49);assert.equal(loaded.seen.length,70);assert.equal(api.load({getItem:()=>'{broken'}).items.length,0);
});
test('기존 통합 백업도 복구 가능하고 새 백업에는 알림 상태를 포함한다',()=>{
 const store=new Map(),storage={getItem:key=>store.get(key)??null};const old=backup.capture(storage);delete old.data[api.KEY];assert.equal(backup.validate(old).data[api.KEY],null);
 store.set(api.KEY,JSON.stringify(api.blank()));const current=backup.capture(storage);assert.ok(current.data[api.KEY]);assert.equal(backup.validate(current),current);
});
