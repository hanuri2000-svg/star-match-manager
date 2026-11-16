import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const mod=require('../schedule-play-records.js');
const elo=require('../starlog/elo-public.js');
const now=Date.parse('2026-11-16T05:00:00Z');
const match=(id,date,result='W',race='Z')=>({id,date,opponentId:513,opponent:'정소이',result,race,type:'스폰',map:'투혼'});
const snapshot=()=>({schemaVersion:1,playerId:443,requested:50,fetchedAt:new Date(now).toISOString(),complete:true,stale:false,
  matches:[match(101,'2026-11-14'),match(102,'2026-11-14'),match(103,'2026-11-14'),match(104,'2026-11-14','L','T'),match(105,'2026-11-14','W','T'),match(106,'2026-11-12')]});
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),values}};

test('선택한 날짜에 연동 5경기와 수동 래더만 합산하고 스폰·메모는 중복 집계하지 않는다',()=>{
 const rows=[{id:'a',date:'2026-11-14',type:'래더',result:'W',race:'P'},
   {id:'b',date:'2026-11-14',type:'래더',result:'L',race:'R'},
   {id:'dup',date:'2026-11-14',type:'스폰',result:'W',race:'Z'},
   {id:'imported',date:'2026-11-14',type:'래더',result:'W',race:'Z',source:'eloboard'},
   {id:'linked',date:'2026-11-14',type:'래더',result:'W',race:'Z',eloRecordId:101},
   {id:'other',date:'2026-11-13',type:'래더',result:'W',race:'P'}];
 const original=JSON.stringify(rows),s=mod.summarizeDay(rows,'2026-11-14',snapshot(),{now});
 assert.deepEqual(s.total,{games:7,wins:5,losses:2});
 assert.deepEqual(s.races.Z,{games:3,wins:3,losses:0});
 assert.deepEqual(s.races.T,{games:2,wins:1,losses:1});
 assert.deepEqual(s.races.P,{games:1,wins:1,losses:0});
 assert.deepEqual(s.races.R,{games:1,wins:0,losses:1});
 assert.equal(s.complete,true);assert.equal(s.officialGames,5);assert.equal(s.ladderGames,2);
 assert.equal(JSON.stringify(rows),original);
});
test('지난 경기 5판은 16일의 오늘 전적으로 바꾸지 않는다',()=>{
 const s=mod.summarizeDay([],'2026-11-16',snapshot(),{now});
 assert.deepEqual(s.total,{games:0,wins:0,losses:0});assert.equal(s.complete,true);
 assert.match(mod.panelHTML(s,true),/0전 0승 0패/);
});
test('50경기 경계일·과거 조회 범위 밖·미래·부분 응답은 확정된 0전으로 표시하지 않는다',()=>{
 const data=snapshot();data.matches=Array.from({length:50},(_,i)=>match(i+1,i<5?'2026-11-14':'2026-11-12'));
 for(const date of ['2026-11-12','2026-10-01','2026-11-17'])assert.equal(mod.summarizeDay([],date,data,{now}).complete,false);
 const old=mod.summarizeDay([],'2026-10-01',data,{now});
 assert.match(mod.panelHTML(old,false),/확인 범위 밖/);assert.doesNotMatch(mod.panelHTML(old,false),/0전 0승 0패/);
 assert.equal(mod.summarizeDay([],'2026-11-14',data,{now}).complete,true);
 data.complete=false;assert.equal(mod.summarizeDay([],'2026-11-14',data,{now}).complete,false);
 assert.match(mod.recordText(mod.summarizeDay([],'2026-11-14',data,{now})),/^확인분 /);
});
test('연동 실패 시 수동 기록은 유지하되 전체 일자 전적으로 확정하지 않는다',()=>{
 const rows=[{date:'2026.11.14',result:'승',race:'저그',type:'CK'},{date:'2026-11-14',result:'L',race:'T',type:'래더'}];
 const s=mod.summarizeDay(rows,'2026-11-14',null,{now,error:true});
 assert.deepEqual(s.total,{games:2,wins:1,losses:1});assert.equal(s.remoteAvailable,false);assert.equal(s.complete,false);
 assert.match(mod.panelHTML(s,false),/직접 기록만 표시/);
 const stale=mod.summarizeDay([], '2026-11-14',snapshot(),{now:now+mod.INTERVAL});
 assert.equal(stale.stale,true);assert.match(mod.panelHTML(stale,false),/마지막 확인 자료/);
});
test('다른 선수·중복 ID·잘못된 날짜·정렬·미래 응답은 연동으로 집계하지 않는다',()=>{
 for(const mutate of [d=>d.playerId=830,d=>d.matches.push(d.matches[0]),d=>d.matches[0].date='2026-02-30',d=>d.matches.reverse(),d=>d.matches[0].date='2026-11-17']){
  const d=snapshot();mutate(d);assert.equal(mod.validSnapshot(d),false);assert.equal(mod.summarizeDay([],'2026-11-14',d,{now}).remoteAvailable,false);
 }
 assert.equal(mod.summarizeDay([],'2026-11-14',snapshot(),{now:now-1}).remoteAvailable,false);
});
test('같은 날짜를 반복 선택해도 요청하지 않고 12시간 캐시와 진행 중인 요청을 공유한다',async()=>{
 let clock=now,calls=0;
 const db=storage();
 const client=elo.createClient({site:'dorang-integrated',storage:db,now:()=>clock,fetch:async()=>{
  calls++;return {ok:true,json:async()=>({...snapshot(),fetchedAt:new Date(clock).toISOString()})};
 }});
 const model=mod.createModel({client,readRecords:()=>[],now:()=>clock});
 await model.refresh();for(let i=0;i<31;i++)model.summarize('2026-11-14');assert.equal(calls,1);
 clock+=mod.INTERVAL-1;await model.refresh();assert.equal(calls,1);
 clock++;await Promise.all([model.refresh(),model.refresh()]);assert.equal(calls,2);
 assert.equal(model.summarize('2026-11-14').total.games,5);
 assert.ok([...db.values.keys()].every(k=>k.startsWith('starlog-public-elo:')));
});
test('조회 실패 뒤 기존 5경기를 유지하고 캐시 재사용이 원본 확인 시간을 바꾸지 않는다',async()=>{
 let clock=now,fail=false;
 const client=elo.createClient({site:'dorang-integrated',storage:storage(),now:()=>clock,fetch:async()=>{if(fail)throw Error('unavailable');return {ok:true,json:async()=>snapshot()}}});
 const model=mod.createModel({client,readRecords:()=>[],now:()=>clock});
 const first=await model.refresh();clock+=1000;const again=await model.refresh();assert.equal(first.checkedAt,again.checkedAt);
 fail=true;await model.refresh(true);
 const s=model.summarize('2026-11-14');assert.equal(s.total.games,5);assert.equal(s.stale,true);
});
test('출처 경고를 HTML로 실행하지 않고 비동기 전적 완료로 일정 입력 폼을 다시 만들지 않는다',()=>{
 const d=snapshot();d.warning='<img onerror=alert(1)>';const html=mod.panelHTML(mod.summarizeDay([],'2026-11-14',d,{now}),false);
 assert.doesNotMatch(html,/<img/);
 const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const handler=source.slice(source.indexOf('function refreshSchedulePlayView(){'),source.indexOf("window.addEventListener('dorang:schedule-play-updated'"));
 assert.ok(handler.includes('[data-schedule-play-details]'));
 assert.doesNotMatch(handler,/\brender\s*\(|scheduleForm\(/);
});
test('려은은 기존 으니의 ID·종족·티어·방송국을 유지하며 두 이름으로 같은 선수를 찾는다',()=>{
 const players=JSON.parse(fs.readFileSync(new URL('../players.json',import.meta.url),'utf8')).players;
 const p=players.filter(p=>p.eloId===830);assert.equal(p.length,1);
 assert.equal(p[0].name,'려은');assert.equal(p[0].soopId,'qwer1317');assert.equal(p[0].race,'P');assert.equal(p[0].tier,'8티어');
 for(const name of ['으니','려은','려은.'])assert.equal(elo.candidates(players,name)[0]?.eloId,830);
 assert.equal(players.filter(p=>p.name==='으니').length,0);
});
