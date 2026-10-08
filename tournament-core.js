(()=>{
  const C={};
  C.SLOT_POSITIONS={
    L0:[83,268,157,30],L1:[83,326,157,30],L2:[83,386,157,30],L3:[83,444,157,30],L4:[83,507,157,30],L5:[83,566,157,30],L6:[83,627,157,30],L7:[83,685,157,30],
    R0:[1303,268,148,30],R1:[1303,326,148,30],R2:[1303,386,148,30],R3:[1303,444,148,30],R4:[1303,507,148,30],R5:[1303,566,148,30],R6:[1303,627,148,30],R7:[1303,685,148,30],
    LQ0:[304,301,91,28],LQ1:[304,417,91,28],LQ2:[304,540,91,28],LQ3:[304,660,91,28],
    RQ0:[1138,301,91,28],RQ1:[1138,417,91,28],RQ2:[1138,540,91,28],RQ3:[1138,660,91,28],
    LS0:[462,361,96,29],LS1:[462,598,96,29],RS0:[977,361,96,29],RS1:[977,598,96,29],
    LF:[520,461,90,30],RF:[926,461,90,30],CHAMP:[680,489,176,38],TL:[566,719,142,31],TR:[824,719,142,31]
  };
  C.blank=()=>({
    event:{title:"토너먼트 대진표",subtitle:"16강 토너먼트",brand:"TOURNAMENT",theme:"purple"},
    roster:Array(16).fill(""),
    teams:Array(16).fill(""),
    started:false,
    results:{},
    updatedAt:Date.now()
  });
  C.normalize=v=>{
    const b=C.blank(),x=v&&typeof v==="object"?v:{};
    return {
      ...b,...x,
      event:{...b.event,...(x.event||{})},
      roster:Array.isArray(x.roster)&&x.roster.length===16?x.roster.map(v=>String(v||"")):b.roster,
      teams:Array.isArray(x.teams)&&x.teams.length===16?x.teams.map(v=>String(v||"")):b.teams,
      results:x.results&&typeof x.results==="object"?{...x.results}:{}
    };
  };
  C.matchup=(state,key)=>{
    const t=state.teams,r=state.results||{};
    if(/^L16_/.test(key)){const i=+key.split("_")[1];return[t[i*2]||"",t[i*2+1]||""];}
    if(/^R16_/.test(key)){const i=+key.split("_")[1];return[t[8+i*2]||"",t[8+i*2+1]||""];}
    if(/^L8_/.test(key)){const i=+key.split("_")[1];return[r["L16_"+i*2]||"",r["L16_"+(i*2+1)]||""];}
    if(/^R8_/.test(key)){const i=+key.split("_")[1];return[r["R16_"+i*2]||"",r["R16_"+(i*2+1)]||""];}
    if(key==="L4")return[r.L8_0||"",r.L8_1||""];
    if(key==="R4")return[r.R8_0||"",r.R8_1||""];
    if(key==="FINAL")return[r.L4||"",r.R4||""];
    if(key==="THIRD")return[C.semiLoser(state,"L"),C.semiLoser(state,"R")];
    return["",""];
  };
  C.semiLoser=(state,side)=>{
    const key=side==="L"?"L4":"R4",m=C.matchup(state,key),w=state.results[key];
    if(!m[0]||!m[1]||!w)return "";
    return m[0]===w?m[1]:m[0];
  };
  C.downstream=key=>{
    if(key.startsWith("L16_"))return["L8_"+Math.floor((+key.split("_")[1])/2),"L4","FINAL","THIRD"];
    if(key.startsWith("R16_"))return["R8_"+Math.floor((+key.split("_")[1])/2),"R4","FINAL","THIRD"];
    if(key.startsWith("L8_"))return["L4","FINAL","THIRD"];
    if(key.startsWith("R8_"))return["R4","FINAL","THIRD"];
    if(key==="L4"||key==="R4")return["FINAL","THIRD"];
    return[];
  };
  C.autoAdvanceByes=state=>{
    const r=state.results||{};
    const children=key=>{
      if(/^L8_/.test(key)){const n=+key.split("_")[1]*2;return["L16_"+n,"L16_"+(n+1)];}
      if(/^R8_/.test(key)){const n=+key.split("_")[1]*2;return["R16_"+n,"R16_"+(n+1)];}
      if(key==="L4")return["L8_0","L8_1"];
      if(key==="R4")return["R8_0","R8_1"];
      if(key==="FINAL")return["L4","R4"];
      return null;
    };
    const status=key=>{
      if(/^L16_/.test(key)||/^R16_/.test(key)){
        const m=C.matchup(state,key),teams=m.filter(Boolean);
        if(teams.length===1)r[key]=teams[0];
        else if(teams.length===0)delete r[key];
        else if(r[key]&&!teams.includes(r[key]))delete r[key];
        return{ready:teams.length<2||!!r[key],team:r[key]||""};
      }
      const kids=children(key);
      if(!kids)return{ready:false,team:""};
      const a=status(kids[0]),b=status(kids[1]);
      if(!a.ready||!b.ready)return{ready:false,team:""};
      const teams=[a.team,b.team].filter(Boolean);
      if(teams.length===1)r[key]=teams[0];
      else if(teams.length===0)delete r[key];
      else if(r[key]&&!teams.includes(r[key]))delete r[key];
      return{ready:teams.length<2||!!r[key],team:r[key]||""};
    };
    status("FINAL");
    return state;
  };
  C.chooseWinner=(state,key,team)=>{
    const m=C.matchup(state,key);
    if(!team||!m.includes(team))return state;
    for(const k of C.downstream(key))delete state.results[k];
    state.results[key]=team;
    return C.autoAdvanceByes(state);
  };
  C.rankings=state=>{
    const f=C.matchup(state,"FINAL"),first=state.results.FINAL||"";
    const second=first&&f[0]&&f[1]?(first===f[0]?f[1]:f[0]):"";
    const third=state.results.THIRD||"";
    return{first,second,third,complete:!!(first&&second&&third)};
  };
  C.slotTeam=(state,id)=>{
    const r=state.results||{},t=state.teams||[];
    if(/^L\d$/.test(id))return t[+id.slice(1)]||"";
    if(/^R\d$/.test(id))return t[8+(+id.slice(1))]||"";
    if(!state.started)return "";
    if(/^LQ\d$/.test(id))return r["L16_"+(+id.slice(2))]||"";
    if(/^RQ\d$/.test(id))return r["R16_"+(+id.slice(2))]||"";
    if(id==="LS0")return r.L8_0||""; if(id==="LS1")return r.L8_1||"";
    if(id==="RS0")return r.R8_0||""; if(id==="RS1")return r.R8_1||"";
    if(id==="LF")return r.L4||""; if(id==="RF")return r.R4||"";
    return "";
  };
  C.keyForSlot=id=>{
    if(/^L\d$/.test(id))return"L16_"+Math.floor((+id.slice(1))/2);
    if(/^R\d$/.test(id))return"R16_"+Math.floor((+id.slice(1))/2);
    if(/^LQ\d$/.test(id))return"L8_"+Math.floor((+id.slice(2))/2);
    if(/^RQ\d$/.test(id))return"R8_"+Math.floor((+id.slice(2))/2);
    if(/^LS\d$/.test(id))return"L4"; if(/^RS\d$/.test(id))return"R4";
    if(id==="LF"||id==="RF")return"FINAL";
    return"";
  };
  C.setupIndexFor=id=>{
    if(/^L\d$/.test(id))return +id.slice(1);
    if(/^R\d$/.test(id))return 8+(+id.slice(1));
    return null;
  };
  C.positionStyle=id=>{
    const [x,y,w,h]=C.SLOT_POSITIONS[id];
    return`left:${x/1536*100}%;top:${y/864*100}%;width:${w/1536*100}%;height:${h/864*100}%`;
  };
  C.roomKey="dorang_tournament_room_v1";
  C.peerPrefix="dorang-tournament-";
  C.sanitizeRoom=v=>String(v||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8);
  C.makeRoom=()=>{
    const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",a=new Uint8Array(8);
    if(crypto?.getRandomValues)crypto.getRandomValues(a);else for(let i=0;i<a.length;i++)a[i]=Math.floor(Math.random()*256);
    return Array.from(a,n=>chars[n%chars.length]).join("");
  };
  C.getRoom=()=>{
    let room=C.sanitizeRoom(localStorage.getItem(C.roomKey));
    if(!room){room=C.makeRoom();localStorage.setItem(C.roomKey,room);}
    return room;
  };
  C.roomFromUrl=()=>C.sanitizeRoom(new URLSearchParams(location.search).get("room"));
  C.broadcastUrl=room=>{
    const u=new URL("./tournament-broadcast.html",location.href);
    u.searchParams.set("room",C.sanitizeRoom(room));
    return u.href;
  };
  window.DorangTournamentCore=C;
})();