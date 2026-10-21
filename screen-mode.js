/* Shared layout preference: a real desktop viewport also updates media queries. */
(()=>{
  if(new URLSearchParams(location.search).get('broadcast')==='1')return;
  const KEY='dorang.screenMode.v1';
  const root=document.documentElement;
  const viewport=document.querySelector('meta[name="viewport"]');
  let mode='mobile';
  try{if(localStorage.getItem(KEY)==='pc')mode='pc'}catch{}
  function fitVisibleViewport(){
    const visible=window.visualViewport;
    root.style.setProperty('--screen-visible-height',(visible?.height||innerHeight)+'px');
    const back=document.querySelector('.screen-mode-return');
    if(back){
      back.style.left=((visible?.offsetLeft||0)+12)+'px';
      back.style.top=((visible?.offsetTop||0)+(visible?.height||innerHeight)-back.offsetHeight-16)+'px';
    }
  }
  function apply(){
    root.dataset.screenMode=mode;
    viewport.content=mode==='pc'?'width=1280,initial-scale=1':'width=device-width,initial-scale=1';
    document.querySelectorAll('button[data-screen-mode]').forEach(button=>{
      const active=button.dataset.screenMode===mode;
      if(button.getAttribute('aria-pressed')!==String(active))button.setAttribute('aria-pressed',String(active));
    });
    requestAnimationFrame(fitVisibleViewport);
  }
  apply();
  const style=document.createElement('style');
  style.textContent=`
    .screen-mode-controls{display:inline-flex;gap:3px;align-items:center;flex-wrap:nowrap;padding:3px;border:1px solid var(--line,#d8c6e4);border-radius:10px;background:#fff}
    .screen-mode-controls button{white-space:nowrap;min-height:34px!important;font-size:12px!important}
    .screen-mode-controls button[aria-pressed="true"]{background:#7351a1!important;border-color:#7351a1!important;color:#fff!important}
    .screen-mode-return{display:none}
    @media(hover:none) and (pointer:coarse){
      html[data-screen-mode="pc"],html[data-screen-mode="pc"] body{height:auto!important;overflow:auto!important}
      html[data-screen-mode="pc"] body.app-fit-screen #app{height:auto!important;max-height:none!important;min-height:var(--screen-visible-height,100svh);overflow:visible!important;padding-bottom:72px!important}
      html[data-screen-mode="pc"] body.app-fit-screen #app>.tab-view[style*="display:block"]{flex:none;overflow:visible!important;overscroll-behavior:auto!important}
      html[data-screen-mode="pc"] .screen-mode-return{display:block;position:fixed;left:12px;bottom:auto;z-index:1000;min-height:44px;padding:10px 14px!important;background:#fff!important;color:#513c60!important;border:2px solid #a68bc1!important;box-shadow:0 3px 14px #0003!important;font-size:14px!important}
    }
  `;
  document.head.appendChild(style);
  function install(){
    const actions=document.querySelector('#app > .head > .actions');
    if(actions&&!actions.querySelector('.screen-mode-controls')){
      const controls=document.createElement('div');
      controls.className='screen-mode-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label','화면 모드');
      controls.innerHTML='<button type="button" data-screen-mode="mobile">모바일 화면</button><button type="button" data-screen-mode="pc">PC 화면</button>';
      actions.prepend(controls);
    }
    if(!document.querySelector('.screen-mode-return')){
      const button=document.createElement('button');
      button.type='button';button.className='screen-mode-return';button.dataset.screenMode='mobile';button.textContent='모바일 화면으로';
      document.body.appendChild(button);
    }
    document.querySelectorAll('[data-screen-mode]').forEach(button=>{
      if(button.tagName==='BUTTON')button.setAttribute('aria-pressed',String(button.dataset.screenMode===mode));
    });
    fitVisibleViewport();
  }
  window.addEventListener('resize',fitVisibleViewport);
  window.visualViewport?.addEventListener('resize',fitVisibleViewport);
  window.visualViewport?.addEventListener('scroll',fitVisibleViewport);
  document.addEventListener('click',event=>{
    const button=event.target.closest('button[data-screen-mode]');
    if(!button)return;
    const next=button.dataset.screenMode;
    if(next!=='pc'&&next!=='mobile')return;
    mode=next;
    try{localStorage.setItem(KEY,mode)}catch{}
    apply();
    requestAnimationFrame(()=>window.scrollTo({left:0,top:0,behavior:'instant'}));
  });
  document.addEventListener('DOMContentLoaded',()=>{
    install();
    new MutationObserver(install).observe(document.getElementById('app'),{childList:true,subtree:true});
  },{once:true});
})();
