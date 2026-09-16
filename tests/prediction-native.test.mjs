import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const main = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const moduleSource = fs.readFileSync(new URL("../prediction-native.js", import.meta.url), "utf8");

test("맞혀도랑은 iframe 없이 통합 모듈로 열린다", () => {
  assert.match(main, /data-prediction-native-host/);
  assert.match(main, /prediction-native\.js\?v=5\.15\.0/);
  assert.doesNotMatch(main, /class="prediction-frame"/);
  assert.doesNotMatch(main, /star-prediction\/\?embed=1/);
});

test("기존 맞혀도랑 저장 키와 전체 기능을 유지한다", () => {
  assert.match(moduleSource, /starPredictionManager_v31/);
  for (const feature of [
    "openParticipants",
    "openEventSettings",
    "openSchedule",
    "openNewMatch",
    "saveSchedule",
    "exportData",
    "restoreData",
  ]) {
    assert.match(moduleSource, new RegExp(`\\b${feature}\\b`));
  }
  assert.match(moduleSource, /mountPredictionNative/);
  assert.match(moduleSource, /attachShadow\(\{mode:'open'\}\)/);
});

test("통합 선수 DB 자동입력과 통합형 UI를 적용한다", () => {
  assert.match(moduleSource, /star-match-manager\/players\.json/);
  assert.match(moduleSource, /autoPlayerMeta/);
  assert.match(moduleSource, /schedulePlayerInput/);
  assert.doesNotMatch(moduleSource, /checkForUpdate/);
  assert.doesNotMatch(moduleSource, /toggleDesktopMode/);
  assert.doesNotMatch(moduleSource, /navigator\.serviceWorker\.register/);
  assert.doesNotMatch(moduleSource, />업데이트 확인</);
  assert.doesNotMatch(moduleSource, />🖥 PC 화면</);
  assert.doesNotMatch(moduleSource, /const TEMPLATE=.*class=\\"brand-icon/);
});
