import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const renderer=html.slice(html.indexOf('function tierPanel(){'),html.indexOf("document.addEventListener('click',event=>{",html.indexOf('function tierPanel(){')));
function render(soopId, live='') {
  const context=vm.createContext({
    s:{tierLevels:[],tierFilter:'ALL'},window:{},
    TIER_DATA:[{tier:'8티어',players:[{name:'선수',race:'P'}]}],
    PLAYER_META:{'선수':{s:soopId,t:'players/1.jpg'}},
    liveForTierPlayer:()=>live,tierLiveStatus:'확인',tierLiveLoading:false,
    esc:value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')
  });
  return vm.runInContext(renderer+';tierPanel()',context);
}
test('offline profile uses the direct station address in the current tab',()=>{
  const result=render('123rhaxld');
  assert.match(result,/href="https:\/\/www.sooplive.com\/station\/123rhaxld" target="_self"/);
  assert.doesNotMatch(result,/class="native-live"/);
});
test('live profile retains the actual broadcast link',()=>{
  const result=render('123rhaxld','https://play.sooplive.com/123rhaxld/12345');
  assert.match(result,/href="https:\/\/play.sooplive.com\/123rhaxld\/12345" target="_blank"/);
  assert.match(result,/class="native-live"/);
});
for(const id of ['',undefined,'bad/id','"><script>']) {
  test('missing or invalid channel '+String(id)+' renders an explanatory button',()=>{
    const result=render(id);
    assert.match(result,/<button class="native-avatar-link" type="button" data-tier-channel-missing="선수"/);
    assert.doesNotMatch(result,/href="#"/);
    assert.match(result,/방송국 주소 미등록 안내/);
  });
}
