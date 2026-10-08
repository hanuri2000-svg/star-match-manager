(()=>{
  if(new URLSearchParams(location.search).get("broadcast")==="1")return;
  const C=window.DorangTournamentCore;
  if(!C)return;

  const OLD_KEY="newcatsle_yut_final_v1";
  const history=[];
  let transport=null;
  let remoteStatus="송출컴 연결 준비 중";

  const migrateOld=()=>{
    try{
      const old=JSON.parse(localStorage.getItem(OLD_KEY)||"null");
      if(old&&Array.isArray(old.teams)&&old.teams.length===16)return C.normalize(old);
    }catch{}
    return C.blank();
  };
  if(!s.tournament){
    s.tournament=migrateOld();
    try{localStorage.setItem(KEY,JSON.stringify(s));}catch{}
  }else s.tournament=C.normalize(s.tournament);

  const tn=()=>s.tournament=C.normalize(s.tournament);
  const tnEsc=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

  const persist=(rerender=true)=>{
    s.tournament.updatedAt=Date.now();
    localStorage.setItem(KEY,JSON.stringify(s));
    window.dispatchEvent(new CustomEvent("dorang:tournament-changed",{detail:s.tournament}));
    transport?.broadcast();
    if(rerender)render();
  };

  const style=document.createElement("style");
  style.id="dorang-tournament-native-style";
  style.textContent=`
    .tn-view{margin-top:0}
    .tn-shell{display:grid;gap:12px}
    .tn-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 16px;border:1.5px solid #cbb8d6;border-radius:18px;background:linear-gradient(120deg,#faf2fc,#eef6ff);color:#4e3b59;box-shadow:0 10px 27px rgba(78,52,99,.12)}
    .tn-top h2{margin:0 0 4px;font-size:21px}.tn-top p{margin:0;color:#74647d;font-size:12px}
    .tn-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px}
    .tn-actions button{border:1px solid #cfbfd9;background:#fff;color:#614e6c}
    .tn-actions .primary{border-color:#a98de8;background:linear-gradient(135deg,#9b7bd5,#d984ad);color:#fff}
    .tn-actions .danger{border-color:#e4aabe;background:#fff3f6;color:#a03c61}
    .tn-statusbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 12px;border:1px solid #d7c8e0;border-radius:14px;background:#fff;color:#5f5068;font-size:12px}
    .tn-statusbar strong{color:#4f3560}.tn-remote{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.tn-remote button{padding:7px 10px;border:1px solid #d4c5dd;background:#f8f2fb;color:#665270}
    .tn-board-scroll{overflow:auto;border:1px solid #493a57;border-radius:18px;background:#09070e}
    .tn-board{position:relative;width:100%;min-width:900px;aspect-ratio:16/9;overflow:hidden;background:radial-gradient(circle at 50% 48%,rgba(108,67,151,.20),transparent 25%),linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(180deg,#15101d,#09070e);background-size:auto,48px 48px,48px 48px,auto}
    .tn-board-title{position:absolute;left:50%;top:4.5%;transform:translateX(-50%);z-index:6;width:55%;text-align:center;color:#f8f3fb;font-size:clamp(18px,2vw,32px);font-weight:1000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tn-board-brand{position:absolute;left:50%;top:1.7%;transform:translateX(-50%);z-index:6;color:#b990f0;font-size:clamp(8px,.75vw,12px);font-weight:1000;letter-spacing:.25em}
    .tn-round{position:absolute;z-index:5;top:16.5%;transform:translateX(-50%);padding:5px 12px;border:1px solid #72588b;border-radius:999px;background:#17111f;color:#d9cce5;font-size:clamp(9px,.85vw,13px);font-weight:1000}
    .tn-final{position:absolute;left:50%;top:16.3%;transform:translateX(-50%);z-index:5;color:#b98be9;font-size:clamp(11px,1vw,16px);font-weight:1000;letter-spacing:.14em}
    .tn-champ-label{position:absolute;left:50%;top:52.2%;transform:translateX(-50%);z-index:5;color:#8c7b98;font-size:clamp(8px,.72vw,11px);font-weight:1000;letter-spacing:.12em}
    .tn-third-label{position:absolute;left:50%;top:77%;transform:translateX(-50%);z-index:5;color:#a898b4;font-size:clamp(9px,.82vw,13px);font-weight:1000}
    .tn-lines{position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none}.tn-lines path{fill:none;stroke:#715889;stroke-width:3}
    .tn-slot{position:absolute;z-index:10;display:flex;align-items:center;justify-content:center;padding:0 .35%;border:1px solid #574763;border-radius:7px;background:#17121e;color:#f7f2fb;font-size:clamp(9px,1vw,15px);font-weight:950;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tn-slot.clickable{cursor:pointer}.tn-slot.clickable:hover{border-color:#b16cff;background:#281936}
    .tn-slot.winner{border-color:#b16cff;background:#352146;color:#fff}.tn-slot.loser{opacity:.28}
    .tn-slot.champ{border-color:#b98be9;background:linear-gradient(180deg,#39224e,#181020);box-shadow:0 0 22px rgba(177,108,255,.18)}
    .tn-board-note{position:absolute;right:1.4%;bottom:1.2%;z-index:4;color:#75667f;font-size:10px}
    .tn-modal{position:fixed;inset:0;z-index:10020;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(30,20,38,.72);backdrop-filter:blur(7px)}.tn-modal.show{display:flex}
    .tn-dialog{width:min(680px,96vw);max-height:92dvh;overflow:auto;border:1px solid #d4c4df;border-radius:20px;background:#fff;box-shadow:0 24px 80px rgba(30,18,38,.34);color:#4c3b58}
    .tn-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid #eadfeb;background:linear-gradient(120deg,#faf2fc,#eef6ff)}
    .tn-dialog-head strong{font-size:17px}.tn-dialog-head button{padding:6px 10px;background:#fff;color:#6a5873;border:1px solid #d9cbe1}
    .tn-dialog-body{padding:14px 16px}.tn-fields{display:grid;gap:10px}.tn-field{display:grid;gap:5px}.tn-field span{font-size:12px;font-weight:850;color:#74647d}.tn-field input,.tn-field select{width:100%;min-height:44px;border:1px solid #d8c9e1;border-radius:10px;background:#fff;color:#4b3a56;padding:0 11px;font-size:16px}
    .tn-dialog-actions{display:flex;gap:8px;flex-wrap:wrap;padding:0 16px 16px}.tn-dialog-actions button{flex:1;min-width:140px}
    .tn-roster-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.tn-roster-row{display:grid;grid-template-columns:30px 1fr;align-items:center;gap:7px}.tn-roster-row b{color:#8b7895;font-size:12px;text-align:center}.tn-roster-row input{min-width:0;height:42px;border:1px solid #d8c9e1;border-radius:9px;padding:0 10px;background:#fff;color:#4b3a56;font-size:15px}
    .tn-picker-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.tn-picker-grid button{min-height:46px;border:1px solid #d8c9e1;background:#faf7fc;color:#574662}.tn-picker-grid button:disabled{opacity:.28}.tn-picker-grid button.current{border-color:#a77dd0;background:#eadcf5;color:#4f3265}
    @media(max-width:760px){
      .tn-top{align-items:stretch;flex-direction:column}.tn-actions{justify-content:stretch}.tn-actions button{flex:1 1 calc(50% - 7px)}
      .tn-statusbar{align-items:flex-start;flex-direction:column}.tn-remote{width:100%}.tn-remote button{flex:1}
      .tn-roster-grid{grid-template-columns:1fr}.tn-picker-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      .tn-board{min-width:880px}
    }
  `;
  document.head.appendChild(style);

  const lines=`
    <svg class="tn-lines" viewBox="0 0 1536 864" aria-hidden="true">
      <path d="M240 283 H274 V315 H304"/><path d="M240 341 H274 V315 H304"/>
      <path d="M240 401 H274 V431 H304"/><path d="M240 459 H274 V431 H304"/>
      <path d="M240 522 H274 V554 H304"/><path d="M240 581 H274 V554 H304"/>
      <path d="M240 642 H274 V674 H304"/><path d="M240 700 H274 V674 H304"/>
      <path d="M395 315 H430 V375 H462"/><path d="M395 431 H430 V375 H462"/>
      <path d="M395 554 H430 V612 H462"/><path d="M395 674 H430 V612 H462"/>
      <path d="M558 375 H600 V476 H520"/><path d="M558 612 H600 V476 H520"/><path d="M610 476 H680 V508"/>
      <path d="M1303 283 H1262 V315 H1229"/><path d="M1303 341 H1262 V315 H1229"/>
      <path d="M1303 401 H1262 V431 H1229"/><path d="M1303 459 H1262 V431 H1229"/>
      <path d="M1303 522 H1262 V554 H1229"/><path d="M1303 581 H1262 V554 H1229"/>
      <path d="M1303 642 H1262 V674 H1229"/><path d="M1303 700 H1262 V674 H1229"/>
      <path d="M1138 315 H1105 V375 H1073"/><path d="M1138 431 H1105 V375 H1073"/>
      <path d="M1138 554 H1105 V612 H1073"/><path d="M1138 674 H1105 V612 H1073"/>
      <path d="M977 375 H936 V476 H1016"/><path d="M977 612 H936 V476 H1016"/><path d="M926 476 H856 V508"/>
    </svg>`;

  const slotClass=(state,id,team)=>{
    const key=C.keyForSlot(id),m=C.matchup(state,key),w=state.results[key];
    let cls="tn-slot";
    if(id==="CHAMP")cls+=" champ";
    if(!state.started&&C.setupIndexFor(id)!==null)cls+=" clickable";
    if(state.started&&team&&m[0]&&m[1]&&!w)cls+=" clickable";
    if(w&&team&&m.includes(team))cls+=w===team?" winner":" loser";
    return cls;
  };

  function boardHtml(state){
    const third=C.matchup(state,"THIRD"),ids=Object.keys(C.SLOT_POSITIONS);
    const slots=ids.map(id=>{
      let team="";
      if(id==="TL")team=state.started?(third[0]||""):"";
      else if(id==="TR")team=state.started?(third[1]||""):"";
      else if(id==="CHAMP")team=state.started?(state.results.FINAL||""):"";
      else team=C.slotTeam(state,id);
      let cls=slotClass(state,id,team);
      if(state.started&&state.results.THIRD&&(id==="TL"||id==="TR")){
        const win=state.results.THIRD;
        cls="tn-slot "+(team===win?"winner clickable":"loser clickable");
      }
      return`<button type="button" class="${cls}" data-tn-slot="${id}" style="${C.positionStyle(id)}">${tnEsc(team)}</button>`;
    }).join("");
    return`
      <div class="tn-board-scroll"><div class="tn-board">
        <div class="tn-board-brand">${tnEsc(state.event.brand||"TOURNAMENT")}</div>
        <div class="tn-board-title">${tnEsc(state.event.title||"토너먼트 대진표")}</div>
        <div class="tn-round" style="left:10%">16강</div><div class="tn-round" style="left:28%">8강</div><div class="tn-round" style="left:40%">4강</div>
        <div class="tn-final">FINAL</div>
        <div class="tn-round" style="left:60%">4강</div><div class="tn-round" style="left:72%">8강</div><div class="tn-round" style="left:90%">16강</div>
        <div class="tn-champ-label">CHAMPION</div><div class="tn-third-label">3 · 4위전</div>
        ${lines}${slots}<div class="tn-board-note">DORANG TOURNAMENT</div>
      </div></div>`;
  }

  function panelHtml(){
    const state=tn(),selected=state.teams.filter(Boolean).length,active=state.roster.filter(Boolean).length;
    const status=state.started
      ?`진행 중 · 16강 결과 ${Object.keys(state.results).filter(k=>k.startsWith("L16_")||k.startsWith("R16_")).length} / 8`
      :`대진 설정 ${selected} / ${active}`;
    return`<section class="tn-shell">
      <div class="tn-top">
        <div><p class="eyebrow">TOURNAMENT BRACKET</p><h2>${tnEsc(state.event.title||"토너먼트 대진표")}</h2><p>범용 16강 토너먼트 · 참가팀/대회명/테마 변경 가능</p></div>
        <div class="tn-actions">
          <button type="button" data-tn-act="event">대회 설정</button>
          <button type="button" data-tn-act="roster" ${state.started?"disabled":""}>팀 명단 수정</button>
          <button type="button" data-tn-act="undo" ${!state.started||!history.length?"disabled":""}>직전 결과 취소</button>
          <button type="button" class="primary" data-tn-act="start" ${state.started||active<2||selected!==active?"disabled":""}>시작</button>
          <button type="button" class="danger" data-tn-act="reset">대진 초기화</button>
        </div>
      </div>
      <div class="tn-statusbar">
        <strong>${tnEsc(status)}</strong>
        <div class="tn-remote"><span data-tn-remote-status>${tnEsc(remoteStatus)}</span><button type="button" data-tn-act="copy-broadcast">송출컴 방송링크 복사</button><button type="button" data-tn-act="open-broadcast">방송화면 열기</button></div>
      </div>
      ${boardHtml(state)}
      ${modalHtml()}
    </section>`;
  }

  function modalHtml(){
    return`
    <div class="tn-modal" data-tn-modal="event"><div class="tn-dialog">
      <div class="tn-dialog-head"><strong>대회 설정</strong><button type="button" data-tn-close>닫기</button></div>
      <div class="tn-dialog-body"><div class="tn-fields">
        <label class="tn-field"><span>대회명</span><input data-tn-event="title" maxlength="40"></label>
        <label class="tn-field"><span>부제 / 주최 / 설명</span><input data-tn-event="subtitle" maxlength="60"></label>
        <label class="tn-field"><span>상단 브랜드 문구</span><input data-tn-event="brand" maxlength="24"></label>
        <label class="tn-field"><span>방송화면 테마</span><select data-tn-event="theme"><option value="purple">퍼플</option><option value="blue">블루</option><option value="red">레드</option><option value="gold">골드</option><option value="green">그린</option></select></label>
      </div></div>
      <div class="tn-dialog-actions"><button type="button" class="primary" data-tn-act="save-event">대회 설정 저장</button></div>
    </div></div>
    <div class="tn-modal" data-tn-modal="roster"><div class="tn-dialog">
      <div class="tn-dialog-head"><strong>팀 명단 수정</strong><button type="button" data-tn-close>닫기</button></div>
      <div class="tn-dialog-body"><div class="tn-roster-grid" data-tn-roster-grid></div></div>
      <div class="tn-dialog-actions"><button type="button" class="primary" data-tn-act="save-roster">팀 명단 확정</button></div>
    </div></div>
    <div class="tn-modal" data-tn-modal="picker"><div class="tn-dialog">
      <div class="tn-dialog-head"><strong data-tn-picker-title>팀 선택</strong><button type="button" data-tn-close>닫기</button></div>
      <div class="tn-dialog-body"><div class="tn-picker-grid" data-tn-picker-grid></div></div>
      <div class="tn-dialog-actions"><button type="button" data-tn-act="clear-slot">이 칸 비우기</button></div>
    </div></div>`;
  }

  let pickerIndex=null;
  function openModal(name){
    document.querySelector(`[data-tn-modal="${name}"]`)?.classList.add("show");
  }
  function closeModals(){document.querySelectorAll(".tn-modal.show").forEach(m=>m.classList.remove("show"))}
  function openEvent(){
    const st=tn(),e=st.event;
    document.querySelector('[data-tn-event="title"]').value=e.title||"";
    document.querySelector('[data-tn-event="subtitle"]').value=e.subtitle||"";
    document.querySelector('[data-tn-event="brand"]').value=e.brand||"";
    document.querySelector('[data-tn-event="theme"]').value=e.theme||"purple";
    openModal("event");
  }
  function openRoster(){
    const st=tn(),grid=document.querySelector("[data-tn-roster-grid]");
    grid.innerHTML=st.roster.map((name,i)=>`<label class="tn-roster-row"><b>${i+1}</b><input data-tn-roster-index="${i}" value="${tnEsc(name)}" placeholder="빈칸은 미사용"></label>`).join("");
    openModal("roster");
  }
  function openPicker(index){
    pickerIndex=index;
    const st=tn(),grid=document.querySelector("[data-tn-picker-grid]");
    document.querySelector("[data-tn-picker-title]").textContent=(index<8?"왼쪽 ":"오른쪽 ")+(index%8+1)+"번 팀 선택";
    grid.innerHTML=st.roster.filter(Boolean).map(name=>{
      const used=st.teams.includes(name)&&st.teams[index]!==name;
      return`<button type="button" data-tn-pick="${tnEsc(name)}" class="${st.teams[index]===name?"current":""}" ${used?"disabled":""}>${tnEsc(name)}</button>`;
    }).join("");
    openModal("picker");
  }

  function saveEvent(){
    const st=tn();
    st.event={
      title:document.querySelector('[data-tn-event="title"]').value.trim()||"토너먼트 대진표",
      subtitle:document.querySelector('[data-tn-event="subtitle"]').value.trim(),
      brand:document.querySelector('[data-tn-event="brand"]').value.trim(),
      theme:document.querySelector('[data-tn-event="theme"]').value||"purple"
    };
    closeModals();persist();
  }
  function saveRoster(){
    const st=tn(),inputs=[...document.querySelectorAll("[data-tn-roster-index]")];
    const next=inputs.map(el=>el.value.trim()),active=next.filter(Boolean);
    if(new Set(active).size!==active.length){alert("중복된 팀명이 있어.");return}
    const prev=[...st.roster];
    st.teams=st.teams.map(name=>{const idx=prev.indexOf(name);return idx<0?name:(next[idx]||"")});
    st.roster=next;
    closeModals();persist();
  }
  function clickSlot(id){
    const st=tn();
    if(!st.started){
      const idx=C.setupIndexFor(id);if(idx!==null)openPicker(idx);return;
    }
    if(id==="TL"||id==="TR"){
      const m=C.matchup(st,"THIRD"),team=id==="TL"?m[0]:m[1];
      if(!m[0]||!m[1]||!team)return;
      history.push(JSON.stringify(st));C.chooseWinner(st,"THIRD",team);persist();return;
    }
    const team=id==="CHAMP"?"":C.slotTeam(st,id),key=C.keyForSlot(id),m=C.matchup(st,key);
    if(!team||!key||!m[0]||!m[1])return;
    history.push(JSON.stringify(st));C.chooseWinner(st,key,team);persist();
  }

  document.addEventListener("click",e=>{
    const slot=e.target.closest("[data-tn-slot]");if(slot){clickSlot(slot.dataset.tnSlot);return}
    const pick=e.target.closest("[data-tn-pick]");if(pick&&pickerIndex!==null){tn().teams[pickerIndex]=pick.dataset.tnPick;closeModals();persist();return}
    if(e.target.closest("[data-tn-close]")||e.target.classList.contains("tn-modal")){closeModals();return}
    const b=e.target.closest("[data-tn-act]");if(!b)return;
    const act=b.dataset.tnAct,st=tn();
    if(act==="event")openEvent();
    if(act==="roster"&&!st.started)openRoster();
    if(act==="save-event")saveEvent();
    if(act==="save-roster")saveRoster();
    if(act==="clear-slot"&&pickerIndex!==null){st.teams[pickerIndex]="";closeModals();persist()}
    if(act==="start"){
      const active=st.roster.filter(Boolean).length,selected=st.teams.filter(Boolean).length;
      if(active<2||selected!==active)return;
      st.started=true;st.results={};history.length=0;C.autoAdvanceByes(st);persist();
    }
    if(act==="undo"&&history.length){s.tournament=C.normalize(JSON.parse(history.pop()));persist()}
    if(act==="reset"){
      if(!confirm("대진 진행 결과를 초기화할까? 팀 명단과 대회 설정은 유지돼."))return;
      const keepEvent={...st.event},keepRoster=[...st.roster];
      s.tournament=C.blank();s.tournament.event=keepEvent;s.tournament.roster=keepRoster;history.length=0;persist();
    }
    if(act==="copy-broadcast")copyBroadcast();
    if(act==="open-broadcast")window.open(C.broadcastUrl(C.getRoom()),"dorangTournamentBroadcast","width=1280,height=720");
  });

  const room=C.getRoom();
  function setRemoteStatus(msg){remoteStatus=msg;document.querySelector("[data-tn-remote-status]")?.replaceChildren(document.createTextNode(msg))}
  function initHost(){
    if(typeof Peer==="undefined"||!window.DorangTournamentTransport){setRemoteStatus("원격 연결 모듈 로드 실패");return}
    transport=window.DorangTournamentTransport.create({hostId:C.peerPrefix+room,getState:tn,onStatus:setRemoteStatus});
  }
  async function copyBroadcast(){
    const url=C.broadcastUrl(room);
    try{await navigator.clipboard.writeText(url);const b=document.querySelector('[data-tn-act="copy-broadcast"]');if(b){const old=b.textContent;b.textContent="복사 완료";setTimeout(()=>{if(b.isConnected)b.textContent=old},1300)}}catch{prompt("송출컴에서 이 링크를 열어",url)}
  }
  initHost();

  const oldRender=render;
  render=function(){
    oldRender();
    const nav=document.querySelector(".app-tabs"),footer=document.querySelector("#app>footer");
    if(!nav||!footer)return;
    if(!nav.querySelector('[data-tab="tournament"]')){
      const match=nav.querySelector('[data-tab="match"]');
      const btn=`<button class="${s.activeTab==="tournament"?"active":""}" data-act="tab" data-tab="tournament">토너먼트</button>`;
      match?match.insertAdjacentHTML("afterend",btn):nav.insertAdjacentHTML("beforeend",btn);
    }
    footer.insertAdjacentHTML("beforebegin",`<div class="tab-view tn-view" style="display:${s.activeTab==="tournament"?"block":"none"}">${s.activeTab==="tournament"?panelHtml():""}</div>`);
    if(s.activeTab==="tournament"){
      document.querySelectorAll(".tab-view:not(.tn-view)").forEach(v=>v.style.display="none");
      requestAnimationFrame(()=>nav.querySelector('[data-tab="tournament"]')?.scrollIntoView({block:"nearest",inline:"center"}));
    }
  };
})();