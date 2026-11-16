import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const code=fs.readFileSync(new URL('../starlog/app.js',import.meta.url),'utf8');
const startup=code.slice(0,code.indexOf("let page='home'"));
const shared='my-starlog-spwn-note-v1',own='my-starlog-dorang-v1';
const record={id:'ladder-1',date:'2026-11-16',type:'래더',result:'W',race:'Z',myRace:'P',opponent:'상대',map:'투혼',build:'더블',enemyBuild:'12앞',memo:'복기 그대로',tags:'정찰',star:true};
const data=()=>({version:1,matches:[record],trash:[{...record,id:'deleted-2'}],settings:{name:'정소이',race:'Z',maps:['투혼'],builds:['더블']},lastBackup:'2026-11-15'});
function boot(values={},failKey=''){
 const store=new Map(Object.entries(values));
 const localStorage={getItem:k=>store.get(k)??null,setItem(k,v){if(k===failKey)throw Error('quota');store.set(k,String(v))}};
 const ctx=vm.createContext({localStorage,structuredClone,Date,setTimeout:()=>0});
 vm.runInContext(startup,ctx);
 return{store,ctx,snapshot:()=>JSON.parse(vm.runInContext('JSON.stringify({db,storageOK})',ctx))};
}
test('first open copies records and draft without changing independent profile or notes',()=>{
 const original=JSON.stringify(data()),draft=JSON.stringify({opponent:'작성 중',memo:'임시 메모'});
 const s=boot({[shared]:original,'my-starlog-spwn-note-draft':draft});
 assert.equal(s.store.get(shared),original);assert.equal(s.store.get('my-starlog-spwn-note-draft'),draft);
 assert.equal(s.store.get('my-starlog-dorang-draft'),draft);
 const loaded=s.snapshot();assert.equal(loaded.storageOK,true);assert.equal(loaded.db.settings.name,'최도랑');
 assert.deepEqual(loaded.db.matches,data().matches);assert.deepEqual(loaded.db.trash,data().trash);
 vm.runInContext("change(d=>{d.settings.name='최도랑';d.matches[0].memo='도랑 복기'})",s.ctx);
 assert.equal(s.store.get(shared),original);assert.equal(JSON.parse(s.store.get(own)).matches[0].memo,'도랑 복기');
});
test('existing empty integrated store wins over independent records on later visits',()=>{
 const empty={...data(),matches:[],trash:[]};const s=boot({[own]:JSON.stringify(empty),[shared]:JSON.stringify(data())});
 assert.equal(s.snapshot().db.matches.length,0);
});
test('first empty visit establishes isolated storage and later independent edits are not imported',()=>{
 const s=boot();assert.ok(s.store.has(own));s.store.set(shared,JSON.stringify(data()));
 const again=boot(Object.fromEntries(s.store));assert.equal(again.snapshot().db.matches.length,0);
});
test('corrupt source and quota failure never overwrite the original',()=>{
 for(const raw of ['{broken',JSON.stringify(data())]){
  const s=boot({[shared]:raw},raw[0]==='{'&&raw.includes('broken')?'':own);
  assert.equal(s.snapshot().storageOK,false);assert.equal(s.store.get(shared),raw);assert.equal(s.store.has(own),false);
 }
});
test('integrated backup restores old shared-key backups into isolated keys only',()=>{
 const api=createRequire(import.meta.url)('../integrated-backup.js');const map=new Map([[shared,JSON.stringify(data())]]);
 const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
 const before=api.capture(storage),target=JSON.parse(JSON.stringify(before));
 target.data[shared]=target.data[own];delete target.data[own];target.data['my-starlog-spwn-note-draft']=JSON.stringify({memo:'old draft'});delete target.data['my-starlog-dorang-draft'];
 const original=map.get(shared);api.restore(storage,target,before);
 assert.equal(map.get(shared),original);assert.deepEqual(JSON.parse(map.get(own)),data());assert.equal(JSON.parse(map.get('my-starlog-dorang-draft')).memo,'old draft');
});
test('restoring an empty legacy backup never reimports independent records or draft',()=>{
 const api=createRequire(import.meta.url)('../integrated-backup.js');
 const original=JSON.stringify(data()),draft=JSON.stringify({opponent:'독립 임시 상대',memo:'독립 초안'});
 const map=new Map([[shared,original],['my-starlog-spwn-note-draft',draft],[own,original],['my-starlog-dorang-draft',JSON.stringify({memo:'복원 전 통합 초안'})]]);
 const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
 const before=api.capture(storage),target=JSON.parse(JSON.stringify(before));
 target.data[shared]=null;delete target.data[own];target.data['my-starlog-spwn-note-draft']=null;delete target.data['my-starlog-dorang-draft'];
 api.restore(storage,target,before);
 const captured=api.capture(storage);
 assert.equal(JSON.parse(captured.data[own]).matches.length,0);assert.equal(captured.data['my-starlog-dorang-draft'],null);
 const loaded=boot(Object.fromEntries(map)),empty=boot().snapshot().db;
 assert.equal(loaded.snapshot().storageOK,true);assert.deepEqual(loaded.snapshot().db,empty);
 assert.equal(loaded.store.get(shared),original);assert.equal(loaded.store.get('my-starlog-spwn-note-draft'),draft);
 assert.equal(loaded.store.has('my-starlog-dorang-draft'),false);
});
test('an isolated journal with no draft never captures the independent draft',()=>{
 const api=createRequire(import.meta.url)('../integrated-backup.js'),draft=JSON.stringify({memo:'독립 초안'});
 const map=new Map([[own,JSON.stringify({...data(),matches:[],trash:[]})],[shared,JSON.stringify(data())],['my-starlog-spwn-note-draft',draft]]);
 const storage={getItem:k=>map.get(k)??null};
 const captured=api.capture(storage);
 assert.equal(JSON.parse(captured.data[own]).matches.length,0);assert.equal(captured.data['my-starlog-dorang-draft'],null);
 map.delete(own);
 assert.equal(api.capture(storage).data['my-starlog-dorang-draft'],draft);
});
