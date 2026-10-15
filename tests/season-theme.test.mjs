import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = path => fs.readFileSync(new URL(path,root),"utf8");
const html = read("index.html");
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
  assert.match(html,/season-theme\.css\?v=5\.23\.0/);
  assert.match(html,/season-theme\.js\?v=5\.23\.0/);
  for(const path of ["spwn-native.js","prediction-native.js"]){
    assert.match(read(path),/applySeasonThemeToShadow\(root\)/,path+" 테마 연결 누락");
  }
  assert.match(css,/body:not\(\.broadcast-only\)/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/\.calendar-day/);
});
test("기존 버전 검사와 초기 가벼운 로딩 구조를 유지한다",()=>{
  assert.match(html,/const APP_VERSION='5\.23\.0'/);
  assert.match(html,/const RELEASE_VERSION='5\.23\.0'/);
  assert.ok(Buffer.byteLength(html)<300000);
  assert.match(html,/script async src="\.\/spwn-native\.js\?v=5\.23\.0"/);
  assert.match(html,/script async src="\.\/prediction-native\.js\?v=5\.23\.0"/);
});
