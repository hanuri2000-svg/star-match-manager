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
assert events['workflow_run']['types'] == ['completed']
assert events['workflow_run']['branches'] == ['main']
writers = []
for path in (ROOT / '.github/workflows').glob('*.yml'):
    other = yaml.safe_load(path.read_text())
    if path.name != 'regression-tests.yml':
        writers.append(other['name'])
        # No second Pages publisher may appear outside the gated workflow.
        assert 'deploy-pages@' not in path.read_text()
        assert other.get('permissions', {}).get('pages') != 'write'
assert set(events['workflow_run']['workflows']) == set(writers)

for name, job in jobs.items():
    assert not job.get('continue-on-error')
    for step in job['steps']:
        assert not step.get('continue-on-error')
        if step.get('uses', '').startswith('actions/checkout@'):
            assert step['with']['ref'] == '${{ github.sha }}', name
            assert step['with']['persist-credentials'] is False
assert any(s.get('run') == 'node --test tests/*.test.mjs' for s in jobs['test']['steps'])
assert any('python tests/pages-workflow.py' in s.get('run', '') for s in jobs['test']['steps'])
browser_commands = '\n'.join(s.get('run', '') for s in jobs['browser-smoke']['steps'])
assert 'python tests/tier-profile-browser.py' in browser_commands
assert 'python tests/browser-smoke.py' in browser_commands
assert 'chromium webkit' in browser_commands

assert set(jobs['build-pages']['needs']) == {'test', 'browser-smoke'}
assert set(jobs['deploy-pages']['needs']) == {'test', 'browser-smoke', 'build-pages'}
for name in ['build-pages', 'deploy-pages']:
    job = jobs[name]
    assert "github.ref == 'refs/heads/main'" in job['if']
    assert "github.event_name != 'pull_request'" in job['if']
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
print('PASS: parsed workflow — required checks, pinned SHA/artifact, serialized guarded deployment, bot update coverage')
