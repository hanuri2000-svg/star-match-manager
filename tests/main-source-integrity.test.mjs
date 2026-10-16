import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const html = fs.readFileSync(new URL('index.html', root), 'utf8');

test('main HTML starts in standards mode and contains no truncated tool output', () => {
  assert.match(html, /^<!doctype html>/i);
  assert.doesNotMatch(html, /Warning: truncated output|Total output lines:|\d+ tokens truncated/);
  for (const anchor of ['id="app"', 'function render()', 'party-image-save', 'renderBeforeViewportFit', 'window.__appBootReady=true']) {
    assert.ok(html.includes(anchor), `Missing complete application section: ${anchor}`);
  }
});

test('every inline script and local script dependency parses completely', () => {
  let inlineCount = 0;
  for (const [, attributes, source] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const src = attributes.match(/\bsrc=["']([^"']+)["']/)?.[1];
    if (src) {
      assert.ok(src.startsWith('./'), `Unexpected script dependency: ${src}`);
      const path = src.split('?')[0];
      new vm.Script(fs.readFileSync(new URL(path, root), 'utf8'), {filename: path});
    } else if (source.trim()) {
      new vm.Script(source, {filename: `index.html:inline-${++inlineCount}`});
    }
  }
  assert.ok(inlineCount >= 5, 'Main application script blocks must not disappear');
});

test('navigation can scroll and short desktop windows use document scrolling', () => {
  assert.match(html, /#app > \.app-tabs\{[^}]*overflow-x:auto/);
  assert.match(html, /#app > \.app-tabs button\{[^}]*white-space:nowrap/);
  assert.match(html, /@media\(min-width:961px\) and \(max-height:700px\)\{\s*html,body\{height:auto!important;overflow:auto!important\}\s*body\.app-fit-screen #app\{height:auto;max-height:none;min-height:100svh;overflow:visible\}/);
});
