/* 첫 화면 요약 · 달력과 독립적으로 갱신 */
(function (global) {
  'use strict';
  const PLAYER = '최도랑';
  const CACHE = 'scheduleDashboard.eloSnapshot.v1';
  const SHARED_CACHE = 'spawnNote.eloDashboard.v1';
  const TTL = 5 * 60 * 1000;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const dateKey = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const numeric = value => value !== '' && value != null && Number.isFinite(Number(String(value).replace(/,/g,''))) ? Number(String(value).replace(/,/g,'')) : null;
  const own = read(CACHE);
  const shared = read(SHARED_CACHE);
  let snapshot = own?.player === PLAYER ? own : null;
  if (!snapshot && shared?.player === PLAYER) snapshot = {player:PLAYER,data:shared.data,checkedAt:0,delta:null};
  let loading = false, error = '', lastAttempt = 0;
  const statText = stat => `${stat.games}전 ${stat.wins}승 ${stat.losses}패`;
  function card(label, value, detail, action, extra = '') {
    return `<button type="button" class="today-summary-card" data-act="${action==='schedule'?'schedule-today':'tab'}" ${action!=='schedule'?'data-tab="spwn"':''} data-overview-target="${action}"><span class="today-summary-label">${label}</span><strong>${value}</strong><span class="today-summary-detail">${detail}</span>${extra}</button>`;
  }
  function html() {
    const now = new Date(), today = dateKey(now);
    const schedules = global.getScheduleDashboardSchedules?.() || [];
    const items = schedules.filter(item => item.date === today);
    const minutes = now.getHours()*60 + now.getMinutes();
    const timed = item => { const m=String(item.time||'').match(/^(\d{1,2}):(\d{2})$/); return m && +m[1]<24 && +m[2]<60 ? +m[1]*60 + +m[2] : null; };
    const pending = items.filter(item => !item.done);
    const next = pending.filter(item => timed(item)!=null && timed(item)>=minutes).sort((a,b)=>timed(a)-timed(b))[0] || pending.find(item=>timed(item)==null);
    const agenda = next ? `${esc(next.time||'시간 미정')} · ${esc(next.title)}` : items.length ? `완료 ${items.filter(item=>item.done).length}개 · 남은 일정 ${pending.length}개` : '등록된 일정 없음';
    const stats = global.SpawnScheduleStats?.summarizeStorage(today,localStorage);
    const races = stats ? ['P','T','Z'].map(race=>`<span><b>${race}전</b> ${statText(stats.races[race])}</span>`).join('') : '';
    const records = global.SpawnScheduleStats?.readRecords(localStorage) || [];
    const last = records.filter(record => global.SpawnScheduleStats?.normalizeDate(record.date) && global.SpawnScheduleStats?.normalizeResult(record.result)).sort((a,b)=>global.SpawnScheduleStats.normalizeDate(b.date).localeCompare(global.SpawnScheduleStats.normalizeDate(a.date)) || Number(b.eloRecordId||b.id||0)-Number(a.eloRecordId||a.id||0))[0];
    const score = numeric(snapshot?.data?.player?.elo);
    const tier = global.HARINA_PLAYER_DIRECTORY?.[PLAYER]?.tier;
    const delta = snapshot?.delta;
    const change = delta == null ? '직전 비교 자료 없음' : delta === 0 ? '직전 확인 대비 변동 없음' : `직전 확인 대비 ${delta>0?'▲':'▼'} ${Number(Math.abs(delta).toFixed(1))}`;
    const checked = snapshot?.checkedAt ? `확인 ${new Date(snapshot.checkedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}` : '저장된 자료';
    const eloState = loading ? '점수 확인 중…' : error ? (score == null ? '조회 실패 · 눌러서 재확인' : `조회 실패 · ${checked} 점수`) : score == null ? 'ELO 확인 전' : checked;
    return card('오늘 일정',`${items.length}개`,agenda,'schedule') +
      card('오늘 전적',stats ? statText(stats.total) : '집계 준비 중',`${PLAYER} · 스폰노트`,'records',`<span class="today-race-list">${races}</span>`) +
      card('현재 ELO',score == null ? '—' : esc(score.toLocaleString('ko-KR')),`${PLAYER}${tier?' · '+esc(tier):''} · ${change}`,'elo',`<span class="today-summary-meta" aria-live="polite">${esc(eloState)}</span>`) +
      card('최근 결과',last ? `<span class="today-result ${global.SpawnScheduleStats.normalizeResult(last.result)==='W'?'win':'loss'}">${global.SpawnScheduleStats.normalizeResult(last.result)==='W'?'승':'패'}</span> vs ${esc(last.opponent||'상대 미상')}` : '기록 없음',last ? `${esc(last.date)} · ${esc(last.map||'맵 미기록')}` : '스폰노트에 경기를 기록해 줘','recent');
  }
  function render() {
    const host = global.document?.querySelector('[data-schedule-dashboard]');
    if (!host) return;
    const content = html();
    if (host._dashboardContent !== content) {
      host._dashboardContent = content;
      host.innerHTML = content;
    }
  }
  async function refresh(force = false) {
    if (loading || (!force && Date.now()-lastAttempt<TTL)) return;
    lastAttempt = Date.now();
    if (!force && snapshot?.checkedAt && Date.now()-snapshot.checkedAt<TTL) return;
    loading = true; error = ''; render();
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(),8000);
    try {
      const base = String(global.SPAWN_NOTE_ELO_API_BASE || 'https://spawn-note-elo-relay.hajimayo8130.workers.dev').replace(/\/$/,'');
      const query = new URLSearchParams({player:PLAYER,today:dateKey()});
      const response = await fetch(`${base}/api/elo/dashboard?${query}`,{signal:controller.signal});
      if (!response.ok) throw new Error('ELO 조회 실패');
      const data = await response.json();
      if (data?.player?.name !== PLAYER || numeric(data.player.elo) == null) throw new Error('ELO 점수 확인 불가');
      const previous = numeric(snapshot?.data?.player?.elo), current = numeric(data.player.elo);
      snapshot = {player:PLAYER,data,checkedAt:Date.now(),delta:previous==null?null:Number((current-previous).toFixed(1))};
      try { localStorage.setItem(CACHE,JSON.stringify(snapshot)); localStorage.setItem(SHARED_CACHE,JSON.stringify({player:PLAYER,data})); } catch {}
    } catch (failure) { error = failure.message; }
    finally { clearTimeout(timeout); loading = false; render(); }
  }
  global.ScheduleDashboard = {render,refresh};
  const style = global.document.createElement('style');
  style.textContent = `
    .schedule-dashboard{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;min-width:0}
    .today-summary-card{display:flex;flex-direction:column;align-items:flex-start;gap:7px;min-width:0;padding:15px!important;text-align:left;background:linear-gradient(155deg,#fff,#faf4ff)!important;border:1.5px solid #d3bfdc!important;border-radius:14px!important;color:#4e3b59!important;box-shadow:0 4px 14px #6545780d!important;white-space:normal;overflow-wrap:anywhere;font:inherit}
    .today-summary-card:hover{border-color:#9c75bb!important}.today-summary-card:focus-visible{outline:3px solid #9368ca;outline-offset:2px}
    .today-summary-label{font-size:.875rem;font-weight:750;color:#755580}
    .today-summary-card>strong{font-size:1.25rem;line-height:1.35;color:#513c60}
    .today-summary-detail{font-size:.875rem;line-height:1.45;color:#74647d}
    .today-summary-meta{font-size:.75rem;color:#85718e;margin-top:auto}
    .today-race-list{display:flex;flex-wrap:wrap;gap:3px 9px;font-size:.75rem;line-height:1.5;color:#6d5878}.today-race-list>span{white-space:nowrap}
    .today-result{color:#328258}.today-result.loss{color:#c44869}
    body.app-fit-screen .today-summary-card{padding:10px!important;gap:4px}
    @media(max-width:900px){.schedule-dashboard{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.today-summary-card{padding:12px!important}.today-summary-card>strong{font-size:1.0625rem}}
  `;
  global.document.head.appendChild(style);
  new MutationObserver(render).observe(global.document.getElementById('app'),{childList:true,subtree:true});
  global.addEventListener('spawn-note:records-changed',render);
  global.addEventListener('spawn-note:dashboard-changed',event=>{
    const {player,data}=event.detail||{};
    if(player!==PLAYER || numeric(data?.player?.elo)==null)return;
    const previous=numeric(snapshot?.data?.player?.elo),current=numeric(data.player.elo);
    snapshot={player:PLAYER,data,checkedAt:Date.now(),delta:previous==null?null:Number((current-previous).toFixed(1))};
    error='';
    try{localStorage.setItem(CACHE,JSON.stringify(snapshot))}catch{}
    render();
  });
  global.addEventListener('storage',event=>{if(event.key==='spawnNote.records.v1')render()});
  global.addEventListener('pageshow',()=>{render();refresh()});
  global.document.addEventListener('visibilitychange',()=>{if(!global.document.hidden){render();refresh()}});
  global.document.addEventListener('click',event=>{
    const target=event.target.closest('[data-overview-target]')?.dataset.overviewTarget;
    if(!target || target==='schedule')return;
    const started=Date.now();
    const focus=()=>{
      const host=global.document.querySelector('[data-spwn-native-host]');
      const root=host?.shadowRoot;
      if(root?.querySelector('#recent')){global.SpwnNative?.showTab('dash');if(target==='recent')root.querySelector('#recent').scrollIntoView({behavior:'smooth',block:'center'});else if(target==='elo')root.querySelector('#basePlayerStatus')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
      if(Date.now()-started<8000)setTimeout(focus,100);
    };
    setTimeout(focus,0);
  });
  render();refresh();
})(window);
