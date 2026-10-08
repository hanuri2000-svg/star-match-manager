/* Shared PeerJS lifecycle for the operator and broadcast window. */
(()=>{
  const MAX_RETRIES=8,DEADLINE=15000;
  window.DorangTournamentTransport={create({hostId,getState,onState=()=>{},onStatus=()=>{}}){
    const host=typeof getState==='function',links=new Map();
    let peer=null,conn=null,retry=null,watchdog=null,attempts=0,stopped=false,blocked=false,reconnecting=false;
    const online=()=>navigator.onLine!==false;
    const status=msg=>onStatus(msg);
    function clearRetry(){clearTimeout(retry);retry=null}
    function drop(c){
      if(!links.has(c))return;
      links.delete(c);if(conn===c)conn=null;
      try{c.close()}catch{}
    }
    function send(c,msg){try{c.send(msg);return true}catch{drop(c);schedule();return false}}
    function snapshot(c){return send(c,{type:'state',state:getState()})}
    function sync(){for(const c of links.keys())if(c.open)snapshot(c)}
    function schedule(){
      if(stopped||blocked||!online()||retry!==null)return;
      if(attempts>=MAX_RETRIES){status('자동 재연결 대기 · 인터넷/화면 복귀 시 재시도');return}
      const delay=Math.min(1000*2**attempts,30000);attempts++;
      retry=setTimeout(()=>{retry=null;recover()},delay);
    }
    function arm(){clearTimeout(watchdog);watchdog=setTimeout(()=>{
      watchdog=null;reconnecting=false;
      if(peer&&!peer.open){const old=peer;peer=null;try{old.destroy()}catch{};schedule()}
    },DEADLINE)}
    function attach(c,p){
      if(stopped||peer!==p){try{c.close()}catch{};return}
      // Replace an earlier channel from the same broadcast peer only.
      for(const old of links.keys())if(old.peer===c.peer)drop(old);
      links.set(c,{last:Date.now(),opened:false});if(!host)conn=c;
      const valid=()=>!stopped&&peer===p&&links.has(c);
      c.on('open',()=>{
        if(!valid())return;
        links.get(c).opened=true;links.get(c).last=Date.now();
        attempts=0;clearRetry();status('송출컴 연결됨');
        if(host)snapshot(c);else send(c,{type:'sync-request'});
      });
      c.on('data',msg=>{
        if(!valid())return;
        links.get(c).last=Date.now();
        if(host&&msg?.type==='sync-request')snapshot(c);
        if(!host&&msg?.type==='state'&&msg.state){attempts=0;clearRetry();onState(msg.state)}
      });
      const lost=()=>{if(!valid())return;drop(c);status('연결 끊김 · 재연결 중');if(!host)schedule()};
      c.on('close',lost);c.on('error',lost);
    }
    function connect(){
      if(stopped||blocked||!online()||!peer?.open||conn)return;
      try{attach(peer.connect(hostId,{reliable:true}),peer)}catch{schedule()}
    }
    function makePeer(){
      if(stopped||blocked||!online()||peer)return;
      try{
        const p=host?new Peer(hostId):new Peer();peer=p;arm();
        p.on('open',()=>{
          if(peer!==p||stopped)return;
          clearTimeout(watchdog);watchdog=null;reconnecting=false;clearRetry();
          if(host){attempts=0;status(links.size?'송출컴 연결됨':'송출컴 연결 대기');sync()}
          else if(conn?.open)send(conn,{type:'sync-request'});else connect();
        });
        p.on('connection',c=>{if(host)attach(c,p);else try{c.close()}catch{}});
        p.on('disconnected',()=>{if(peer!==p||stopped)return;reconnecting=false;status('중계 서버 재연결 중');schedule()});
        p.on('close',()=>{if(peer!==p||stopped)return;peer=null;for(const c of [...links.keys()])drop(c);schedule()});
        p.on('error',err=>{
          if(peer!==p||stopped)return;
          if(['unavailable-id','invalid-id','invalid-key','browser-incompatible','ssl-unavailable'].includes(err?.type)){
            blocked=true;clearRetry();clearTimeout(watchdog);status(err.type==='unavailable-id'?'다른 조작화면이 이미 연결 중':'원격 연결 설정 오류');return;
          }
          status('원격 연결 오류 · 재연결 중');schedule();
        });
      }catch{peer=null;schedule()}
    }
    function recover(){
      if(stopped||blocked||!online())return;
      if(!peer||peer.destroyed){peer=null;makePeer();return}
      if(peer.disconnected){
        if(reconnecting)return;
        reconnecting=true;arm();try{peer.reconnect()}catch{reconnecting=false;schedule()}
      }else if(peer.open){if(host)sync();else if(conn?.open)send(conn,{type:'sync-request'});else connect()}
    }
    function resume(){
      if(stopped||blocked||!online())return;
      attempts=0;clearRetry();check();recover();
    }
    function check(){
      if(stopped||!online())return;
      const now=Date.now();
      for(const [c,info] of [...links]){
        if(now-info.last>=DEADLINE){drop(c);if(!host)schedule()}
        else if(!host&&c.open)send(c,{type:'sync-request'});
      }
    }
    function offline(){clearRetry();clearTimeout(watchdog);watchdog=null;reconnecting=false;for(const c of [...links.keys()])drop(c);status('인터넷 연결 끊김 · 복구 대기')}
    const visible=()=>{if(document.visibilityState!=='hidden')resume()};
    window.addEventListener('online',resume);window.addEventListener('offline',offline);
    window.addEventListener('pageshow',resume);document.addEventListener('visibilitychange',visible);
    const heartbeat=setInterval(check,5000);
    function stop(){
      if(stopped)return;stopped=true;clearRetry();clearTimeout(watchdog);clearInterval(heartbeat);
      window.removeEventListener('online',resume);window.removeEventListener('offline',offline);window.removeEventListener('pageshow',resume);document.removeEventListener('visibilitychange',visible);window.removeEventListener('pagehide',hide);
      for(const c of [...links.keys()])drop(c);try{peer?.destroy()}catch{};peer=null;
    }
    const hide=e=>{if(!e.persisted)stop()};window.addEventListener('pagehide',hide);
    makePeer();
    return {broadcast:sync,stop};
  }};
})();
