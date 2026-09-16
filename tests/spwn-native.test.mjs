import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const main = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const moduleSource = fs.readFileSync(new URL("../spwn-native.js", import.meta.url), "utf8");

test("스폰노트는 iframe 없이 통합 모듈로 열린다", () => {
  assert.match(main, /data-spwn-native-host/);
  assert.match(main, /spwn-native\.js\?v=5\.15\.1/);
  assert.doesNotMatch(main, /src="\.\.\/spwn-note\/\?embed=1/);
});

test("기존 스폰노트 기록 저장 키를 유지한다", () => {
  assert.match(moduleSource, /spawnNote\.records\.v1/);
  assert.match(moduleSource, /spawnNote\.eloPlayer/);
  assert.match(moduleSource, /spawnNote\.rivalPlayer/);
});

test("통합 모듈은 전체 기록 기능과 공용 선수 DB를 유지한다", () => {
  for (const feature of [
    "openForm",
    "openEloDialog",
    "exportJson",
    "importJson",
    "previewElo",
    "autoFillRecordPlayer",
  ]) {
    assert.match(moduleSource, new RegExp(`\\b${feature}\\b`));
  }
  assert.match(moduleSource, /players\.json/);
  assert.match(moduleSource, /mountSpwnNoteNative/);
  assert.match(moduleSource, /attachShadow\(\{mode:'open'\}\)/);
  assert.doesNotMatch(moduleSource, /\.spwn-\.spwn-body/);
  assert.doesNotMatch(moduleSource, /navigator\.serviceWorker\.register/);
});
