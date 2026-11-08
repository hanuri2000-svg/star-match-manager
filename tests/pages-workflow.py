"""Parse the actual workflow to catch gates or immutable-ref wiring being removed."""
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
workflow = yaml.safe_load((ROOT / '.github/workflows/regression-tests.yml').read_text())
jobs = workflow['jobs']
# YAML 1.1 calls the key 'on' True; GitHub's YAML 1.2 treats it as text.
events = workflow.get('on', workflow.get(True))
assert events['push']['branches'] == ['main']
assert 'paths' not in events['push'] and 'paths-ignore' not in events['push']
assert 'workflow_run' not in events
assert 'pull_request' in events
assert 'deploy_sha' in events['workflow_dispatch']['inputs']
for path in (ROOT / '.github/workflows').glob('*.yml'):
    other = yaml.safe_load(path.read_text())
    if path.name != 'regression-tests.yml':
        assert 'deploy-pages@' not in path.read_text()
        assert other.get('permissions', {}).get('pages') != 'write'
review = yaml.safe_load((ROOT / '.github/workflows/sync-eloboard-tiers.yml').read_text())
assert review['permissions']['contents'] == 'read'
steps = review['jobs']['sync']['steps']
assert any('--proposal-dir=tier-sync-proposal' in s.get('run', '') for s in steps)
assert any(s.get('uses') == 'actions/upload-artifact@v4' for s in steps)
assert not any('git push' in s.get('run', '') or '--apply' in s.get('run', '') for s in steps)
approval = yaml.safe_load((ROOT / '.github/workflows/apply-eloboard-proposal.yml').read_text())
assert set(approval.get('on', approval.get(True))) == {'workflow_dispatch'}
assert approval['jobs']['prepare']['if'] == "github.ref == 'refs/heads/main'"
assert approval['jobs']['prepare']['permissions'] == {'actions': 'write', 'contents': 'write', 'pull-requests': 'write'}
commands = '\n'.join(step.get('run', '') for step in approval['jobs']['prepare']['steps'])
assert 'node --test tests/*.test.mjs' in commands
assert 'python tests/browser-smoke.py' in commands and 'python tests/tier-profile-browser.py' in commands
assert 'node scripts/prepare-eloboard-approval.mjs' in commands
assert 'git push' not in commands and '${{ inputs.' not in commands
for retired in ['apply-player-master-v512.yml', 'bump-shared-apps-v5121.yml']:
    old = yaml.safe_load((ROOT / '.github/workflows' / retired).read_text())
    assert set(old.get('on', old.get(True))) == {'workflow_dispatch'}
    assert old['permissions']['contents'] == 'read'
    assert list(old['jobs']) == ['retired']

for name, job in jobs.items():
    assert not job.get('continue-on-error')
    for step in job['steps']:
        assert not step.get('continue-on-error')
        if step.get('uses', '').startswith('actions/checkout@'):
            assert step['with']['ref'] == '${{ github.sha }}', name
            assert step['with']['persist-credentials'] is False
assert any(s.get('run') == 'node --test tests/*.test.mjs' for s in jobs['test']['steps'])
assert any('python tests/pages-workflow.py' in s.get('run', '') for s in jobs['test']['steps'])
assert jobs['browser-smoke']['runs-on'] == 'ubuntu-24.04'
assert jobs['browser-smoke']['container']['image'] == 'mcr.microsoft.com/playwright/python:v1.56.0-noble'
browser_commands = '\n'.join(s.get('run', '') for s in jobs['browser-smoke']['steps'])
assert 'playwright install --with-deps' not in browser_commands
assert 'python tests/tier-profile-browser.py' in browser_commands
assert 'python tests/browser-smoke.py' in browser_commands
assert 'python -m pip install playwright==1.56.0' in browser_commands

assert set(jobs['build-pages']['needs']) == {'test', 'browser-smoke'}
assert set(jobs['deploy-pages']['needs']) == {'test', 'browser-smoke', 'build-pages'}
for name in ['build-pages', 'deploy-pages']:
    job = jobs[name]
    assert "github.ref == 'refs/heads/main'" in job['if']
    assert "github.event_name == 'workflow_dispatch'" in job['if']
    assert 'inputs.deploy_sha == github.sha' in job['if']
    assert 'always()' not in job['if']
    guard = next(s for s in job['steps'] if s.get('id') == 'guard')
    assert guard['env']['REQUIRED_RESULTS'] == '${{ toJSON(needs) }}'
    assert "require('./scripts/pages-deploy-guard.cjs')" in guard['with']['script']
    assert 'await guard({github, context, core})' in guard['with']['script']

deploy = jobs['deploy-pages']
assert deploy['concurrency'] == {'group': 'github-pages', 'cancel-in-progress': False}
assert deploy['environment']['name'] == 'github-pages'
assert deploy['permissions']['pages'] == deploy['permissions']['id-token'] == 'write'
upload = next(s for s in jobs['build-pages']['steps'] if s.get('uses', '').startswith('actions/upload-pages-artifact@'))
publish = deploy['steps'][-1]
assert publish['uses'] == 'actions/deploy-pages@v4'
assert deploy['steps'][-2]['id'] == 'guard'
assert upload['if'] == publish['if'] == "steps.guard.outputs.current == 'true'"
assert upload['with']['name'] == '${{ steps.package.outputs.artifact-name }}'
assert jobs['build-pages']['outputs']['artifact-name'] == '${{ steps.package.outputs.artifact-name }}'
assert publish['with']['artifact_name'] == '${{ needs.build-pages.outputs.artifact-name }}'
package = next(s for s in jobs['build-pages']['steps'] if s.get('id') == 'package')
assert 'artifact-name=github-pages-$GITHUB_SHA-$GITHUB_RUN_ATTEMPT' in package['run']
assert '>> "$GITHUB_OUTPUT"' in package['run']
assert upload['with']['path'] == '_site'
assert any('git archive "$GITHUB_SHA"' in s.get('run', '') for s in jobs['build-pages']['steps'])
print('PASS: explicit production approval, pinned SHA/artifact, read-only proposals, reviewed data PRs, retired direct writers')
