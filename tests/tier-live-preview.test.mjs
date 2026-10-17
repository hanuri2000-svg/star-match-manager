import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const html = read('index.html');
const js = read('tier-live-preview.js');
const css = read('tier-live-preview.css');
const version = JSON.parse(read('version.json')).version;

test('new preview assets are version-pinned in the main page', () => {
  assert.ok(html.includes('<link rel="stylesheet" href="./tier-live-preview.css?v=' + version + '">'));
  assert.ok(html.includes('<script src="./tier-live-preview.js?v=' + version + '"></script>'));
  new vm.Script(js, {filename:'tier-live-preview.js'});
});
test('preview stays limited to the existing LIVE links with delayed loading', () => {
  assert.match(js, /classList\.contains\('native-live'\)/);
  assert.match(js, /const delayMs = 450/);
  assert.match(js, /pointerover/);
  assert.match(js, /pointerout/);
  assert.match(js, /video\.replaceChildren\(\)/);
  assert.match(js, /if \(!touchMode\) return/);
});
test('only trusted SOOP iframe origins are accepted, and the viewer is muted', () => {
  assert.match(js, /url\.protocol !== 'https:'/);
  assert.match(js, /allowed\.includes\(url\.hostname\.toLowerCase\(\)\)/);
  assert.match(js, /\/embed\?autoPlay=true&mutePlay=true&showChat=false/);
  assert.match(js, /event\.preventDefault\(\)/);
  assert.match(css, /tier-live-preview\[hidden\]/);
  assert.match(css, /max-width: 560px/);
});

test('live preview remains compatible with the two-row profile card layout', () => {
  const layout = read('tier-player-layout.css');
  assert.ok(html.includes('<link rel="stylesheet" href="./tier-player-layout.css?v=' + version + '">'));
  assert.match(html, /class="native-tier-identity"/);
  assert.match(html, /\$\{live\?'is-live':''\}/);
  assert.match(layout, /grid-template-columns: 72px minmax\(0, 1fr\) !important/);
  assert.match(layout, /grid-row: 1 \/ span 2 !important/);
  assert.match(layout, /grid-row: 2 !important/);
  assert.match(layout, /grid-template-columns: minmax\(0, 1fr\) !important/);
});
