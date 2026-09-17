/* 스폰노트 기록을 스케줄 달력용 일자별 종족 전적으로 집계 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "spawnNote.records.v1";
  const RACE_ORDER = ["Z", "T", "P"];
  const RACE_LABELS = { Z: "저그전", T: "테란전", P: "토스전" };

  function normalizeDate(value) {
    const match = String(value || "").match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if (!match) return "";
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }

  function normalizeRace(value) {
    const race = String(value || "").normalize("NFKC").trim().toLowerCase();
    if (["z", "저그", "zerg"].includes(race)) return "Z";
    if (["t", "테란", "terran"].includes(race)) return "T";
    if (["p", "토스", "프로토스", "protoss"].includes(race)) return "P";
    return "";
  }

  function normalizeResult(value) {
    const result = String(value || "").normalize("NFKC").trim().toLowerCase();
    if (["승", "승리", "w", "win", "won"].includes(result)) return "W";
    if (["패", "패배", "l", "loss", "lose", "lost"].includes(result)) return "L";
    return "";
  }

  function emptyStat() {
    return { games: 0, wins: 0, losses: 0 };
  }

  function summarize(records, date) {
    const dateKey = normalizeDate(date);
    const races = { Z: emptyStat(), T: emptyStat(), P: emptyStat() };

    for (const record of Array.isArray(records) ? records : []) {
      if (normalizeDate(record?.date) !== dateKey) continue;
      const race = normalizeRace(record?.race);
      const result = normalizeResult(record?.result);
      if (!race || !result) continue;
      races[race].games += 1;
      races[race][result === "W" ? "wins" : "losses"] += 1;
    }

    const total = RACE_ORDER.reduce(
      (sum, race) => ({
        games: sum.games + races[race].games,
        wins: sum.wins + races[race].wins,
        losses: sum.losses + races[race].losses,
      }),
      emptyStat(),
    );

    return { date: dateKey, races, total, hasRecords: total.games > 0 };
  }

  function readRecords(storage = global.localStorage) {
    try {
      const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function summarizeStorage(date, storage = global.localStorage) {
    return summarize(readRecords(storage), date);
  }

  const api = {
    STORAGE_KEY,
    RACE_ORDER,
    RACE_LABELS,
    normalizeDate,
    normalizeRace,
    normalizeResult,
    summarize,
    readRecords,
    summarizeStorage,
  };

  global.SpawnScheduleStats = api;
  if (global.document) {
    const style = global.document.createElement("style");
    style.textContent = `
      body.app-fit-screen #app > .tab-view { min-width:0; width:100%; }
      body.app-fit-screen #app > .schedule-view { overflow-x:hidden !important; }
      .schedule-shell,.schedule-main-layout,.schedule-bottom-layout { min-width:0; max-width:100%; }
    `;
    global.document.head.appendChild(style);
    const keepScheduleAtLeft = () => {
      const view = global.document.querySelector(".schedule-view");
      if (view && view.scrollLeft !== 0) view.scrollLeft = 0;
    };
    new MutationObserver(keepScheduleAtLeft).observe(global.document.documentElement,{childList:true,subtree:true});
    global.addEventListener("pageshow",keepScheduleAtLeft);
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
