import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const api=createRequire(import.meta.url)('../integrated-backup.js');
const main=title=>JSON.stringify({title,playersA:[],playersB:[],matches:[],setGames:[1],schedules:[{id:'one',date:'2026-10-03',title}]});
function storage(){const data=new Map();return{data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)}}
function fixture(title='기존 일정'){
 const s=storage();s.setItem(api.KEYS[0],main(title));s.setItem(api.KEYS[1],JSON.stringify([{date:'2026-10-03',opponent:'상대',race:'P',result:'승',note:'느낀점'}]));s.setItem(api.KEYS[5],JSON.stringify({participants:['은종근','최도랑'],matches:[{id:1,winner:1}],asl:{picks:{은종근:{champion:'최도랑'}}}}));s.setItem('otherApp','그대로');return s;
}
test('통합 백업은 사용자 데이터와 메모·예측 참가자·ASL을 함께 담고 다른 앱을 제외한다',()=>{
 const s=fixture(),b=api.capture(s,main('화면의 최신 일정'),'5.18.0');assert.equal(Object.keys(b.data).length,api.KEYS.length);assert.equal(b.data.otherApp,undefined);
 assert.match(b.data[api.KEYS[0]],/화면의 최신 일정/);assert.match(b.data[api.KEYS[1]],/느낀점/);assert.match(b.data[api.KEYS[5]],/은종근.*asl/);assert.deepEqual(api.counts(b),{schedules:1,records:1,predictions:1});
});
test('자동 백업은 동일한 데이터를 중복 저장하지 않고 최근 5개를 보관한다',()=>{
 const s=fixture();let b=api.capture(s);api.checkpoint(s,b);api.checkpoint(s,b);assert.equal(api.history(s).length,1);
 const changed=JSON.parse(b.data[api.KEYS[0]]);changed.activeTab='spwn';b.data[api.KEYS[0]]=JSON.stringify(changed);api.checkpoint(s,b);assert.equal(api.history(s).length,1);
 for(let i=0;i<7;i++)api.checkpoint(s,api.capture(s,main('일정'+i)));assert.equal(api.history(s).length,5);assert.match(api.history(s).at(-1).backup.data[api.KEYS[0]],/일정6/);
});
test('복구 전에 기존 데이터를 저장하고 통합 데이터만 교체한다',()=>{
 const s=fixture(),before=api.capture(s),target=api.capture(s,main('복구한 일정'));target.data[api.KEYS[1]]=null;
 api.restore(s,target,before);assert.match(s.getItem(api.KEYS[0]),/복구한 일정/);assert.equal(s.getItem(api.KEYS[1]),null);assert.equal(s.getItem('otherApp'),'그대로');
 assert.equal(api.history(s).at(-1).reason,'before-restore');assert.match(api.history(s).at(-1).backup.data[api.KEYS[0]],/기존 일정/);
});
test('잘못된 파일과 누락된 항목은 데이터 변경 전에 거절한다',()=>{
 const s=fixture(),before=api.capture(s),original=s.getItem(api.KEYS[0]);
 for(const mutate of [b=>b.app='다른 앱',b=>delete b.data[api.KEYS[1]],b=>b.data[api.KEYS[5]]=JSON.stringify({participants:['정상 이름'],matches:'잘못된 값'}),b=>b.data.unrelated='악성키',b=>b.data[api.KEYS[1]]='{broken']){
  const target=JSON.parse(JSON.stringify(before));mutate(target);assert.throws(()=>api.restore(s,target,before));assert.equal(s.getItem(api.KEYS[0]),original);assert.equal(api.history(s).length,0);
 }
});
test('복구 도중 저장 오류가 발생하면 원래 데이터를 되돌린다',()=>{
 const s=fixture(),before=api.capture(s),target=api.capture(s,main('다른 일정'));const set=s.setItem;let failed=false;
 s.setItem=(key,value)=>{if(key===api.KEYS[5]&&!failed){failed=true;throw new Error('quota')}set(key,value)};
 assert.throws(()=>api.restore(s,target,before),/기존 데이터를 유지/);
 for(const key of api.KEYS)assert.equal(s.getItem(key),before.data[key]);assert.equal(s.getItem('otherApp'),'그대로');assert.equal(api.history(s).at(-1).reason,'before-restore');
});
test('복구 전 백업을 저장할 수 없으면 현재 데이터를 그대로 유지한다',()=>{
 const s=fixture(),before=api.capture(s),target=api.capture(s,main('다른 일정')),set=s.setItem;s.setItem=(key,value)=>{if(key===api.HISTORY_KEY)throw new Error('quota');set(key,value)};
 assert.throws(()=>api.restore(s,target,before),/백업 저장 공간/);for(const key of api.KEYS)assert.equal(s.getItem(key),before.data[key]);
});
test('백업 용량이 크면 개수를 줄이고 용량 초과를 명확히 알린다',()=>{
 const s=fixture(),b=api.capture(s);b.data[api.KEYS[1]]=JSON.stringify([{note:'가'.repeat(500000)}]);api.checkpoint(s,b,'manual');api.checkpoint(s,b,'manual');assert.equal(api.history(s).length,1);
 b.data[api.KEYS[1]]=JSON.stringify([{note:'가'.repeat(1000000)}]);assert.throws(()=>api.checkpoint(s,b),/파일 백업/);assert.equal(api.history(s).length,1);
});
