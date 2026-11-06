import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('const normalizeTierLiveName=');
const end=html.indexOf("s.tierFilter=s.tierFilter||'ALL'",start);
const liveCode=html.slice(start,end);

test('failed LIVE refresh removes old badges and does not mislabel duplicate names',async()=>{
  let saved='';
  const context=vm.createContext({
    TIER_LIVE:{dkwkal:'https://play.sooplive.com/dkwkal/old'},TIER_LIVE_BY_NAME:{'탱크':'https://play.sooplive.com/other/old'},
    TIER_DATA:[{tier:'스페이드',players:[{name:'탱크',eloId:170},{name:'탱크',eloId:6312}]}],
    tierPlayerMeta:p=>p.eloId===170?{s:'dkwkal'}:{s:''},
    LIVE_RELAY:'https://relay.example/',fetch:async()=>{throw Error('unavailable')},
    s:{activeTab:'tier',tierLiveOnly:true},render:()=>{},KEY:'fixture',
    localStorage:{setItem:(_key,value)=>{saved=value}}
  });
  vm.runInContext(liveCode,context);
  assert.equal(vm.runInContext('liveForTierPlayer(TIER_DATA[0].players[0])',context),'https://play.sooplive.com/dkwkal/old');
  await vm.runInContext('refreshTierLive()',context);
  assert.equal(vm.runInContext('liveForTierPlayer(TIER_DATA[0].players[0])',context),'');
  assert.equal(vm.runInContext('liveForTierPlayer(TIER_DATA[0].players[1])',context),'');
  assert.match(vm.runInContext('tierLiveStatus',context),/현재 방송 여부 확인 불가/);
  assert.equal(vm.runInContext('s.tierLiveOnly',context),false);
  assert.equal(JSON.parse(saved).tierLiveOnly,false);
  assert.equal(vm.runInContext('tierLiveReady',context),false);
});
