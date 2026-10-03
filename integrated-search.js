/* 저장된 일정·선수·전적과 통합페이지 메뉴 검색 */
(function(global){
  'use strict';
  const LABELS={all:'전체',schedule:'일정',player:'선수',record:'스폰 전적',prediction:'맞혀도랑',match:'대진',menu:'메뉴'};
  const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[\s./:\-]+/g,'');
  const initials=value=>Array.from(String(value??'')).map(char=>{const n=char.charCodeAt(0)-0xac00;return n>=0&&n<11172?'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'[Math.floor(n/588)]:char}).join('');
  const list=value=>Array.isArray(value)?value.filter(item=>item&&typeof item==='object'):[];
  const text=(...values)=>values.filter(value=>value!=null&&value!=='').join(' · ');
  const race=value=>({P:'프로토스',T:'테란',Z:'저그',R:'랜덤'}[value]||value||'');
  function buildIndex({main={},players=[],records=[],prediction={}}={}){
    main=main&&typeof main==='object'?main:{};prediction=prediction&&typeof prediction==='object'?prediction:{};
    const rows=[];
    const add=(kind,title,detail,extra,target,date='')=>{
      const haystack=text(title,detail,extra,LABELS[kind]);
      rows.push({id:'r'+rows.length,kind,title,detail,target,date,search:normalize(haystack),initials:normalize(initials(haystack)),name:normalize(title)});
    };
    for(const item of list(main.schedules)){
      if(!item.title||!/^\d{4}-\d{2}-\d{2}$/.test(item.date||''))continue;
      add('schedule',String(item.title),text(item.date,item.time,item.done?'완료':'예정',item.note),item.type,{kind:'schedule',id:item.id,date:item.date},item.date);
    }
    const seen=new Set();
    for(const item of list(players)){
      const key=normalize(item.name);if(!key||seen.has(key)||item.active===false)continue;seen.add(key);
      add('player',String(item.name),text(item.tier,race(item.race)),text(...(Array.isArray(item.aliases)?item.aliases:[])),{kind:'player',name:item.name});
    }
    for(const item of list(records)){
      const id=Number(item.id);if(!Number.isFinite(id)||id<=0)continue;
      add('record',text(item.result||'경기',item.opponent?'vs '+item.opponent:'상대 미상'),text(item.date,item.map,item.tier,race(item.race),item.myBuild,item.enemyBuild,item.cause,item.note,item.feedback).slice(0,300),text(item.opponent,item.myBuild,item.enemyBuild,item.cause,item.note,item.feedback,item.eloMemo,item.eloMatchType),{kind:'record',id},item.date||'');
    }
    list(prediction.matches).forEach((item,index)=>{
      add('prediction',`${item.p1||'선수 미정'} vs ${item.p2||'선수 미정'}`,text(prediction.tournament,`${index+1}경기`,item.tier1,item.tier2,item.winner?'결과 등록':'예측'),text(prediction.teamA,prediction.teamB,race(item.race1),race(item.race2),...(Array.isArray(prediction.participants)?prediction.participants:[])),{kind:'prediction',index,p1:item.p1,p2:item.p2});
    });
    const participants=[...list(main.playersA),...list(main.playersB)];
    const matches=list(main.matches);
    [...matches,...list(main.aces)].forEach((item,index)=>{
      const a=participants.find(p=>p.id===item.a),b=participants.find(p=>p.id===item.b);
      add('match',`${a?.name||'선수 미정'} vs ${b?.name||'선수 미정'}`,text(main.title,index>=matches.length?'ACE':`${item.set||1}세트`,`${index+1}경기`,item.map),text(main.teamA,main.teamB,a?.tier,b?.tier,race(item.raceA),race(item.raceB)),{kind:'match',id:item.id});
    });
    for(const [title,tab,extra] of [['스케줄','schedule','달력 일정'],['스타 티어표','tier','선수 종족'],['스폰노트','spwn','ELO 전적 기록'],['맞혀도랑','prediction','ASL 예측 우승 준우승'],['대진표','match','CK 대회 경기'],['덕몽 & 폴가이즈','party','게임 점수'],['룰렛','roulette','맵 추첨'],['별풍 정산','settlement','펀딩 계산'],['알림센터','schedule','알림'],['백업·복구','schedule','파일 저장 복원'],['동기화 상태','schedule','ELO 티어 갱신 새로고침']]){
      const section=title==='알림센터'?'notification':title==='백업·복구'?'backup':title==='동기화 상태'?'sync':'';
      add('menu',title,'바로 열기',extra,{kind:'menu',tab,section});
    }
    return rows;
  }
  function search(index,query='',kind='all',limit=50){
    const tokens=String(query).normalize('NFKC').trim().split(/\s+/).map(normalize).filter(Boolean);
    const joined=normalize(query);
    const matches=index.filter(row=>tokens.length?tokens.every(token=>row.search.includes(token)||row.initials.includes(token)):row.kind==='menu');
    const counts=Object.fromEntries(Object.keys(LABELS).map(key=>[key,key==='all'?matches.length:matches.filter(row=>row.kind===key).length]));
    const filtered=matches.filter(row=>kind==='all'||row.kind===kind);
    const rank=row=>joined&&row.name===joined?0:joined&&row.name.startsWith(joined)?1:joined&&row.name.includes(joined)?2:3;
    filtered.sort((a,b)=>rank(a)-rank(b)||String(b.date).localeCompare(String(a.date))||a.title.localeCompare(b.title,'ko'));
    return {items:filtered.slice(0,limit),total:filtered.length,counts};
  }
  const api={LABELS,normalize,initials,buildIndex,search};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(!global.document)return;
  const doc=global.document;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let opened=false,kind='all',index=[],shown=[],queryTimer,returnFocus,oldOverflow='',oldInert=false,navigation=0,composing=false;
  function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
  function sources(){
    const memory=global.getIntegratedSearchSources?.()||{};
    return {main:memory.main||read('star-match-manager-v1',{}),players:memory.players||Object.values(global.HARINA_PLAYER_DIRECTORY||{}),records:read('spawnNote.records.v1',read('newcatsleSpawnNote.records.v1',[])),prediction:read('starPredictionManager_v31',{})};
  }
  const overlay=doc.createElement('div');overlay.className='integrated-search-overlay';overlay.hidden=true;
  overlay.innerHTML=`<section class="integrated-search-dialog" role="dialog" aria-modal="true" aria-labelledby="integrated-search-title"><header><h2 id="integrated-search-title">통합 검색</h2><button type="button" class="secondary" data-search-close aria-label="통합 검색 닫기">닫기</button></header><label class="integrated-search-field"><span>찾고 싶은 내용</span><input type="search" data-integrated-search-input maxlength="100" autocomplete="off" placeholder="이름·초성·날짜·맵·메모 검색"></label><p class="integrated-search-help">일정·선수·이 기기에 저장된 전적을 검색해. 날짜는 2026-10-03처럼 입력해.</p><div class="integrated-search-filters" role="group" aria-label="검색 범위">${Object.entries(LABELS).map(([key,label])=>`<button type="button" data-search-kind="${key}" aria-pressed="${key==='all'}">${label}<span></span></button>`).join('')}</div><p class="integrated-search-status" role="status" aria-live="polite"></p><div class="integrated-search-results" aria-label="검색 결과"></div></section>`;
  doc.body.appendChild(overlay);
  const input=overlay.querySelector('input'),results=overlay.querySelector('.integrated-search-results'),status=overlay.querySelector('.integrated-search-status');
  function installButton(){
    const actions=doc.querySelector('.head .actions');if(!actions||actions.querySelector('[data-open-search]'))return;
    const button=doc.createElement('button');button.type='button';button.className='secondary';button.dataset.openSearch='1';button.textContent='🔎 통합 검색';button.setAttribute('aria-haspopup','dialog');actions.insertBefore(button,actions.firstChild);
  }
  function render(){
    if(!opened)return;
    const found=search(index,input.value,kind);shown=found.items;
    for(const button of overlay.querySelectorAll('[data-search-kind]')){const key=button.dataset.searchKind;button.setAttribute('aria-pressed',String(key===kind));button.querySelector('span').textContent=input.value.trim()?' '+found.counts[key]:'';}
    status.textContent=input.value.trim()?`${LABELS[kind]} ${found.total}개${found.total>shown.length?' · 먼저 '+shown.length+'개 표시':''}`:'검색어를 입력하거나 메뉴를 바로 열어 봐.';
    const content=shown.map(row=>`<button type="button" class="integrated-search-result" data-search-result="${row.id}"><span class="integrated-search-type">${LABELS[row.kind]}</span><strong>${esc(row.title)}</strong><span class="integrated-search-detail">${esc(row.detail)}</span><span class="integrated-search-arrow" aria-hidden="true">›</span></button>`).join('')||'<p class="integrated-search-empty">검색 결과가 없어. 이름 일부나 다른 검색어로 찾아봐.</p>';
    if(results._content!==content){results._content=content;results.innerHTML=content;results.scrollTop=0;}
  }
  function refresh(){if(opened){index=buildIndex(sources());render()}}
  function fitViewport(){
    if(!opened)return;
    const viewport=global.visualViewport;
    overlay.style.height=`${viewport?.height||global.innerHeight}px`;
    overlay.style.top=`${viewport?.offsetTop||0}px`;overlay.style.bottom='auto';
  }
  function open(){
    if(opened){input.focus();return;}
    navigation++;
    opened=true;returnFocus=doc.activeElement;oldOverflow=doc.body.style.overflow;doc.body.style.overflow='hidden';
    const app=doc.getElementById('app');oldInert=app?.inert||false;if(app)app.inert=true;
    overlay.hidden=false;fitViewport();index=buildIndex(sources());render();input.focus();
  }
  function close(restoreFocus=true){
    clearTimeout(queryTimer);opened=false;overlay.hidden=true;doc.body.style.overflow=oldOverflow;
    const app=doc.getElementById('app');if(app)app.inert=oldInert;
    if(restoreFocus)(returnFocus?.isConnected?returnFocus:doc.querySelector('[data-open-search]'))?.focus();
  }
  function focusTarget(node){
    if(!node)return false;node.scrollIntoView({behavior:'smooth',block:'center'});node.tabIndex=-1;node.focus({preventScroll:true});
    const previous=node.style.outline;node.style.outline='2px solid #a87bd0';setTimeout(()=>node.style.outline=previous,2200);return true;
  }
  async function go(row){
    const target=row.target,token=++navigation;close(false);global.openIntegratedSearchTarget?.(target);
    const started=Date.now();
    while(token===navigation&&Date.now()-started<6000){
      let node;
      if(target.kind==='record'){
        const host=doc.querySelector('[data-spwn-native-host]');
        if(host?.shadowRoot&&global.SpwnNative?.openSearchRecord){global.SpwnNative.openSearchRecord(target.id);return;}
      }else if(target.kind==='prediction'){
        const host=doc.querySelector('[data-prediction-native-host]');
        if(host?.shadowRoot&&global.PredictionNative?.selectHistory){
          const latest=read('starPredictionManager_v31',{}).matches?.[target.index];
          if(latest?.p1===target.p1&&latest?.p2===target.p2)global.PredictionNative.selectHistory(target.index);
          focusTarget(host);return;
        }
      }else if(target.kind==='schedule')node=Array.from(doc.querySelectorAll('.schedule-list-item')).find(item=>String(item.querySelector('[data-act="schedule-edit"]')?.dataset.id)===String(target.id))||doc.querySelector('.schedule-detail');
      else if(target.kind==='player')node=Array.from(doc.querySelectorAll('.native-tier-player')).find(item=>item.querySelector('strong')?.textContent===target.name)||doc.querySelector('.native-tier-panel');
      else if(target.kind==='match')node=Array.from(doc.querySelectorAll('.match')).find(item=>String(item.dataset.id)===String(target.id));
      else if(target.section){
        node=doc.querySelector(target.section==='backup'?'.backup-details':target.section==='notification'?'.notification-details':'[data-schedule-sync]');
        if(node&&target.section!=='sync')node.open=true;
      }else node=doc.querySelector(`[data-tab="${target.tab}"]`);
      if(focusTarget(node))return;
      await new Promise(resolve=>setTimeout(resolve,60));
    }
  }
  doc.addEventListener('click',event=>{if(event.target.closest('[data-open-search]'))open()});
  overlay.addEventListener('click',event=>{
    if(event.target===overlay||event.target.closest('[data-search-close]')){close();return;}
    const filter=event.target.closest('[data-search-kind]');if(filter){kind=filter.dataset.searchKind;render();return;}
    const result=event.target.closest('[data-search-result]');if(result){const row=shown.find(item=>item.id===result.dataset.searchResult);if(row)go(row);}
  });
  input.addEventListener('compositionstart',()=>composing=true);
  input.addEventListener('compositionend',()=>{composing=false;clearTimeout(queryTimer);render()});
  input.addEventListener('input',()=>{if(!composing){clearTimeout(queryTimer);queryTimer=setTimeout(render,120)}});
  doc.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();open();return;}
    if(!opened||event.isComposing||composing)return;
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key==='Tab'){
      const controls=Array.from(overlay.querySelectorAll('input,button')).filter(node=>!node.disabled);const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first.focus();}
    }
    if(event.target===input&&event.key==='Enter'){event.preventDefault();clearTimeout(queryTimer);render();if(shown[0])go(shown[0]);}
    if(event.target===input&&event.key==='ArrowDown'){event.preventDefault();results.querySelector('button')?.focus();}
    const buttons=Array.from(results.querySelectorAll('button')),position=buttons.indexOf(event.target);
    if(position>=0&&(event.key==='ArrowDown'||event.key==='ArrowUp')){event.preventDefault();const next=position+(event.key==='ArrowDown'?1:-1);if(next<0)input.focus();else buttons[Math.min(next,buttons.length-1)]?.focus();}
  });
  const style=doc.createElement('style');style.textContent=`.integrated-search-overlay[hidden]{display:none!important}.integrated-search-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:flex-start;justify-content:center;padding:7vh 18px 18px;background:#34253a88;backdrop-filter:blur(4px)}.integrated-search-dialog{display:flex;flex-direction:column;width:min(680px,100%);max-height:85vh;max-height:min(85dvh,100%);padding:20px;border:1px solid #d3bfdc;border-radius:18px;background:#fffafd;color:#513c60;box-shadow:0 20px 70px #34253a40;min-width:0}.integrated-search-dialog header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.integrated-search-dialog h2{margin:0;font-size:20px}.integrated-search-dialog button,.integrated-search-dialog input{font:inherit}.integrated-search-field{display:grid;gap:6px;font-size:12px;font-weight:800}.integrated-search-field input{width:100%;min-width:0;box-sizing:border-box;padding:12px;border:1.5px solid #c7b5d1;border-radius:10px;background:#fff;color:#513c60;font-size:16px;outline:none}.integrated-search-field input:focus{border-color:#9766b9;box-shadow:0 0 0 3px #a87bd022}.integrated-search-help{margin:8px 0 12px;font-size:12px;line-height:1.5;color:#74647d}.integrated-search-filters{display:flex;flex-wrap:wrap;gap:6px}.integrated-search-filters button{border:1px solid #dfd1e7;border-radius:20px;padding:6px 10px;background:#fff;color:#63506e;font-size:12px;white-space:nowrap}.integrated-search-filters button[aria-pressed=true]{background:#eadcf5;border-color:#b992cf;color:#513266;font-weight:800}.integrated-search-status{margin:12px 0 8px;font-size:12px;color:#74647d}.integrated-search-results{display:grid;gap:7px;overflow:auto;overscroll-behavior:contain;min-height:0}.integrated-search-result{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:4px 9px;padding:12px!important;border:1px solid #e7dceb!important;border-radius:10px!important;background:#fff!important;color:#513c60!important;text-align:left;font-size:14px;min-width:0}.integrated-search-type{grid-row:1/3;border-radius:6px;background:#f0e6f6;padding:4px 6px;font-size:10px;font-weight:800}.integrated-search-result strong,.integrated-search-detail{min-width:0;overflow-wrap:anywhere}.integrated-search-detail{grid-column:2;font-size:12px;font-weight:400;color:#74647d;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.integrated-search-arrow{grid-column:3;grid-row:1/3;font-size:22px;color:#9d7db2}.integrated-search-empty{padding:20px 8px;font-size:14px;color:#74647d;text-align:center}.integrated-search-dialog button:focus-visible{outline:2px solid #9766b9;outline-offset:2px}@media(max-width:560px){.integrated-search-overlay{padding:env(safe-area-inset-top,10px) 10px max(10px,env(safe-area-inset-bottom));align-items:flex-start}.integrated-search-dialog{margin-top:10px;padding:14px;max-height:calc(100% - 10px);border-radius:14px}.integrated-search-dialog h2{font-size:18px}.integrated-search-result{padding:10px!important}.integrated-search-filters{gap:5px}.integrated-search-filters button{padding:6px 8px}.integrated-search-help{font-size:11px}}`;doc.head.appendChild(style);
  for(const name of ['dorang:data-changed','spawn-note:records-changed','prediction:data-changed','harina-player-master-updated'])global.addEventListener(name,refresh);
  global.addEventListener('storage',refresh);
  global.addEventListener('resize',fitViewport);
  global.visualViewport?.addEventListener('resize',fitViewport);
  global.visualViewport?.addEventListener('scroll',fitViewport);
  new MutationObserver(installButton).observe(doc.getElementById('app'),{childList:true,subtree:true});
  global.IntegratedSearch={...api,open,close,refresh};installButton();
})(typeof window==='object'?window:globalThis);
