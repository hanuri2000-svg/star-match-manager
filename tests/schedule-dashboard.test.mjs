import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const stats=require('../spawn-schedule-stats.js');
const source=fs.readFileSync(new URL('../schedule-dashboard.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const version=JSON.parse(fs.readFileSync(new URL('../version.json',import.meta.url),'utf8')).version;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
function fixture({records=[],cache=null,fetcher=async()=>({ok:true,json:async()=>({player:{name:'최도랑',elo:'1234.5'}})}),timeout=false}={}){
 const storage=new Map([['spawnNote.records.v1',JSON.stringify(records)],['scheduleDashboard.eloSnapshot.v1',JSON.stringify(cache)]]);
 const host={innerHTML:''},events={},documentEvents={},styles=[];
 const window={localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},SpawnScheduleStats:stats,HARINA_PLAYER_DIRECTORY:{최도랑:{tier:'4티어'}},getScheduleDashboardSchedules:()=>[{date:today(),time:'23:59',title:'CK <테스트>'}],addEventListener:(name,fn)=>events[name]=fn,document:{hidden:false,head:{appendChild:style=>styles.push(style.textContent)},createElement:()=>({}),getElementById:()=>({}),querySelector:selector=>selector==='[data-schedule-dashboard]'?host:null,addEventListener:(name,fn)=>documentEvents[name]=fn}};
 vm.runInNewContext(source,{window,localStorage:window.localStorage,fetch:fetcher,MutationObserver:class{observe(){}},URLSearchParams,AbortController,setTimeout:timeout?(fn,ms)=>ms===8000?setTimeout(fn,1):setTimeout(fn,ms):setTimeout,clearTimeout,Date});
 return {window,host,events,storage,styles};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('오늘 기록·종족별 합계·최근 결과와 ELO 차이를 정확히 표시한다',async()=>{
 const f=fixture({cache:{player:'최도랑',data:{player:{elo:'1200'}},checkedAt:1},records:[{id:1,date:today(),race:'P',result:'승',opponent:'A',map:'투혼'},{id:2,date:today(),race:'Z',result:'패',opponent:'B'},{id:3,date:today(),race:'T',result:'승',opponent:'<상대>',map:'실피드'},{id:4,date:'2000-01-01',race:'P',result:'패'}]});
 await settle();
 assert.match(f.host.innerHTML,/오늘 일정.*1개.*CK &lt;테스트&gt;/);
 assert.match(f.host.innerHTML,/오늘 전적.*3전 2승 1패/);
 assert.match(f.host.innerHTML,/P전<\/b> 1전 1승 0패/);
 assert.match(f.host.innerHTML,/T전<\/b> 1전 1승 0패/);
 assert.match(f.host.innerHTML,/Z전<\/b> 1전 0승 1패/);
 assert.match(f.host.innerHTML,/1,234.5.*4티어.*▲ 34.5/);
 assert.match(f.host.innerHTML,/승<\/span> vs &lt;상대&gt;.*실피드/);
 assert.equal((f.host.innerHTML.match(/class="today-summary-card"/g)||[]).length,4);
});
test('ELO 실패 시 저장된 점수와 실패 상태를 남기고 기록 카드는 정상 표시한다',async()=>{
 const f=fixture({cache:{player:'최도랑',data:{player:{elo:'1100'}},checkedAt:1},fetcher:async()=>{throw new Error('offline')}});
 await settle();
 assert.match(f.host.innerHTML,/1,100/);assert.match(f.host.innerHTML,/조회 실패/);assert.match(f.host.innerHTML,/0전 0승 0패/);assert.doesNotMatch(f.host.innerHTML,/점수 확인 중/);
});
test('조회가 멈춰도 시간 제한으로 종료하며 다른 선수의 캐시는 섞지 않는다',async()=>{
 const f=fixture({cache:{player:'다른선수',data:{player:{elo:'9999'}},checkedAt:Date.now()},timeout:true,fetcher:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('timeout'))))});
 assert.match(f.host.innerHTML,/오늘 일정/);assert.doesNotMatch(f.host.innerHTML,/9,999/);
 await new Promise(resolve=>setTimeout(resolve,10));assert.match(f.host.innerHTML,/조회 실패/);assert.doesNotMatch(f.host.innerHTML,/점수 확인 중/);
});
test('기록 변경과 스폰노트의 점수 갱신을 재요청 없이 반영한다',async()=>{
 let calls=0;const f=fixture({fetcher:async()=>{calls++;return{ok:true,json:async()=>({player:{name:'최도랑',elo:'1200'}})}}});await settle();
 f.storage.set('spawnNote.records.v1',JSON.stringify([{id:1,date:today(),race:'P',result:'승',opponent:'새 상대'}]));f.events['spawn-note:records-changed']();
 assert.match(f.host.innerHTML,/1전 1승 0패/);
 f.events['spawn-note:dashboard-changed']({detail:{player:'최도랑',data:{player:{elo:'1190'}}}});
 assert.match(f.host.innerHTML,/1,190.*▼ 10/);assert.equal(calls,1);
});
test('달력 위에 카드 영역을 두고 모바일과 PC 배치 및 릴리스 버전을 맞춘다',()=>{
 assert.match(main,/data-schedule-dashboard[\s\S]*schedule-toolbar panel/);
 assert.match(source,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(source,/@media\(max-width:900px\)[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.ok(main.includes(`const APP_VERSION='${version}'`));assert.ok(main.includes(`const RELEASE_VERSION='${version}'`));
 for(const module of ['schedule-dashboard','spwn-native','prediction-native','spawn-schedule-stats'])assert.ok(main.includes(`${module}.js?v=${version}`));
});
