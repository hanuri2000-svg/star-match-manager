import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const stats = require("../spawn-schedule-stats.js");
const main = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const spwnModule = fs.readFileSync(new URL("../spwn-native.js", import.meta.url), "utf8");

test("선택한 날짜의 스폰 전적을 상대 종족별로 집계한다", () => {
  const result = stats.summarize(
    [
      { date: "2026-09-16", race: "저그", result: "승" },
      { date: "2026.09.16", race: "Zerg", result: "패" },
      { date: "2026-9-16", race: "T", result: "win" },
      { date: "2026-09-16T20:10:00", race: "프로토스", result: "loss" },
      { date: "2026-09-15", race: "저그", result: "승" },
      { date: "2026-09-16", race: "랜덤", result: "승" },
      { date: "2026-09-16", race: "테란", result: "무" },
    ],
    "2026-09-16",
  );

  assert.deepEqual(result.total, { games: 4, wins: 2, losses: 2 });
  assert.deepEqual(result.races.Z, { games: 2, wins: 1, losses: 1 });
  assert.deepEqual(result.races.T, { games: 1, wins: 1, losses: 0 });
  assert.deepEqual(result.races.P, { games: 1, wins: 0, losses: 1 });
  assert.equal(result.hasRecords, true);
});

test("저장 데이터가 없거나 손상돼도 0전으로 안전하게 표시한다", () => {
  const brokenStorage = { getItem: () => "{not-json" };
  const result = stats.summarizeStorage("2026-09-16", brokenStorage);

  assert.deepEqual(result.total, { games: 0, wins: 0, losses: 0 });
  assert.equal(result.hasRecords, false);
});

test("달력과 스폰노트가 같은 저장 키로 자동 갱신된다", () => {
  assert.match(main, /spawn-schedule-stats\.js\?v=5\.15\.0/);
  assert.match(main, /SpawnScheduleStats\?\.summarizeStorage/);
  assert.match(main, /저그전/);
  assert.match(main, /테란전/);
  assert.match(main, /토스전/);
  assert.match(main, /@media\(max-width:560px\).*\.spawn-race-grid\{grid-template-columns:1fr\}/s);
  assert.match(main, /spawn-note:records-changed/);
  assert.match(main, /event\.key==='spawnNote\.records\.v1'/);
  assert.match(spwnModule, /new CustomEvent\("spawn-note:records-changed"/);
});
