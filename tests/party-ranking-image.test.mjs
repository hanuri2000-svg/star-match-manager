import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const main = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("덕몽 & 폴가이즈 순위 결과를 PNG로 만든다", () => {
  assert.match(main, /id="party-ranking-image-export"/);
  assert.match(main, /data-party-image-save/);
  assert.match(main, /canvas\.width=width/);
  assert.match(main, /width=1080/);
  assert.match(main, /canvas\.toDataURL\('image\/png'\)/);
});

test("아이폰 공유와 저장 대체 경로를 함께 제공한다", () => {
  assert.match(main, /navigator\.canShare/);
  assert.match(main, /navigator\.share/);
  assert.match(main, /이미지를 길게 눌러 사진 앱에 저장/);
  assert.match(main, /downloadPartyImage/);
});

test("결과 이미지에 게임·팀 점수·최종 순위를 포함한다", () => {
  assert.match(main, /순위 결과/);
  assert.match(main, /const totalA=/);
  assert.match(main, /const totalB=/);
  assert.match(main, /rankPartyPlayers/);
  assert.match(main, /하리나 매치룸 · 덕몽 & 폴가이즈/);
});
