import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
class Events{
  handlers=new Map();
  on(k,f){const a=this.handlers.get(k)||[];a.push(f);this.handlers.set(k,a)}
  emit(k,v){for(const f of this.handlers.get(k)||[])f(v)}
  addEventListener(k,f){this.on(k,f)}
  removeEventListener(k,f){this.handlers.set(k,(this.handlers.get(k)||[]).filter(x=>x!==f))}
}
function setup(host=false){
  let now=0,id=0;const timers=new Map(),created=[],states=[],statuses=[];
  class Conn extends Events{constructor(name){super();this.peer=name;this.open=false;this.sent=[]}send(m){if(!this.open)throw Error('closed');this.sent.push(structuredClone(m))}close(){this.open=false;this.emit('close')}openNow(){this.open=true;this.emit('open')}}
  class Peer extends Events{
    constructor(name){super();this.id=name;this.open=false;this.disconnected=false;this.destroyed=false;this.calls=[];this.reconnects=0;created.push(this)}
    connect(name){const c=new Conn(name);this.calls.push(c);return c}
    reconnect(){this.reconnects++}
    destroy(){this.destroyed=true;this.open=false;this.emit('close')}
    ready(){this.open=true;this.disconnected=false;this.emit('open')}
    disconnect(){this.open=false;this.disconnected=true;this.emit('disconnected')}
  }
  const window=new Events(),document=new Events(),navigator={onLine:true};document.visibilityState='visible';
  const add=(f,ms,repeat=false)=>{timers.set(++id,{f,at:now+ms,ms,repeat});return id};
  const context={window,document,navigator,Peer,Date:{now:()=>now},setTimeout:(f,ms)=>add(f,ms),clearTimeout:i=>timers.delete(i),setInterval:(f,ms)=>add(f,ms,true),clearInterval:i=>timers.delete(i)};
  vm.runInNewContext(fs.readFileSync(new URL('../tournament-transport.js',import.meta.url),'utf8'),context);
  let current={teams:['A','B'],results:{},event:{title:'대회'}};
  const api=window.DorangTournamentTransport.create({hostId:'room',...(host?{getState:()=>current}:{}),onState:s=>states.push(s),onStatus:s=>statuses.push(s)});
  function tick(ms){const end=now+ms;for(;;){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;const [i,t]=next;now=t.at;if(t.repeat)t.at+=t.ms;else timers.delete(i);t.f()}now=end}
  return {api,created,states,statuses,window,document,navigator,tick,timers,Conn,setState:s=>current=s};
}
test('signaling reconnect is deduplicated and requests a complete snapshot on reopen',()=>{
  const h=setup();const p=h.created[0];p.ready();const c=p.calls[0];c.openNow();
  p.disconnect();p.emit('error',{type:'network'});p.emit('disconnected');h.tick(1000);assert.equal(p.reconnects,1);
  h.window.emit('online');h.document.emit('visibilitychange');assert.equal(p.reconnects,1);
  p.ready();assert.equal(p.calls.length,1);assert.equal(c.sent.at(-1).type,'sync-request');
  c.emit('data',{type:'state',state:{teams:['A','B'],results:{FINAL:'A'}}});assert.equal(h.states.at(-1).results.FINAL,'A');h.api.stop();assert.equal(h.timers.size,0);
});
test('offline pauses retries, online recovers, stale channel callbacks are ignored',()=>{
  const h=setup();const p=h.created[0];p.ready();const old=p.calls[0];old.openNow();
  h.navigator.onLine=false;h.window.emit('offline');h.tick(120000);assert.equal(p.calls.length,1);
  h.navigator.onLine=true;h.window.emit('online');assert.equal(p.calls.length,2);
  old.emit('data',{type:'state',state:{stale:true}});old.emit('error',{});assert.equal(h.states.length,0);
  p.calls[1].openNow();h.window.emit('pageshow',{persisted:true});assert.equal(p.calls.length,2);h.api.stop();
});
test('hung data channel expires and resume replaces it without duplicate connections',()=>{
  const h=setup();const p=h.created[0];p.ready();p.calls[0].openNow();h.tick(15000);h.tick(1000);assert.equal(p.calls.length,2);
  h.window.emit('pageshow',{persisted:true});h.document.emit('visibilitychange');assert.equal(p.calls.length,2);h.api.stop();
});
test('host resends all current results on reconnect, request and live edits; duplicate viewers replaced',()=>{
  const h=setup(true);const p=h.created[0];p.ready();const c=new h.Conn('viewer');p.emit('connection',c);c.openNow();
  h.setState({teams:['A','B'],results:{L4:'A',FINAL:'A',THIRD:'B'},event:{title:'새 대회'}});
  p.disconnect();h.tick(1000);p.ready();assert.equal(c.sent.at(-1).state.results.THIRD,'B');
  c.emit('data',{type:'sync-request'});assert.equal(c.sent.at(-1).state.event.title,'새 대회');h.api.broadcast();assert.equal(c.sent.length,4);
  const replacement=new h.Conn('viewer');p.emit('connection',replacement);replacement.openNow();c.emit('close');h.api.broadcast();assert.equal(replacement.sent.length,2);assert.equal(c.open,false);h.api.stop();
});
test('failed signaling reconnect is timed out and replaced; old peer events are ignored',()=>{
  const h=setup(true);const p=h.created[0];p.ready();p.disconnect();h.tick(1000);h.tick(15000);h.tick(2000);
  assert.equal(h.created.length,2);const next=h.created[1];next.ready();p.emit('open');assert.equal(h.created.length,2);h.api.stop();
});
test('retry budget stops permanent failures and resumes on network return',()=>{
  const h=setup();let p=h.created[0];p.ready();
  for(let i=0;i<12;i++){const c=p.calls.at(-1);c.emit('error',{});c.emit('close');h.tick(30000)}
  assert.equal(p.calls.length,9);h.tick(600000);assert.equal(p.calls.length,9);
  h.window.emit('online');assert.equal(p.calls.length,10);h.api.stop();
});
test('duplicate operator ID does not retry or steal the room',()=>{
  const h=setup(true);h.created[0].emit('error',{type:'unavailable-id'});h.tick(600000);h.window.emit('online');assert.equal(h.created.length,1);assert.match(h.statuses.at(-1),/다른 조작화면/);h.api.stop();
});
test('page lifecycle keeps bfcache recovery and cleans up a disposed page',()=>{
  const h=setup();h.created[0].ready();h.window.emit('pagehide',{persisted:true});assert.ok(h.timers.size);
  h.window.emit('pageshow',{persisted:true});assert.equal(h.created[0].calls.length,1);
  h.window.emit('pagehide',{persisted:false});assert.equal(h.timers.size,0);h.window.emit('online');assert.equal(h.created.length,1);
});
test('both entrypoints load shared transport before use and broadcast styling stays intact',()=>{
  const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');const broadcast=fs.readFileSync(new URL('../tournament-broadcast.html',import.meta.url),'utf8');
  assert.ok(index.indexOf('tournament-transport.js')<index.indexOf('tournament-native.js'));
  assert.ok(broadcast.indexOf('tournament-transport.js')<broadcast.indexOf('DorangTournamentTransport.create'));
  assert.match(broadcast,/closePodium/);assert.match(broadcast,/C.normalize\(next\);render\(\)/);
});
