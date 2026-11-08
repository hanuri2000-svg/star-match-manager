import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {digest} from '../scripts/eloboard-review.mjs';

test('receipt check rejects extra DB edits and a base DB changed after approval',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'review-receipt-'));
  const script=new URL('../scripts/verify-eloboard-receipt.mjs',import.meta.url).pathname;
  const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:'pipe'}).trim();
  try {
    git('init');git('config','user.name','Test');git('config','user.email','test@example.invalid');
    const before={players:[{name:'선수',eloId:32,race:null,soopId:'keep'}]},raw=JSON.stringify(before)+'\n';
    await writeFile(join(dir,'players.json'),raw);git('add','.');git('commit','-m','baseline');
    const base=git('rev-parse','HEAD');git('update-ref','refs/remotes/origin/main',base);
    const after=structuredClone(before);after.players[0].race='P';const result=JSON.stringify(after,null,2)+'\n';
    const r={commitSha:base,dbSha256:digest(raw),resultSha256:digest(result),approved:['32:race'],proposalSha256:'pinned-proposal',
      actor:'reviewer',approvedAt:'2026-11-08T00:00:00Z',operations:[{key:'32:race',index:0,before:{race:null},after:{race:'P'}}]};
    r.approvalSha256=digest(JSON.stringify({proposalSha256:r.proposalSha256,approved:r.approved,actor:r.actor,approvedAt:r.approvedAt}));
    await mkdir(join(dir,'docs/eloboard-reviews'),{recursive:true});await writeFile(join(dir,'docs/eloboard-reviews/10.json'),JSON.stringify(r));
    await writeFile(join(dir,'players.json'),result);git('add','.');git('commit','-m','approved change');
    const run=()=>execFileSync(process.execPath,[script],{cwd:dir,stdio:'pipe',env:{...process.env,GITHUB_REF:'refs/heads/approved',GITHUB_EVENT_PATH:''}});
    assert.match(run().toString(),/exact approved DB result/);
    after.players[0].soopId='unexpected';await writeFile(join(dir,'players.json'),JSON.stringify(after,null,2)+'\n');
    assert.throws(run,error=>/differs from approved/.test(String(error.stderr)));
    await writeFile(join(dir,'players.json'),result);
    // Advance a separate main branch and merge it into the proposal branch.
    git('checkout','-b','main-advanced',base);before.players[0].soopId='new-main-value';
    await writeFile(join(dir,'players.json'),JSON.stringify(before)+'\n');git('add','.');git('commit','-m','new baseline');
    const advanced=git('rev-parse','HEAD');git('update-ref','refs/remotes/origin/main',advanced);
    git('checkout','-b','rebased-proposal',advanced);
    await writeFile(join(dir,'players.json'),result);await mkdir(join(dir,'docs/eloboard-reviews'),{recursive:true});
    await writeFile(join(dir,'docs/eloboard-reviews/10.json'),JSON.stringify(r));git('add','.');git('commit','-m','stale approval');
    assert.throws(run,error=>/Main DB changed/.test(String(error.stderr)));
  } finally {await rm(dir,{recursive:true,force:true});}
});
