import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const stats=require('../spawn-schedule-stats.js');
const {createClient}=require('../elo-sync-client.js');
const source=fs.readFileSync(new URL('../schedule-dashboard.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const version=JSON.parse(fs.readFileSync(new URL('../version.json',import.meta.url),'utf8')).version;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
function fixture({records=[],cache=null,fetcher=async()=>({ok:true,json:async()=>({player:{name:'최도랑',elo:'1234.5'}})}),timeout=false}={}){
 const storage=new Map([['spawnNote.records.v1',JSON.stringify(records)],['scheduleDashboard.eloSnapshot.v1',JSON.stringify(cache)]]);
 const host={innerHTML:''},syncHost={innerHTML:''},events={},documentEvents={},styles=[];
 const window={localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},SpawnScheduleStats:stats,HARINA_PLAYER_DIRECTORY:{최도랑:{tier:'4티어'}},getScheduleDashboardSchedules:()=>[{date:today(),time:'23:59',title:'CK <테스트>'}],addEventListener:(name,fn)=>events[name]=fn,document:{hidden:false,head:{appendChild:style=>styles.push(style.textContent)},createElement:()=>({}),getElementById:()=>({}),querySelector:selector=>selector==='[data-schedule-dashboard]'?host:selector==='[data-schedule-sync]'?syncHost:null,addEventListener:(name,fn)=>documentEvents[name]=fn}};
 window.EloDashboardClient=createClient({fetch:fetcher,storage:window.localStorage,retryDelay:0,timeoutMs:timeout?1:60000,profileTimeoutMs:timeout?1:20000});
 vm.runInNewContext(source,{window,localStorage:window.localStorage,fetch:fetcher,MutationObserver:class{observe(){}},URLSearchParams,AbortController,setTimeout:timeout?(fn,ms)=>ms===8000?setTimeout(fn,1):setTimeout(fn,ms):setTimeout,clearTimeout,Date});
 return {window,host,syncHost,events,storage,styles};
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,10));
test('일정·저장된 전적·전체 기록을 표시하고 오래된 ELO 캐시는 사용하지 않는다',async()=>{
 let calls=0;
 const f=fixture({cache:{player:'최도랑',data:{player:{elo:'9999'}},checkedAt:Date.now()},fetcher:async()=>{calls++;throw new Error('External request forbidden')},records:[{id:1,date:today(),race:'P',result:'승',opponent:'<상대>',map:'투혼'}]});
 await settle();
 assert.match(f.host.innerHTML,/오늘 일정.*1개/);assert.match(f.host.innerHTML,/오늘 전적.*1전 1승 0패/);
 assert.match(f.host.innerHTML,/전체 기록.*1경기/);assert.match(f.host.innerHTML,/&lt;상대&gt;/);
 assert.doesNotMatch(f.host.innerHTML,/현재 ELO|9,999|조회 실패/);assert.doesNotMatch(f.syncHost.innerHTML,/ELO 점수/);
 f.events.pageshow();f.events.online();await f.window.ScheduleDashboard.refresh();await settle();assert.equal(calls,0);
 f.storage.set('spawnNote.records.v1','[]');f.events['spawn-note:records-changed']();assert.match(f.host.innerHTML,/0전 0승 0패/);
});
test('새로고침은 저장소 선수 DB만 읽으며 기존 기록을 변경하지 않는다',async()=>{
 const f=fixture(),before=f.storage.get('spawnNote.records.v1');let calls=0;
 f.window.HARINA_LOAD_PLAYER_MASTER=async()=>{calls++;};await f.window.ScheduleDashboard.refreshAll();
 assert.equal(calls,1);assert.equal(f.storage.get('spawnNote.records.v1'),before);
});
test('릴리스 버전은 로드하는 모듈과 일치하고 ELO 조회 모듈은 로드하지 않는다',()=>{
 assert.ok(main.includes(`const APP_VERSION='${version}'`));
 for(const module of ['schedule-dashboard','spwn-native','prediction-native','spawn-schedule-stats','integrated-backup','notification-center'])assert.ok(main.includes(`${module}.js?v=${version}`));
 assert.doesNotMatch(main,/src="[^"]*(?:daily-elo-import|elo-sync-client)\.js/);
 assert.doesNotMatch(source,/EloDashboardClient|api\/elo|spawn-note-elo-relay/);
});
function masterFixture(fetcher,render){
 const code=main.slice(main.indexOf('let sharedPlayerMasterRequest=null;'),main.indexOf('window.HARINA_LOAD_PLAYER_MASTER=loadSharedPlayerMaster;')+'window.HARINA_LOAD_PLAYER_MASTER=loadSharedPlayerMaster;'.length);
 const window={dispatchEvent(){}};const directory={최도랑:{name:'최도랑',tier:'4티어'}};const groups=[{tier:'4티어',players:[{name:'최도랑'}]}];const metaById={};
 vm.runInNewContext(code,{window,fetch:fetcher,render,console:{warn(){}},SHARED_PLAYER_MASTER_URL:'./players.json',PLAYER_DIRECTORY:directory,PLAYER_META:{},PLAYER_META_BY_ID:metaById,TIER_DATA:groups,normalizePlayerDirectoryName:v=>v,AbortController,CustomEvent:class{},setTimeout:fn=>setTimeout(fn,5),clearTimeout,Date});return{window,directory,groups,metaById};
}
test('DB loader keeps same-name identities separate by Elo ID',async()=>{
 const f=masterFixture(async()=>({ok:true,json:async()=>({players:[
  {name:'탱크',tier:'스페이드',race:'P',eloId:170,soopId:'dkwkal',thumbUrl:'players/170.jpg'},
  {name:'탱크',tier:'스페이드',race:'P',eloId:6312,soopId:'',thumbUrl:'players/6312.jpg'}
 ]})}));
 await f.window.HARINA_LOAD_PLAYER_MASTER(true);
 assert.deepEqual(Array.from(f.groups[0].players,p=>p.eloId),[170,6312]);
 assert.equal(f.metaById[170].s,'dkwkal');assert.equal(f.metaById[6312].s,'');
 assert.equal(f.metaById[170].t,'players/170.jpg');assert.equal(f.metaById[6312].t,'players/6312.jpg');
});
test('화면 표시 실패가 성공한 티어표 동기화를 오류로 바꾸지 않는다',async()=>{
 const f=masterFixture(async()=>({ok:true,json:async()=>({source:{version:'3.62'},players:[{name:'최도랑',tier:'3티어',race:'P'}]})}),()=>{throw new SyntaxError('The string did not match the expected pattern.')});
 await f.window.HARINA_LOAD_PLAYER_MASTER(true);
 assert.equal(f.window.HARINA_MASTER_SYNC_STATUS.status,'ok');
 assert.equal(f.directory.최도랑.tier,'3티어');
 await f.window.HARINA_LOAD_PLAYER_MASTER(true);
 assert.equal(f.window.HARINA_MASTER_SYNC_STATUS.error,'');
});
test('티어표 중복 요청을 합치고 성공한 자료의 버전과 날짜를 기록한다',async()=>{
 let calls=0,finish;const f=masterFixture(async()=>{calls++;return new Promise(resolve=>finish=resolve)});
 const one=f.window.HARINA_LOAD_PLAYER_MASTER(true),two=f.window.HARINA_LOAD_PLAYER_MASTER(true);assert.equal(one,two);assert.equal(calls,1);
 finish({ok:true,json:async()=>({source:{version:'3.62',date:'2026-10-03'},players:[{name:'최도랑',tier:'3티어',race:'P'}]})});await one;
 assert.equal(f.window.HARINA_MASTER_SYNC_STATUS.status,'ok');assert.equal(f.window.HARINA_MASTER_SYNC_STATUS.version,'3.62');assert.equal(f.directory.최도랑.tier,'3티어');
});
test('잘못된 티어표 응답은 기존 선수 정보를 지우지 않고 오류 상태를 남긴다',async()=>{
 const f=masterFixture(async()=>({ok:true,json:async()=>({players:[]})}));await assert.rejects(f.window.HARINA_LOAD_PLAYER_MASTER(true));
 assert.equal(f.directory.최도랑.tier,'4티어');assert.equal(f.groups.length,1);assert.equal(f.window.HARINA_MASTER_SYNC_STATUS.status,'error');
});
test('티어표 요청 시간이 초과돼도 새로고침 잠금을 해제해 다시 시도할 수 있다',async()=>{
 let calls=0;const f=masterFixture((_url,{signal})=>{calls++;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('abort'),{name:'AbortError'}))))});
 await assert.rejects(f.window.HARINA_LOAD_PLAYER_MASTER(true));assert.equal(f.window.HARINA_MASTER_SYNC_STATUS.error,'응답 시간 초과');
 await assert.rejects(f.window.HARINA_LOAD_PLAYER_MASTER(true));assert.equal(calls,2);
});
