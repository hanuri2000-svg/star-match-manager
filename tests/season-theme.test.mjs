import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = path => fs.readFileSync(new URL(path,root),"utf8");
const html = read("index.html");
const version = JSON.parse(read("version.json")).version;
assert.match(version, /^\d+\.\d+\.\d+$/, "version.json에 유효한 앱 버전이 있어야 한다");
const css = read("season-theme.css");
const engine = read("season-theme.js");
const palettesMatch = engine.match(/const PALETTES = Object\.freeze\((\{[\s\S]*?\})\);/);
assert.ok(palettesMatch,"시즌 팔레트 선언은 검증 가능한 JSON 형식이어야 한다");
const palettes = JSON.parse(palettesMatch[1]);
const lum = color => {
  const [r,g,b] = color.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
  return 0.2126*r+0.7152*g+0.0722*b;
};
const contrast = (a,b) => {
  const [x,y] = [lum(a),lum(b)].sort((a,b)=>a-b);
  return (y+0.05)/(x+0.05);
};

test("1월부터 12월까지 테마와 장식이 모두 제공된다",()=>{
  assert.equal(Object.keys(palettes).length,12);
  for(let month=1;month<=12;month++){
    assert.ok(palettes[String(month)],month+"월 누락");
    assert.equal(palettes[String(month)].decor.length,3);
  }
});
test("각 월별 글자·보조글자·버튼의 대비가 WCAG AA 일반 텍스트 4.5:1 이상이다",()=>{
  for(let month=1;month<=12;month++){
    const p=palettes[String(month)];
    const pairs=[["text/panel",p.text,p.panel],["text/bg",p.text,p.bg],["muted/panel",p.muted,p.panel],["text/soft",p.text,p.soft],["button",p.onAccent,p.accent]];
    pairs.forEach(([label,a,b])=>assert.ok(contrast(a,b)>=4.5,month+"월 "+label+" "+contrast(a,b).toFixed(2)));
  }
});
test("KST 월별 전환과 수동/원본 전환을 지원한다",()=>{
  assert.match(engine,/Asia\/Seoul/);
  assert.match(engine,/settings\.mode==="auto"/);
  assert.match(engine,/settings\.mode==="off"/);
  assert.match(engine,/visibilitychange/);
  assert.match(engine,/setInterval\(/);
  assert.match(engine,/dorang-season-theme\.v1/);
});
test("메인 화면과 Shadow DOM 모듈을 모두 연결한다",()=>{
  assert.ok(html.includes(`<link rel="stylesheet" href="./season-theme.css?v=${version}">`), "시즌 CSS 버전 불일치");
  assert.ok(html.includes(`<script src="./season-theme.js?v=${version}"></script>`), "시즌 JS 버전 불일치");
  for(const path of ["spwn-native.js","prediction-native.js"]){
    assert.match(read(path),/applySeasonThemeToShadow\(root\)/,path+" 테마 연결 누락");
  }
  assert.match(css,/body:not\(\.broadcast-only\)/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/\.calendar-day/);
});
test("기존 버전 검사와 초기 가벼운 로딩 구조를 유지한다",()=>{
  assert.equal(html.match(/const APP_VERSION=['"]([^'"]+)['"]/)?.[1],version);
  assert.equal(html.match(/const RELEASE_VERSION=['"]([^'"]+)['"]/)?.[1],version);
  assert.ok(Buffer.byteLength(html)<300000);
  for(const path of ["spwn-native.js","prediction-native.js"]){
    assert.ok(html.includes(`<script async src="./${path}?v=${version}"></script>`),path+" 비동기 로딩 또는 버전 불일치");
  }
});

test("10월 단풍, 12월 크리스마스 테마가 유지된다",()=>{
  assert.equal(palettes["10"].icon,"🍁");
  assert.equal(palettes["10"].dark,false);
  assert.deepEqual(palettes["10"].decor,["🍁","🌰","🍂"]);
  assert.equal(palettes["12"].icon,"🎄");
  assert.deepEqual(palettes["12"].decor,["🎄","❄️","🎁"]);
});

test("3월 새싹과 5월 정원은 명확히 다른 배경과 장식을 제공한다",()=>{
  assert.notEqual(palettes["3"].bg,palettes["5"].bg);
  assert.notEqual(palettes["3"].icon,palettes["5"].icon);
  assert.notDeepEqual(palettes["3"].decor,palettes["5"].decor);
});
test("9~11월의 테마는 각각 황금·단풍·버건디로 차별화한다",()=>{
  assert.equal(palettes["9"].icon,"🌾");
  assert.equal(palettes["10"].icon,"🍁");
  assert.equal(palettes["11"].icon,"🕯️");
  assert.equal(palettes["11"].dark,true);
  assert.notEqual(palettes["9"].bg,palettes["10"].bg);
  assert.notEqual(palettes["10"].bg,palettes["11"].bg);
});
test("오브젝트를 헤더·달력·오늘 요약에 표시하고 탭 리렌더를 감지한다",()=>{
  assert.match(engine,/renderSeasonDecorations\(\)/);
  assert.match(engine,/season-hero-badge/);
  assert.match(engine,/season-calendar-symbol/);
  assert.match(engine,/new MutationObserver\(\(\)=>\{installTrigger\(\);renderSeasonDecorations\(\)\}\)/);
  assert.match(css,/today-summary-card::after/);
  assert.match(css,/season-hero-symbol/);
  assert.match(css,/season-calendar-symbol/);
  assert.match(css,/pointer-events:none/);
});

test('어두운 테마의 주말·공휴일 날짜는 기본/선택 배경에서 4.5:1 대비를 유지한다',()=>{
  for(const month of ['8','11','12']){
    const p=palettes[month];
    for(const [text,weekend] of [['#ffb9ce','#392b3b'],['#b9dcff','#213e50']]){
      for(const bg of [weekend,p.panel,p.soft])assert.ok(contrast(text,bg)>=4.5,`${month}월 ${text}/${bg}`);
    }
  }
});

test("아이패드 터치 화면에서 헤더 크기와 문서 스크롤을 유지한다",()=>{
  assert.match(html,/#app > \.head,body\.app-fit-screen #app > \.head\{\s*height:auto!important;min-height:142px!important;flex-shrink:0/);
  assert.match(html,/@media\(min-width:961px\) and \(hover:none\) and \(pointer:coarse\)\{\s*html,body\{height:auto!important;overflow:auto!important\}\s*body\.app-fit-screen #app\{height:auto;max-height:none;min-height:100svh;overflow:visible\}/);
});
