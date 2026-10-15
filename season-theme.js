/* 도랑이꺼야 12개월 시즌 테마 엔진 v5.23.4 */
(function () {
  "use strict";
  if (typeof document === "undefined") return;
  const STORAGE_KEY = "dorang-season-theme.v1";
  const SEOUL_ZONE = "Asia/Seoul";
  const NAMES = ["설원의 겨울","로맨틱 발렌타인","민트 새싹","벚꽃 라벤더","햇살 정원","푸른 하늘","트로피컬 바다","여름밤 축제","황금빛 들판","붉은 단풍","버건디 늦가을","크리스마스"];
  const PALETTES = Object.freeze({
    "1":{"bg":"#eaf4fc","panel":"#ffffff","soft":"#e8f1fa","text":"#213c53","muted":"#4a6175","line":"#bacfdf","accent":"#285c85","onAccent":"#ffffff","glowA":"#bbdbefaa","glowB":"#dbe9f6aa","dark":false,"decor":["❄️","☃️","✦"],"icon":"❄️"},
    "2":{"bg":"#ffe4ed","panel":"#fffafd","soft":"#ffcfdf","text":"#592039","muted":"#813a54","line":"#eab0c6","accent":"#973252","onAccent":"#ffffff","glowA":"#ff94b09c","glowB":"#fdd0d9a8","dark":false,"decor":["💝","❤️","🎀"],"icon":"💝"},
    "3":{"bg":"#e4faec","panel":"#fafffe","soft":"#cdf1e3","text":"#174b3a","muted":"#386957","line":"#96d1ba","accent":"#216750","onAccent":"#ffffff","glowA":"#a4edcfab","glowB":"#fff3b3b0","dark":false,"decor":["🌱","🍀","🌷"],"icon":"🌱"},
    "4":{"bg":"#f5ecff","panel":"#fffaff","soft":"#ead8fa","text":"#4a2e64","muted":"#705286","line":"#d3b2e6","accent":"#774391","onAccent":"#ffffff","glowA":"#f5b9d999","glowB":"#d8c0ffa9","dark":false,"decor":["🌸","🪻","🌸"],"icon":"🌸"},
    "5":{"bg":"#dfefb8","panel":"#fcfff2","soft":"#c9e293","text":"#263b1b","muted":"#425d31","line":"#9ac26e","accent":"#365c28","onAccent":"#ffffff","glowA":"#a9e27ac2","glowB":"#ffee9ebc","dark":false,"decor":["🌻","🦋","🌼"],"icon":"🌻"},
    "6":{"bg":"#e3f5ff","panel":"#ffffff","soft":"#d7ebfa","text":"#20465e","muted":"#46697e","line":"#b5d2e9","accent":"#286487","onAccent":"#ffffff","glowA":"#b3dcfa99","glowB":"#d9f1ffa8","dark":false,"decor":["☁️","🫧","☀️"],"icon":"☁️"},
    "7":{"bg":"#c9f4f0","panel":"#faffff","soft":"#a7e5db","text":"#154a4d","muted":"#30686c","line":"#7accc2","accent":"#17666d","onAccent":"#ffffff","glowA":"#66d4c7aa","glowB":"#ffdfad9e","dark":false,"decor":["🌴","🐚","🏖️"],"icon":"🌴"},
    "8":{"bg":"#101b31","panel":"#1a2b47","soft":"#243856","text":"#f5f8ff","muted":"#d2ddeb","line":"#4b6380","accent":"#f5ce83","onAccent":"#242b39","glowA":"#6c5db855","glowB":"#375c9c55","dark":true,"decor":["🎆","🌙","✦"],"icon":"🎆"},
    "9":{"bg":"#fff2bd","panel":"#fffdf3","soft":"#fae29a","text":"#49351a","muted":"#6d522a","line":"#d6b86c","accent":"#77511e","onAccent":"#ffffff","glowA":"#f4d17daa","glowB":"#f9e6aeb5","dark":false,"decor":["🌾","🌻","🌾"],"icon":"🌾"},
    "10":{"bg":"#ffe1cb","panel":"#fff9f3","soft":"#f7c8aa","text":"#532a21","muted":"#794434","line":"#de9e7e","accent":"#923529","onAccent":"#ffffff","glowA":"#ee895ca8","glowB":"#ffd07cac","dark":false,"decor":["🍁","🌰","🍂"],"icon":"🍁"},
    "11":{"bg":"#2b1727","panel":"#422436","soft":"#55374a","text":"#fff5f5","muted":"#e6cbd6","line":"#886579","accent":"#f3cda3","onAccent":"#3b2230","glowA":"#88486877","glowB":"#b0745c66","dark":true,"decor":["🕯️","☕","🍂"],"icon":"🕯️"},
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
    root.style.setProperty("--season-banner-image",'url("./assets/season-banners/'+month.padStart(2,"0")+'.svg?v=5.23.4")');
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
    const opts=[["auto","자동 변경 (한국시간 기준)"],["off","기존 기본 테마"]].concat(NAMES.map((name,i)=>[String(i+1),(i+1)+"월 · "+name]));
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

  /* 오브젝트는 배경에만 숨기지 않고 실제 헤더·달력 제목에 표시한다. */
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
    const title=document.querySelector(".head > div:first-child");
    if(title){
      let badge=title.querySelector(".season-hero-badge");
      if(!badge){
        badge=document.createElement("div");
        badge.className="season-hero-badge";
        badge.setAttribute("aria-label","현재 시즌 테마");
        const subtitle=title.querySelector(".sub");
        if(subtitle)subtitle.insertAdjacentElement("afterend",badge);
        else title.appendChild(badge);
      }
      const signature=month+"-"+p.icon;
      if(badge.dataset.signature!==signature){
        badge.dataset.signature=signature;
        badge.replaceChildren();
        const symbol=document.createElement("span");
        symbol.className="season-hero-symbol";symbol.textContent=p.decor[0];
        const content=document.createElement("span");content.className="season-hero-label";
        const b=document.createElement("strong");b.textContent=Number(month)+"월 · "+NAMES[Number(month)-1];
        const aside=document.createElement("small");aside.textContent=p.decor.join("  ");
        content.append(b,aside);badge.append(symbol,content);
      }
    }
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