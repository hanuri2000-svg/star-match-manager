/* 도랑이 통합페이지의 사용자 데이터 백업·복구 */
(function(global){
  'use strict';
  const APP='dorang-integrated-page',HISTORY_KEY='dorangIntegratedBackup.v1',MAX_HISTORY=5,MAX_HISTORY_CHARS=900000;
  const KEYS=['star-match-manager-v1','spawnNote.records.v1','spawnNote.eloPlayer','spawnNote.rivalPlayer','spawnNote.rivalOpponent','starPredictionManager_v31','newcatsleSpawnNote.records.v1','newcatsleEloPlayer'];
  const JSON_KEYS=[KEYS[0],KEYS[1],KEYS[5],KEYS[6]];
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function validate(backup){
    if(!object(backup)||backup.app!==APP||backup.schemaVersion!==1||typeof backup.createdAt!=='string'||!Number.isFinite(Date.parse(backup.createdAt))||!object(backup.data))throw new Error('올바른 통합 백업 파일이 아니야.');
    if(Object.keys(backup.data).length!==KEYS.length||KEYS.some(key=>!Object.hasOwn(backup.data,key)))throw new Error('백업에 필요한 데이터가 빠져 있어.');
    for(const key of KEYS){
      const value=backup.data[key];if(value!==null&&typeof value!=='string')throw new Error('백업 데이터 형식이 올바르지 않아.');
      if(value===null||!JSON_KEYS.includes(key))continue;
      let parsed;try{parsed=JSON.parse(value)}catch{throw new Error('백업 데이터가 손상됐어.')}
      if(key===KEYS[1]||key===KEYS[6]){if(!Array.isArray(parsed)||parsed.some(item=>!object(item)))throw new Error('스폰노트 기록 형식이 올바르지 않아.')}
      else{
        if(!object(parsed))throw new Error('앱 데이터 형식이 올바르지 않아.');
        const required=key===KEYS[0]?['playersA','playersB','matches','setGames']:['participants','matches'];
        if(required.some(field=>!Array.isArray(parsed[field])))throw new Error('앱 데이터에 필요한 항목이 빠져 있어.');
        for(const field of key===KEYS[0]?['playersA','playersB','matches','aces','schedules']:['matches','schedules']){
          if(parsed[field]!=null&&(!Array.isArray(parsed[field])||parsed[field].some(item=>!object(item))))throw new Error('경기·일정 데이터 형식이 올바르지 않아.');
        }
        if(key===KEYS[5]&&parsed.participants.some(item=>typeof item!=='string'))throw new Error('맞혀도랑 참가자 형식이 올바르지 않아.');
        if(key===KEYS[0]&&parsed.setGames.some(value=>!Number.isInteger(value)||value<1||value>1000))throw new Error('경기 수를 확인하지 못했어.');
      }
    }
    return backup;
  }
  function capture(storage,mainState,version=''){
    const data=Object.fromEntries(KEYS.map(key=>[key,storage.getItem(key)]));
    if(mainState!=null)data[KEYS[0]]=mainState;
    return validate({app:APP,schemaVersion:1,appVersion:version,createdAt:new Date().toISOString(),data});
  }
  function fingerprint(backup){
    const data={...backup.data};
    for(const key of [KEYS[0],KEYS[5]]){
      if(!data[key])continue;const parsed=JSON.parse(data[key]);
      for(const field of key===KEYS[0]?['activeTab','scheduleView','scheduleDate','tierSearch','tierFilter','tierLevels','tierLiveOnly']:['current'])delete parsed[field];
      data[key]=JSON.stringify(parsed);
    }
    return JSON.stringify(data);
  }
  function history(storage){
    try{const list=JSON.parse(storage.getItem(HISTORY_KEY)||'[]');return Array.isArray(list)?list.filter(item=>{try{return object(item)&&typeof item.id==='string'&&validate(item.backup)}catch{return false}}).slice(-MAX_HISTORY):[]}catch{return[]}
  }
  function checkpoint(storage,backup,reason='auto'){
    validate(backup);
    const list=history(storage);
    if(reason==='auto'&&list.length&&fingerprint(list.at(-1).backup)===fingerprint(backup))return list.at(-1);
    const item={id:Date.now()+'-'+Math.random().toString(36).slice(2,8),reason,backup};list.push(item);
    while(list.length>MAX_HISTORY||(list.length>1&&JSON.stringify(list).length>MAX_HISTORY_CHARS))list.shift();
    if(JSON.stringify(list).length>MAX_HISTORY_CHARS)throw new Error('자동 백업 용량을 넘었어. 파일 백업으로 보관해 줘.');
    for(;;){try{storage.setItem(HISTORY_KEY,JSON.stringify(list));return item}catch(error){if(list.length>1)list.shift();else throw new Error('백업 저장 공간이 부족해. 파일 백업으로 보관해 줘.')}}
  }
  function restore(storage,backup,before){
    validate(backup);validate(before);
    checkpoint(storage,before,'before-restore');
    const original=Object.fromEntries(KEYS.map(key=>[key,storage.getItem(key)]));
    try{
      KEYS.forEach(key=>storage.removeItem(key));
      KEYS.forEach(key=>{if(backup.data[key]!==null)storage.setItem(key,backup.data[key])});
    }catch(error){
      try{KEYS.forEach(key=>storage.removeItem(key));KEYS.forEach(key=>{if(original[key]!==null)storage.setItem(key,original[key])})}catch{throw new Error('복구 중 저장 오류가 발생했어. 복구 전 백업이 보관돼 있어.')}
      throw new Error('복구에 실패해 기존 데이터를 유지했어. 저장 공간을 확인해 줘.');
    }
  }
  function counts(backup){
    const parse=key=>{try{return JSON.parse(backup.data[key]||'null')}catch{return null}};
    return {schedules:parse(KEYS[0])?.schedules?.length||0,records:(parse(KEYS[1])||parse(KEYS[6]))?.length||0,predictions:parse(KEYS[5])?.matches?.length||0};
  }
  const api={KEYS,HISTORY_KEY,validate,capture,fingerprint,history,checkpoint,restore,counts};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(!global.document)return;
  let error='',pending=null,selected='',timer=null,restoring=false;
  const nowBackup=()=>capture(localStorage,global.getIntegratedBackupMainState?.(),global.INTEGRATED_APP_VERSION||'');
  const date=value=>new Date(value).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  const reason={auto:'자동',manual:'수동','before-restore':'복구 전'};
  function render(){
    const host=global.document.querySelector('[data-integrated-backup]');if(!host)return;
    const list=history(localStorage),last=list.at(-1);
    const preview=pending?counts(pending):null;
    const content=`<details class="backup-details"><summary><strong>백업·복구</strong><span>${last?'최근 백업 '+esc(date(last.backup.createdAt)):'백업 없음'}</span></summary><div class="backup-body"><p>일정·스폰노트·맞혀도랑·대진·정산·게임 점수를 함께 보관해. 자동 백업은 이 기기에 최근 5개까지 저장돼. 다른 기기로 옮길 땐 파일 백업을 사용해.</p><div class="backup-actions"><button type="button" class="secondary" data-backup-save>지금 백업</button><button type="button" class="primary" data-backup-export>파일 백업</button><label class="backup-file">파일 복구<input type="file" accept=".json,application/json" data-backup-file></label></div><div class="backup-history"><select data-backup-history aria-label="복구할 이전 백업">${list.length?list.slice().reverse().map(item=>`<option value="${esc(item.id)}" ${item.id===selected?'selected':''}>${esc(date(item.backup.createdAt))} · ${reason[item.reason]||'백업'} · 일정 ${counts(item.backup).schedules}개 / 스폰 ${counts(item.backup).records}경기</option>`).join(''):'<option value="">이전 백업 없음</option>'}</select><button type="button" class="secondary" data-backup-previous ${list.length?'':'disabled'}>이전 백업 복구</button></div>${pending?`<div class="backup-preview"><b>복구할 백업 · ${esc(date(pending.createdAt))}</b><span>일정 ${preview.schedules}개 · 스폰 ${preview.records}경기 · 맞혀도랑 ${preview.predictions}경기</span><small>현재 데이터를 교체하고 페이지를 다시 열어. 교체 전 데이터는 자동으로 백업해.</small><div class="backup-actions"><button type="button" class="primary" data-backup-restore>이 백업으로 복구</button><button type="button" class="secondary" data-backup-cancel>취소</button></div></div>`:''}${error?`<p class="backup-message" role="status">${esc(error)}</p>`:''}</div></details>`;
    if(host._backupContent===content)return;
    const open=host.querySelector('details')?.open;host._backupContent=content;host.innerHTML=content;
    if(open||pending)host.querySelector('details').open=true;
  }
  function backup(reason='auto'){
    if(restoring)return;
    try{const item=checkpoint(localStorage,nowBackup(),reason);if(reason==='manual'){selected=item.id;error='이 기기에 백업했어.'}else error=''}catch(failure){error=failure.message}render();
  }
  function scheduleBackup(){clearTimeout(timer);timer=setTimeout(()=>backup(),750)}
  function exportFile(){
    try{
      const data=nowBackup(),blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=global.document.createElement('a');
      a.href=url;a.download=`도랑이_통합백업_${data.createdAt.slice(0,19).replace(/[:T]/g,'-')}.json`;global.document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      error='백업 파일 다운로드를 시작했어. 아이폰에서는 파일 앱의 다운로드 폴더를 확인해.';render();
    }catch(failure){error=failure.message;render()}
  }
  global.document.addEventListener('click',event=>{
    const target=event.target;
    if(target.closest('[data-backup-save]'))backup('manual');
    else if(target.closest('[data-backup-export]'))exportFile();
    else if(target.closest('[data-backup-previous]')){const item=history(localStorage).find(item=>item.id===global.document.querySelector('[data-backup-history]')?.value);if(item){pending=item.backup;error='';render()}}
    else if(target.closest('[data-backup-cancel]')){pending=null;error='';render()}
    else if(target.closest('[data-backup-restore]')&&pending){
      if(!global.confirm('현재 통합페이지 데이터를 이 백업으로 교체할까?\n복구 전 데이터는 이 기기에 백업해.'))return;
      try{restoring=true;clearTimeout(timer);restore(localStorage,pending,nowBackup());global.location.reload()}catch(failure){restoring=false;error=failure.message;render()}
    }
  });
  global.document.addEventListener('change',async event=>{
    if(event.target.matches('[data-backup-history]')){selected=event.target.value;return}
    if(!event.target.matches('[data-backup-file]'))return;
    const file=event.target.files?.[0];if(!file)return;
    try{if(file.size>10*1024*1024)throw new Error('백업 파일이 너무 커. 10MB 이하 파일을 선택해 줘.');pending=validate(JSON.parse(await file.text()));error=''}catch(failure){pending=null;error=failure instanceof SyntaxError?'JSON 백업 파일을 읽지 못했어.':failure.message}
    event.target.value='';render();
  });
  const style=global.document.createElement('style');style.textContent=`.backup-details{border:1px solid #d3bfdc;border-radius:12px;background:#fff;color:#513c60;padding:10px 14px}.backup-details summary{cursor:pointer;font-size:.875rem}.backup-details summary span{margin-left:12px;color:#74647d;font-size:.75rem}.backup-body{display:grid;gap:10px;margin-top:10px}.backup-body p{margin:0;color:#74647d;font-size:.875rem;line-height:1.5}.backup-actions{display:flex;flex-wrap:wrap;gap:8px}.backup-actions button,.backup-history button,.backup-file{font-size:.875rem!important;padding:8px 12px!important}.backup-file{position:relative;display:inline-flex;align-items:center;border:1px solid #c7b5d1;border-radius:8px;background:#f5eef9;color:#574662;cursor:pointer;font-weight:700;overflow:hidden}.backup-file input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}.backup-history{display:flex;gap:8px;min-width:0}.backup-history select{flex:1;min-width:0;font-size:.875rem}.backup-history button{flex-shrink:0}.backup-preview{display:grid;gap:7px;border:1px solid #c7b5d1;padding:12px;border-radius:10px;background:#faf5fc}.backup-preview b,.backup-preview span{font-size:.875rem}.backup-preview small{font-size:.75rem;line-height:1.5}.backup-body p.backup-message{color:#865a3b}@media(max-width:560px){.backup-history{flex-direction:column}.backup-details summary span{display:block;margin:4px 0 0 15px}}`;global.document.head.appendChild(style);
  new MutationObserver(render).observe(global.document.getElementById('app'),{childList:true,subtree:true});
  for(const event of ['dorang:data-changed','spawn-note:records-changed','prediction:data-changed'])global.addEventListener(event,scheduleBackup);
  for(const event of ['input','change','click'])global.document.addEventListener(event,e=>{if(!e.composedPath().some(node=>node?.matches?.('[data-integrated-backup]')))scheduleBackup()},true);
  global.addEventListener('pagehide',()=>backup());global.addEventListener('storage',event=>{if(KEYS.includes(event.key)){scheduleBackup()}else if(event.key===HISTORY_KEY)render()});
  global.IntegratedBackup={...api,backup,render,exportFile};render();backup();
})(typeof window!=='undefined'?window:globalThis);
