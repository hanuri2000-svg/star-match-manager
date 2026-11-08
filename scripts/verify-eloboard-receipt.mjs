import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {isDeepStrictEqual as equal} from 'node:util';
import {digest} from './eloboard-review.mjs';

const git = (...args) => execFileSync('git', args, {encoding:'utf8'}).trim();
const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8')) : {};
const main = event.pull_request?.base?.sha || (process.env.GITHUB_REF !== 'refs/heads/main' ? 'origin/main' : null);
// For pushes, inspect this change; for branch checks, compare against current main.
const base = main ? git('merge-base', main, 'HEAD') : event.before && !/^0+$/.test(event.before) ? event.before : 'HEAD^';
const paths = git('diff','--name-only','--diff-filter=A',base,'HEAD').split('\n').filter(p => /^docs\/eloboard-reviews\/\d+\.json$/.test(p));
for (const path of paths) {
  const r = JSON.parse(await readFile(path,'utf8'));
  if (!/^[a-f0-9]{40}$/.test(r.commitSha) || !Array.isArray(r.operations) || !r.operations.length) throw new Error('Invalid approval receipt');
  // Current base DB must still equal the reviewed baseline, including unrelated metadata.
  const baseline = execFileSync('git',['show',`${main || base}:players.json`],{encoding:'utf8'});
  if (digest(baseline) !== r.dbSha256) throw new Error('Main DB changed since approval; regenerate proposal');
  const next = JSON.parse(baseline);
  if (!equal([...r.approved].sort(), r.operations.map(o => o.key).sort())) throw new Error('Approval keys changed');
  const approvedHash = digest(JSON.stringify({proposalSha256:r.proposalSha256, approved:r.approved,
    actor:r.actor, approvedAt:r.approvedAt}));
  if (r.approvalSha256 !== approvedHash) throw new Error('Approval binding changed');
  for (const op of r.operations) {
    if (op.index === null) next.players.push(op.after);
    else {
      const previous = next.players[op.index];
      if (!previous || Object.entries(op.before).some(([k,v]) => !equal(previous[k],v))) throw new Error('Approved before value changed');
      for (const key of Object.keys(op.before)) if (!Object.hasOwn(op.after, key)) delete previous[key];
      Object.assign(previous,op.after);
    }
  }
  const actual = await readFile('players.json','utf8');
  if (digest(actual) !== r.resultSha256 || actual !== JSON.stringify(next,null,2)+'\n') throw new Error('DB differs from approved operations');
  console.log(`Verified ${path}: exact approved DB result`);
}
if (!paths.length) console.log('No new EloBoard approval receipts');
