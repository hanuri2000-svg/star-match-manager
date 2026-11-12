/* 도랑이꺼야 12개월 시즌 테마 엔진 v5.23.5 */
(function () {
  "use strict";
  if (typeof document === "undefined") return;
  const STORAGE_KEY = "dorang-season-theme.v1";
  const SEOUL_ZONE = "Asia/Seoul";
  const NAMES = ["설원의 겨울","로맨틱 발렌타인","민트 새싹","벚꽃 라벤더","햇살 정원","푸른 하늘","트로피컬 바다","여름밤 축제","황금빛 들판","붉은 단풍","라벤더 늦가을","크리스마스"];
  const PALETTES = Object.freeze({
  "1": {
    "bg": "#f7f8fd",
    "panel": "#fffefd",
    "soft": "#edf0fb",
    "text": "#443854",
    "muted": "#71647e",
    "line": "#e8deef",
    "accent": "#8060a8",
    "onAccent": "#ffffff",
    "glowA": "#e8dbf51c",
    "glowB": "#fae6ed24",
    "dark": false,
    "decor": [
      "❄️",
      "☃️",
      "✦"
    ],
    "icon": "❄️"
  },
  "2": {
    "bg": "#fff8fb",
    "panel": "#fffefd",
    "soft": "#fbedf3",
    "text": "#443854",
    "muted": "#71647e",
    "line": "#e8deef",
    "accent": "#8060a8",
    "onAccent": "#ffffff",
    "glowA": "#e8dbf51c",
    "glowB": "#fae6ed24",
    "dark": false,
    "decor": [
      "💝",
      "❤️",
      "🎀"
    ],
    "icon": "💝"
  },
  "3": {
    "bg": "#f6faf8",
    "panel": "#fffefd",
    "soft": "#eaf5ef",
    "text": "#443854",
    "muted": "#71647e",
    "line": "#e8deef",
    "accent": "#8060a8",
    "onAccent": "#ffffff",
    "glowA": "#e8dbf51c",
    "glowB": "#fae6ed24",
    "dark": false,
    "decor": [
      "🌱",
      "🍀",
      "🌷"
    ],
    "icon": "🌱"
  },
  "4": {
    "bg": "#faf7fd",
    "panel": "#fffefd",
    "soft": "#f1e9fa",
    "text": "#443854",
    "muted": "#71647e",
    "line": "#e8deef",
    "accent": "#8060a8",
    "onAccent": "#ffffff",
    "glowA": "#e8dbf51c",
    "glowB": "#fae6ed24",
    "dark": false,
    "decor": [
      "🌸",
      "🪻",
      "🌸"
    ],
    "icon": "🌸"
  },
  "5": {
    "bg": "#fafbf5",
    "panel": "#fffefd",
    "soft": "#f1f4e8",
    "text": "#443854",
    "muted": "#71647e",
    "line": "#e8deef",
    "accent": "#8060a8",
    "onAccent": "#ffffff",
    "glowA": "#e8dbf51c",
    "glowB": "#fae6ed24",
    "dark": false,
    "decor": [
      "🌻",
      "🦋",
      "🌼"
    ],
    "icon": "🌻"
  },
  "6": {
    "bg": "#f6f9fd",
    "panel": "#fffefd",
    "soft": "#eaf1fa",
    "text": "#443854",
    "muted": "#71647e",
    "line": "#e8deef",
    "accent": "#8060a8",
    "onAccent": "#ffffff",
    "glowA": "#e8dbf51c",
    "glowB": "#fae6ed24",
    "dark": false,
    "decor": [
      "☁️",
      "🫧",
      "☀️"
    ],
    "icon": "☁️"
  },
  "7": {
    "bg": "#f5fafb",
    "panel": "#fffefd",
    "soft": "#e7f3f2",
    "text": "#443854",
    "muted": "#71647e",
    "line": "#e8deef",
    "accent": "#8060a8",
    "onAccent": "#ffffff",
    "glowA": "#e8dbf51c",
    "glowB": "#fae6ed24",
    "dark": false,
    "decor": [
      "🌴",
      "🐚",
      "🏖️"
    ],
    "icon": "🌴"
  },
  "8": {
    "bg": "#f8f7fd",
    "panel": "#fffefd",
    "soft": "#efebfa",
    "text": "#443854",
    "muted": "#71647e",
    "line": "#e8deef",
    "accent": "#8060a8",
    "onAccent": "#ffffff",
    "glowA": "#e8dbf51c",
    "glowB": "#fae6ed24",
    "dark": false,
    "decor": [
      "🎆",
      "🌙",
      "✦"
    ],
    "icon": "🎆"
  },
  "9": {
    "bg": "#fdfaf5",
    "panel": "#fffefd",
    "soft": "#f8f0e4",
    "text": "#443854",
    "muted": "#71647e",
    "line": "#e8deef",
    "accent": "#8060a8",
    "onAccent": "#ffffff",
    "glowA": "#e8dbf51c",
    "glowB": "#fae6ed24",
    "dark": false,
    "decor": [
      "🌾",
      "🌻",
      "🌾"
    ],
    "icon": "🌾"
  },
  "10": {
    "bg": "#fff9f5",
    "panel": "#fffefd",
    "soft": "#f9eee8",
    "text": "#443854",
    "muted": "#71647e",
    "line": "#e8deef",
    "accent": "#8060a8",
    "onAccent": "#ffffff",
    "glowA": "#e8dbf51c",
    "glowB": "#fae6ed24",
    "dark": false,
    "decor": [
      "🍁",
      "🌰",
      "🍂"
    ],
    "icon": "🍁"
  },
  "11": {
    "bg": "#faf8fd",
    "panel": "#fffefd",
    "soft": "#f2ebf7",
    "text": "#443854",
    "muted": "#71647e",
    "line": "#e8deef",
    "accent": "#8060a8",
    "onAccent": "#ffffff",
    "glowA": "#e8dbf51c",
    "glowB": "#fae6ed24",
    "dark": false,
    "decor": [
      "🕯️",
      "☕",
      "🍂"
    ],
    "icon": "🕯️"
  },
  "12": {
    "bg": "#f7faf8",
    "panel": "#fffefd",
    "soft": "#eaf3ed",
    "text": "#443854",
    "muted": "#71647e",
    "line": "#e8deef",
    "accent": "#8060a8",
    "onAccent": "#ffffff",
    "glowA": "#e8dbf51c",
    "glowB": "#fae6ed24",
    "dark": false,
    "decor": [
      "🎄",
      "❄️",
      "🎁"
    ],
    "icon": "🎄"
  }
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
      document.body.appendChild(scene);
    }
    while(scene.children.length<6)scene.appendChild(document.createElement("span"));
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
        ".spwn-body .brandtext h1::after,.prediction-body h1::after{content:var(--season-object-primary);display:inline-block;margin-left:9px;font-size:.83em;vertical-align:middle;pointer-events:none;}",
        ".spwn-body button:focus-visible,.prediction-body button:focus-visible{outline:3px solid var(--season-accent)!important;outline-offset:2px;}"
      ].join("\n");
      shadowRoot.appendChild(el);
    }
    el.disabled = !root.hasAttribute("data-season-theme");
    window.applyStarlogThemeToShadow?.(shadowRoot);
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
    for(const n of cssNames.concat(varNames,["--season-module-bg","--season-module-panel","--season-module-soft","--season-module-line","--season-module-text","--season-module-muted","--season-object-primary","--season-object-secondary","--season-object-tertiary","--season-banner-image"]))root.style.removeProperty(n);
    const scene=document.getElementById("season-scene");
    if(scene)scene.remove();
    activeMonth="";
    updateShadowModules();
    renderSeasonDecorations();
  }
  function apply(){
    if(settings.mode==="off"){reset();updateTrigger();return;}
    const month = settings.mode==="auto" ? currentSeoulMonth() : settings.mode;
    const p=PALETTES[month];
    if(!p)return;
    root.dataset.seasonTheme=p.dark?"dark":"light";
    root.dataset.seasonMonth=month;
    root.dataset.seasonEffect=settings.effect;
    root.style.setProperty("--season-banner-image",'url("./assets/season-banners/'+month.padStart(2,"0")+'.svg?v=5.23.5")');
    seasonNames.forEach((n,i)=>root.style.setProperty(cssNames[i],p[n]));
    [["--bg",p.bg],["--panel",p.panel],["--line",p.line],["--text",p.text],["--muted",p.muted],["--purple",p.accent],["--purple2",p.accent]].forEach(pair=>root.style.setProperty(pair[0],pair[1]));
    const modulePalette = p.dark ? {bg:"#f9f6fc",panel:"#ffffff",soft:"#f2eaf6",text:"#352b40",muted:"#64536f",line:"#d7c6df"} : p;
    for(const k of ["bg","panel","soft","text","muted","line"])root.style.setProperty("--season-module-"+k,modulePalette[k]);
    if(activeMonth!==month){
      const scene=ensureScene();
      scene.querySelectorAll("span").forEach((el,i)=>{el.textContent=p.decor[i%p.decor.length]});
      activeMonth=month;
    }
    root.style.setProperty("--season-object-primary",JSON.stringify(p.decor[0]));
    root.style.setProperty("--season-object-secondary",JSON.stringify(p.decor[1]));
    root.style.setProperty("--season-object-tertiary",JSON.stringify(p.decor[2]));
    updateShadowModules();
    updateTrigger();
    renderSeasonDecorations();
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
    const opts=[["auto","자동 변경 (한국시간 기준)"],["off","스타로그 기본 테마"]].concat(NAMES.map((name,i)=>[String(i+1),(i+1)+"월 · "+name]));
    opts.forEach(o=>{const option=document.createElement("option");option.value=o[0];option.textContent=o[1];modeSelect.appendChild(option)});
    modeLabel.appendChild(modeSelect);
    const motionLabel=document.createElement("label");motionLabel.textContent="장식 효과";
    const motionSelect=document.createElement("select");motionSelect.dataset.seasonEffect="1";
    [["off","배경 장식 끄기 · 최고 성능"],["subtle","은은하게 · 추천"],["full","풍성하게"]].forEach(o=>{const option=document.createElement("option");option.value=o[0];option.textContent=o[1];motionSelect.appendChild(option)});
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

  /* 월별 안내 카드는 표시하지 않고 달력 장식만 유지한다. */
  function renderSeasonDecorations(){
    if(new URLSearchParams(location.search).get("broadcast")==="1")return;
    const month = root.dataset.seasonMonth;
    const p = PALETTES[month];
    const oldHero=document.querySelector(".season-hero-badge");
    const oldCalendar=document.querySelector(".season-calendar-symbol");
    if(!p){
      if(oldHero)oldHero.remove();
      if(oldCalendar)oldCalendar.remove();
      return;
    }
    if(oldHero)oldHero.remove();
    const calendarTitle=document.querySelector(".schedule-toolbar h2");
    if(calendarTitle){
      let mark=calendarTitle.querySelector(".season-calendar-symbol");
      if(!mark){
        mark=document.createElement("span");mark.className="season-calendar-symbol";
        mark.setAttribute("aria-hidden","true");calendarTitle.appendChild(mark);
      }
      if(mark.dataset.month!==month){
        mark.dataset.month=month;
        mark.textContent=p.decor[0]+" "+p.decor[1];
      }
    }
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
  renderSeasonDecorations();
  if(app)new MutationObserver(()=>{installTrigger();renderSeasonDecorations()}).observe(app,{childList:true,subtree:true});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&dialog&&!dialog.hidden)dialog.hidden=true});
  document.addEventListener("pointerdown",e=>{if(dialog&&!dialog.hidden&&!dialog.contains(e.target)&&!e.target.closest("[data-season-theme-open]"))dialog.hidden=true});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)apply()});
  window.addEventListener("pageshow",apply);
  setInterval(()=>{if(settings.mode==="auto"&&activeMonth!==currentSeoulMonth())apply()},60000);
  window.DorangSeasonTheme={apply, getSettings:()=>({...settings}),getMonth:()=>root.dataset.seasonMonth||null};
})();