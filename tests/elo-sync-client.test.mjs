import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {createClient}=createRequire(import.meta.url)('../elo-sync-client.js');
const query={player:'최도랑',today:'2026-10-03',base:'https://relay.example'};
const payload=elo=>({player:{name:'최도랑',elo:String(elo)}});
const response=data=>({ok:true,status:200,json:async()=>data});
function storage(){const values=new Map();return {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}}

test('첫 화면·탭·강제 새로고침이 진행 중인 요청 하나를 공유한다',async()=>{
 let calls=0,finish;
 const client=createClient({fetch:()=>{calls++;return new Promise(resolve=>finish=resolve)}});
 const a=client.get(query),b=client.get(query),c=client.get({...query,force:true});
 assert.equal(a,b);assert.equal(b,c);await Promise.resolve();assert.equal(calls,1);
 finish(response(payload(1234)));const [one,two]=await Promise.all([a,b]);assert.equal(one,two);assert.equal(one.cached,false);
});
test('최근 성공 자료를 재사용하고 수동 갱신·TTL 경과·날짜 변경은 새로 조회한다',async()=>{
 let time=1000000,calls=0;const client=createClient({now:()=>time,storage:storage(),fetch:async()=>{calls++;return response(payload(1234+calls))}});
 const first=await client.get(query);time+=1000;
 const cached=await client.get(query);assert.equal(calls,1);assert.equal(cached.checkedAt,first.checkedAt);assert.equal(cached.cached,true);
 await client.get({...query,force:true});assert.equal(calls,2);
 time+=300001;await client.get(query);assert.equal(calls,3);
 await client.get({...query,today:'2026-10-04'});assert.equal(calls,4);
});
test('새로 열린 화면도 성공 시각이 있는 캐시만 재사용한다',async()=>{
 const store=storage();let calls=0;const options={storage:store,now:()=>1000000,fetch:async()=>{calls++;return response(payload(1234))}};
 await createClient(options).get(query);const cached=await createClient(options).get(query);assert.equal(calls,1);assert.equal(cached.cached,true);
 store.setItem('spawnNote.eloDashboard.v1',JSON.stringify({player:query.player,data:payload(1100)}));await createClient(options).get(query);assert.equal(calls,2);
});
test('503과 네트워크 실패는 한 번 재시도하고 성공 결과만 저장한다',async()=>{
 for(const network of [false,true]){
  let calls=0;const store=storage();const client=createClient({retryDelay:0,storage:store,fetch:async()=>{calls++;if(calls===1){if(network)throw new Error('연결 끊김');return {ok:false,status:503,json:async()=>({error:'서버 혼잡'})}}return response(payload(1250))}});
  assert.equal((await client.get(query)).data.player.elo,'1250');assert.equal(calls,2);assert.equal(JSON.parse(store.getItem('spawnNote.eloDashboard.v1')).data.player.elo,'1250');
 }
});
test('404와 다른 선수·빈 점수 응답은 재시도하거나 캐시에 저장하지 않는다',async()=>{
 for(const result of [{ok:false,status:404,json:async()=>({error:'선수 없음'})},response({player:{name:'다른선수',elo:'1250'}}),response(payload(''))]){
  let calls=0;const store=storage();const client=createClient({storage:store,fetch:async()=>{calls++;return result}});
  await assert.rejects(client.get(query));assert.equal(calls,1);assert.equal(store.getItem('spawnNote.eloDashboard.v1'),undefined);
 }
});
test('응답과 JSON 본문이 멈춰도 두 번까지만 시도하고 잠금을 해제한다',async()=>{
 for(const body of [false,true]){
  let calls=0;const signals=[];const client=createClient({timeoutMs:5,retryDelay:0,fetch:(_url,{signal})=>{calls++;signals.push(signal);return body?Promise.resolve({ok:true,json:()=>new Promise(()=>{})}):new Promise(()=>{})}});
  await assert.rejects(client.get(query),/응답 시간 초과/);assert.equal(calls,2);assert.ok(signals.every(signal=>signal.aborted));
  await assert.rejects(client.get({...query,force:true}),/응답 시간 초과/);assert.equal(calls,4);
 }
});
test('갱신 실패는 이전 성공 자료·시각을 보존하고 반복 탭 이동을 잠시 제한한다',async()=>{
 let time=1000000,calls=0,fail=false;const store=storage();const client=createClient({storage:store,now:()=>time,retryDelay:0,fetch:async()=>{calls++;if(fail)throw new Error('연결 끊김');return response(payload(1200))}});
 await client.get(query);const old=store.getItem('spawnNote.eloDashboard.v1');time+=300001;fail=true;
 await assert.rejects(client.get(query));assert.equal(calls,3);assert.equal(store.getItem('spawnNote.eloDashboard.v1'),old);
 await assert.rejects(client.get(query));assert.equal(calls,3);
 time+=30001;fail=false;await client.get(query);assert.equal(calls,4);
});
test('오프라인에서는 요청하지 않고 연결 복구 후 강제 갱신할 수 있다',async()=>{
 let online=false,calls=0;const client=createClient({isOnline:()=>online,fetch:async()=>{calls++;return response(payload(1200))}});
 await assert.rejects(client.get(query),/인터넷 연결 없음/);assert.equal(calls,0);
 online=true;await client.get({...query,force:true});assert.equal(calls,1);
});
