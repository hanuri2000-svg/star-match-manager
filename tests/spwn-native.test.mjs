import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('integrated sponsor tab loads the same-origin Starlog app',()=>{
 assert.match(read('index.html'),/starlog-embed\.js\?v=/);
 assert.match(read('starlog-embed.js'),/frame.src = '\.\/starlog\/index.html/);
 assert.doesNotMatch(read('index.html'),/<script[^>]+src="\.\/spwn-native/);
 assert.match(read('starlog/app.js'),/my-starlog-spwn-note-v1/);
 assert.match(read('starlog/app.js'),/autoMigrateLegacy\(\)/);
 assert.match(read('starlog/index.html'),/id="nameGuide"/);
 assert.match(read('starlog/app.js'),/nameGreeting/);
 assert.doesNotMatch(read('starlog/app.js'),/api\/elo|spawn-note-elo-relay/);
});
