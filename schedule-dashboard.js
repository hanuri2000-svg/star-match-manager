/* 첫 화면 요약 · 달력과 독립적으로 갱신 */
(function (global) {
  'use strict';
  const PLAYER = '최도랑';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateKey = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  let manualRefreshing=false;
  const syncLabels={idle:'확인 전',loading:'업데이트 중',ok:'정상',cached:'저장된 자료',error:'오류'};
  function syncHtml(){
    const tier=global.HARINA_MASTER_SYNC_STATUS||{status:'idle'};
    const time=timestamp=>timestamp?new Date(timestamp).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'없음';
    const row=(label,state,detail='')=>`<div class="sync-source"><div><b>${label}</b><span class="sync-badge sync-${state.status}">${syncLabels[state.status]||'확인 전'}</span></div><span>마지막 성공 ${esc(time(state.lastSuccess))}</span>${state.status==='error'?`<small class="sync-error">${esc(state.error||'갱신 실패')} · 이전 자료 유지</small>`:detail?`<small>${esc(detail)}</small>`:''}</div>`;
    const busy=manualRefreshing||tier.status==='loading';
    const offline=global.navigator?.onLine===false;
    return `<div class="sync-heading"><strong>동기화 상태</strong><button type="button" class="secondary" data-sync-refresh ${busy?'disabled':''}>${busy?'확인 중…':'새로고침'}</button></div><div class="sync-sources">${row('티어표',tier,tier.version?`자료 v${tier.version}${tier.sourceDate?' · '+tier.sourceDate+' 기준':''}`:'선수 DB')}</div>${offline?'<p class="sync-offline">인터넷 연결 없음 · 저장된 자료를 표시해.</p>':''}`;
  }
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
    return card('오늘 일정',`${items.length}개`,agenda,'schedule') +
      card('오늘 전적',stats ? statText(stats.total) : '집계 준비 중',`${PLAYER} · 스폰노트`,'records',`<span class="today-race-list">${races}</span>`) +
      card('전체 기록',`${records.length}경기`,'이 기기에 저장된 스폰일지','records') +
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
    const sync=global.document.querySelector('[data-schedule-sync]');
    if(sync){const content=syncHtml();if(sync._syncContent!==content){sync._syncContent=content;sync.innerHTML=content}}
  }
  function refresh(){ render(); }
  async function refreshAll(){
    if(manualRefreshing||global.HARINA_MASTER_SYNC_STATUS?.status==='loading')return;
    manualRefreshing=true;render();
    try{await Promise.allSettled([Promise.resolve().then(()=>global.HARINA_LOAD_PLAYER_MASTER?.(true))])}
    finally{manualRefreshing=false;render()}
  }
  global.ScheduleDashboard = {render,refresh,refreshAll};
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
    .schedule-sync{padding:10px 14px;border:1px solid #d3bfdc;border-radius:12px;background:#fff;min-width:0;color:#513c60}
    .sync-heading,.sync-source>div{display:flex;align-items:center;justify-content:space-between;gap:10px}.sync-heading strong{font-size:.875rem}.sync-heading button{font-size:.875rem!important;padding:6px 10px!important}.sync-heading button:disabled{opacity:.65;cursor:wait}
    .sync-sources{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;margin-top:8px}.sync-source{display:grid;gap:4px;min-width:0;padding:8px 10px;background:#faf7fc;border-radius:8px}.sync-source b{font-size:.875rem}.sync-source>span,.sync-source small{color:#74647d;font-size:.75rem;line-height:1.4;overflow-wrap:anywhere}
    .sync-badge{font-size:.75rem;padding:3px 7px;border-radius:6px;background:#ece5f2;color:#705982;white-space:nowrap}.sync-ok{background:#e7f5ed;color:#28724e}.sync-loading{background:#e9effd;color:#4468a3}.sync-error{background:#fce9ef;color:#b63d5e}.sync-source small.sync-error{color:#b63d5e;background:transparent}.sync-offline{margin:8px 0 0;color:#b63d5e;font-size:.875rem}
    body.app-fit-screen .today-summary-card{padding:10px!important;gap:4px}
    @media(max-width:900px){.schedule-dashboard{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.today-summary-card{padding:12px!important}.today-summary-card>strong{font-size:1.0625rem}}
  `;
  global.document.head.appendChild(style);
  new MutationObserver(render).observe(global.document.getElementById('app'),{childList:true,subtree:true});
  global.addEventListener('spawn-note:records-changed',render);
  global.addEventListener('harina-player-master-sync',render);
  global.addEventListener('online',()=>{render();refreshAll()});
  global.addEventListener('offline',render);
  global.addEventListener('storage',event=>{if((event.key==='spawnNote.records.v1'||event.key==='my-starlog-spwn-note-v1'))render()});
  global.addEventListener('pageshow',()=>{render();refresh()});
  global.document.addEventListener('visibilitychange',()=>{if(!global.document.hidden){render();refresh()}});
  global.document.addEventListener('click',event=>{
    if(event.target.closest('[data-sync-refresh]')){refreshAll();return;}
    const target=event.target.closest('[data-overview-target]')?.dataset.overviewTarget;
    if(!target || target==='schedule')return;
    const started=Date.now();
    const focus=()=>{
      const host=global.document.querySelector('[data-spwn-native-host]');
      const root=host?.shadowRoot;
      if(root?.querySelector('#recent')){global.SpwnNative?.showTab('dash');if(target==='recent')root.querySelector('#recent').scrollIntoView({behavior:'smooth',block:'center'});return;}
      if(Date.now()-started<8000)setTimeout(focus,100);
    };
    setTimeout(focus,0);
  });
  render();
})(window);
