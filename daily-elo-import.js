/* Once per local calendar day: import sponsored matches without replacing notes. */
(function(global){
'use strict';
const RECORDS='spawnNote.records.v1',PREFIX='spawnNote.dailyElo.v1.';
const day=value=>{const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const normalize=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]/g,'');
const key=r=>[r.date,normalize(r.opponent),r.result,normalize(r.map)].join('|');
function mergeRecords(existing,items){
 const records=existing.slice(),ids=new Set(existing.map(r=>r.sourceId).filter(Boolean)),manual=new Map();
 for(const r of existing)if(!r.sourceId)manual.set(key(r),(manual.get(key(r))||0)+1);
 let next=Math.max(0,...existing.map(r=>Number(r.id)||0))+1,added=0;
 for(const r of items){
  if(r?.source!=='eloboard'||!r.sourceId||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!r.opponent||!['승','패'].includes(r.result)||ids.has(r.sourceId))continue;
  ids.add(r.sourceId);const k=key(r);
  if(manual.get(k)>0){manual.set(k,manual.get(k)-1);continue;}
  const record={...r,id:next++,note:r.note||'',feedback:r.feedback||'',myBuild:r.myBuild||'',enemyBuild:r.enemyBuild||'',cause:r.cause||''};
  delete record.duplicate;records.push(record);added++;
 }
 return {records,added};
}
function createService({storage,fetch,now=Date.now,player=()=> '최도랑',base=()=> 'https://spawn-note-elo-relay.hajimayo8130.workers.dev',onChange=()=>{},onStatus=()=>{}}){
 let pending=null,status={state:'idle'};
 const read=key=>JSON.parse(storage.getItem(key)||'null');
 function set(value){status=value;onStatus(status);return value;}
 async function run(force=false){
  if(pending)return pending;
  const name=player(),stampKey=PREFIX+encodeURIComponent(name),today=day(now());
  if(!name)return;
  let stamp;try{stamp=read(stampKey)||{};}catch{return set({state:'error',error:'자동 확인 정보를 읽지 못했어. 기존 기록은 유지했어.'});}
  if(!force&&stamp.attemptDay===today)return set(stamp);
  pending=(async()=>{
   let timer;
   try{
    const attempted={...stamp,state:'loading',attemptDay:today,checkedAt:now(),error:''};storage.setItem(stampKey,JSON.stringify(attempted));set(attempted);
    const start=new Date(stamp.successAt||now());start.setDate(start.getDate()-(stamp.successAt?7:30));
    const query=new URLSearchParams({player:name,fromDate:day(start),pages:'100'});
    const controller=new AbortController();
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('응답 시간이 초과됐어. 수동 확인으로 다시 시도해 줘.'));},20000)});
    const data=await Promise.race([(async()=>{const response=await fetch(`${base().replace(/\/$/,'')}/api/elo/preview?${query}`,{signal:controller.signal});if(!response.ok)throw new Error('ELOBOARD 연결 실패. 수동 확인으로 다시 시도해 줘.');return response.json();})(),timeout]);
    if(!Array.isArray(data.items))throw new Error('전적 응답 형식을 확인하지 못했어.');
    if(player()!==name)throw new Error('기준 선수가 변경돼서 가져오기를 멈췄어.');
    // Read again after the request so manual edits made while loading survive.
    const existing=read(RECORDS)||[];if(!Array.isArray(existing))throw new Error('저장된 기록 형식을 확인하지 못했어.');
    const result=mergeRecords(existing,data.items);
    if(result.added){storage.setItem(RECORDS,JSON.stringify(result.records));onChange(result);}
    const done={state:'ok',attemptDay:today,checkedAt:now(),successAt:now(),added:result.added,limit:data.checkedMatches>=100};
    storage.setItem(stampKey,JSON.stringify(done));return set(done);
   }catch(error){const failed={...stamp,state:'error',attemptDay:today,checkedAt:now(),error:error.message};try{storage.setItem(stampKey,JSON.stringify(failed));}catch{}return set(failed);}
   finally{clearTimeout(timer);pending=null;}
  })();return pending;
 }
 return {run,getStatus:()=>status};
}
if(typeof module==='object'&&module.exports){module.exports={createService,mergeRecords,day};return;}
if(!global.document||new URLSearchParams(global.location.search).get('broadcast')==='1')return;
function renderStatus(){
 const root=global.document.querySelector('[data-spwn-native-host]')?.shadowRoot;if(!root)return;
 let box=root.querySelector('[data-daily-elo-status]');
 if(!box){box=global.document.createElement('div');box.dataset.dailyEloStatus='1';box.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 14px;font-size:13px;background:var(--season-module-panel,#fff);color:var(--season-module-text,#45354f);border-bottom:1px solid var(--season-module-line,#ddcfe5)';const text=global.document.createElement('span');const button=global.document.createElement('button');button.type='button';button.textContent='지금 전적 확인';button.addEventListener('click',()=>run(true));box.append(text,button);root.querySelector('.spwn-body main')?.prepend(box);}
 const s=service.getStatus();box.firstElementChild.textContent=s.state==='loading'?'ELOBOARD 전적 확인 중…':s.state==='error'?`하루 1회 자동 반영 · ${s.error}`:s.state==='ok'?`하루 1회 자동 반영 · ${new Date(s.checkedAt).toLocaleString('ko-KR')} 확인 · 새 전적 ${s.added}개${s.limit?' · 최근 100경기 기준':''}`:'ELOBOARD 전적을 하루 한 번 자동으로 확인해.';
 box.lastElementChild.disabled=s.state==='loading';
}
const service=createService({storage:global.localStorage,fetch:(...args)=>global.fetch(...args),player:()=>String(global.localStorage.getItem('spawnNote.eloPlayer')||'최도랑').trim(),base:()=>global.SPAWN_NOTE_ELO_API_BASE||'https://spawn-note-elo-relay.hajimayo8130.workers.dev',onStatus:renderStatus,onChange:result=>{global.SpwnNative?.reloadRecords?.();global.dispatchEvent(new CustomEvent('spawn-note:records-changed',{detail:{count:result.records.length,source:'daily-elo'}}));}});
function run(force=false){if(global.navigator?.onLine===false||global.document.hidden)return Promise.resolve();return global.navigator?.locks?global.navigator.locks.request('dorang-daily-elo-import',()=>service.run(force)):service.run(force);}
global.DailyEloImport={run,renderStatus};
global.document.addEventListener('visibilitychange',()=>{if(!global.document.hidden)run()});global.addEventListener('pageshow',()=>run());global.addEventListener('online',()=>run());
// Timer checks the date locally; it does not poll ELOBOARD within the same day.
setInterval(()=>run(),60000);run();
})(typeof window==='object'?window:globalThis);
