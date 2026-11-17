import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const db = JSON.parse(fs.readFileSync(new URL('../players.json',import.meta.url),'utf8'));
const code = fs.readFileSync(new URL('../tier-board.js',import.meta.url),'utf8');
function board(){
  const sandbox={location:{hash:''},setInterval(){},document:{addEventListener(){},querySelector(){return null},createElement(){return {}}}};
  sandbox.window={addEventListener(){}};
  vm.runInNewContext(code.replace('  function closePreview(){','  globalThis.__test = {players,playerUrl,hasEloId,state};\n  function closePreview(){'),sandbox);
  return sandbox.__test;
}
test('requested Zerg youth use exact SOOP identities without fabricated Elo numbers',()=>{
  for(const [name,soopId] of [['수빛나','492877vv'],['김아린','skdidkfl']]){
    const rows=db.players.filter(p=>p.name===name || p.soopId===soopId);
    assert.equal(rows.length,1); const p=rows[0];
    assert.equal(p.name,name);assert.equal(p.soopId,soopId);assert.equal(p.race,'Z');
    assert.equal(p.tier,'유스');assert.equal(p.tierLabel,'베이비');assert.equal(p.active,true);assert.equal(p.eloId,null);
  }
  const ids=db.players.map(p=>p.eloId).filter(x=>x!=null);
  assert.equal(new Set(ids).size,ids.length);
  assert.equal(db.players.find(p=>p.eloId===830)?.name,'려은');
});
test('SOOP-only players stay visible and use a real station URL; official IDs keep their existing links',()=>{
  const b=board();const local=db.players.filter(p=>['수빛나','김아린'].includes(p.name));
  b.state.payload={players:[...local,{name:'known',eloId:443,active:true},{name:'unsafe',eloId:null,soopId:'javascript:alert(1)'},{name:'inactive',eloId:null,soopId:'validid',active:false}]};
  assert.equal(b.players().length,3);
  assert.equal(b.playerUrl(local[0]),'https://www.sooplive.com/station/492877vv');
  assert.equal(b.playerUrl(local[1]),'https://www.sooplive.com/station/skdidkfl');
  assert.equal(b.playerUrl({eloId:443}),'https://eloboard.com/players/443');
  assert.equal(b.playerUrl({eloId:null,soopId:'https://example.com'}),'');
  assert.equal(b.hasEloId({eloId:0}),false);
  assert.equal(b.hasEloId({eloId:-1}),false);
  assert.equal(b.hasEloId({eloId:'443'}),false);
});
