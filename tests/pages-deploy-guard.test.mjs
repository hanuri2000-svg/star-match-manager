import assert from 'node:assert/strict';
import test from 'node:test';
import guard from '../scripts/pages-deploy-guard.cjs';

const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40);
const passing = {test: {result: 'success'}, 'browser-smoke': {result: 'success'}};
function fixture(overrides = {}) {
  return {
    context: {repo: {owner: 'owner', repo: 'site'}, ref: 'refs/heads/main', eventName: 'push', sha: A, payload: {}},
    results: structuredClone(passing),
    github: {rest: {
      git: {getRef: async () => ({data: {object: {sha: A}}})},
      repos: {getPages: async () => ({data: {build_type: 'workflow'}})},
    }},
    core: {notice() {}, info() {}},
    ...overrides,
  };
}

test('normal: all required checks passed for the current main commit', async () => {
  assert.equal(await guard(fixture()), true);
});
for (const job of ['test', 'browser-smoke', 'build-pages']) {
  for (const result of ['failure', 'cancelled', 'skipped', 'timed_out', undefined]) {
    test(`fail closed: ${job}=${result} cannot promote`, async () => {
      const f = fixture();
      f.results[job] = {result};
      await assert.rejects(guard(f), /did not pass/);
    });
  }
}
test('missing checks, unverified SHA, PRs, tags and other branches cannot deploy', async () => {
  await assert.rejects(guard(fixture({results: {}})), /did not pass/);
  for (const changes of [{sha: 'main'}, {eventName: 'pull_request'}, {ref: 'refs/tags/v1'}, {ref: 'refs/heads/feature'}]) {
    const f = fixture(); Object.assign(f.context, changes);
    await assert.rejects(guard(f));
  }
});
test('legacy publishing and API failures fail closed', async () => {
  const f = fixture();
  f.github.rest.repos.getPages = async () => ({data: {build_type: 'legacy'}});
  await assert.rejects(guard(f), /source must be GitHub Actions/);
  f.github.rest.git.getRef = async () => { throw new Error('API unavailable'); };
  await assert.rejects(guard(f), /API unavailable/);
});
test('successive commits: stale build, queued old run, and old rerun never roll back the site', async () => {
  let main = A, deployed = C;
  const f = fixture();
  f.github.rest.git.getRef = async () => ({data: {object: {sha: main}}});
  assert.equal(await guard(f), true); // A packaged after its checks.
  main = B; // B pushed while A waits for the deployment slot.
  if (await guard(f)) deployed = f.context.sha;
  assert.equal(deployed, C); // Last good deployment survives a superseded run.
  f.context.sha = B;
  f.results['browser-smoke'].result = 'failure';
  await assert.rejects(guard(f));
  assert.equal(deployed, C); // Failed latest commit also leaves it unchanged.
  f.results['browser-smoke'].result = 'success';
  if (await guard(f)) deployed = f.context.sha;
  assert.equal(deployed, B);
  f.context.sha = A; // Someone reruns A after B deployed.
  if (await guard(f)) deployed = f.context.sha;
  assert.equal(deployed, B);
});
test('bot completion tests the new main snapshot, not the pre-sync upstream SHA', async () => {
  const f = fixture();
  f.context.eventName = 'workflow_run';
  f.context.payload.workflow_run = {name: 'Sync EloBoard tiers', conclusion: 'success', head_branch: 'main',
    head_sha: C, head_repository: {full_name: 'owner/site'}};
  assert.equal(await guard(f), true);
  for (const change of [{conclusion: 'failure'}, {head_branch: 'other'},
    {head_repository: {full_name: 'fork/site'}}, {name: 'Unknown writer'}]) {
    const invalid = {...f, context: {...f.context, payload: {workflow_run: {...f.context.payload.workflow_run, ...change}}}};
    await assert.rejects(guard(invalid), /upstream/);
  }
});
