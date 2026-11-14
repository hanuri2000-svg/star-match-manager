/* Read-only shared tier board. Match history and the player master are never written here. */
(() => {
  'use strict';
  const MASTER = 'https://hanuri2000-svg.github.io/star-match-manager/players.json';
  const CHANNEL = id => `https://api-channel.sooplive.co.kr/v1.1/channel/${encodeURIComponent(id)}/home/section/broad`;
  const POLL_MS = 180000;
  const PREVIEW_DELAY_MS = 450;
  // The two Tank profiles share an unresolved channel attribution; neither is inferred LIVE.
  const AMBIGUOUS_ELO_IDS = new Set([170, 6312]);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const state = {payload:null, loading:null, liveOnly:false, tierFilter:'all', live:new Map(), pending:false, checked:0, errors:0, total:0, lastChecked:0, generation:0, liveError:false};
  const manager = typeof window.HARINA_LOAD_PLAYER_MASTER === 'function';
  let host, preview, previewTimer, previewCloseTimer;

  function closePreview(){
    clearTimeout(previewTimer);clearTimeout(previewCloseTimer);
    previewTimer=previewCloseTimer=null;
    preview?.remove();preview=null;
  }
  function deferClose(){clearTimeout(previewTimer);clearTimeout(previewCloseTimer);previewCloseTimer=setTimeout(closePreview,220)}
  function showPreview(row){
    if(!row?.isConnected || !active() || document.hidden)return;
    const id=row.dataset.liveId, number=state.live.get(id);
    if(!/^[a-z0-9_]{2,40}$/.test(id||'') || !Number.isSafeInteger(Number(number)) || Number(number)<=0)return;
    closePreview();
    const name=row.querySelector('a[href^="https://eloboard.com/players/"]')?.textContent || '방송';
    const channel=`https://play.sooplive.co.kr/${encodeURIComponent(id)}/${number}`;
    preview=document.createElement('aside');
    preview.className='shared-tier-preview';preview.dataset.liveId=id;preview.setAttribute('role','dialog');preview.setAttribute('aria-label',`${name} 방송 미리보기`);
    preview.innerHTML=`<div class="shared-tier-preview-head"><strong>${esc(name)} · LIVE</strong><button type="button" data-preview-close aria-label="미리보기 닫기">×</button></div><div class="shared-tier-preview-video"><iframe title="${esc(name)} 방송 미리보기" src="${channel}/embed?autoPlay=true&mutePlay=true" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe></div><a href="${channel}" target="_blank" rel="noopener noreferrer">SOOP에서 방송 보기 ↗</a>`;
    document.body.append(preview);
    const width=preview.getBoundingClientRect().width, height=preview.getBoundingClientRect().height, rect=row.getBoundingClientRect();
    preview.style.left=`${Math.max(12,Math.min(window.innerWidth-width-12,rect.left))}px`;
    preview.style.top=`${Math.max(12,rect.bottom+height+12<window.innerHeight?rect.bottom+8:rect.top-height-8)}px`;
    preview.addEventListener('pointerenter',()=>clearTimeout(previewCloseTimer));
    preview.addEventListener('pointerleave',deferClose);
  }

  function active(){return manager ? window.s?.activeTab === 'tiers' || (typeof s !== 'undefined' && s.activeTab === 'tiers') : location.hash === '#tiers'}
  function players(){return (state.payload?.players || []).filter(p => p && p.active !== false && p.name && Number.isSafeInteger(p.eloId))}
  function tierName(p){return p.tierLabel || (p.tier === '유스' ? '베이비' : p.tier) || '미지정'}
  function draw(){
    if(!host || !active())return;
    closePreview();
    const all = players(), visible = state.liveOnly && state.lastChecked ? all.filter(p => !AMBIGUOUS_ELO_IDS.has(p.eloId) && state.live.has(String(p.soopId || '').toLowerCase())) : all;
    const order = state.payload?.tierOrder || [];
    const counts = new Map();
    for(const p of all){const name=tierName(p);counts.set(name,(counts.get(name)||0)+1)}
    const groups = new Map();
    for(const p of visible){const name=tierName(p);if(!groups.has(name))groups.set(name,[]);groups.get(name).push(p)}
    const tierTabs = [...order.map(t => t === '유스' ? '베이비' : t), ...counts.keys()].filter((v,i,a) => a.indexOf(v) === i && counts.has(v));
    const tiers = tierTabs.filter(t => groups.has(t) && (state.tierFilter === 'all' || state.tierFilter === t));
    const status = state.pending ? `방송 상태 확인 중 ${state.checked}/${state.total} · 전체 티어표를 표시하고 있어` : state.liveError ? '방송 상태 조회에 실패해서 전체 티어표를 표시하고 있어 · 라이브 보기를 눌러 다시 시도해줘' : state.liveOnly && state.lastChecked ? `방송 확인 ${new Date(state.lastChecked).toLocaleTimeString('ko-KR')} · LIVE ${visible.length}명${state.errors ? ` · ${state.errors}개 채널 미확인` : ''}` : `${all.length}명 · 공통 선수 DB 기준`;
    host.innerHTML = `<div class="shared-tier-head"><div><h2>티어표</h2><p>${esc(status)}</p></div><div class="shared-tier-actions"><button type="button" data-tier-all aria-pressed="${!state.liveOnly}">전체 보기</button><button type="button" data-tier-live aria-pressed="${state.liveOnly}">${state.pending ? 'LIVE 확인 중…' : '라이브 보기'}</button></div></div>${state.payload ? `<nav class="shared-tier-filters" aria-label="티어별 보기"><button type="button" data-tier-filter="all" aria-pressed="${state.tierFilter==='all'}">전체 <small>${all.length}</small></button>${tierTabs.map(t=>`<button type="button" data-tier-filter="${esc(t)}" aria-pressed="${state.tierFilter===t}">${esc(t)} <small>${counts.get(t)}</small></button>`).join('')}</nav>` : ''}${!state.payload ? '<p class="shared-tier-empty">공통 선수 DB를 불러오는 중…</p>' : state.liveOnly && !state.pending && !visible.length ? '<p class="shared-tier-empty">지금 확인된 LIVE 선수가 없어. 방송주소 미등록 또는 조회 실패 선수는 포함되지 않아.</p>' : state.tierFilter !== 'all' && !tiers.length ? '<p class="shared-tier-empty">이 티어에서 확인된 LIVE 선수가 없어.</p>' : ''}<div class="shared-tier-grid">${tiers.map(t => `<section class="shared-tier-group"><h3>${esc(t)} <small>${groups.get(t).length}명</small></h3><div class="shared-tier-players">${groups.get(t).map(p => {const id=String(p.soopId||'').toLowerCase(),live=state.live.get(id),canPreview=live && !AMBIGUOUS_ELO_IDS.has(p.eloId) && /^[a-z0-9_]{2,40}$/.test(id);return `<div class="shared-tier-player"${canPreview ? ` data-live-id="${esc(id)}"` : ''}><span class="shared-tier-race race-${['T','P','Z'].includes(p.race)?p.race:'unknown'}">${esc(p.race||'?')}</span><a href="https://eloboard.com/players/${p.eloId}" target="_blank" rel="noopener noreferrer">${esc(p.name)}</a>${canPreview ? `<button type="button" class="shared-tier-preview-trigger" aria-label="${esc(p.name)} 방송 미리보기">미리보기</button><a class="shared-tier-live" href="https://ch.sooplive.co.kr/${encodeURIComponent(id)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(p.name)} 방송 채널">● LIVE</a>` : ''}</div>`}).join('')}</div></section>`).join('')}</div>${state.payload ? '<p class="shared-tier-foot">방송주소가 등록된 선수만 조회해. 확인할 수 없는 상태는 LIVE로 표시하지 않아. LIVE 선수에 마우스를 올리거나 미리보기를 눌러봐.</p>' : ''}`;
  }
  async function load(){
    if(state.loading)return state.loading;
    state.loading=(async()=>{try{const res=await fetch(MASTER,{cache:'no-store'});if(!res.ok)throw Error('DB');const payload=await res.json();if(!Array.isArray(payload.players)||!payload.players.length)throw Error('DB');state.payload=payload;draw();if(state.liveOnly)checkLive()}catch{if(host)host.innerHTML='<p class="shared-tier-empty">선수 DB를 읽지 못했어. 잠시 뒤 다시 열어줘.</p>'}finally{state.loading=null}})();
    return state.loading;
  }
  async function checkLive(){
    if(state.pending || !active() || !state.liveOnly || !state.payload || document.hidden)return;
    const ids=[...new Set(players().filter(p=>!AMBIGUOUS_ELO_IDS.has(p.eloId)).map(p=>String(p.soopId||'').trim().toLowerCase()).filter(id=>/^[a-z0-9_]{2,40}$/.test(id)))];
    const generation=++state.generation, results=new Map();
    state.pending=true;state.checked=0;state.errors=0;state.total=ids.length;draw();
    let cursor=0,errors=0,checked=0;
    async function worker(){while(cursor<ids.length && generation===state.generation){const id=ids[cursor++];try{const response=await fetch(CHANNEL(id),{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('channel');const body=await response.text();const data=body.trim()?JSON.parse(body):{};if(Number(data.broadNo)>0 && String(data.userId||'').toLowerCase()===id)results.set(id,data.broadNo)}catch{errors++}finally{checked++;if(generation===state.generation){state.checked=checked;state.errors=errors;if(checked%15===0)draw()}}}}
    await Promise.all(Array.from({length:Math.min(8,ids.length)},worker));
    if(generation!==state.generation)return;
    state.pending=false;state.errors=errors;
    if(state.errors===ids.length && ids.length){state.liveOnly=false;state.liveError=true;state.lastChecked=0;state.live.clear();draw();return}
    state.liveError=false;state.live=results;state.lastChecked=Date.now();draw();
  }
  function mount(node){host=node;host.classList.add('shared-tier-board');draw();if(!state.payload)load();else if(state.liveOnly && (!state.lastChecked || Date.now()-state.lastChecked>POLL_MS))checkLive()}
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-preview-close]')){closePreview();return}
    const trigger=event.target.closest('.shared-tier-preview-trigger');
    if(trigger && host?.contains(trigger)){const row=trigger.closest('[data-live-id]');if(preview && preview.dataset.liveId===row?.dataset.liveId)closePreview();else showPreview(row);return}
    if(event.target.closest('[data-tier-all]')){state.liveOnly=false;state.liveError=false;state.generation++;state.pending=false;draw()}
    if(event.target.closest('[data-tier-live]')){state.liveOnly=true;state.liveError=false;draw();if(!state.pending)checkLive()}
    const filter=event.target.closest('[data-tier-filter]');
    if(filter && host?.contains(filter) && (filter.dataset.tierFilter==='all' || players().some(p=>tierName(p)===filter.dataset.tierFilter))){state.tierFilter=filter.dataset.tierFilter;draw()}
  });
  document.addEventListener('pointerover',event=>{
    if(event.pointerType==='touch')return;
    const row=event.target.closest?.('.shared-tier-player[data-live-id]');
    if(!row || !host?.contains(row) || row.contains(event.relatedTarget))return;
    clearTimeout(previewTimer);clearTimeout(previewCloseTimer);
    if(preview?.dataset.liveId===row.dataset.liveId)return;
    closePreview();previewTimer=setTimeout(()=>showPreview(row),PREVIEW_DELAY_MS);
  });
  document.addEventListener('pointerout',event=>{
    const row=event.target.closest?.('.shared-tier-player[data-live-id]');
    if(row && host?.contains(row) && !row.contains(event.relatedTarget))deferClose();
  });
  document.addEventListener('pointerdown',event=>{if(preview && !preview.contains(event.target) && !event.target.closest?.('.shared-tier-preview-trigger'))closePreview()});
  window.addEventListener('scroll',closePreview,true);window.addEventListener('resize',closePreview);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)closePreview()});
  setInterval(()=>{if(active() && state.liveOnly && !state.pending)checkLive()},POLL_MS);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && active() && state.liveOnly && Date.now()-state.lastChecked>POLL_MS)checkLive()});
  if(manager){
    const original=render;
    render=function(...args){const result=original.apply(this,args);const nav=document.querySelector('.app-tabs');if(!nav)return result;const button=document.createElement('button');button.type='button';button.dataset.act='tab';button.dataset.tab='tiers';button.textContent='티어표';button.classList.toggle('active',s.activeTab==='tiers');nav.insertBefore(button,nav.querySelector('[data-tab="settlement"]'));if(s.activeTab==='tiers'){document.querySelectorAll('#app > .tab-view').forEach(el=>el.style.display='none');const footer=document.querySelector('#app > footer');const wrapper=document.createElement('div');wrapper.className='tab-view';footer.before(wrapper);mount(wrapper)}return result};
    render();
  }else{
    const nav=document.querySelector('#nav');if(nav && !nav.querySelector('[href="#tiers"]'))nav.insertAdjacentHTML('beforeend','<a href="#tiers">♧ <span>티어표</span></a>');
    const section=document.createElement('section');section.id='tiers';section.className='page';document.querySelector('.content')?.append(section);
    function route(){if(!active())return;document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id==='tiers'));document.querySelectorAll('#nav a').forEach(el=>el.classList.toggle('active',el.hash==='#tiers'));const breadcrumb=document.querySelector('#breadcrumb');if(breadcrumb)breadcrumb.innerHTML='나의 작은 기록 공간 <span> / 티어표</span>';mount(section)}
    window.addEventListener('hashchange',()=>setTimeout(route,0));route();
  }
})();
