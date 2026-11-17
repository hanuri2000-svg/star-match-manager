import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync(new URL('../tier-board.js', import.meta.url), 'utf8');
const db = JSON.parse(fs.readFileSync(new URL('../players.json', import.meta.url), 'utf8'));

async function boot(manager=false, liveIds=[], payload=db){
  const listeners = new Map(), requested = [], hosts=[];
  const node = ()=>({innerHTML:'',style:{},dataset:{},classList:{add(){},toggle(){}},contains(){return true;},remove(){}});
  const nav={insertBefore(){},querySelector(){return null;}};
  const document={hidden:false, addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback)},
    createElement(){return node()},querySelectorAll(){return []},
    querySelector(selector){if(selector==='.content')return {append(el){hosts.push(el)}};if(selector==='.app-tabs')return nav;if(selector==='#app > footer')return {before(el){hosts.push(el)}};return null},body:{append(){}}};
  const context={document,location:{hash:'#tiers'},console,URL,AbortSignal,Number,String,Set,Map,
    setInterval(){return 1},clearInterval(){},setTimeout,clearTimeout,addEventListener(){},
    fetch:async url=>{requested.push(url);if(url.includes('players.json'))return {ok:true,json:async()=>payload};const id=decodeURIComponent(url.split('/channel/')[1].split('/')[0]);return {ok:true,text:async()=>liveIds.includes(id)?JSON.stringify({userId:id,broadNo:12345}):''}}};
  context.window=context;
  if(manager){context.HARINA_LOAD_PLAYER_MASTER=()=>{};context.s={activeTab:'tiers'};context.render=()=>{};}
  vm.runInNewContext(code,context);
  for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));
  return {get html(){return hosts.at(-1)?.innerHTML||''},requested,all(){for(const cb of listeners.get('click')||[])cb({target:{closest(selector){return selector==='[data-tier-all]'?{}:null}}})}};
}

test('both requested players have one exact Zerg youth entry and their supplied channel',()=>{
  for(const [name,channel] of [['수빛나','492877vv'],['김아린','skdidkfl']]){
    const matches=db.players.filter(p=>p.name===name||p.soopId===channel);assert.equal(matches.length,1);
    assert.equal(matches[0].race,'Z');assert.equal(matches[0].tier,'유스');assert.equal(matches[0].tierLabel,'베이비');assert.equal(matches[0].eloId,null);
  }
});
for(const manager of [false,true])test(`${manager?'integrated':'standalone'} view includes both players and station links`,async()=>{
  const view=await boot(manager);view.all();
  for(const [name,channel] of [['수빛나','492877vv'],['김아린','skdidkfl']]){
    assert.match(view.html,new RegExp(`href="https://www.sooplive.com/station/${channel}"[^>]*>${name}</a>`));
    assert.ok(view.requested.some(url=>url.includes(`/channel/${channel}/`)));
    assert.ok(view.html.includes(`https://profile.img.sooplive.com/LOGO/${channel.slice(0,2)}/${channel}/${channel}.jpg`));
  }
  assert.ok(view.html.includes('https://eloboard.com/players/443'));
  assert.ok(!view.html.includes('/players/null'));assert.ok(!view.html.includes('/players/undefined'));
});
test('channel-only youth entries participate in existing LIVE view without invented live status',async()=>{
  const view=await boot(false,['492877vv']);assert.ok(view.html.includes('수빛나'));assert.ok(!view.html.includes('>김아린</a>'));assert.ok(view.html.includes('data-live-id="492877vv"'));
  view.all();assert.ok(view.html.includes('>김아린</a>'));
});
test('inactive and malformed channel-only entries are not rendered',async()=>{
  const extra=[{name:'Inactive fixture',soopId:'inactive_ok',race:'Z',tier:'유스',active:false,eloId:null},
    {name:'Invalid fixture',soopId:'bad/../path',race:'Z',tier:'유스',active:true,eloId:null},
    {name:'Missing fixture',race:'Z',tier:'유스',active:true,eloId:null}];
  const view=await boot(false,[],{...db,players:[...db.players,...extra]});view.all();
  for(const p of extra)assert.ok(!view.html.includes(p.name));
});
