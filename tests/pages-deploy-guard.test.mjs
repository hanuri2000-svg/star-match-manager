import assert from 'node:assert/strict';
import test from 'node:test';
import guard from '../scripts/pages-deploy-guard.cjs';

const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40);
const passing = {test: {result: 'success'}, 'browser-smoke': {result: 'success'}};
function fixture(overrides = {}) {
  return {
    context: {repo: {owner: 'owner', repo: 'site'}, ref: 'refs/heads/main', eventName: 'workflow_dispatch', sha: A, payload: {inputs:{deploy_sha:A}}},
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
  f.context.sha = B; f.context.payload.inputs.deploy_sha = B;
  f.results['browser-smoke'].result = 'failure';
  await assert.rejects(guard(f));
  assert.equal(deployed, C); // Failed latest commit also leaves it unchanged.
  f.results['browser-smoke'].result = 'success';
  if (await guard(f)) deployed = f.context.sha;
  assert.equal(deployed, B);
  f.context.sha = A; f.context.payload.inputs.deploy_sha = A; // Someone reruns A after B deployed.
  if (await guard(f)) deployed = f.context.sha;
  assert.equal(deployed, B);
});
test('push, bot completion, absent or stale production approvals never deploy', async () => {
  for (const eventName of ['push', 'workflow_run', 'pull_request']) {
    const f = fixture(); f.context.eventName = eventName;
    await assert.rejects(guard(f), /separate explicit approval/);
  }
  for (const inputs of [{}, {deploy_sha:B}, {deploy_sha:'main'}]) {
    const f = fixture(); f.context.payload.inputs = inputs;
    await assert.rejects(guard(f), /separate explicit approval/);
  }
});
