/* Selected-day schedule view. Public games are read-only; private journals stay local. */
(function (global, factory) {
  const api = factory(global);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.SchedulePlayRecords = api;
})(typeof window === 'object' ? window : globalThis, function (global) {
  'use strict';
  const INTERVAL = 12 * 60 * 60 * 1000;
  const EVENT = 'dorang:schedule-play-updated';
  const SITE = 'dorang-integrated';
  const CACHE_KEY = 'starlog-public-elo:v1:' + SITE + ':443:recent';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dayOf = at => new Date(at + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dateOK = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
  const normalizeDate = value => {
    const match=String(value || '').match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:T.*)?$/);
    const day=match ? `${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}` : '';
    return dateOK(day) ? day : '';
  };
  const resultOf = value => ['승','승리','W','WIN','WON'].includes(String(value || '').toUpperCase()) ? 'W' :
    ['패','패배','L','LOSS','LOSE','LOST'].includes(String(value || '').toUpperCase()) ? 'L' : '';
  const raceOf = value => ({Z:'Z',저그:'Z',ZERG:'Z',T:'T',테란:'T',TERRAN:'T',P:'P',토스:'P',프로토스:'P',PROTOSS:'P'})[String(value || '').toUpperCase()] || 'R';
  function validSnapshot(data) {
    const at = Date.parse(data?.fetchedAt);
    return data?.schemaVersion === 1 && Number(data.playerId) === 443 && Number.isFinite(at) &&
      typeof data.complete === 'boolean' && Array.isArray(data.matches) && data.matches.length <= 50 &&
      data.matches.every((row, i) => row && Number.isSafeInteger(Number(row.id)) && Number(row.id) > 0 &&
        Number.isSafeInteger(Number(row.opponentId)) && Number(row.opponentId) > 0 && Number(row.opponentId) !== 443 &&
        typeof row.opponent === 'string' && dateOK(row.date) && row.date <= dayOf(at) && ['W','L'].includes(row.result) &&
        (!i || row.date <= data.matches[i - 1].date)) &&
      new Set(data.matches.map(row => String(row.id))).size === data.matches.length;
  }
  const empty = () => ({games:0,wins:0,losses:0});
  function summarizeDay(records, date, snapshot, options = {}) {
    const now = options.now ?? Date.now();
    date = normalizeDate(date);
    const valid = validSnapshot(snapshot) && Date.parse(snapshot.fetchedAt) <= now;
    const manual = (Array.isArray(records) ? records : []).filter(row => row && normalizeDate(row.date) && resultOf(row.result))
      .map(row => ({...row,date:normalizeDate(row.date),result:resultOf(row.result)}));
    // Official totals already contain many manually logged sponsored/CK games.
    // Match the main statistics policy: only unlinked manual ladder games are additive.
    const extra = valid ? manual.filter(row => row.type === '래더' && row.source !== 'eloboard' && !row.eloRecordId && !row.eloMatchId) : manual;
    const automatic = valid ? snapshot.matches.filter(row => row.date === date) : [];
    const local = extra.filter(row => row.date === date);
    const rows = automatic.concat(local);
    const races = {Z:empty(),T:empty(),P:empty(),R:empty()}, total = empty();
    for (const row of rows) {
      const result = resultOf(row.result), race = raceOf(row.race), field = result === 'W' ? 'wins' : 'losses';
      total.games++; total[field]++; races[race].games++; races[race][field]++;
    }
    const oldest = valid ? snapshot.matches.at(-1)?.date : '';
    // The API request is always limit=50. A complete shorter list is full history;
    // otherwise the oldest boundary day may have more games outside the window.
    const wholeHistory = valid && snapshot.complete && snapshot.matches.length < 50;
    const complete = Boolean(valid && dateOK(date) && date <= dayOf(Date.parse(snapshot.fetchedAt)) &&
      snapshot.complete && (wholeHistory || (oldest && date > oldest)));
    const stale = valid && (Boolean(snapshot.stale || options.stale || options.error) || now - Date.parse(snapshot.fetchedAt) >= INTERVAL);
    return {date,races,total,hasRecords:total.games > 0,records:rows,complete,remoteAvailable:valid,
      officialGames:automatic.length,ladderGames:local.filter(row => row.type === '래더').length,
      loading:Boolean(options.loading),error:Boolean(options.error),stale,fetchedAt:valid ? snapshot.fetchedAt : '',
      warning:valid && typeof snapshot.warning === 'string' ? snapshot.warning : ''};
  }
  function recordText(stats) {
    return (stats.complete === false && stats.remoteAvailable ? '확인분 ' : '') +
      `${stats.total.games}전 ${stats.total.wins}승 ${stats.total.losses}패`;
  }
  function panelHTML(stats, isToday) {
    let badge = stats.hasRecords ? recordText(stats) : stats.complete ? '0전 0승 0패' :
      stats.loading ? '확인 중' : stats.remoteAvailable ? '확인 범위 밖' : '연동 확인 필요';
    let note = stats.remoteAvailable ? '최도랑 연동 전적 + 직접 기록한 래더 · 12시간 간격 자동 확인' :
      '연동 전적 확인 전에는 직접 기록만 표시해. 전체 전적으로 확정하지 않아.';
    if (stats.remoteAvailable && !stats.complete) note += ' · 최근 50경기 중 확인된 기록이며, 이 날짜의 전체 전적은 확인되지 않았어.';
    if (stats.stale) note += ' · 마지막 확인 자료';
    if (stats.fetchedAt) note += ' · ' + new Date(stats.fetchedAt).toLocaleString('ko-KR', {
      timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) + ' 확인';
    const kinds = [['Z','저그전','🐜'],['T','테란전','👽'],['P','토스전','⚔️']];
    if (stats.races.R.games) kinds.push(['R','랜덤 / 모름','🎲']);
    return `<div class="spawn-day-summary ${stats.hasRecords?'has-records':'no-records'}" data-schedule-play-summary>` +
      `<div class="spawn-day-head"><div><span>MY STARLOG</span><b>🎮 ${isToday?'오늘':'이날'} 플레이 전적</b></div><strong>${esc(badge)}</strong></div>` +
      (stats.hasRecords ? '<div class="spawn-race-grid">' + kinds.map(([race,label,icon]) => {
        const row=stats.races[race];return `<div class="spawn-race-card race-${race}"><span>${icon} ${label}</span><b>${row.games}전 ${row.wins}승 ${row.losses}패</b></div>`;
      }).join('') + '</div>' : `<p>${stats.complete?'선택한 날짜에 확인된 경기가 없어.':stats.loading?'최도랑의 연동 경기 기록을 확인하고 있어.':'이 날짜의 연동 전적은 아직 확인하지 못했어.'}</p>`) +
      `<small style="display:block;line-height:1.6;white-space:normal">${esc(note)}</small>` +
      `<button type="button" class="secondary" data-schedule-play-refresh ${stats.loading?'disabled':''} style="margin-top:8px;padding:6px 10px;font-size:11px">${stats.loading?'전적 확인 중…':'↻ 전적 다시 확인'}</button></div>`;
  }
  function createModel({client, readRecords, onChange = () => {}, now = Date.now}) {
    let result = null, loading = false, error = false, pending = null;
    function peek() {
      try { result = client.peek('recent',443) || result; } catch {}
      return result;
    }
    function summarize(date) {
      let local = []; try { local = readRecords(); } catch {}
      const entry = peek();
      return summarizeDay(local,date,entry?.data,{now:now(),stale:entry?.stale,loading,error:error || entry?.error});
    }
    function refresh(force = false) {
      if (pending) return pending;
      loading = true; error = false;
      pending = Promise.resolve().then(() => client.get('recent',443,null,force)).then(next => {
        result = next; error = Boolean(next.error); return next;
      }).catch(() => {error = true;}).finally(() => {loading=false;pending=null;onChange();});
      onChange();
      return pending;
    }
    return {summarize,refresh};
  }
  let model=null,clientPromise=null,attemptedAt=null,starting=false,bootError=false;
  const notify = () => global.dispatchEvent(new CustomEvent(EVENT));
  function localRecords(storage) {
    return global.SpawnScheduleStats?.readRecords(storage) || [];
  }
  function savedSnapshot(storage) {
    try {
      const entry=JSON.parse(storage.getItem(CACHE_KEY)||'null');
      return entry?.site===SITE && entry.kind==='recent' && Number(entry.playerId)===443 && !entry.opponentId && validSnapshot(entry.data) ? entry : null;
    } catch { return null; }
  }
  function summarizeStorage(date,storage=global.localStorage) {
    if(model && storage===global.localStorage)return model.summarize(date);
    const entry=savedSnapshot(storage);
    return summarizeDay(localRecords(storage),date,entry?.data,{stale:entry?.stale,loading:starting,error:bootError});
  }
  const recordsForDate = (date,storage=global.localStorage) => summarizeStorage(date,storage).records;
  async function loadClient() {
    if (!clientPromise) clientPromise = (async () => {
      if (!global.StarlogElo) await new Promise((resolve,reject) => {
        const script=global.document.createElement('script');
        script.src='./starlog/elo-public.js?v=2.0.20';
        script.onload=resolve;script.onerror=()=>reject(new Error('전적 조회 모듈을 불러오지 못했어.'));
        global.document.head.appendChild(script);
      });
      if(!global.StarlogElo?.createClient)throw new Error('전적 조회 모듈을 확인해 줘.');
      return global.StarlogElo.createClient({site:SITE});
    })().catch(error => {clientPromise=null;throw error;});
    return clientPromise;
  }
  async function ensure(force=false) {
    const view=global.document.querySelector('.schedule-view');
    if (!view?.getClientRects().length || !global.SpawnScheduleStats || global.document.visibilityState==='hidden' || starting) return;
    if (!force && attemptedAt!==null && Date.now()>=attemptedAt && Date.now()-attemptedAt<INTERVAL) return;
    attemptedAt=Date.now();starting=true;bootError=false;notify();
    try {
      if(!model)model=createModel({client:await loadClient(),readRecords:()=>localRecords(global.localStorage),onChange:notify});
      const entry=await model.refresh(force);
      // Reusing a cache must not restart its 12-hour freshness window.
      if(entry && !entry.error && !entry.stale && Number.isFinite(entry.checkedAt) &&
        entry.checkedAt<=Date.now() && Date.now()-entry.checkedAt<INTERVAL)attemptedAt=entry.checkedAt;
    } catch {bootError=true;} finally {starting=false;notify();}
  }
  if(global.document) {
    let queued=false;
    const queue=()=>{if(queued)return;queued=true;global.setTimeout(()=>{queued=false;ensure();},0);};
    new MutationObserver(queue).observe(global.document.documentElement,{childList:true,subtree:true});
    global.document.addEventListener('click',event=>{
      if(event.target.closest('[data-schedule-play-refresh]'))ensure(true);
    });
    global.addEventListener('storage',event=>{
      if([CACHE_KEY,CACHE_KEY+':attempt','my-starlog-dorang-v1','my-starlog-spwn-note-v1','spawnNote.records.v1',null].includes(event.key)){notify();queue();}
    });
    global.addEventListener('focus',queue);
    global.addEventListener('pageshow',queue);
    global.document.addEventListener('visibilitychange',queue);
    global.setInterval(queue,60000);
    queue();
  }
  return {summarizeDay,summarizeStorage,recordsForDate,recordText,panelHTML,createModel,validSnapshot,INTERVAL,EVENT};
});
