import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const main = fs.readFileSync(new URL("index.html", root), "utf8");
const prediction = fs.readFileSync(new URL("prediction-native.js", root), "utf8");

test("통합페이지가 버전 배지를 두 코드에서 반복 변경하지 않는다", () => {
  assert.doesNotMatch(prediction, /syncReleaseVersion|app-version-badge|RELEASE_VERSION/);
  assert.match(main, /const RELEASE_VERSION='5\.16\.6'/);
});

test("초기 HTML은 인라인 이미지 없이 가볍게 유지한다", () => {
  assert.ok(Buffer.byteLength(main) < 300_000, "index.html should stay below 300 KB");
  assert.doesNotMatch(main, /data:image\//);
  assert.match(main, /dorang-header-character\.webp/);
  assert.match(main, /dorang-sleeping-cat\.webp/);
  assert.match(main, /harina-signature\.webp/);
});

test("무거운 탭 모듈은 첫 화면 파싱을 막지 않는다", () => {
  assert.match(main, /<script async src="\.\/spwn-native\.js\?v=5\.16\.6"><\/script>/);
  assert.match(main, /<script async src="\.\/prediction-native\.js\?v=5\.16\.6"><\/script>/);
  assert.match(main, /window\.__appBootReady=true/);
});

test("최적화 이미지 용량을 제한한다", () => {
  const maxBytes = {
    "harina-signature.webp": 60_000,
    "dorang-header-character.webp": 30_000,
    "dorang-sleeping-cat.webp": 35_000,
  };
  for (const [file, limit] of Object.entries(maxBytes)) {
    assert.ok(fs.statSync(new URL(file, root)).size < limit, `${file} should stay below ${limit} bytes`);
  }
});
