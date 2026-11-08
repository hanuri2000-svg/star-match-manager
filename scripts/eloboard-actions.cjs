'use strict';
const fs = require('node:fs/promises');
const {createHash} = require('node:crypto');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

// Only data from a successful, current-main run of the known read-only workflow
// crosses into this privileged job. No artifact-provided code is executed.
async function download({github, context, core}) {
  const {REVIEW_RUN_ID, APPROVED_CHANGES} = process.env;
  assert(context.ref === 'refs/heads/main' && context.eventName === 'workflow_dispatch', 'Run approval from main');
  assert(/^[1-9]\d*$/.test(REVIEW_RUN_ID || '') && Number.isSafeInteger(Number(REVIEW_RUN_ID)), 'Invalid review run ID');
  assert(/^(?:\d+|legacy-\d+):(?:name|tier|race|active|eloId|thumbUrl|add)(?:\s*,\s*(?:\d+|legacy-\d+):(?:name|tier|race|active|eloId|thumbUrl|add))*$/.test(APPROVED_CHANGES || ''), 'Select explicit approval keys');
  const repo = context.repo;
  const {data: head} = await github.rest.git.getRef({...repo, ref:'heads/main'});
  assert(head.object.sha === context.sha, 'Main changed; run a fresh comparison');
  const {data: workflow} = await github.rest.actions.getWorkflow({...repo, workflow_id:'sync-eloboard-tiers.yml'});
  const {data: run} = await github.rest.actions.getWorkflowRun({...repo, run_id:Number(REVIEW_RUN_ID)});
  assert(run.workflow_id === workflow.id && run.conclusion === 'success' && run.status === 'completed'
    && run.head_branch === 'main' && run.head_sha === context.sha
    && run.head_repository?.full_name === `${repo.owner}/${repo.repo}`
    && ['schedule','workflow_dispatch','push'].includes(run.event), 'Untrusted, unsuccessful or stale source run');
  const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, {...repo, run_id:run.id, per_page:100});
  const matches = artifacts.filter(a => a.name === 'eloboard-tier-proposal');
  assert(matches.length === 1, 'Expected exactly one source artifact');
  const artifact = matches[0];
  assert(!artifact.expired && Date.parse(artifact.expires_at) > Date.now()
    && artifact.size_in_bytes <= 100_000_000 && /^sha256:[a-f0-9]{64}$/.test(artifact.digest || ''), 'Expired, oversized or unbound artifact');
  const {data: archive} = await github.rest.actions.downloadArtifact({...repo, artifact_id:artifact.id, archive_format:'zip'});
  const bytes = Buffer.from(archive);
  assert(`sha256:${hash(bytes)}` === artifact.digest, 'Artifact ZIP digest mismatch');
  await fs.mkdir('_review', {recursive:true});
  await fs.writeFile('_review/proposal.zip', bytes);
  const provenance = {runId:String(run.id), artifactId:artifact.id, artifactDigest:artifact.digest,
    commitSha:context.sha, repository:`${repo.owner}/${repo.repo}`, actor:context.actor,
    approvedChanges:APPROVED_CHANGES, approvedAt:new Date().toISOString()};
  await fs.writeFile('_review/provenance.json', JSON.stringify(provenance, null, 2));
  core.info(`Verified source run ${run.id}, artifact ${artifact.id}`);
}

async function publish({github, context, core}) {
  const repo = context.repo;
  assert(context.ref === 'refs/heads/main' && context.eventName === 'workflow_dispatch', 'Run approval from main');
  const receipt = JSON.parse(await fs.readFile('eloboard-approval.json', 'utf8'));
  const provenance = JSON.parse(await fs.readFile('_review/provenance.json', 'utf8'));
  const db = await fs.readFile('players.json');
  assert(receipt.resultSha256 === hash(db), 'Result changed after testing');
  assert(provenance.commitSha === context.sha, 'Unexpected source commit');
  const {data: head} = await github.rest.git.getRef({...repo, ref:'heads/main'});
  assert(head.object.sha === context.sha, 'Main advanced during review; compare again');
  const {data: current} = await github.rest.repos.getContent({...repo, path:'players.json', ref:context.sha});
  assert(hash(Buffer.from(current.content.replace(/\s/g,''),'base64')) === receipt.dbSha256, 'DB changed since review');
  const branch = `eloboard/approved-${context.runId}`;
  const reviewPath = `docs/eloboard-reviews/${context.runId}.json`;
  const audit = {...receipt, ...provenance};
  const elements = [
    {path:'players.json', mode:'100644', type:'blob', content:db.toString('utf8')},
    {path:reviewPath, mode:'100644', type:'blob', content:JSON.stringify(audit,null,2)+'\n'}
  ];
  // Only reviewed local image files can accompany the DB; never commit code.
  const proposal = JSON.parse(await fs.readFile('_review/proposal.json','utf8'));
  const paths = new Set(receipt.operations.map(o => o.after.thumbUrl).filter(p => p?.startsWith('assets/')));
  for (const path of paths) {
    const asset = proposal.assets.find(a => a.path === path);
    if (!asset) continue;
    assert(/^assets\/eloboard-players\/\d+-[a-zA-Z0-9._-]+\.(?:jpe?g|png|webp|gif)$/.test(path), 'Unsafe publish path');
    const bytes = await fs.readFile(path);
    assert(hash(bytes) === asset.sha256, 'Asset changed after testing');
    const {data: blob} = await github.rest.git.createBlob({...repo, encoding:'base64', content:bytes.toString('base64')});
    elements.push({path,mode:'100644',type:'blob',sha:blob.sha});
  }
  const {data: parent} = await github.rest.git.getCommit({...repo, commit_sha:context.sha});
  const {data: tree} = await github.rest.git.createTree({...repo, base_tree:parent.tree.sha, tree:elements});
  const {data: commit} = await github.rest.git.createCommit({...repo, tree:tree.sha, parents:[context.sha], message:`Apply reviewed EloBoard proposal ${provenance.runId}`});
  await github.rest.git.createRef({...repo, ref:`refs/heads/${branch}`, sha:commit.sha});
  const {data: pr} = await github.rest.pulls.create({...repo, head:branch, base:'main',
    title:`Review approved EloBoard player changes (${provenance.runId})`,
    body:`Approved by @${context.actor} through workflow_dispatch.\n\nSource run: ${provenance.runId}; artifact: ${provenance.artifactId}.\nSource SHA-256: \`${receipt.sourceSha256}\`\nDB SHA-256: \`${receipt.dbSha256}\`\nProposal SHA-256: \`${receipt.proposalSha256}\`\n\nApproved keys: ${receipt.approved.map(k=>'`'+k+'`').join(', ')}\n\n${await fs.readFile('_review/review.md','utf8')}\n\nNode, workflow and browser checks passed on the candidate before this PR was created. A separate regression run is explicitly dispatched for this immutable commit. Main merge and production deployment each require separate approval. Audit: ${reviewPath}`});
  // A GITHUB_TOKEN-created PR does not trigger pull_request workflows.
  await github.rest.actions.createWorkflowDispatch({...repo, workflow_id:'regression-tests.yml', ref:branch,
    inputs:{tested_sha:commit.sha, deploy_sha:''}});
  await core.summary.addRaw(`Created [PR #${pr.number}](${pr.html_url}). No main write or deployment.\n`).write();
}
module.exports = {download, publish};
