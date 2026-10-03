/* 페이지 안에서 확인하는 통합 알림함 */
(function(global){
  'use strict';
  const KEY='dorangNotificationCenter.v1',PLAYER='최도랑';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const blank=()=>({schemaVersion:1,items:[],seen:[],baseline:{schedules:null,elo:null,tier:null,tierVersion:null,failures:{},sequence:0}});
  function load(storage){
    try{
      const x=JSON.parse(storage.getItem(KEY)||'null');if(x?.schemaVersion!==1||!Array.isArray(x.items)||!Array.isArray(x.seen)||!x.baseline)return blank();
      const state=blank();state.items=x.items.filter(item=>item&&typeof item.id==='string'&&typeof item.title==='string'&&Number.isFinite(item.createdAt)).slice(0,50);state.seen=x.seen.filter(id=>typeof id==='string').slice(-200);
      const b=x.baseline;state.baseline={...state.baseline,...b,schedules:Array.isArray(b.schedules)?b.schedules:null,elo:Number.isFinite(b.elo)?b.elo:null,failures:b.failures&&typeof b.failures==='object'?b.failures:{},sequence:Number.isInteger(b.sequence)?b.sequence:0};return state;
    }catch{return blank()}
  }
  function newer(a,b){const x=String(a||'').split('.').map(Number),y=String(b||'').split('.').map(Number);if([...x,...y].some(n=>!Number.isFinite(n)))return false;for(let i=0;i<Math.max(x.length,y.length);i++){if((x[i]||0)!==(y[i]||0))return(x[i]||0)>(y[i]||0)}return false}
  function timeMinutes(value){
    const text=String(value||'').trim();let m=text.match(/^(\d{1,2}):(\d{2})$/);
    if(m)return+m[1]<24&&+m[2]<60?+m[1]*60 + +m[2]:null;
    m=text.match(/^(오전|오후|저녁|아침)\s*(\d{1,2})시(?:\s*(\d{1,2})분)?$/);
    if(!m||+m[2]<1||+m[2]>12||+(m[3]||0)>59)return null;
    return(+m[2]%12+(['오후','저녁'].includes(m[1])?12:0))*60+ +(m[3]||0);
  }
  function add(state,id,title,body,target,now=Date.now()){
    if(state.seen.includes(id))return false;
    state.seen.push(id);state.seen=state.seen.slice(-200);
    state.items.unshift({id,title,body,target,createdAt:now,read:false});state.items=state.items.slice(0,50);return true;
  }
  function observeSchedules(state,schedules,now=new Date()){
    const list=Array.isArray(schedules)?schedules:[],ids=list.map(item=>String(item.id));
    if(state.baseline.schedules!==null){for(const item of list){if(!state.baseline.schedules.includes(String(item.id)))add(state,'new-schedule:'+item.id+':'+item.date,'새 일정 등록',`${item.date} ${item.time||'시간 미정'} · ${item.title}`,{kind:'schedule',date:item.date},now.getTime())}}
    state.baseline.schedules=ids;
    for(const item of list){
      if(item.done||!/^\d{4}-\d{2}-\d{2}$/.test(item.date||''))continue;
      const minutes=timeMinutes(item.time);if(minutes===null)continue;
      const [year,month,day]=item.date.split('-').map(Number),start=new Date(year,month-1,day,Math.floor(minutes/60),minutes%60),remaining=start-now;
      if(start.getFullYear()!==year||start.getMonth()!==month-1||start.getDate()!==day)continue;
      if(remaining>=0&&remaining<=30*60000)add(state,`due:${item.id}:${item.date}:${item.time}`,'일정 시작 임박',`${Math.ceil(remaining/60000)}분 후 · ${item.time} · ${item.title}`,{kind:'schedule',date:item.date},now.getTime());
    }
  }
  function observeFailure(state,source,status,error,now=Date.now()){
    if(status==='ok'){state.baseline.failures[source]=false;return}
    if(status!=='error'||state.baseline.failures[source])return;
    state.baseline.failures[source]=true;
    add(state,`failure:${source}:${++state.baseline.sequence}`,`${source} 동기화 오류`,error||'자료를 갱신하지 못했어. 저장된 자료를 유지해.',{kind:'sync'},now);
  }
  function observeElo(state,sync,now=Date.now()){
    if(!sync)return;observeFailure(state,'ELO',sync.status,sync.error,now);
    if(sync.status==='cached'&&state.baseline.elo===null&&sync.score!=null&&Number.isFinite(Number(sync.score))){state.baseline.elo=Number(sync.score);return}
    if(sync.status!=='ok'||sync.score==null||!Number.isFinite(Number(sync.score)))return;
    const score=Number(sync.score),previous=state.baseline.elo??(Number.isFinite(sync.previousScore)?sync.previousScore:null);
    if(previous!==null&&previous!==score)add(state,'elo:'+ ++state.baseline.sequence,'최도랑 ELO 변경',`${previous} → ${score} (${score>previous?'+':''}${Number((score-previous).toFixed(1))})`,{kind:'elo'},now);
    state.baseline.elo=score;
  }
  function observeTier(state,sync,tier,now=Date.now()){
    if(!sync)return;observeFailure(state,'티어표',sync.status,sync.error,now);if(sync.status!=='ok')return;
    if(tier){if(state.baseline.tier!==null&&state.baseline.tier!==tier)add(state,'tier:'+ ++state.baseline.sequence,'최도랑 티어 변경',`${state.baseline.tier} → ${tier}`,{kind:'tier'},now);state.baseline.tier=tier}
    if(sync.version){if(state.baseline.tierVersion!==null&&state.baseline.tierVersion!==sync.version)add(state,'tier-version:'+sync.version,'티어표 갱신',`v${sync.version}${sync.sourceDate?' · '+sync.sourceDate+' 기준':''}`,{kind:'tier'},now);state.baseline.tierVersion=sync.version}
  }
  function observeVersion(state,info,current,now=Date.now()){if(info&&newer(info.version,current))add(state,'version:'+info.version,'새 버전 업데이트',`v${info.version}${info.notes?' · '+info.notes:''}`,{kind:'update',version:info.version},now)}
  function markRead(state,id){state.items.forEach(item=>{if(id==null||item.id===id)item.read=true})}
  function clearRead(state){state.items=state.items.filter(item=>!item.read)}
  const api={KEY,blank,load,newer,timeMinutes,add,observeSchedules,observeFailure,observeElo,observeTier,observeVersion,markRead,clearRead};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(!global.document)return;
  let state=load(localStorage),expanded=false,unreadOnly=false,storageError='',versionCheckedAt=0,versionLoading=false;
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));storageError='';global.dispatchEvent(new CustomEvent('dorang:notifications-changed'))}catch{storageError='알림을 이 기기에 저장하지 못했어.'}}
  function change(fn){const before=JSON.stringify(state);fn();if(JSON.stringify(state)!==before)save();render()}
  function render(){
    const unread=state.items.filter(item=>!item.read).length,actions=global.document.querySelector('.head .actions');
    if(actions){let button=actions.querySelector('[data-open-notifications]');if(!button){button=global.document.createElement('button');button.type='button';button.className='secondary';button.dataset.openNotifications='1';actions.appendChild(button)}const label=`🔔 알림${unread?' '+unread:''}`;if(button.textContent!==label)button.textContent=label;button.setAttribute('aria-label',`알림센터 · 읽지 않은 알림 ${unread}개`)}
    const host=global.document.querySelector('[data-notification-center]');if(!host)return;
    const items=state.items.filter(item=>!unreadOnly||!item.read);
    const content=`<details class="notification-details"><summary><strong>알림센터</strong><span class="notification-count" aria-live="polite">${unread?'읽지 않음 '+unread+'개':'새 알림 없음'}</span></summary><div class="notification-body"><p class="notification-note">페이지가 열려 있을 때 확인해. 일정 임박 알림은 시작 30분 전부터 기기 시간 기준으로 표시돼.</p><div class="notification-tools"><button type="button" class="secondary" data-notification-all ${unread?'':'disabled'}>모두 읽음</button><button type="button" class="secondary" data-notification-clear ${state.items.some(item=>item.read)?'':'disabled'}>읽은 알림 정리</button><button type="button" class="secondary" data-notification-filter aria-pressed="${unreadOnly}">${unreadOnly?'전체 보기':'읽지 않음만'}</button></div><div class="notification-list">${items.map(item=>`<article class="notification-item ${item.read?'is-read':'is-unread'}"><button type="button" class="notification-link" data-notification-open="${esc(item.id)}"><b>${esc(item.title)}</b><span>${esc(item.body)}</span><small>${esc(new Date(item.createdAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}))}${item.read?' · 읽음':''}</small></button>${!item.read?`<button type="button" class="secondary notification-read" data-notification-read="${esc(item.id)}">읽음</button>`:''}</article>`).join('')||'<p class="notification-empty">확인할 알림이 없어.</p>'}</div>${storageError?`<p role="status">${esc(storageError)}</p>`:''}</div></details>`;
    if(host._notificationContent===content)return;
    expanded=host.querySelector('details')?.open??expanded;host._notificationContent=content;host.innerHTML=content;host.querySelector('details').open=expanded;
  }
  function checkSources(){
    change(()=>{
      observeSchedules(state,global.getScheduleDashboardSchedules?.()||[]);
      observeElo(state,global.DORANG_ELO_SYNC_STATUS);
      observeTier(state,global.HARINA_MASTER_SYNC_STATUS,global.HARINA_PLAYER_DIRECTORY?.[PLAYER]?.tier);
    });
  }
  async function checkVersion(){
    if(versionLoading||Date.now()-versionCheckedAt<5*60000)return;
    versionCheckedAt=Date.now();versionLoading=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try{const response=await fetch('./version.json?t='+Date.now(),{cache:'no-store',signal:controller.signal});if(!response.ok)return;const info=await response.json();change(()=>observeVersion(state,info,global.INTEGRATED_APP_VERSION||''))}catch{}finally{clearTimeout(timer);versionLoading=false}
  }
  function openCenter(){expanded=true;global.openIntegratedNotificationTarget?.({kind:'center'});render();const details=global.document.querySelector('.notification-details');if(details){details.open=true;details.scrollIntoView({behavior:'smooth',block:'nearest'})}}
  global.document.addEventListener('toggle',event=>{if(event.target.matches?.('.notification-details'))expanded=event.target.open},true);
  global.document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-open-notifications')){openCenter();return}
    if(button.hasAttribute('data-notification-all'))change(()=>markRead(state));
    else if(button.hasAttribute('data-notification-clear'))change(()=>clearRead(state));
    else if(button.hasAttribute('data-notification-filter')){unreadOnly=!unreadOnly;render()}
    else if(button.dataset.notificationRead)change(()=>markRead(state,button.dataset.notificationRead));
    else if(button.dataset.notificationOpen){
      const item=state.items.find(item=>item.id===button.dataset.notificationOpen);if(!item)return;change(()=>markRead(state,item.id));
      if(item.target?.kind==='update'&&newer(item.target.version,global.INTEGRATED_APP_VERSION))global.applyIntegratedUpdate?.(item.target.version);
      else global.openIntegratedNotificationTarget?.(item.target||{kind:'center'});
    }
  });
  const style=global.document.createElement('style');style.textContent=`.notification-details{padding:10px 14px;border:1px solid #d3bfdc;border-radius:12px;background:#fff;color:#513c60}.notification-details summary{cursor:pointer;font-size:.875rem}.notification-count{margin-left:12px;padding:3px 7px;border-radius:6px;background:#f2e8f8;color:#755580;font-size:.75rem}.notification-body{display:grid;gap:10px;margin-top:10px}.notification-note,.notification-empty{margin:0;color:#74647d;font-size:.875rem;line-height:1.5}.notification-tools{display:flex;gap:6px;flex-wrap:wrap}.notification-tools button,.notification-read{font-size:.875rem!important;padding:7px 10px!important}.notification-list{display:grid;gap:7px;max-height:350px;overflow:auto}.notification-item{display:flex;gap:8px;align-items:center;padding:8px;border:1px solid #e5d5ed;border-radius:10px;background:#fcf9ff;min-width:0}.notification-item.is-unread{border-left:4px solid #a777c0}.notification-item.is-read{background:#fafafa}.notification-link{display:grid;gap:5px;flex:1;min-width:0;text-align:left;background:transparent!important;border:0!important;box-shadow:none!important;color:#513c60!important;padding:4px!important;overflow-wrap:anywhere}.notification-link b,.notification-link span{font-size:.875rem;line-height:1.5}.notification-link small{font-size:.75rem;color:#88728f}.notification-read{flex-shrink:0}.notification-tools button:disabled{opacity:.5}@media(max-width:560px){.notification-count{display:inline-block;margin-left:7px}.notification-item{gap:5px}.notification-read{padding:7px!important}}`;global.document.head.appendChild(style);
  new MutationObserver(render).observe(global.document.getElementById('app'),{childList:true,subtree:true});
  for(const name of ['dorang:data-changed','dorang:elo-sync','harina-player-master-sync','spawn-note:dashboard-changed'])global.addEventListener(name,checkSources);
  global.addEventListener('dorang:version-checked',event=>change(()=>observeVersion(state,event.detail,global.INTEGRATED_APP_VERSION||'')));
  global.addEventListener('storage',event=>{if(event.key===KEY){state=load(localStorage);render()}else if(event.key==='star-match-manager-v1')checkSources()});
  global.addEventListener('pageshow',()=>{checkSources();checkVersion()});
  global.document.addEventListener('visibilitychange',()=>{if(!global.document.hidden){checkSources();checkVersion()}});
  setInterval(()=>{if(!global.document.hidden){checkSources();checkVersion()}},30000);
  global.NotificationCenter={checkSources,checkVersion,openCenter,getState:()=>state};checkSources();checkVersion();render();
})(typeof window!=='undefined'?window:globalThis);
