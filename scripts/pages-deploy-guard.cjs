'use strict';

const WRITERS = [
  'Sync EloBoard tiers',
  'Apply shared player master DB',
  'Refresh integrated shared apps v5.12.1',
];

// Used both before packaging and after acquiring the deployment concurrency slot.
// Errors fail closed; only a superseded commit is a successful, explicit skip.
module.exports = async function guard({ github, context, core, results = JSON.parse(process.env.REQUIRED_RESULTS || '{}') }) {
  const repo = context.repo;
  if (context.ref !== 'refs/heads/main' ||
      !['push', 'workflow_dispatch', 'workflow_run'].includes(context.eventName)) {
    throw new Error('Pages deployment is restricted to main push/dispatch/approved writer completion.');
  }
  if (context.eventName === 'workflow_run') {
    const run = context.payload.workflow_run;
    if (run?.conclusion !== 'success' || run.head_branch !== 'main' ||
        run.head_repository?.full_name !== `${repo.owner}/${repo.repo}` || !WRITERS.includes(run.name)) {
      throw new Error('Untrusted or unsuccessful upstream workflow.');
    }
  }
  for (const job of ['test', 'browser-smoke']) {
    if (results[job]?.result !== 'success') throw new Error(`Required job did not pass: ${job}`);
  }
  for (const [job, result] of Object.entries(results)) {
    if (result.result !== 'success') throw new Error(`Dependency did not pass: ${job}`);
  }
  if (!/^[a-f0-9]{40}$/.test(context.sha)) throw new Error('Expected an immutable commit SHA.');
  const { data: head } = await github.rest.git.getRef({ ...repo, ref: 'heads/main' });
  if (!/^[a-f0-9]{40}$/.test(head.object?.sha || '')) throw new Error('Could not verify main SHA.');
  if (head.object.sha !== context.sha) {
    core.notice(`Skip superseded commit ${context.sha}; latest main is ${head.object.sha}. Existing site is unchanged.`);
    return false;
  }
  const { data: pages } = await github.rest.repos.getPages(repo);
  if (pages.build_type !== 'workflow') {
    throw new Error('Pages source must be GitHub Actions (Settings > Pages). Branch publishing bypasses regression tests.');
  }
  core.info(`Deployable tested main commit: ${context.sha}`);
  return true;
};
