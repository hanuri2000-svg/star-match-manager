import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

for(const path of ['index.html','spwn-native.js']){
 test(`${path}: failed lazy image tolerates removal during rerender and shows an attached fallback`,()=>{
  const source=fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
  const handlers=[...source.matchAll(/onerror="([^"]*nextElementSibling[^"]*)"/g)].map(match=>new Function(match[1]));
  assert.ok(handlers.length>0);
  for(const handler of handlers){
   const detached={style:{},nextElementSibling:null};
   assert.doesNotThrow(()=>handler.call(detached));assert.equal(detached.style.display,'none');
   const attached={style:{},nextElementSibling:{style:{display:'none'}}};
   handler.call(attached);assert.equal(attached.nextElementSibling.style.display,'grid');
  }
 });
}
