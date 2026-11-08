import {readFile, writeFile, appendFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {digest} from './eloboard-review.mjs';

const raw = await readFile('_review/proposal.json','utf8');
const proposal = JSON.parse(raw);
const provenance = JSON.parse(await readFile('_review/provenance.json','utf8'));
if (proposal.repository !== provenance.repository || proposal.commitSha !== provenance.commitSha
    || proposal.runId !== provenance.runId) throw new Error('Proposal provenance mismatch');
execFileSync(process.execPath, ['scripts/sync-eloboard-tiers.mjs', '--apply', '--source-file=_review/source.html',
  '--proposal-file=_review/proposal.json', `--expected-sha256=${proposal.sourceSha256}`,
  `--expected-db-sha256=${proposal.dbSha256}`, `--expected-proposal-sha256=${digest(raw)}`,
  `--approved-changes=${provenance.approvedChanges}`], {stdio:'inherit'});
const receipt = JSON.parse(await readFile('eloboard-approval.json','utf8'));
receipt.approvalSha256 = digest(JSON.stringify({proposalSha256:receipt.proposalSha256, approved:receipt.approved,
  actor:provenance.actor, approvedAt:provenance.approvedAt}));
await writeFile('eloboard-approval.json', JSON.stringify(receipt,null,2)+'\n');
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
  `Approved operations: ${receipt.approved.join(', ')}\n\nResult SHA-256: \`${receipt.resultSha256}\`\n\nNo main write or deployment.\n`);
