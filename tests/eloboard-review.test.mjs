import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {makeReview, applyProposal, digest, renderReview, operationsFor} from '../scripts/eloboard-review.mjs';

function fixture() {
  const before = {name:'옛이름',tier:'7티어',tierLabel:'7티어',race:null,eloId:32,active:true,
    aliases:['예전별칭'],soopId:'keep-soop',settings:{color:'violet'},history:[{win:true}],thumbUrl:''};
  const untouched = {...before,name:'다른선수',eloId:100};
  const db = {source:{version:'old'},custom:{keep:true},players:[before,untouched]};
  const after = {...before,name:'새이름',aliases:['예전별칭','옛이름'],tier:'6티어',tierLabel:'6티어',race:'P'};
  const source = '<html>reviewed source</html>', dbRaw=JSON.stringify(db);
  const proposal = {...makeReview(db,[after,untouched],new Map([[32,before]]),new Map()),
    checkedAt:new Date().toISOString(),sourceUrl:'https://eloboard.co.kr/tiers',sourceSha256:digest(source),dbSha256:digest(dbRaw)};
  const args = () => {const proposalRaw=JSON.stringify(proposal);return {dbRaw,source,proposalRaw,
    expectedSource:digest(source),expectedDb:digest(dbRaw),expectedProposal:digest(proposalRaw),approved:'32:race'};};
  return {before,db,proposal,args};
}

test('only selected field changes; IDs, undecided data, aliases, SOOP, settings, history and unapproved players survive',()=>{
  const f=fixture(), result=applyProposal(f.args()), next=JSON.parse(result.after);
  assert.deepEqual(next,{...f.db,players:[{...f.before,race:'P'},f.db.players[1]]});
  const renamed=JSON.parse(applyProposal({...f.args(),approved:'32:name'}).after);
  assert.deepEqual(renamed.players[0].aliases,['예전별칭','옛이름']);
  assert.equal(renamed.players[0].race,null);
  const tier=JSON.parse(applyProposal({...f.args(),approved:'32:tier'}).after);
  assert.equal(tier.players[0].tierLabel,'6티어');
});
for (const [name, mutate, pattern] of [
  ['source mismatch',a=>{a.source+='changed';},/snapshot hash/],
  ['DB mismatch',a=>{a.dbRaw+=' ';},/DB changed/],
  ['proposal mismatch',a=>{a.proposalRaw+=' ';},/proposal hash/],
  ['unknown key',a=>{a.approved='100:race';},/approval keys/],
  ['implicit all',a=>{a.approved='all';},/approval keys/],
  ['empty',a=>{a.approved='';},/approval keys/],
  ['duplicate',a=>{a.approved='32:race,32:race';},/approval keys/],
]) test(`${name} fails closed`,()=>{const a=fixture().args();mutate(a);assert.throws(()=>applyProposal(a),pattern);});

for (const field of ['soopId','settings','history']) test(`protected ${field} cannot be changed even in a rehashed proposal`,()=>{
  const f=fixture();f.proposal.records[0].after[field]='bad';
  assert.throws(()=>applyProposal(f.args()),/Protected field/);
});
test('ID replacement, malformed race, old proposal and operation tampering are rejected',()=>{
  let f=fixture();f.proposal.records[0].after.eloId=999;assert.throws(()=>applyProposal(f.args()),/replacement/);
  f=fixture();f.proposal.records[0].after.race='unknown';assert.throws(()=>applyProposal(f.args()),/Invalid candidate/);
  f=fixture();f.proposal.checkedAt='2020-01-01';assert.throws(()=>applyProposal(f.args()),/expired/);
  f=fixture();f.proposal.operations[0].after.name='tampered';assert.throws(()=>applyProposal(f.args()),/operations changed/);
});
test('report includes both IDs and complete field details without executable HTML',()=>{
  const f=fixture();f.proposal.records[0].after.name='<img src=x onerror=alert(1)>';
  const report=renderReview(f.proposal);assert.match(report,/eloId/);assert.match(report,/32:race/);assert.ok(!report.includes('<img'));
});
test('new identity and missing legacy identity are explicit approval units',()=>{
  const f=fixture(), newcomer={...f.before,eloId:200,name:'신규',soopId:'',aliases:[],settings:undefined,history:undefined};
  delete newcomer.settings; delete newcomer.history;
  f.proposal.records.push({index:null,before:null,after:newcomer});f.proposal.operations=operationsFor(f.proposal.records);
  const result=JSON.parse(applyProposal({...f.args(),approved:'200:add'}).after);
  assert.equal(result.players.length,3);assert.deepEqual(result.players[0],f.before);assert.equal(result.players[2].race,null);
});
test('reviewed image bytes are frozen; unsafe paths and wrong hashes are rejected',()=>{
  const f=fixture(), path='assets/eloboard-players/32-photo.jpg',bytes=Buffer.from([255,216,255]);
  f.proposal.records[0].after.thumbUrl=path;f.proposal.operations=operationsFor(f.proposal.records);
  f.proposal.assets=[{path,sha256:digest(bytes),base64:bytes.toString('base64')}];
  assert.deepEqual(applyProposal({...f.args(),approved:'32:thumbUrl'}).assets[0].bytes,bytes);
  f.proposal.assets[0].sha256='0'.repeat(64);assert.throws(()=>applyProposal({...f.args(),approved:'32:thumbUrl'}),/image hash/);
  f.proposal.records[0].after.thumbUrl='assets/../../evil.jpg';f.proposal.assets[0].path='assets/../../evil.jpg';f.proposal.operations=operationsFor(f.proposal.records);
  assert.throws(()=>applyProposal({...f.args(),approved:'32:thumbUrl'}),/Unsafe asset/);
});
test('apply performs no network requests and refuses the old whole-snapshot command',async()=>{
  const f=fixture(),dir=await mkdtemp(join(tmpdir(),'review-apply-'));
  const script=new URL('../scripts/sync-eloboard-tiers.mjs',import.meta.url).pathname;
  try {
    const a=f.args();await writeFile(join(dir,'players.json'),a.dbRaw);await writeFile(join(dir,'source.html'),a.source);
    await writeFile(join(dir,'proposal.json'),a.proposalRaw);
    await writeFile(join(dir,'no-network.mjs'),"globalThis.fetch=()=>{throw new Error('Network forbidden')}");
    const hashes=[`--expected-sha256=${a.expectedSource}`,`--expected-db-sha256=${a.expectedDb}`];
    assert.throws(()=>execFileSync(process.execPath,[script,'--apply','--source-file=source.html',...hashes],{cwd:dir,stdio:'pipe'}));
    assert.equal(await readFile(join(dir,'players.json'),'utf8'),a.dbRaw);
    execFileSync(process.execPath,['--import',join(dir,'no-network.mjs'),script,'--apply','--source-file=source.html',...hashes,
      '--proposal-file=proposal.json',`--expected-proposal-sha256=${a.expectedProposal}`,'--approved-changes=32:race'],{cwd:dir,stdio:'pipe'});
    assert.equal(JSON.parse(await readFile(join(dir,'players.json'),'utf8')).players[0].race,'P');
    assert.deepEqual(JSON.parse(await readFile(join(dir,'eloboard-approval.json'),'utf8')).approved,['32:race']);
  } finally {await rm(dir,{recursive:true,force:true});}
});
