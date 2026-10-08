(()=>{
  if(new URLSearchParams(location.search).get('broadcast')==='1')return;

  const style=document.createElement('style');
  style.id='dorang-tournament-integrated-style';
  style.textContent=`
    .tournament-view{margin-top:0}
    .tournament-shell{overflow:hidden;border:1.5px solid #bfa9ce;border-radius:18px;background:linear-gradient(145deg,#fff9fc,#f5f1ff 55%,#eef8ff);box-shadow:0 10px 27px rgba(78,52,99,.16)}
    .tournament-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-bottom:1.5px solid #cbb8d6;background:linear-gradient(110deg,#f3e9f8,#e9f2fc);color:#4e3b59}
    .tournament-bar>div{display:grid;gap:2px;min-width:0}
    .tournament-bar strong{font-size:15px}
    .tournament-bar span{color:#74647d;font-size:11px}
    .tournament-bar a{flex:none;padding:8px 11px;border:1px solid #cdbbd8;border-radius:9px;background:#fff;color:#6d5a8f;font-size:12px;font-weight:900;text-decoration:none}
    .tournament-frame{display:block;width:100%;height:calc(100vh - 238px);min-height:720px;border:0;background:#09070e}
    @media(max-width:760px){
      .tournament-bar span{display:none}
      .tournament-frame{height:calc(100vh - 205px);min-height:620px}
    }
  `;
  document.head.appendChild(style);

  const renderBeforeTournament=render;
  render=function(){
    renderBeforeTournament();
    const nav=document.querySelector('.app-tabs');
    const footer=document.querySelector('#app>footer');
    if(!nav||!footer)return;

    if(!nav.querySelector('[data-tab="tournament"]')){
      const matchTab=nav.querySelector('[data-tab="match"]');
      const button=`<button class="${s.activeTab==='tournament'?'active':''}" data-act="tab" data-tab="tournament">토너먼트</button>`;
      if(matchTab)matchTab.insertAdjacentHTML('afterend',button);
      else nav.insertAdjacentHTML('beforeend',button);
    }

    const content=s.activeTab==='tournament'
      ? `<section class="tournament-shell">
          <div class="tournament-bar">
            <div><strong>토너먼트 대진표</strong><span>범용 16강 · 게임컴 조작 / 송출컴 실시간 연동</span></div>
            <a href="../yut/control.html" target="_blank" rel="noopener noreferrer">새 창에서 열기</a>
          </div>
          <iframe class="tournament-frame" src="../yut/control.html?embed=1" title="토너먼트 대진표 조작화면" allow="clipboard-write"></iframe>
        </section>`
      : '';

    footer.insertAdjacentHTML(
      'beforebegin',
      `<div class="tab-view tournament-view" style="display:${s.activeTab==='tournament'?'block':'none'}">${content}</div>`
    );

    if(s.activeTab==='tournament'){
      document.querySelectorAll('.tab-view:not(.tournament-view)').forEach(v=>v.style.display='none');
    }
  };
})();