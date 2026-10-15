/* 도랑이꺼야 12개월 시즌 테마 엔진 v5.23.0 */
(function () {
  "use strict";
  if (typeof document === "undefined") return;
  const STORAGE_KEY = "dorang-season-theme.v1";
  const SEOUL_ZONE = "Asia/Seoul";
  const NAMES = ["설원의 겨울","로맨틱 발렌타인","봄의 시작","벚꽃 축제","싱그러운 정원","청량한 초여름","트로피컬 바캉스","여름밤 축제","황금빛 가을","할로윈","깊어가는 가을","크리스마스"];
  const PALETTES = Object.freeze({
    "1":{"bg":"#eaf4fc","panel":"#ffffff","soft":"#e8f1fa","text":"#213c53","muted":"#4a6175","line":"#bacfdf","accent":"#285c85","onAccent":"#ffffff","glowA":"#bbdbefaa","glowB":"#dbe9f6aa","dark":false,"decor":["❄️","☃️","✦"],"icon":"❄️"},
    "2":{"bg":"#fff1f5","panel":"#ffffff","soft":"#ffecf2","text":"#51293b","muted":"#745364","line":"#e8c7d4","accent":"#8b3558","onAccent":"#ffffff","glowA":"#f6bbcf99","glowB":"#f7d7e299","dark":false,"decor":["💝","💕","🎀"],"icon":"💕"},
    "3":{"bg":"#f2faee","panel":"#ffffff","soft":"#e9f6e9","text":"#23462f","muted":"#466a53","line":"#bbd7c0","accent":"#2b6944","onAccent":"#ffffff","glowA":"#cbe9c099","glowB":"#ddf0c499","dark":false,"decor":["🌱","☘️","🌷"],"icon":"🌱"},
    "4":{"bg":"#fff3f7","panel":"#ffffff","soft":"#ffeaf2","text":"#552d43","muted":"#75566a","line":"#e9c8d7","accent":"#8c4168","onAccent":"#ffffff","glowA":"#f3c5d599","glowB":"#f5e0ed99","dark":false,"decor":["🌸","🌸","✨"],"icon":"🌸"},
    "5":{"bg":"#f2f9ed","panel":"#ffffff","soft":"#ebf6df","text":"#2a4732","muted":"#526653","line":"#cad9b9","accent":"#396e45","onAccent":"#ffffff","glowA":"#d9edb999","glowB":"#f7edbd99","dark":false,"decor":["🌼","🦋","🌿"],"icon":"🌼"},
    "6":{"bg":"#edfaff","panel":"#ffffff","soft":"#e3f6fb","text":"#204657","muted":"#456879","line":"#bfdce6","accent":"#226986","onAccent":"#ffffff","glowA":"#bde7f299","glowB":"#daeeff99","dark":false,"decor":["☁️","🌊","☀️"],"icon":"☁️"},
    "7":{"bg":"#edfafa","panel":"#ffffff","soft":"#e2f5f2","text":"#1f474a","muted":"#456c70","line":"#b6dcd6","accent":"#1f6c72","onAccent":"#ffffff","glowA":"#b4e9e399","glowB":"#ffe2c599","dark":false,"decor":["🏖️","🌴","🐚"],"icon":"🏖️"},
    "8":{"bg":"#101b31","panel":"#1a2b47","soft":"#243856","text":"#f5f8ff","muted":"#d2ddeb","line":"#4b6380","accent":"#f5ce83","onAccent":"#242b39","glowA":"#6c5db855","glowB":"#375c9c55","dark":true,"decor":["🎆","🌙","✦"],"icon":"🎆"},
    "9":{"bg":"#fff8eb","panel":"#ffffff","soft":"#fbefd8","text":"#4c3725","muted":"#715940","line":"#e3d2af","accent":"#795125","onAccent":"#ffffff","glowA":"#f1d79c99","glowB":"#f6e1c099","dark":false,"decor":["🌾","🍂","☀️"],"icon":"🌾"},
    "10":{"bg":"#191526","panel":"#282038","soft":"#372c49","text":"#fcf7ff","muted":"#e1d2ed","line":"#695679","accent":"#ffc07d","onAccent":"#352235","glowA":"#7a488155","glowB":"#b56c2c55","dark":true,"decor":["🎃","👻","🦇"],"icon":"🎃"},
    "11":{"bg":"#fff6ec","panel":"#ffffff","soft":"#f9eadc","text":"#503625","muted":"#745643","line":"#e5ccba","accent":"#844732","onAccent":"#ffffff","glowA":"#e9c6a899","glowB":"#eac59c99","dark":false,"decor":["🍁","🍂","☕"],"icon":"🍁"},
    "12":{"bg":"#112820","panel":"#1b382c","soft":"#284738","text":"#f7fff9","muted":"#d3e7d9","line":"#4e7562","accent":"#ffdb96","onAccent":"#294334","glowA":"#3b8a6555","glowB":"#ba594e55","dark":true,"decor":["🎄","❄️","🎁"],"icon":"🎄"}
  });
  const DEFAULT = {mode:"auto",effect:"subtle"};
  const root = document.documentElement;
  const varNames = ["--bg","--panel","--line","--text","--muted","--purple","--purple2"];
  const seasonNames = ["bg","panel","soft","text","muted","line","accent","onAccent","glowA","glowB"];
  const cssNames = ["--season-bg","--season-panel","--season-soft","--season-text","--season-muted","--season-line","--season-accent","--season-on-accent","--season-glow-a","--season-glow-b"];
  let settings = readSettings(), activeMonth = "", dialog;
  function readSettings(){
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {};
      return {
        mode: value.mode === "off" || value.mode === "auto" || /^(?:[1-9]|1[0-2])$/.test(String(value.mode)) ? String(value.mode || "auto") : "auto",
        effect: ["off","subtle","full"].includes(value.effect) ? value.effect : "subtle"
      };
    } catch (_) { return Object.assign({},DEFAULT); }
  }
  function save(){
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(settings)); } catch (_) {}
  }
  function currentSeoulMonth(){
    return String(Number(new Intl.DateTimeFormat("en-US",{timeZone:SEOUL_ZONE,month:"numeric"}).format(new Date())));
  }
  function ensureScene(){
    let scene = document.getElementById("season-scene");
    if(!scene){
      scene=document.createElement("div");
      scene.id="season-scene"; scene.className="season-scene";
      scene.setAttribute("aria-hidden","true");
      for(let i=0;i<3;i++)scene.appendChild(document.createElement("span"));
      document.body.appendChild(scene);
    }
    return scene;
  }
  function applyShadowTheme(shadowRoot){
    if(!shadowRoot || !shadowRoot.host) return;
    let el=shadowRoot.querySelector("[data-season-shadow]");
    if(!el){
      el=document.createElement("style");
      el.dataset.seasonShadow="1";
      el.textContent=[
        ":host{--bg:var(--season-module-bg)!important;--panel:var(--season-module-panel)!important;--panel2:var(--season-module-soft)!important;--line:var(--season-module-line)!important;--text:var(--season-module-text)!important;--muted:var(--season-module-muted)!important;--accent:var(--season-accent)!important;--violet:var(--season-accent)!important;--violet2:var(--season-accent)!important;--navy:var(--season-module-text)!important;--silver:var(--season-module-soft)!important;--cyan:var(--season-accent)!important;}",
        ".spwn-body,.prediction-body{background:var(--season-module-bg)!important;color:var(--season-module-text)!important;}",
        ".spwn-body header,.prediction-body header,.spwn-body .card,.spwn-body .section,.prediction-body .panel,.prediction-body .card,.prediction-body .asl-panel,.prediction-body .asl-row,.prediction-body .asl-result>div{background:var(--season-module-panel)!important;color:var(--season-module-text)!important;border-color:var(--season-module-line)!important;}",
        ".spwn-body input,.spwn-body select,.spwn-body textarea,.prediction-body input,.prediction-body select,.prediction-body textarea{background:var(--season-module-panel)!important;color:var(--season-module-text)!important;border-color:var(--season-module-line)!important;}",
        ".spwn-body .tabs button,.prediction-body .btn:not(.primary){background:var(--season-module-soft)!important;color:var(--season-module-text)!important;border-color:var(--season-module-line)!important;}",
        ".spwn-body .tabs button.active,.prediction-body .btn.primary,.prediction-body .primary{background:var(--season-accent)!important;color:var(--season-on-accent)!important;border-color:var(--season-accent)!important;}",
        ".prediction-body .asl-title,.prediction-body .asl-row b{color:var(--season-module-text)!important;}",
        ".spwn-body button:focus-visible,.prediction-body button:focus-visible{outline:3px solid var(--season-accent)!important;outline-offset:2px;}"
      ].join("\n");
      shadowRoot.appendChild(el);
    }
    el.disabled = !root.hasAttribute("data-season-theme");
  }
  window.applySeasonThemeToShadow = applyShadowTheme;
  function updateShadowModules(){
    for(const selector of ["[data-spwn-native-host]","[data-prediction-native-host]"]){
      document.querySelectorAll(selector).forEach(host=>applyShadowTheme(host.shadowRoot));
    }
    if(window.__predictionNativeHost)applyShadowTheme(window.__predictionNativeHost.shadowRoot);
  }
  function reset(){
    delete root.dataset.seasonTheme;
    delete root.dataset.seasonMonth;
    delete root.dataset.seasonEffect;
    for(const n of cssNames.concat(varNames,["--season-module-bg","--season-module-panel","--season-module-soft","--season-module-line","--season-module-text","--season-module-muted"]))root.style.removeProperty(n);
    const scene=document.getElementById("season-scene");
    if(scene)scene.remove();
    activeMonth="";
    updateShadowModules();
  }
  function apply(){
    if(settings.mode==="off"){reset();updateTrigger();return;}
    const month = settings.mode==="auto" ? currentSeoulMonth() : settings.mode;
    const p=PALETTES[month];
    if(!p)return;
    root.dataset.seasonTheme=p.dark?"dark":"light";
    root.dataset.seasonMonth=month;
    root.dataset.seasonEffect=settings.effect;
    seasonNames.forEach((n,i)=>root.style.setProperty(cssNames[i],p[n]));
    [["--bg",p.bg],["--panel",p.panel],["--line",p.line],["--text",p.text],["--muted",p.muted],["--purple",p.accent],["--purple2",p.accent]].forEach(pair=>root.style.setProperty(pair[0],pair[1]));
    const modulePalette = p.dark ? {bg:"#f9f6fc",panel:"#ffffff",soft:"#f2eaf6",text:"#352b40",muted:"#64536f",line:"#d7c6df"} : p;
    for(const k of ["bg","panel","soft","text","muted","line"])root.style.setProperty("--season-module-"+k,modulePalette[k]);
    if(activeMonth!==month){
      const scene=ensureScene();
      scene.querySelectorAll("span").forEach((el,i)=>{el.textContent=p.decor[i]});
      activeMonth=month;
    }
    updateShadowModules();
    updateTrigger();
  }
  function updateTrigger(){
    const trigger=document.querySelector("[data-season-theme-open]");
    if(!trigger)return;
    if(settings.mode==="off"){trigger.textContent="🎨 기본 테마";return;}
    const m=settings.mode==="auto"?currentSeoulMonth():settings.mode;
    trigger.textContent=PALETTES[m].icon+" "+m+"월 테마";
    trigger.setAttribute("aria-label","테마 설정: "+NAMES[Number(m)-1]+(settings.mode==="auto"?" 자동":" 수동"));
  }
  function ensureDialog(){
    if(dialog)return dialog;
    dialog=document.createElement("div");
    dialog.className="season-theme-popover";
    dialog.setAttribute("role","dialog");
    dialog.setAttribute("aria-label","월별 테마 설정");
    dialog.hidden=true;
    const title=document.createElement("div");title.className="season-title";
    const strong=document.createElement("strong");strong.textContent="🎨 월별 자동 테마";
    const close=document.createElement("button");close.type="button";close.textContent="×";close.setAttribute("aria-label","닫기");close.addEventListener("click",()=>{dialog.hidden=true});
    title.append(strong,close);
    const modeLabel=document.createElement("label");modeLabel.textContent="사용할 테마";
    const modeSelect=document.createElement("select");modeSelect.dataset.seasonMode="1";
    const opts=[["auto","자동 변경 (한국시간 기준)"],["off","기존 기본 테마"]].concat(NAMES.map((name,i)=>[String(i+1),(i+1)+"월 · "+name]));
    opts.forEach(o=>{const option=document.createElement("option");option.value=o[0];option.textContent=o[1];modeSelect.appendChild(option)});
    modeLabel.appendChild(modeSelect);
    const motionLabel=document.createElement("label");motionLabel.textContent="장식 효과";
    const motionSelect=document.createElement("select");motionSelect.dataset.seasonEffect="1";
    [["off","끄기 · 최고 성능"],["subtle","은은하게 · 추천"],["full","풍성하게"]].forEach(o=>{const option=document.createElement("option");option.value=o[0];option.textContent=o[1];motionSelect.appendChild(option)});
    motionLabel.appendChild(motionSelect);
    const hint=document.createElement("small");hint.textContent="12개월 테마가 매월 1일 자동 전환돼. 글자 대비는 보호하고 승패·종족·일정 표시 색상은 유지해.";
    dialog.append(title,modeLabel,motionLabel,hint);
    document.body.appendChild(dialog);
    modeSelect.addEventListener("change",()=>{settings.mode=modeSelect.value;save();apply()});
    motionSelect.addEventListener("change",()=>{settings.effect=motionSelect.value;save();apply()});
    return dialog;
  }
  function openDialog(){
    ensureDialog();
    dialog.querySelector("[data-season-mode]").value=settings.mode;
    dialog.querySelector("[data-season-effect]").value=settings.effect;
    dialog.hidden=false;
    dialog.querySelector("[data-season-mode]").focus();
  }
  function installTrigger(){
    if(new URLSearchParams(location.search).get("broadcast")==="1")return;
    const actions=document.querySelector(".head .actions");
    if(!actions || actions.querySelector("[data-season-theme-open]"))return;
    const btn=document.createElement("button");
    btn.type="button";btn.className="season-theme-open";
    btn.dataset.seasonThemeOpen="1";
    btn.addEventListener("click",openDialog);
    actions.insertBefore(btn,actions.firstChild);
    updateTrigger();
  }
  apply();
  installTrigger();
  const app=document.getElementById("app");
  if(app)new MutationObserver(installTrigger).observe(app,{childList:true,subtree:true});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&dialog&&!dialog.hidden)dialog.hidden=true});
  document.addEventListener("pointerdown",e=>{if(dialog&&!dialog.hidden&&!dialog.contains(e.target)&&!e.target.closest("[data-season-theme-open]"))dialog.hidden=true});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)apply()});
  window.addEventListener("pageshow",apply);
  setInterval(()=>{if(settings.mode==="auto"&&activeMonth!==currentSeoulMonth())apply()},60000);
  window.DorangSeasonTheme={apply, getSettings:()=>({...settings}),getMonth:()=>root.dataset.seasonMonth||null};
})();