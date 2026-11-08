import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import actions from '../scripts/eloboard-actions.cjs';
import {digest} from '../scripts/eloboard-review.mjs';

const sha='a'.repeat(40);
function fixture() {
  const archive=Buffer.from('verified ZIP bytes');
  const run={id:10,workflow_id:5,conclusion:'success',status:'completed',head_branch:'main',head_sha:sha,
    head_repository:{full_name:'owner/repo'},event:'schedule'};
  const artifact={id:20,name:'eloboard-tier-proposal',expired:false,expires_at:new Date(Date.now()+86400000).toISOString(),
    size_in_bytes:archive.length,digest:`sha256:${digest(archive)}`};
  const f={run,artifact,archive,context:{repo:{owner:'owner',repo:'repo'},ref:'refs/heads/main',eventName:'workflow_dispatch',sha,actor:'owner'},
    core:{info(){}},github:{rest:{git:{getRef:async()=>({data:{object:{sha}}})},actions:{
      getWorkflow:async()=>({data:{id:5}}), getWorkflowRun:async()=>({data:run}),
      listWorkflowRunArtifacts(){}, downloadArtifact:async()=>({data:f.archive})}},paginate:async()=>[artifact]}};
  return f;
}
test('approval accepts only the exact successful main workflow artifact and verifies ZIP digest',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'actions-review-')),cwd=process.cwd();
  const oldRun=process.env.REVIEW_RUN_ID,oldKeys=process.env.APPROVED_CHANGES;
  try {
    process.chdir(dir);process.env.REVIEW_RUN_ID='10';process.env.APPROVED_CHANGES='32:race';
    let f=fixture();await actions.download(f);
    assert.equal((await readFile('_review/proposal.zip')).toString(),'verified ZIP bytes');
    assert.equal(JSON.parse(await readFile('_review/provenance.json','utf8')).approvedChanges,'32:race');
    for (const patch of [{workflow_id:99},{head_branch:'feature'},{head_sha:'b'.repeat(40)},
      {conclusion:'failure'},{status:'in_progress'},{head_repository:{full_name:'fork/repo'}},{event:'pull_request'}]) {
      f=fixture();Object.assign(f.run,patch);await assert.rejects(actions.download(f),/Untrusted/);
    }
    f=fixture();f.archive=Buffer.from('tampered');await assert.rejects(actions.download(f),/digest mismatch/);
    f=fixture();f.artifact.expired=true;await assert.rejects(actions.download(f),/Expired/);
    f=fixture();f.github.paginate=async()=>[f.artifact,f.artifact];await assert.rejects(actions.download(f),/exactly one/);
    f=fixture();f.context.ref='refs/heads/feature';await assert.rejects(actions.download(f),/from main/);
    f=fixture();process.env.APPROVED_CHANGES='32:race; touch pwned';await assert.rejects(actions.download(f),/approval keys/);
    assert.equal(await readFile('_review/proposal.zip','utf8'),'verified ZIP bytes');
  } finally {
    process.chdir(cwd);if(oldRun===undefined)delete process.env.REVIEW_RUN_ID;else process.env.REVIEW_RUN_ID=oldRun;
    if(oldKeys===undefined)delete process.env.APPROVED_CHANGES;else process.env.APPROVED_CHANGES=oldKeys;
    await rm(dir,{recursive:true,force:true});
  }
});
test('publisher writes a fresh data-only branch and PR, explicitly dispatches checks, and never updates main',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'actions-publish-')),cwd=process.cwd();
  try {
    process.chdir(dir);await mkdir('_review');
    const db='{"players":[]}\n';
    await writeFile('players.json',db);
    await writeFile('eloboard-approval.json',JSON.stringify({resultSha256:digest(db),dbSha256:digest(db),approved:['32:race'],operations:[]}));
    await writeFile('_review/provenance.json',JSON.stringify({commitSha:sha,runId:'10',artifactId:20}));
    await writeFile('_review/proposal.json',JSON.stringify({assets:[]}));await writeFile('_review/review.md','Review table');
    const f=fixture(),calls=[];f.context.runId=30;
    Object.assign(f.github.rest.git,{
      getCommit:async()=>({data:{tree:{sha:'base-tree'}}}),
      createTree:async args=>{calls.push(['tree',args]);return {data:{sha:'new-tree'}};},
      createCommit:async args=>{calls.push(['commit',args]);return {data:{sha:'b'.repeat(40)}};},
      createRef:async args=>{calls.push(['ref',args]);}
    });
    f.github.rest.repos={getContent:async()=>({data:{content:Buffer.from(db).toString('base64')}})};
    f.github.rest.pulls={create:async args=>{calls.push(['PR',args]);return {data:{number:1,html_url:'https://example.test/1'}};}};
    f.github.rest.actions.createWorkflowDispatch=async args=>{calls.push(['dispatch',args]);};
    f.core.summary={addRaw(){return this;},async write(){}};
    await actions.publish(f);
    assert.equal(calls.find(([name])=>name==='ref')[1].ref,'refs/heads/eloboard/approved-30');
    assert.deepEqual(calls.find(([name])=>name==='tree')[1].tree.map(e=>e.path),['players.json','docs/eloboard-reviews/30.json']);
    assert.equal(calls.find(([name])=>name==='dispatch')[1].inputs.tested_sha,'b'.repeat(40));
    assert.equal(calls.find(([name])=>name==='dispatch')[1].inputs.deploy_sha,'');
    assert.equal(calls.find(([name])=>name==='PR')[1].base,'main');
    f.github.rest.git.getRef=async()=>({data:{object:{sha:'c'.repeat(40)}}});
    const count=calls.length;await assert.rejects(actions.publish(f),/Main advanced/);assert.equal(calls.length,count);
  } finally {process.chdir(cwd);await rm(dir,{recursive:true,force:true});}
});
