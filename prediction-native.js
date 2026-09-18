/* 맞혀도랑 v6.3.0 통합 모듈 · iframe 없이 Shadow DOM에서 실행 */
(()=>{
const TEMPLATE="<div class=\"prediction-body embedded\">\n<div class=\"wrap\">\n<header>\n<button class=\"btn\" onclick=\"window.PredictionNative.openParticipants()\">참가자</button>\n<button class=\"btn\" onclick=\"window.PredictionNative.quickAddParticipant()\">＋ 빠른 참가자</button>\n<button class=\"btn\" onclick=\"window.PredictionNative.openEventSettings()\">대회/팀 설정</button>\n<button class=\"btn\" onclick=\"window.PredictionNative.openSchedule()\">대진표 관리</button>\n<button class=\"btn\" onclick=\"window.PredictionNative.exportData()\">백업</button>\n<label class=\"btn\">복원<input id=\"restoreFile\" type=\"file\" accept=\"application/json\" hidden onchange=\"window.PredictionNative.restoreData(event)\"></label>\n<span id=\"saveState\" class=\"save-state\">✓ 자동 저장됨</span>\n<button class=\"btn danger\" onclick=\"window.PredictionNative.resetTournament()\">대회 초기화</button>\n</header>\n\n<div class=\"layout\">\n<section class=\"card\">\n<h2 id=\"tourTitle\"></h2>\n<div class=\"teamboard\" id=\"teamBoard\" style=\"display:none\">\n<div class=\"team\"><div class=\"teamname\" id=\"teamAName\"></div><div class=\"score\" id=\"teamAScore\">0</div></div>\n<div class=\"sep\">:</div>\n<div class=\"team\"><div class=\"teamname\" id=\"teamBName\"></div><div class=\"score\" id=\"teamBScore\">0</div></div>\n</div>\n\n<div class=\"toolbar\">\n<button class=\"btn primary\" onclick=\"window.PredictionNative.openNewMatch()\">＋ 경기 추가</button>\n<button class=\"btn\" onclick=\"window.PredictionNative.prevMatch()\">◀ 이전 경기</button>\n<button class=\"btn\" onclick=\"window.PredictionNative.nextMatch()\">다음 경기 ▶</button>\n<button class=\"btn\" onclick=\"window.PredictionNative.duplicateMatch()\">이전 대진 복사</button>\n<button class=\"btn\" id=\"lockBtn\" onclick=\"window.PredictionNative.toggleLock()\">🔒 예측 마감</button>\n</div>\n\n<div class=\"match\">\n<div class=\"player\" id=\"p1\">선수 A</div><div class=\"vs\">VS</div><div class=\"player\" id=\"p2\">선수 B</div>\n</div>\n<div class=\"prediction-summary\" id=\"predictionSummary\">\n      <div class=\"vote-card left\"><b id=\"voteP1\">0명 · 0%</b><span id=\"voteP1Name\">선수 A</span></div>\n      <button class=\"missing-card\" id=\"missingBtn\" onclick=\"window.PredictionNative.toggleMissingOnly()\"><b id=\"missingCount\">0명</b><span>미예측</span></button>\n      <div class=\"vote-card right\"><b id=\"voteP2\">0명 · 0%</b><span id=\"voteP2Name\">선수 B</span></div>\n    </div>\n    <div class=\"status\" id=\"status\"></div>\n<div class=\"pred-list\" id=\"predList\"></div>\n\n<div class=\"resultbar\">\n<button class=\"btn good\" id=\"win1\" onclick=\"window.PredictionNative.setWinner(1)\">선수 A 승</button>\n<button class=\"btn good\" id=\"win2\" onclick=\"window.PredictionNative.setWinner(2)\">선수 B 승</button>\n<button class=\"btn\" onclick=\"window.PredictionNative.clearWinner()\">결과 취소</button>\n<button class=\"btn danger\" onclick=\"window.PredictionNative.deleteCurrentMatch()\">경기 삭제</button>\n</div>\n<div id=\"postResultBar\" class=\"post-result-bar\" style=\"display:none\">\n  <div class=\"post-result-text\" id=\"postResultText\"></div>\n  <button class=\"btn primary\" onclick=\"window.PredictionNative.nextMatch()\">다음 경기 ▶</button>\n</div>\n</section>\n\n<aside>\n<section class=\"card\"><h2>🏆 현재 순위</h2>\n<table><thead><tr><th>순위</th><th>참가자</th><th>등락</th><th>적중</th><th>오답</th><th>적중률</th></tr></thead><tbody id=\"rankBody\"></tbody></table>\n</section>\n<section class=\"card\" style=\"margin-top:14px\"><h2>📋 전체 대진</h2><div id=\"history\"></div></section>\n</aside>\n</div>\n</div>\n<div class=\"modal\" id=\"modal\"><div class=\"dialog\" id=\"dialog\"></div></div>\n</div>";
const STYLES="\n:host{--bg:#0a0f1e;--panel:#141b2d;--panel2:#1b2540;--line:#2a3657;--text:#f6f8ff;--muted:#9da9c4;--accent:#7788ff;--good:#30d07b;--bad:#ff6577;--gold:#ffd166}\n*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}.prediction-body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,\"Apple SD Gothic Neo\",\"Noto Sans KR\",sans-serif}\nbutton,input,textarea,select{font:inherit}.wrap{max-width:1280px;margin:auto;padding:16px}header{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-bottom:14px}h1{font-size:23px;margin:0 auto 0 0}\n.btn{border:1px solid var(--line);background:var(--panel2);color:var(--text);border-radius:11px;padding:10px 13px;font-weight:800;cursor:pointer}.primary{background:var(--accent);border-color:transparent}.good{background:#174d35}.danger{background:#542332}\n.layout{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(320px,.65fr);gap:14px}.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:15px}.card h2{font-size:16px;margin:0 0 12px}.toolbar{display:flex;gap:8px;flex-wrap:wrap}\n.teamboard{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;margin:8px 0 12px}.team{background:var(--panel2);border-radius:14px;padding:14px;text-align:center}.teamname{font-size:18px;font-weight:900}.score{font-size:30px;font-weight:1000;margin-top:4px}.sep{font-size:22px;color:var(--muted);font-weight:900}\n.match{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;margin:14px 0}.player{background:var(--panel2);padding:16px 10px;border-radius:14px;text-align:center;font-size:22px;font-weight:900}.teamtag{display:block;font-size:11px;color:var(--muted);margin-top:4px}.vs{color:var(--muted);font-weight:900}\n.status{font-size:13px;color:var(--muted);margin:8px 0 12px}.status b{color:var(--gold)}.pred-list{display:grid;gap:8px}.pred{display:grid;grid-template-columns:150px 1fr 1fr;gap:8px;align-items:center;background:#10172a;padding:8px;border-radius:12px}.name{font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pick{min-height:44px;border:1px solid var(--line);background:var(--panel2);color:var(--text);border-radius:10px;font-weight:800}.pick.on{outline:2px solid var(--accent);background:#29356c}\n.resultbar{display:flex;gap:8px;flex-wrap:wrap;margin-top:13px}table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:9px 6px;border-bottom:1px solid var(--line);text-align:center}th{font-size:12px;color:var(--muted)}td:nth-child(2){text-align:left;font-weight:900}.hist{padding:10px 4px;border-bottom:1px solid var(--line);cursor:pointer}.hist.current{background:#1d2743;border-radius:8px;padding-left:8px}.small{font-size:12px;color:var(--muted)}\n.modal{position:fixed;inset:0;background:#000a;display:none;align-items:center;justify-content:center;padding:18px;z-index:20}.modal.show{display:flex}.dialog{width:min(620px,100%);background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:17px;max-height:90vh;overflow:auto}.dialog h3{margin:0 0 12px}.field{display:grid;gap:6px;margin:10px 0}.field input,.field textarea,.field select{width:100%;background:var(--panel2);border:1px solid var(--line);color:var(--text);border-radius:10px;padding:11px}.field textarea{min-height:210px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.hint{font-size:12px;color:var(--muted);line-height:1.5}\n.sidebox{background:#10172a;border:1px solid var(--line);border-radius:14px;padding:12px}.sidebox h4{margin:0 0 8px}.teamchoices{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px}.teamchoice{border:1px solid var(--line);background:var(--panel2);color:var(--text);padding:11px 8px;border-radius:10px;font-weight:900}.teamchoice.on{background:var(--accent);border-color:transparent}\n.playerlist{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.playerchip{border:1px solid var(--line);background:var(--panel2);color:var(--text);padding:9px 11px;border-radius:999px;font-weight:800}.playerchip.on{outline:2px solid var(--accent);background:#29356c}\n@media(max-width:900px){.layout{grid-template-columns:1fr}.pred{grid-template-columns:105px 1fr 1fr}.player{font-size:18px}}@media(max-width:520px){.grid2{grid-template-columns:1fr}.pred{grid-template-columns:88px 1fr 1fr}.player{font-size:17px}.teamchoices{grid-template-columns:1fr}.teamname{font-size:15px}}\n\n.schedule-editor{display:grid;gap:8px;margin:10px 0}\n.schedule-head,.schedule-row{display:grid;grid-template-columns:52px minmax(120px,1fr) minmax(120px,1fr) 118px;gap:7px;align-items:center}\n.schedule-head{font-size:12px;color:var(--muted);font-weight:800;padding:0 4px}\n.schedule-row{background:#10172a;border:1px solid var(--line);border-radius:12px;padding:8px}\n.game-no{text-align:center;font-weight:1000;color:var(--gold)}\n.schedule-row input{width:100%;background:var(--panel2);border:1px solid var(--line);color:var(--text);border-radius:9px;padding:10px}\n.row-actions{display:flex;gap:5px;justify-content:flex-end}\n.mini{border:1px solid var(--line);background:var(--panel2);color:var(--text);border-radius:8px;padding:8px 9px;font-weight:900;cursor:pointer}\n.mini.danger{background:#542332}\n@media(max-width:620px){\n .schedule-head{display:none}\n .schedule-row{grid-template-columns:38px 1fr 1fr;gap:6px}\n .row-actions{grid-column:1/-1;justify-content:flex-end}\n .schedule-row input{min-width:0}\n}\n\n\n/* ===== 맞혀도랑 v5.0 visual renovation ===== */\n:host{\n --bg:#f8f6fb;--panel:#ffffff;--panel2:#f6f1fa;--line:#e8dfef;\n --text:#342d40;--muted:#95899f;--accent:#8c70c7;--accent2:#cf8fb4;\n --good:#68b89a;--bad:#d98596;--gold:#bf9452;\n --shadow:0 10px 32px rgba(75,52,103,.075);\n}\n.prediction-body{\n background:\n radial-gradient(circle at 8% 0%,rgba(193,164,224,.20),transparent 26%),\n radial-gradient(circle at 92% 4%,rgba(231,174,207,.17),transparent 25%),\n var(--bg);\n}\n.wrap{max-width:1380px;padding:18px 22px 28px}\nheader{\n position:sticky;top:0;z-index:12;padding:12px 0 14px;\n background:rgba(248,246,251,.90);backdrop-filter:blur(15px);\n}\n.brand{margin-right:auto;min-width:230px}\n.brand h1{margin:0;font-size:28px;letter-spacing:-.7px;font-weight:950}\n.brand-icon{filter:saturate(.85)}\n.version{font-size:10px;color:var(--muted);font-weight:800;vertical-align:middle}\n.subtitle{font-size:12px;color:var(--muted);margin:3px 0 0 39px}\n.btn{\n background:#fff;border-color:var(--line);color:var(--text);\n border-radius:12px;padding:10px 13px;box-shadow:0 2px 8px rgba(60,42,82,.025);\n transition:transform .14s ease,box-shadow .14s ease,border-color .14s ease;\n}\n.btn:hover{transform:translateY(-1px);box-shadow:0 7px 17px rgba(70,45,100,.08);border-color:#d6c8e2}\n.primary{background:linear-gradient(135deg,#8b70c8,#c889b0);color:#fff;border-color:transparent}\n.good{background:#edf8f3;color:#347c64;border-color:#cde8dc}\n.danger{background:#fbf0f2;color:#a95567;border-color:#f0d2d9}\n.layout{grid-template-columns:minmax(680px,1.55fr) minmax(390px,.72fr);gap:18px;align-items:start}\n.card{border-color:var(--line);border-radius:20px;box-shadow:var(--shadow);padding:18px}\n.card h2{font-size:15px;color:#4b4057}\naside{position:sticky;top:94px;display:grid;gap:16px;max-height:calc(100vh - 112px)}\naside .card{margin-top:0!important}\naside .card:last-child{overflow:auto;max-height:49vh}\n.team{background:linear-gradient(180deg,#fdfbfe,#f7f1fb);border:1px solid #eadff1}\n.teamname{color:#574b63}.score{color:var(--accent)}\n.player{\n background:linear-gradient(180deg,#fff,#f8f3fb);border:1px solid #e9dff0;\n box-shadow:0 6px 18px rgba(74,49,98,.04);font-size:27px;padding:19px 12px\n}\n.pred{background:#fcfafd;border:1px solid #eee7f3;grid-template-columns:175px 1fr 1fr;padding:9px}\n.pick{background:#fff;border-color:#e7deee}\n.pick.on{outline:none;border-color:transparent;background:linear-gradient(135deg,#8b70c8,#ca8bb1);color:#fff;box-shadow:0 5px 14px rgba(135,100,178,.16)}\n.status{background:#fbf8fd;border:1px solid #eee7f3;border-radius:12px;padding:10px 12px}\n.hist{border:1px solid transparent;border-radius:11px;margin-bottom:5px;padding:10px 8px}\n.hist:hover{background:#faf6fc;border-color:#eee5f3}\n.hist.current{background:#f2ebf8;border-color:#e4d7ed}\ntable tbody tr:hover{background:#fbf8fd}\n.schedule-row{background:#fcfafd;border-color:#eee6f3}\n.schedule-row input,.field input,.field textarea,.field select{background:#fff;border-color:#e5dbea}\n.dialog{border-radius:20px;border-color:#e5dbea;box-shadow:0 20px 60px rgba(35,20,50,.18)}\n.credit{text-align:center;color:#aaa0b2;font-size:11px;padding:4px 0 24px;letter-spacing:.15px}\n.credit b{color:#897b94;font-weight:850}\n.view-toggle{white-space:nowrap}\n\n/* Mobile default */\n@media(max-width:1100px){\n .prediction-body:not(.force-desktop) .layout{grid-template-columns:1fr}\n .prediction-body:not(.force-desktop) aside{position:static;max-height:none}\n .prediction-body:not(.force-desktop) aside .card:last-child{max-height:none}\n}\n@media(max-width:700px){\n .prediction-body:not(.force-desktop) .wrap{padding:12px}\n .prediction-body:not(.force-desktop) header{position:static;gap:7px}\n .prediction-body:not(.force-desktop) .brand{width:100%;margin-bottom:5px}\n .prediction-body:not(.force-desktop) .brand h1{font-size:24px}\n .prediction-body:not(.force-desktop) .subtitle{margin-left:34px}\n .prediction-body:not(.force-desktop) .pred{grid-template-columns:92px 1fr 1fr}\n .prediction-body:not(.force-desktop) .player{font-size:18px;padding:16px 8px}\n .prediction-body:not(.force-desktop) .card{padding:14px;border-radius:17px}\n}\n\n/* Force desktop layout even on iPhone/iPad */\n.prediction-body.force-desktop{min-width:1180px;overflow-x:auto}\n.prediction-body.force-desktop .wrap{min-width:1180px;max-width:1380px}\n.prediction-body.force-desktop .layout{grid-template-columns:minmax(680px,1.55fr) minmax(390px,.72fr)!important}\n.prediction-body.force-desktop aside{position:sticky!important;top:94px!important;max-height:calc(100vh - 112px)!important}\n.prediction-body.force-desktop aside .card:last-child{max-height:49vh!important}\n.prediction-body.force-desktop .pred{grid-template-columns:175px 1fr 1fr!important}\n.prediction-body.force-desktop .player{font-size:27px!important}\n.prediction-body.force-desktop header{position:sticky!important}\n\n\n.race-badge{\n display:inline-flex;align-items:center;justify-content:center;\n min-width:25px;height:25px;padding:0 7px;border-radius:999px;\n font-size:11px;font-weight:950;vertical-align:middle;margin-left:5px;\n border:1px solid transparent\n}\n.race-p{background:#fff4c7;color:#9a7513;border-color:#ead479}\n.race-t{background:#e8f1ff;color:#4d72a8;border-color:#cbdcf3}\n.race-z{background:#f2e8ff;color:#7e4dab;border-color:#ddc9f3}\n.race-r{background:#f1eef3;color:#6e6574;border-color:#ddd6e1}\n.race-select{\n width:100%;background:#fff;border:1px solid #e5dbea;color:var(--text);\n border-radius:9px;padding:10px 8px;font-weight:800\n}\n.schedule-head,.schedule-row{\n grid-template-columns:52px minmax(120px,1fr) 105px minmax(120px,1fr) 105px 118px!important;\n}\n@media(max-width:760px){\n .schedule-head{display:none}\n .schedule-row{\n   grid-template-columns:38px minmax(120px,1fr) 92px!important;\n }\n .schedule-row .p2-input{grid-column:2}\n .schedule-row .race2-select{grid-column:3}\n .schedule-row .row-actions{grid-column:1/-1}\n}\n\n\n.save-state{\n font-size:11px;color:#6d9c88;background:#edf8f3;border:1px solid #d2eade;\n border-radius:999px;padding:7px 10px;white-space:nowrap\n}\n.prediction-summary{\n display:grid;grid-template-columns:1fr 112px 1fr;gap:10px;align-items:stretch;margin:12px 0 10px\n}\n.vote-card,.missing-card{\n border:1px solid var(--line);background:#fbf9fd;border-radius:14px;padding:12px;\n text-align:center;color:var(--text)\n}\n.vote-card b,.missing-card b{display:block;font-size:19px}\n.vote-card span,.missing-card span{display:block;font-size:11px;color:var(--muted);margin-top:2px}\n.vote-card.left b{color:#7860bc}.vote-card.right b{color:#b86f99}\n.missing-card{cursor:pointer;font-weight:800}\n.missing-card.active{background:#fff1f4;border-color:#efcbd4}\n.pred.hidden-by-filter{display:none}\n.post-result-bar{\n margin-top:12px;padding:12px 13px;border:1px solid #e6dcec;border-radius:14px;\n background:linear-gradient(135deg,#faf6fd,#fff8fb);\n display:flex;justify-content:space-between;align-items:center;gap:12px\n}\n.post-result-text{font-size:13px;color:#665a72;font-weight:800}\n.rank-change{font-size:11px;font-weight:900;white-space:nowrap}\n.rank-up{color:#4b9a78}.rank-down{color:#bf6679}.rank-same{color:#aaa0b2}\n@media(max-width:700px){\n .prediction-body:not(.force-desktop) .prediction-summary{grid-template-columns:1fr 90px 1fr;gap:6px}\n .prediction-body:not(.force-desktop) .vote-card,.prediction-body:not(.force-desktop) .missing-card{padding:9px 6px}\n .prediction-body:not(.force-desktop) .vote-card b,.prediction-body:not(.force-desktop) .missing-card b{font-size:16px}\n}\n\n\\n/* ===== v5.3 popup / schedule responsive sizing ===== */\n.modal{padding:16px;overflow:hidden;width:100vw;height:100dvh}\n.dialog{width:min(720px,calc(100vw - 32px));max-width:calc(100vw - 32px);max-height:calc(100dvh - 32px);overflow:auto;overscroll-behavior:contain}\n.dialog.schedule-dialog{width:min(1180px,calc(100vw - 32px));max-width:min(1180px,calc(100vw - 32px));padding:20px}\n.schedule-dialog .schedule-editor{width:100%;overflow:visible}\n.schedule-dialog .schedule-head,.schedule-dialog .schedule-row{width:100%;grid-template-columns:48px minmax(150px,1fr) 116px minmax(150px,1fr) 116px 126px!important}\n.schedule-dialog .schedule-row input,.schedule-dialog .schedule-row select{min-width:0}\n.schedule-dialog > .toolbar{position:sticky;bottom:-1px;z-index:3;background:rgba(255,255,255,.96);backdrop-filter:blur(8px);border-top:1px solid var(--line);padding-top:12px;margin-bottom:-4px}\n.prediction-body.force-desktop .modal{min-width:0!important;width:100vw!important;left:0!important;right:auto!important}\n.prediction-body.force-desktop .dialog{max-width:calc(100vw - 32px)!important}\n.prediction-body.force-desktop .dialog.schedule-dialog{width:min(1180px,calc(100vw - 32px))!important;max-width:calc(100vw - 32px)!important}\n@media(max-width:900px){\n  .dialog{width:calc(100vw - 24px);max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px)}\n  .dialog.schedule-dialog{width:calc(100vw - 24px);max-width:calc(100vw - 24px);padding:16px}\n  .schedule-dialog .schedule-head{display:none}\n  .schedule-dialog .schedule-row{grid-template-columns:42px minmax(0,1fr) 105px!important;gap:7px}\n  .schedule-dialog .p1-input{grid-column:2}.schedule-dialog .race1-select{grid-column:3}\n  .schedule-dialog .p2-input{grid-column:2}.schedule-dialog .race2-select{grid-column:3}\n  .schedule-dialog .row-actions{grid-column:1/-1;justify-content:flex-end}\n}\n@media(max-width:560px){\n  .modal{padding:8px;align-items:flex-start}\n  .dialog{width:calc(100vw - 16px);max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);border-radius:16px;padding:14px}\n  .dialog.schedule-dialog{width:calc(100vw - 16px)!important;max-width:calc(100vw - 16px)!important;padding:12px}\n  .schedule-dialog .schedule-row{display:grid!important;grid-template-columns:34px minmax(0,1fr)!important;gap:7px;padding:10px}\n  .schedule-dialog .game-no{grid-column:1;grid-row:1 / span 4;align-self:start;padding-top:10px}\n  .schedule-dialog .p1-input,.schedule-dialog .race1-select,.schedule-dialog .p2-input,.schedule-dialog .race2-select{grid-column:2!important;width:100%}\n  .schedule-dialog .row-actions{grid-column:1/-1!important;justify-content:flex-end;padding-top:2px}\n  .schedule-dialog .race-select{padding:9px 8px}\n  .schedule-dialog > .toolbar{display:grid;grid-template-columns:1fr 1fr;gap:7px}\n  .schedule-dialog > .toolbar .btn:first-child{grid-column:1/-1}\n}\n\n\n/* ===== v5.4 HARINA MATCHROOM-inspired dark UI ===== */\n:host{--bg:#080b14;--panel:#121728;--panel2:#0d1220;--line:#29324d;--text:#f4f6ff;--muted:#929bb8;--accent:#8067ff;--accent2:#d584aa;--good:#45d6a0;--bad:#ff8fa3;--gold:#ffd670;--shadow:0 16px 40px rgba(0,0,0,.28)}\n:host{background:#080b14}\n.prediction-body{background:radial-gradient(circle at 18% -12%,rgba(77,58,155,.42) 0,transparent 32%),radial-gradient(circle at 90% 0%,rgba(139,60,112,.25) 0,transparent 28%),var(--bg);color:var(--text)}\n.wrap{max-width:1500px;padding:18px 22px 34px}\nheader{background:rgba(8,11,20,.9);border-bottom:1px solid rgba(67,76,112,.32);backdrop-filter:blur(16px);margin-bottom:16px;padding:12px 0}\n.brand h1{color:#fff;text-shadow:0 2px 18px rgba(128,103,255,.2)}.brand .subtitle{color:var(--muted)}\n.version{color:#b9abff;background:#211b3c;border:1px solid #4d4283;border-radius:999px;padding:3px 7px;margin-left:4px}\n.btn{color:var(--text);background:#161d30;border-color:#303a59;box-shadow:none;border-radius:9px}.btn:hover{transform:none;filter:brightness(1.12);border-color:#4c5880;box-shadow:none}\n.primary{background:linear-gradient(135deg,#8067ff,#6750d8);border-color:transparent;color:#fff}.good{color:#a4f1d2;background:#17352d;border-color:#2d6d59}.danger{color:#ff9bac;background:#25121a;border-color:#5a2b3b}.view-toggle{background:#121728}.save-state{color:#85cbb0;background:#10261f;border-color:#285948}\n.layout{grid-template-columns:minmax(720px,1.5fr) minmax(370px,.68fr);gap:14px}.card{background:linear-gradient(145deg,#151b2e,#101523);border:1px solid var(--line);box-shadow:var(--shadow);border-radius:18px;padding:16px}.card h2{color:#fff}\n.team{background:#0d1220;border:1px solid #303958}.teamname{color:#dfe3f5}.teamboard .score{color:#d8ceff}.sep{color:#6e7897}\n.player{background:linear-gradient(145deg,#171d31,#0d1220);border:1px solid #303958;box-shadow:none;color:#fff;padding:16px 10px}.teamtag{color:#8490b0}\n.status{color:#aab3cf;background:#0d1220;border-color:#29324d}.status b{color:#ffd670}\n.vote-card,.missing-card{background:#0d1220;border:1px solid #29324d;color:#fff;border-radius:12px}.vote-card.left b{color:#ad9cff}.vote-card.right b{color:#e5a3c2}.vote-card span,.missing-card span{color:#8f99b7}.missing-card.active{background:#281721;border-color:#6d344b}\n.pred{background:#0d1220;border:1px solid #222b43;border-radius:10px}.name{color:#f5f6ff}.pick{background:#151c2d;border-color:#303a59;color:#eef1ff}.pick.on{background:linear-gradient(135deg,#8067ff,#b26c9a);box-shadow:none;color:#fff}\n.post-result-bar{background:linear-gradient(120deg,#171938,#251427);border-color:#453963}.post-result-text{color:#d7d0eb}\ntable{color:#eef1ff}th{color:#858fab;border-bottom-color:#2a334f}td{border-bottom-color:#242d45}table tbody tr:hover{background:#141b2d}\n.hist{border:1px solid transparent;color:#edf0ff}.hist:hover{background:#151c2e;border-color:#29324d}.hist.current{background:linear-gradient(135deg,#222044,#25172d);border-color:#50456f}.small{color:#8993b0}\n.race-p{background:#5b4a12;color:#ffe78a;border-color:#9c7c22}.race-t{background:#173d78;color:#bcd6ff;border-color:#3567b8}.race-z{background:#4f2b70;color:#dfbaff;border-color:#74449b}.race-r{background:#255544;color:#b8f2da;border-color:#3a8067}\n.dialog{background:linear-gradient(145deg,#151b2e,#101523);border-color:#313a58;box-shadow:0 24px 70px rgba(0,0,0,.55)}.dialog h3{color:#fff}.hint{color:#8d97b3}.field label{color:#939dbc}\n.field input,.field textarea,.field select,.schedule-row input,.race-select{background:#0c101d!important;color:#f4f6ff!important;border-color:#303a59!important}.field input:focus,.field textarea:focus,.field select:focus,.schedule-row input:focus,.race-select:focus{outline:none;border-color:#8067ff!important;box-shadow:0 0 0 2px rgba(128,103,255,.18)}\n.schedule-dialog .schedule-head{color:#8f99b7}.schedule-dialog .schedule-row{background:#0d1220;border-color:#29324d}.game-no{color:#d7c9ff}.mini{color:#eef1ff;background:#192138;border-color:#303a59}.mini.danger{background:#25121a;color:#ff9bac;border-color:#5a2b3b}.schedule-dialog>.toolbar{background:rgba(16,21,35,.97);border-top-color:#29324d}.modal{background:rgba(2,4,10,.78)}\n.credit{color:#5f6986}.credit b{color:#8d96b2}\n::-webkit-scrollbar{width:9px;height:9px}::-webkit-scrollbar-track{background:#0c101d}::-webkit-scrollbar-thumb{background:#3a4568;border-radius:10px}::-webkit-scrollbar-thumb:hover{background:#4c5982}\n@media(min-width:1101px){.wrap{max-width:1800px;padding:14px 18px 24px}header{margin-bottom:10px}.brand h1{font-size:30px}.subtitle{font-size:11px}.btn{padding:7px 10px;font-size:12px}.layout{gap:10px}.card{padding:11px 12px;border-radius:14px}.card h2{font-size:14px;margin-bottom:8px}.teamboard{margin:5px 0 8px}.team{padding:9px}.teamname{font-size:15px}.score{font-size:23px}.toolbar{gap:5px}.player{font-size:21px;padding:11px 8px}.match{margin:8px 0}.status{padding:7px 9px;margin:6px 0 8px;font-size:11px}.prediction-summary{margin:7px 0}.vote-card,.missing-card{padding:8px}.vote-card b,.missing-card b{font-size:15px}.pred-list{gap:4px}.pred{grid-template-columns:150px 1fr 1fr;padding:5px 6px;min-height:38px}.pick{min-height:34px;padding:6px;font-size:12px}.name{font-size:12px}.resultbar{margin-top:8px}th,td{padding:7px 5px;font-size:12px}.hist{padding:7px 8px;margin-bottom:3px}aside{top:76px;gap:10px;max-height:calc(100vh - 90px)}aside .card:last-child{max-height:46vh}}\n@media(max-width:700px){.prediction-body:not(.force-desktop) .card{background:linear-gradient(145deg,#151b2e,#101523);border-color:#29324d}.prediction-body:not(.force-desktop) header{background:transparent;border-bottom:0}.prediction-body:not(.force-desktop) .btn{min-height:40px}}\n\n\n/* ===== v5.5 header harmony tune ===== */\nheader{\n  background:linear-gradient(90deg,rgba(11,14,27,.96),rgba(17,24,43,.95) 52%,rgba(35,16,45,.92));\n  border-bottom:1px solid rgba(91,99,147,.34);\n  box-shadow:0 10px 28px rgba(0,0,0,.28);\n}\n.brand{\n  display:flex;flex-direction:column;justify-content:center;padding:10px 16px;\n  border:1px solid rgba(92,98,153,.34);border-radius:16px;\n  background:linear-gradient(135deg,rgba(38,31,71,.72),rgba(14,20,35,.88));\n  box-shadow:inset 0 1px 0 rgba(255,255,255,.04);\n}\n.brand h1{display:flex;align-items:center;gap:10px;color:#fff;text-shadow:none}\n.brand-icon{\n  display:inline-grid;place-items:center;width:30px;height:30px;border-radius:11px;\n  background:linear-gradient(135deg,#8067ff,#d584aa);color:#fff;font-size:16px;font-weight:900;\n  filter:none;box-shadow:0 8px 18px rgba(128,103,255,.26);\n}\n.brand .subtitle{margin-left:40px;color:#a9b2d0}\n.version{\n  color:#f4f6ff;background:linear-gradient(135deg,#32285d,#5a3d80);\n  border:1px solid rgba(136,118,224,.45);\n}\nheader .btn:not(.danger):not(.good):not(.primary){\n  background:linear-gradient(180deg,#18223a,#10182b);border:1px solid #34405f;color:#eef1ff;\n}\nheader .btn:not(.danger):not(.good):not(.primary):hover{\n  background:linear-gradient(180deg,#1d2946,#152039);border-color:#7d68ff;color:#fff;\n}\nheader .btn.primary{background:linear-gradient(135deg,#8067ff,#6750d8);border-color:transparent}\nheader .save-state{\n  background:linear-gradient(180deg,#132a23,#10211d);border-color:#2d6652;color:#9be1c4;\n}\nheader .danger{\n  background:linear-gradient(180deg,#2e1620,#221119);border-color:#6b3043;color:#ffb2be;\n}\n@media(max-width:700px){\n  .prediction-body:not(.force-desktop) .brand{padding:9px 12px;border-radius:14px}\n  .prediction-body:not(.force-desktop) .brand .subtitle{margin-left:34px}\n  .prediction-body:not(.force-desktop) .brand-icon{width:26px;height:26px;font-size:14px}\n}\n\n\n\n\n/* 맞혀도랑 v6.0 - 화이트 파스텔 카드형 + 고양이 포인트 */\n:host{\n  --bg:#fff9fc !important;\n  --panel:#ffffff !important;\n  --panel2:#fffafd !important;\n  --line:#eadfea !important;\n  --text:#51485f !important;\n  --muted:#958aa2 !important;\n  --accent:#b59aff !important;\n  --accent2:#ffb5cf !important;\n  --good:#79cfae !important;\n  --bad:#ff8da3 !important;\n  --gold:#e5ba57 !important;\n  --shadow:0 14px 34px rgba(178,151,204,.10) !important;\n}\n\n:host{background:#fff9fc !important}\n.prediction-body{\n  background:\n    radial-gradient(circle at 4% 0%,rgba(255,221,238,.70) 0,transparent 25%),\n    radial-gradient(circle at 96% 3%,rgba(222,240,255,.80) 0,transparent 24%),\n    linear-gradient(180deg,#fffafd 0%,#f9fbff 100%) !important;\n  color:var(--text) !important;\n}\n\n.wrap{max-width:1800px !important;padding:16px 20px 30px !important}\n\nheader{\n  position:sticky !important;top:0 !important;z-index:12 !important;\n  margin-bottom:14px !important;padding:12px 0 14px !important;\n  background:rgba(255,250,253,.88) !important;\n  border-bottom:1px solid rgba(222,205,229,.72) !important;\n  box-shadow:none !important;\n  backdrop-filter:blur(16px) !important;\n}\n\n.brand{\n  position:relative !important;\n  margin-right:auto !important;min-width:250px !important;\n  padding:10px 16px !important;\n  border:1.5px solid #e5d8eb !important;\n  border-radius:18px !important;\n  background:linear-gradient(135deg,#ffffff 0%,#fff7fb 58%,#f8f5ff 100%) !important;\n  box-shadow:0 10px 24px rgba(183,153,206,.10) !important;\n}\n.brand::after{\n  content:'🐾';position:absolute;right:12px;bottom:7px;\n  font-size:12px;opacity:.14;pointer-events:none;\n}\n.brand h1{color:#6b5e7f !important;text-shadow:none !important;font-weight:950 !important}\n.brand .subtitle{color:#a095ad !important}\n.brand-icon{\n  background:linear-gradient(145deg,#c5b0ff,#ffb6d2) !important;\n  color:#fff !important;border:2px solid #fff !important;\n  box-shadow:0 6px 16px rgba(184,151,219,.24) !important;\n}\n.version{\n  color:#77658f !important;\n  background:linear-gradient(135deg,#f1eaff,#fff0f6) !important;\n  border:1px solid #d9c7ea !important;\n}\n\n.btn{\n  background:#fff !important;color:#695d7a !important;\n  border:1.5px solid #e3d8e8 !important;border-radius:13px !important;\n  box-shadow:0 5px 14px rgba(180,150,207,.08) !important;\n  transition:transform .14s ease,box-shadow .14s ease,border-color .14s ease !important;\n}\n.btn:hover{transform:translateY(-1px) !important;filter:none !important;border-color:#cdb9df !important;box-shadow:0 8px 18px rgba(180,150,207,.13) !important}\n.btn.primary{background:linear-gradient(135deg,#b79cff,#f0a9ca) !important;color:#fff !important;border-color:transparent !important}\n.btn.good{background:linear-gradient(135deg,#effaf5,#e3f7ee) !important;color:#4b8f74 !important;border-color:#c9eadc !important}\n.btn.danger{background:linear-gradient(135deg,#fff4f7,#ffe6ed) !important;color:#c26178 !important;border-color:#f5c8d5 !important}\n.save-state{background:#eff9f4 !important;border-color:#cce8db !important;color:#5f9a82 !important}\n\n.layout{gap:14px !important}\n.card{\n  position:relative !important;\n  background:rgba(255,255,255,.96) !important;\n  border:1.5px solid #e8ddeb !important;\n  border-radius:20px !important;\n  box-shadow:0 14px 32px rgba(181,151,207,.09),0 4px 12px rgba(127,200,255,.04) !important;\n  color:var(--text) !important;\n}\n.card::after{\n  content:'🐾';position:absolute;right:14px;top:12px;\n  font-size:11px;opacity:.08;pointer-events:none;\n}\n.card h2{color:#74668a !important;font-weight:900 !important}\n\n.team{\n  background:linear-gradient(180deg,#fff 0%,#fff8fc 100%) !important;\n  border:1.5px solid #eadfeb !important;\n  border-radius:16px !important;\n  box-shadow:0 8px 18px rgba(176,154,196,.07) !important;\n}\n.teamname{color:#746981 !important}.teamboard .score{color:#9c7de2 !important}.sep{color:#b4a9bc !important}\n\n.player{\n  background:linear-gradient(180deg,#fff 0%,#fff9fc 100%) !important;\n  border:1.5px solid #e7dbea !important;\n  color:#5b5068 !important;\n  border-radius:18px !important;\n  box-shadow:0 8px 18px rgba(184,158,206,.08) !important;\n}\n.teamtag{color:#9a8fa4 !important}\n\n.status{\n  background:#fffafd !important;border:1.5px solid #eadfeb !important;\n  color:#91869b !important;border-radius:14px !important;\n}\n.status b{color:#b28a2d !important}\n\n.prediction-summary{gap:9px !important}\n.vote-card,.missing-card{\n  background:#fff !important;border:1.5px solid #e8ddeb !important;\n  color:#5e536a !important;border-radius:16px !important;\n  box-shadow:0 7px 16px rgba(180,152,205,.06) !important;\n}\n.vote-card.left b{color:#8a75d3 !important}.vote-card.right b{color:#c9789c !important}\n.vote-card span,.missing-card span{color:#9a8fa6 !important}\n.missing-card.active{background:#fff1f6 !important;border-color:#f2c8d7 !important}\n\n.pred{\n  background:#fff !important;border:1.5px solid #eee5f0 !important;\n  border-radius:13px !important;box-shadow:0 4px 11px rgba(174,151,191,.045) !important;\n}\n.name{color:#5c5267 !important}\n.pick{background:#fff !important;border:1.5px solid #e3d8e8 !important;color:#6c6179 !important;border-radius:11px !important}\n.pick.on{background:linear-gradient(135deg,#c2adff,#f0aecb) !important;color:#fff !important;border-color:transparent !important;box-shadow:0 5px 14px rgba(183,148,215,.14) !important}\n\n.post-result-bar{\n  background:linear-gradient(135deg,#faf6ff,#fff5fa) !important;\n  border:1.5px solid #e5d7eb !important;border-radius:16px !important;\n}\n.post-result-text{color:#786b84 !important}\n\ntable{color:#5d5368 !important}\nth{color:#a095aa !important;border-bottom-color:#eadfeb !important}\ntd{border-bottom-color:#f0e8f1 !important}\ntable tbody tr:hover{background:#fff9fc !important}\n\n.hist{\n  color:#655a71 !important;border:1px solid transparent !important;\n  border-radius:12px !important;\n}\n.hist:hover{background:#fff8fc !important;border-color:#eadfeb !important}\n.hist.current{background:linear-gradient(135deg,#f4eeff,#fff1f6) !important;border-color:#ddcbea !important}\n.small{color:#9a8fa6 !important}\n\n.modal{background:rgba(76,63,88,.26) !important;backdrop-filter:blur(6px) !important}\n.dialog{\n  background:linear-gradient(145deg,#fff 0%,#fffafd 100%) !important;\n  border:1.5px solid #e6d9ea !important;\n  box-shadow:0 24px 65px rgba(85,61,101,.18) !important;\n  color:#574d63 !important;\n}\n.dialog h3{color:#6d6080 !important}\n.hint,.field label{color:#978ba3 !important}\n.field input,.field textarea,.field select,.schedule-row input,.race-select{\n  background:#fff !important;color:#574d63 !important;\n  border:1.5px solid #e1d5e7 !important;border-radius:11px !important;\n  box-shadow:0 1px 0 rgba(255,255,255,.95) inset !important;\n}\n.field input:focus,.field textarea:focus,.field select:focus,.schedule-row input:focus,.race-select:focus{\n  outline:none !important;border-color:#b79cff !important;\n  box-shadow:0 0 0 3px rgba(183,156,255,.13) !important;\n}\n\n.schedule-dialog .schedule-head{color:#978ca2 !important}\n.schedule-dialog .schedule-row{\n  background:linear-gradient(180deg,#fff 0%,#fffafd 100%) !important;\n  border:1.5px solid #e9dfec !important;border-radius:14px !important;\n}\n.schedule-dialog>.toolbar{background:rgba(255,250,253,.97) !important;border-top-color:#e7dbea !important}\n.game-no{color:#a486d8 !important}\n.mini{background:#fff !important;color:#6e627c !important;border:1.5px solid #e2d7e7 !important;border-radius:10px !important}\n.mini.danger{background:#fff1f5 !important;color:#c15f76 !important;border-color:#f3c5d2 !important}\n\n/* 종족 배지: P 노랑 / T 파랑 / Z 보라 */\n.race-p{background:#fff4c7 !important;color:#9a7513 !important;border-color:#ead479 !important}\n.race-t{background:#e6f1ff !important;color:#477ab6 !important;border-color:#bfd9f5 !important}\n.race-z{background:#f1e7ff !important;color:#7e50aa !important;border-color:#dac6f0 !important}\n.race-r{background:#eaf8f2 !important;color:#5b907b !important;border-color:#cce9dc !important}\n\n.credit{color:#b1a7b7 !important}.credit b{color:#8a7c94 !important}\n\n::-webkit-scrollbar-track{background:#fff8fc !important}\n::-webkit-scrollbar-thumb{background:#ddcfE5 !important;border-radius:10px !important}\n::-webkit-scrollbar-thumb:hover{background:#cbb9d6 !important}\n\n@media(min-width:1101px){\n  .card{padding:13px 14px !important}\n  .btn{padding:8px 11px !important}\n  .player{padding:13px 9px !important}\n}\n\n@media(max-width:700px){\n  .prediction-body:not(.force-desktop) header{background:rgba(255,250,253,.94) !important;border-bottom:1px solid #eadfeb !important}\n  .prediction-body:not(.force-desktop) .brand{width:100% !important;border-radius:16px !important}\n  .prediction-body:not(.force-desktop) .card{border-radius:18px !important}\n}\n\n/* ===== v6.0.2 하단 배경 자연스러운 마무리 ===== */\n:host{\n  min-height:100% !important;\n  background:#fff9fc !important;\n}\n.prediction-body{\n  min-height:100vh !important;\n  background:\n    radial-gradient(circle at 4% 0%,rgba(255,221,238,.70) 0,transparent 25%),\n    radial-gradient(circle at 96% 3%,rgba(222,240,255,.80) 0,transparent 24%),\n    radial-gradient(ellipse at 50% 115%,rgba(242,226,255,.52) 0,transparent 48%),\n    linear-gradient(180deg,#fffafd 0%,#fafbff 62%,#fff8fc 100%) !important;\n  background-attachment:fixed !important;\n}\n.credit{\n  background:transparent !important;\n  padding:18px 0 30px !important;\n  margin:0 !important;\n}\n\n\n\n/* ===== v6.0.3 상단 헤더 양끝 띠 제거 ===== */\nheader{\n  background:transparent !important;\n  border-bottom:0 !important;\n  box-shadow:none !important;\n  backdrop-filter:none !important;\n}\n.prediction-body:not(.force-desktop) header{\n  background:transparent !important;\n  border-bottom:0 !important;\n}\n.wrap{background:transparent !important;}\n\n/* ===== v6.0.5 캐릭터 유지 · 중복 HARINA 로고 제거 ===== */\nheader{\n  position:sticky !important;\n  padding-top:12px !important;\n  overflow:visible !important;\n}\nheader::before{\n  content:none !important;\n  display:none !important;\n}\n.brand{\n  min-width:330px !important;\n  min-height:72px !important;\n  padding-left:92px !important;\n  overflow:visible !important;\n}\n.brand::before{\n  content:'';\n  position:absolute;\n  left:8px;\n  bottom:-2px;\n  width:78px;\n  height:80px;\n  background:url('./assets/matchedorang-character.webp?v=605') center bottom/contain no-repeat;\n  filter:drop-shadow(0 7px 10px rgba(184,151,219,.13));\n  pointer-events:none;\n  z-index:1;\n}\n.brand h1,.brand .subtitle{position:relative;z-index:2}\n\n@media(max-width:900px){\n  .prediction-body:not(.force-desktop) header{padding-top:12px !important}\n  .prediction-body:not(.force-desktop) .brand{min-width:0 !important;min-height:66px !important;padding-left:76px !important}\n  .prediction-body:not(.force-desktop) .brand::before{left:6px;width:64px;height:66px}\n}\n\n\n/* ===== v6.0.6 통합 페이지용 컴팩트 헤더 ===== */\n.prediction-body.embedded .wrap{padding-top:8px !important}\n.prediction-body.embedded header{padding:4px 0 8px !important;margin-bottom:8px !important}\n.prediction-body.embedded header .brand{display:none !important}\n\n/* ===== v6.0.7 대진표 종족 선택 폭 보정 ===== */\n.schedule-dialog .schedule-head,.schedule-dialog .schedule-row{\n  grid-template-columns:48px minmax(130px,.85fr) 148px minmax(130px,.85fr) 148px 126px !important;\n}\n.schedule-dialog .race-select{padding-left:10px !important;padding-right:24px !important;font-size:13px !important}\n@media(max-width:900px){\n  .schedule-dialog .schedule-row{grid-template-columns:42px minmax(0,1fr) 138px !important}\n}\n\n/* ===== v6.1.0 통합 티어·종족 자동 입력 ===== */\n.prediction-body.embedded #viewToggle{display:none !important}\n.schedule-dialog .tier-select{\n  width:100%;min-width:0;padding:10px 8px;border:1.5px solid #e1d5e7;border-radius:11px;\n  background:#fff;color:#574d63;font-size:13px;font-weight:800;\n}\n.schedule-dialog .schedule-head,.schedule-dialog .schedule-row{\n  grid-template-columns:44px minmax(105px,.8fr) 92px 122px minmax(105px,.8fr) 92px 122px 112px !important;\n}\n@media(max-width:900px){\n  .schedule-dialog .schedule-row{grid-template-columns:42px minmax(0,1fr) 92px 128px !important}\n  .schedule-dialog .game-no{grid-column:1;grid-row:1 / span 2}\n  .schedule-dialog .p1-input{grid-column:2;grid-row:1}.schedule-dialog .tier1-select{grid-column:3;grid-row:1}.schedule-dialog .race1-select{grid-column:4;grid-row:1}\n  .schedule-dialog .p2-input{grid-column:2;grid-row:2}.schedule-dialog .tier2-select{grid-column:3;grid-row:2}.schedule-dialog .race2-select{grid-column:4;grid-row:2}\n  .schedule-dialog .row-actions{grid-column:1/-1;grid-row:3}\n}\n@media(max-width:560px){\n  .schedule-dialog .schedule-row{grid-template-columns:34px minmax(0,1fr) !important}\n  .schedule-dialog .game-no{grid-column:1;grid-row:1 / span 6}\n  .schedule-dialog .p1-input,.schedule-dialog .tier1-select,.schedule-dialog .race1-select,.schedule-dialog .p2-input,.schedule-dialog .tier2-select,.schedule-dialog .race2-select{grid-column:2 !important;grid-row:auto}\n  .schedule-dialog .row-actions{grid-column:1/-1 !important;grid-row:auto}\n}\n\n:host{display:block;width:100%;min-height:680px;color:#51485f}\n.prediction-body{min-height:680px;background:linear-gradient(180deg,#fffafd 0%,#f9fbff 100%)!important;overflow-x:hidden}\n.prediction-body>.wrap{width:100%;max-width:none!important;padding:10px 14px 24px!important}\n.prediction-body header{position:static!important;margin-bottom:10px!important;padding:4px 0 10px!important}\n.prediction-body header .brand,.prediction-body #viewToggle,.prediction-body .credit{display:none!important}\n.prediction-body header .btn{min-height:38px}\n.prediction-body .layout{align-items:start}\n@media(max-width:700px){\n  :host,.prediction-body{min-height:560px}\n  .prediction-body>.wrap{padding:7px 7px 18px!important}\n  .prediction-body header{gap:6px!important}\n  .prediction-body header .btn{min-height:38px;padding:8px 9px!important;font-size:11px!important}\n}\n";
const ASL_STYLES=`
.asl-panel{margin:12px 0 14px;padding:14px;border:1px solid #eadff1;border-radius:16px;background:linear-gradient(135deg,#fffafd,#f7f2fb)}
.asl-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.asl-title{font-size:16px;font-weight:950}.asl-title small{display:block;margin-top:3px;color:var(--muted);font-size:11px;font-weight:700}
.asl-actions{display:flex;gap:7px;flex-wrap:wrap}.asl-status{margin:10px 0;color:#75687f;font-size:12px;font-weight:800}.asl-list{display:grid;gap:7px}.asl-row{display:grid;grid-template-columns:minmax(90px,150px) 1fr 1fr auto;gap:7px;align-items:center;padding:8px;border:1px solid #eee5f3;border-radius:12px;background:#fff}
.asl-row select{min-width:0;width:100%;padding:9px 8px;border:1px solid #e3d9e9;border-radius:9px;background:#fff;color:var(--text);font-weight:800}.asl-hit{min-width:48px;text-align:center;color:#4b9a78;font-size:11px;font-weight:950}.asl-empty{padding:12px;text-align:center;color:var(--muted);font-size:12px}.asl-result{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.asl-result>div{padding:10px;border-radius:11px;background:#fff;border:1px solid #eadff1;text-align:center}.asl-result b{display:block;color:#765bb0}.asl-result span{font-size:11px;color:var(--muted)}
@media(max-width:650px){.asl-row{grid-template-columns:82px 1fr 1fr}.asl-hit{grid-column:1/-1;text-align:right}.asl-panel{padding:11px}.asl-row select{font-size:12px;padding:9px 5px}}
`;
window.mountPredictionNative=function(host){
  if(!host)return;
  const mounted=window.__predictionNativeHost;
  if(mounted&&mounted!==host){host.replaceWith(mounted);return mounted;}
  if(host.dataset.predictionMounted==='1')return host;
  host.dataset.predictionMounted='1';
  window.__predictionNativeHost=host;
  const root=host.shadowRoot||host.attachShadow({mode:'open'});
  root.innerHTML='<style>'+STYLES+ASL_STYLES+'</style>'+TEMPLATE;
  const realDocument=window.document;
  const aslPanel=realDocument.createElement('div');
  aslPanel.className='asl-panel';
  aslPanel.innerHTML='<div class="asl-head"><div class="asl-title">🏆 ASL 우승·준우승 예측<small>참가자별로 1등과 2등을 선택해</small></div><div class="asl-actions"><button class="btn" onclick="window.PredictionNative.openAslSettings()">선수·결과 설정</button><button class="btn" id="aslLockBtn" onclick="window.PredictionNative.toggleAslLock()">🔒 예측 마감</button></div></div><div id="aslStatus" class="asl-status"></div><div id="aslResult" class="asl-result" style="display:none"></div><div id="aslList" class="asl-list"></div>';
  root.querySelector('.toolbar')?.before(aslPanel);
  const body=root.querySelector('.prediction-body');
  const document={
    querySelector:root.querySelector.bind(root),
    querySelectorAll:root.querySelectorAll.bind(root),
    getElementById:root.getElementById.bind(root),
    createElement:realDocument.createElement.bind(realDocument),
    addEventListener:root.addEventListener.bind(root),
    body,
    visibilityState:'visible'
  };
const KEY='starPredictionManager_v31';
 function blank(){return {tournament:'새 대회',teamA:'',teamB:'',participants:[],matches:[],current:-1,playerRaces:{},playerTiers:{},asl:{players:[],picks:{},locked:false,result:{champion:'',runnerUp:''}},version:32}}
 let data=load();
 function ensureAsl(){
  if(!data.asl||typeof data.asl!=='object')data.asl={};
  if(!Array.isArray(data.asl.players))data.asl.players=[];
  if(!data.asl.picks||typeof data.asl.picks!=='object'||Array.isArray(data.asl.picks))data.asl.picks={};
  if(!data.asl.result||typeof data.asl.result!=='object')data.asl.result={champion:'',runnerUp:''};
  data.asl.locked=!!data.asl.locked;
 }
 ensureAsl();
function ensurePlayerMetaMemory(){
  if(!data.playerRaces||typeof data.playerRaces!=='object'||Array.isArray(data.playerRaces))data.playerRaces={};
  if(!data.playerTiers||typeof data.playerTiers!=='object'||Array.isArray(data.playerTiers))data.playerTiers={};
}
function normalizePlayerKey(v){return String(v||'').trim().replace(/\s+/g,' ').toLocaleLowerCase()}
const SHARED_PLAYER_MASTER_URL='https://hanuri2000-svg.github.io/star-match-manager/players.json';
let SHARED_PLAYER_DIRECTORY={};
function masterPlayerKey(name){return String(name||'').normalize('NFKC').replace(/\s+/g,'').replace(/[^0-9a-z가-힣]/gi,'').toLowerCase()}
function directoryPlayer(name){
  const key=masterPlayerKey(name);
  if(!key)return null;
  if(SHARED_PLAYER_DIRECTORY[key])return SHARED_PLAYER_DIRECTORY[key];
  try{return (window.parent?.HARINA_PLAYER_DIRECTORY||window.HARINA_PLAYER_DIRECTORY||{})[key]||null}catch{return null}
}
async function loadSharedPlayerMaster(force=false){
  try{
    const res=await fetch(SHARED_PLAYER_MASTER_URL+(force?'?t='+Date.now():''),{cache:'no-store'});
    if(!res.ok)throw new Error('shared player DB load failed');
    const payload=await res.json(),list=Array.isArray(payload.players)?payload.players:[];
    const directory={};
    list.filter(p=>p&&p.active!==false&&p.name).forEach(p=>{
      const meta={name:p.name,tier:p.tier||'',race:p.race||''};
      directory[masterPlayerKey(p.name)]=meta;
      (p.aliases||[]).forEach(a=>{if(a)directory[masterPlayerKey(a)]=meta});
    });
    SHARED_PLAYER_DIRECTORY=directory;
    window.HARINA_PLAYER_DIRECTORY=Object.assign({},window.HARINA_PLAYER_DIRECTORY||{},directory);
    let dl=document.getElementById('masterPlayerNames');
    if(!dl){dl=document.createElement('datalist');dl.id='masterPlayerNames';document.body.appendChild(dl)}
    dl.innerHTML=list.filter(p=>p&&p.active!==false&&p.name).map(p=>`<option value="${esc(p.name)}">${esc(p.tier||'')} · ${esc(p.race||'')}</option>`).join('');
    document.querySelectorAll('#np1,#np2,.p1-input,.p2-input').forEach(el=>el.setAttribute('list','masterPlayerNames'));
    if(document.getElementById('np1'))autoPlayerMeta('np1','nr1','nt1');
    if(document.getElementById('np2'))autoPlayerMeta('np2','nr2','nt2');
  }catch(e){console.warn('공용 선수 DB 불러오기 실패, 통합페이지/로컬 기억값 사용',e)}
}
setTimeout(()=>loadSharedPlayerMaster(false),0);
const __masterPlayerObserver=new MutationObserver(()=>document.querySelectorAll('#np1,#np2,.p1-input,.p2-input').forEach(el=>el.setAttribute('list','masterPlayerNames')));
__masterPlayerObserver.observe(document.body,{childList:true,subtree:true});
function rememberedRace(name){ensurePlayerMetaMemory();return data.playerRaces[normalizePlayerKey(name)]||''}
function rememberedTier(name){ensurePlayerMetaMemory();return data.playerTiers[normalizePlayerKey(name)]||''}
function rememberRace(name,race){
  ensurePlayerMetaMemory();
  const key=normalizePlayerKey(name);if(!key)return;
  const r=String(race||'').toUpperCase();
  if(['P','T','Z','R'].includes(r))data.playerRaces[key]=r;else delete data.playerRaces[key];
}
function rememberTier(name,tier){
  ensurePlayerMetaMemory();
  const key=normalizePlayerKey(name);if(!key)return;
  const value=String(tier||'').trim();
  if(value)data.playerTiers[key]=value;else delete data.playerTiers[key];
}
function seedPlayerMetaMemory(){
  ensurePlayerMetaMemory();
  for(const m of (data.matches||[])){
    const k1=normalizePlayerKey(m.p1),k2=normalizePlayerKey(m.p2);
    if(k1&&!data.playerRaces[k1]&&['P','T','Z','R'].includes(m.race1||''))data.playerRaces[k1]=m.race1;
    if(k2&&!data.playerRaces[k2]&&['P','T','Z','R'].includes(m.race2||''))data.playerRaces[k2]=m.race2;
    if(k1&&!data.playerTiers[k1]&&m.tier1)data.playerTiers[k1]=m.tier1;
    if(k2&&!data.playerTiers[k2]&&m.tier2)data.playerTiers[k2]=m.tier2;
  }
}
function autoPlayerMeta(inputId,raceSelectId,tierSelectId){
  const input=document.getElementById(inputId),race=document.getElementById(raceSelectId),tier=document.getElementById(tierSelectId);if(!input)return;
  const meta=directoryPlayer(input.value);
  if(race)race.value=meta?.race||rememberedRace(input.value)||'';
  if(tier)tier.value=meta?.tier||rememberedTier(input.value)||'';
}
function schedulePlayerInput(i,side,el){
  const key=side===1?'p1':'p2',raceKey=side===1?'race1':'race2',tierKey=side===1?'tier1':'tier2';
  scheduleDraft[i][key]=el.value;
  const meta=directoryPlayer(el.value),r=meta?.race||rememberedRace(el.value)||'',tier=meta?.tier||rememberedTier(el.value)||'';
  scheduleDraft[i][raceKey]=r;
  scheduleDraft[i][tierKey]=tier;
  const row=el.closest('.schedule-row'),raceSelect=row?.querySelector(side===1?'.race1-select':'.race2-select'),tierSelect=row?.querySelector(side===1?'.tier1-select':'.tier2-select');
  if(raceSelect)raceSelect.value=r;
  if(tierSelect)tierSelect.value=tier;
}
ensurePlayerMetaMemory();
seedPlayerMetaMemory();
let missingOnly=false;
let previousRanks={};
function load(){try{return JSON.parse(localStorage.getItem(KEY))||blank()}catch(e){return blank()}}
function save(){
  localStorage.setItem(KEY,JSON.stringify(data));
  const s=document.getElementById('saveState');
  if(s){s.textContent='저장 중…';s.style.opacity='.65'}
  render();
  setTimeout(()=>{const x=document.getElementById('saveState');if(x){x.textContent='✓ 자동 저장됨';x.style.opacity='1'}},220);
}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function current(){return data.matches[data.current]||null}
function teamLabel(c){return c==='A'?data.teamA:c==='B'?data.teamB:''}
function teamScore(){let a=0,b=0;data.matches.forEach(m=>{if(!m.winner)return;let t=m.winner===1?m.team1:m.team2;if(t==='A')a++;if(t==='B')b++});return{a,b}}


function raceLabel(r){
  return r==='P'?'프로토스':r==='T'?'테란':r==='Z'?'저그':r==='R'?'랜덤':'';
}
function raceShort(r){ return r||''; }
function raceBadge(r){
  if(!r) return '';
  const cls=r==='P'?'race-p':r==='T'?'race-t':r==='Z'?'race-z':'race-r';
  return `<span class="race-badge ${cls}" title="${raceLabel(r)}">${raceShort(r)}</span>`;
}
function raceOptions(selected=''){
  const opts=[['','미지정'],['P','프로토스 (P)'],['T','테란 (T)'],['Z','저그 (Z)'],['R','랜덤 (R)']];
  return opts.map(([v,n])=>`<option value="${v}" ${selected===v?'selected':''}>${n}</option>`).join('');
}
function tierOptions(selected=''){
  const values=['','갓','킹','잭','조커','스페이드','0티어','1티어','2티어','3티어','4티어','5티어','6티어','7티어','8티어','유스'];
  return values.map(value=>`<option value="${value}" ${selected===value?'selected':''}>${value||'미지정'}</option>`).join('');
}

function aslPlayerOptions(selected='',other=''){
  return '<option value="">선수 선택</option>'+data.asl.players.map(name=>`<option value="${esc(name)}" ${name===selected?'selected':''} ${name===other?'disabled':''}>${esc(name)}</option>`).join('');
}
function renderAsl(){
  ensureAsl();
  const list=document.getElementById('aslList'),status=document.getElementById('aslStatus'),lock=document.getElementById('aslLockBtn'),result=document.getElementById('aslResult');
  if(!list||!status||!lock||!result)return;
  const predictions=data.asl.picks||{},entered=data.participants.filter(n=>predictions[n]?.champion&&predictions[n]?.runnerUp).length;
  lock.textContent=data.asl.locked?'🔓 예측 다시 열기':'🔒 예측 마감';
  status.textContent=`ASL 선수 ${data.asl.players.length}명 · 예측 완료 ${entered}/${data.participants.length}명 · ${data.asl.locked?'마감':'진행중'}`;
  const actual=data.asl.result||{};
  result.style.display=actual.champion||actual.runnerUp?'grid':'none';
  result.innerHTML=`<div><span>실제 1등</span><b>${esc(actual.champion||'미입력')}</b></div><div><span>실제 2등</span><b>${esc(actual.runnerUp||'미입력')}</b></div>`;
  if(!data.asl.players.length){list.innerHTML='<div class="asl-empty">선수·결과 설정에서 ASL 출전 선수를 먼저 등록해줘.</div>';return;}
  if(!data.participants.length){list.innerHTML='<div class="asl-empty">예측 참가자를 먼저 등록해줘.</div>';return;}
  list.innerHTML=data.participants.map(name=>{
    const pick=predictions[name]||{champion:'',runnerUp:''};
    const championHit=!!actual.champion&&pick.champion===actual.champion;
    const runnerUpHit=!!actual.runnerUp&&pick.runnerUp===actual.runnerUp;
    const judged=!!(actual.champion&&actual.runnerUp);
    const hitText=judged?(championHit&&runnerUpHit?'완전 적중':`${Number(championHit)+Number(runnerUpHit)}/2 적중`):'';
    return `<div class="asl-row"><div class="name">${esc(name)}</div><select aria-label="${esc(name)} 1등 예측" ${data.asl.locked?'disabled':''} onchange="window.PredictionNative.setAslPick('${encodeURIComponent(name)}','champion',this.value)">${aslPlayerOptions(pick.champion,pick.runnerUp)}</select><select aria-label="${esc(name)} 2등 예측" ${data.asl.locked?'disabled':''} onchange="window.PredictionNative.setAslPick('${encodeURIComponent(name)}','runnerUp',this.value)">${aslPlayerOptions(pick.runnerUp,pick.champion)}</select><div class="asl-hit">${hitText}</div></div>`;
  }).join('');
}
function setAslPick(encodedName,place,value){
  if(data.asl.locked)return;
  const name=decodeURIComponent(encodedName),pick=data.asl.picks[name]||{champion:'',runnerUp:''};
  const other=place==='champion'?'runnerUp':'champion';
  if(value&&pick[other]===value)return alert('1등과 2등은 같은 선수를 선택할 수 없어.');
  pick[place]=value;data.asl.picks[name]=pick;save();
}
function toggleAslLock(){data.asl.locked=!data.asl.locked;save()}
function openAslSettings(){
  const actual=data.asl.result||{};
  modal(`<h3>ASL 우승·준우승 예측 설정</h3><div class="field"><label>ASL 출전 선수 · 한 줄에 한 명씩</label><textarea id="aslPlayers">${esc(data.asl.players.join('\n'))}</textarea></div><div class="grid2"><div class="field"><label>실제 1등</label><select id="aslChampion">${aslPlayerOptions(actual.champion,actual.runnerUp)}</select></div><div class="field"><label>실제 2등</label><select id="aslRunnerUp">${aslPlayerOptions(actual.runnerUp,actual.champion)}</select></div></div><div class="hint">선수 명단만 먼저 저장해 예측을 받고, ASL 종료 후 실제 결과를 입력하면 참가자별 적중 여부가 자동 표시돼.</div><div class="toolbar" style="margin-top:12px"><button class="btn primary" onclick="window.PredictionNative.saveAslSettings()">저장</button><button class="btn" onclick="window.PredictionNative.closeModal()">취소</button></div>`);
}
function saveAslSettings(){
  const players=[...new Set(document.getElementById('aslPlayers').value.split(/\n/).map(x=>x.trim()).filter(Boolean))];
  const champion=document.getElementById('aslChampion')?.value||'',runnerUp=document.getElementById('aslRunnerUp')?.value||'';
  if(champion&&runnerUp&&champion===runnerUp)return alert('실제 1등과 2등은 같은 선수일 수 없어.');
  data.asl.players=players;
  data.asl.result={champion:players.includes(champion)?champion:'',runnerUp:players.includes(runnerUp)?runnerUp:''};
  Object.keys(data.asl.picks).forEach(name=>{const p=data.asl.picks[name];if(!players.includes(p.champion))p.champion='';if(!players.includes(p.runnerUp))p.runnerUp='';});
  closeModal();save();
}

function render(){
 const m=current(), tm=!!(data.teamA||data.teamB), s=teamScore();
 document.getElementById('tourTitle').textContent='🏟️ '+data.tournament;
 document.getElementById('teamBoard').style.display=tm?'grid':'none';
 document.getElementById('teamAName').textContent=data.teamA||'팀 A';
 document.getElementById('teamBName').textContent=data.teamB||'팀 B';
 document.getElementById('teamAScore').textContent=s.a; document.getElementById('teamBScore').textContent=s.b;
 document.getElementById('p1').innerHTML=m?`${esc(m.p1)} ${raceBadge(m.race1||'')}${m.team1?'<span class="teamtag">'+esc(teamLabel(m.team1))+'</span>':''}`:'선수 A';
 document.getElementById('p2').innerHTML=m?`${esc(m.p2)} ${raceBadge(m.race2||'')}${m.team2?'<span class="teamtag">'+esc(teamLabel(m.team2))+'</span>':''}`:'선수 B';
 document.getElementById('win1').textContent=(m?m.p1:'선수 A')+' 승';
 document.getElementById('win2').textContent=(m?m.p2:'선수 B')+' 승';
 document.getElementById('lockBtn').textContent=m&&m.locked?'🔓 예측 다시 열기':'🔒 예측 마감';
 
 const picks=m?.picks||{};
 let c1=0,c2=0;
 data.participants.forEach(n=>{if(picks[n]===1)c1++;else if(picks[n]===2)c2++;});
 const voted=c1+c2;
 const p1pct=voted?Math.round(c1/voted*100):0;
 const p2pct=voted?Math.round(c2/voted*100):0;
 document.getElementById('voteP1').textContent=`${c1}명 · ${p1pct}%`;
 document.getElementById('voteP2').textContent=`${c2}명 · ${p2pct}%`;
 document.getElementById('voteP1Name').textContent=m?m.p1:'선수 A';
 document.getElementById('voteP2Name').textContent=m?m.p2:'선수 B';
 const miss=Math.max(0,data.participants.length-voted);
 document.getElementById('missingCount').textContent=`${miss}명`;
 document.getElementById('missingBtn').classList.toggle('active',missingOnly);
 const prb=document.getElementById('postResultBar');
 if(prb){
   prb.style.display=m&&m.winner?'flex':'none';
   const txt=document.getElementById('postResultText');
   if(txt&&m?.winner) txt.textContent=`${m.winner===1?m.p1:m.p2} 승 · 순위 갱신 완료`;
 }

 document.getElementById('status').innerHTML=m?`${data.current+1}경기 · 예측 ${Object.keys(m.picks||{}).length}/${data.participants.length}명 · <b>${m.locked?'마감':'진행중'}</b>${m.winner?` · 결과 <b>${esc(m.winner===1?m.p1:m.p2)} 승</b>`:''}`:'새 경기를 등록해줘.';
 const pl=document.getElementById('predList');pl.innerHTML='';
 data.participants.forEach(n=>{
   let p=m?.picks?.[n],d=document.createElement('div');d.className='pred'; if(missingOnly && p) d.classList.add('hidden-by-filter');
   d.innerHTML=`<div class="name">${esc(n)}</div>
   <button class="pick ${p===1?'on':''}" ${!m||m.locked||m.winner?'disabled':''} onclick="window.PredictionNative.pick('${encodeURIComponent(n)}',1)">${esc(m?.p1||'A')}</button>
   <button class="pick ${p===2?'on':''}" ${!m||m.locked||m.winner?'disabled':''} onclick="window.PredictionNative.pick('${encodeURIComponent(n)}',2)">${esc(m?.p2||'B')}</button>`;
   pl.appendChild(d)
 });
 renderRanks();renderHistory();renderAsl()
}
function stats(n){let h=0,m=0;data.matches.forEach(x=>{if(x.winner&&x.picks?.[n])x.picks[n]===x.winner?h++:m++});return{h,m,t:h+m,r:h+m?h/(h+m):0}}
function renderRanks(){
 let arr=data.participants.map(n=>({n,...stats(n)}))
   .sort((a,b)=>b.h-a.h||b.r-a.r||a.n.localeCompare(b.n,'ko'));
 const newRanks={};
 arr.forEach((x,i)=>newRanks[x.n]=i+1);
 document.getElementById('rankBody').innerHTML=arr.map((x,i)=>{
   const rank=i+1;
   const prev=previousRanks[x.n];
   let change='<span class="rank-change rank-same">―</span>';
   if(prev && prev>rank) change=`<span class="rank-change rank-up">▲${prev-rank}</span>`;
   else if(prev && prev<rank) change=`<span class="rank-change rank-down">▼${rank-prev}</span>`;
   return `<tr><td>${rank}</td><td>${esc(x.n)}</td><td>${change}</td><td>${x.h}</td><td>${x.m}</td><td>${x.t?(x.r*100).toFixed(1):'0'}%</td></tr>`;
 }).join('');
 previousRanks=newRanks;
}
function renderHistory(){document.getElementById('history').innerHTML=[...data.matches].reverse().map((m,ri)=>{let i=data.matches.length-ri-1,w=m.winner?(m.winner===1?m.p1:m.p2)+' 승':'결과 대기';let vc1=0,vc2=0;Object.values(m.picks||{}).forEach(v=>{if(v===1)vc1++;else if(v===2)vc2++;});return`<div class="hist ${i===data.current?'current':''}" onclick="window.PredictionNative.selectHistory(${i})"><b>${i+1}경기 ${esc(m.p1)} ${raceBadge(m.race1||'')} vs ${esc(m.p2)} ${raceBadge(m.race2||'')}</b><div class="small">${esc(teamLabel(m.team1)||'-')} / ${esc(teamLabel(m.team2)||'-')} · ${vc1}:${vc2} · ${esc(w)}</div></div>`}).join('')||'<div class="small">아직 경기 기록이 없어.</div>'}
function pick(n,v){let m=current();if(!m||m.locked||m.winner)return;m.picks[decodeURIComponent(n)]=v;save()}
function toggleLock(){let m=current();if(m){m.locked=!m.locked;save()}}
function setWinner(v){
  let m=current();if(!m)return;
  const winner=v===1?m.p1:m.p2;
  if(!m.locked && !confirm('예측을 마감하고 결과 입력할까?')) return;
  if(!confirm(`${winner} 승리로 확정할까?\n순위가 다시 계산돼.`)) return;
  m.locked=true;m.winner=v;save();
}
function clearWinner(){let m=current();if(m){m.winner=null;save()}}
function duplicateMatch(){let m=current();if(!m)return;data.matches.push({p1:m.p1,p2:m.p2,race1:m.race1||'',race2:m.race2||'',team1:m.team1||'',team2:m.team2||'',picks:{},locked:false,winner:null});data.current=data.matches.length-1;save()}
function deleteCurrentMatch(){if(data.current<0||!confirm('현재 경기를 삭제할까?'))return;data.matches.splice(data.current,1);data.current=Math.min(data.current,data.matches.length-1);save()}
function resetTournament(){if(!confirm('경기/예측/순위와 ASL 예측 결과를 초기화할까? 참가자와 선수 명단은 유지돼.'))return;data.matches=[];data.current=-1;ensureAsl();data.asl.picks={};data.asl.locked=false;data.asl.result={champion:'',runnerUp:''};save()}
function modal(h){
  const d=document.getElementById('dialog');
  d.className='dialog';
  d.innerHTML=h;
  document.getElementById('modal').classList.add('show');
}
function closeModal(){document.getElementById('modal').classList.remove('show')}
document.getElementById('modal').onclick=e=>{if(e.target.id==='modal')closeModal()}


function toggleMissingOnly(){
  missingOnly=!missingOnly;
  render();
}
function quickAddParticipant(){
  modal(`<h3>빠른 참가자 추가</h3>
    <div class="field"><label>참가자 이름</label><input id="quickParticipantName" placeholder="닉네임" autofocus></div>
    <div class="hint">추가 즉시 현재 경기부터 예측 가능해.</div>
    <div class="toolbar" style="margin-top:12px">
      <button class="btn primary" onclick="window.PredictionNative.saveQuickParticipant()">추가</button>
      <button class="btn" onclick="window.PredictionNative.closeModal()">취소</button>
    </div>`);
}
function saveQuickParticipant(){
  const name=document.getElementById('quickParticipantName')?.value.trim();
  if(!name) return alert('이름을 입력해줘.');
  if(data.participants.includes(name)) return alert('이미 있는 참가자야.');
  data.participants.push(name);
  closeModal();
  save();
}

function openParticipants(){modal(`<h3>참가자 관리</h3><div class="field"><label>한 줄에 한 명씩</label><textarea id="plist">${esc(data.participants.join('\n'))}</textarea></div><div class="toolbar"><button class="btn primary" onclick="window.PredictionNative.saveParticipants()">저장</button><button class="btn" onclick="window.PredictionNative.closeModal()">취소</button></div>`)}
function saveParticipants(){data.participants=[...new Set(document.getElementById('plist').value.split(/\n/).map(x=>x.trim()).filter(Boolean))];closeModal();save()}

function openEventSettings(){modal(`<h3>대회 / 팀 설정</h3><div class="field"><label>대회명</label><input id="tname" value="${esc(data.tournament)}"></div><div class="grid2"><div class="field"><label>팀 A</label><input id="ta" value="${esc(data.teamA)}" placeholder="예: NEWCATSLE"></div><div class="field"><label>팀 B</label><input id="tb" value="${esc(data.teamB)}" placeholder="예: 상대팀"></div></div><div class="hint">팀명을 비우면 개인전처럼 사용할 수 있어.</div><div class="toolbar"><button class="btn primary" onclick="window.PredictionNative.saveEventSettings()">저장</button><button class="btn" onclick="window.PredictionNative.closeModal()">취소</button></div>`)}
function saveEventSettings(){data.tournament=document.getElementById('tname').value.trim()||'새 대회';data.teamA=document.getElementById('ta').value.trim();data.teamB=document.getElementById('tb').value.trim();closeModal();save()}




let scheduleDraft=[];

function openSchedule(){
  scheduleDraft=data.matches.map(m=>({
    p1:m.p1||'',
    p2:m.p2||'',
    tier1:m.tier1||rememberedTier(m.p1)||'',
    tier2:m.tier2||rememberedTier(m.p2)||'',
    race1:m.race1||'',
    race2:m.race2||'',
    picks:m.picks||{},
    locked:!!m.locked,
    winner:m.winner||null
  }));
  if(!scheduleDraft.length) scheduleDraft.push({p1:'',p2:'',tier1:'',tier2:'',race1:'',race2:'',picks:{},locked:false,winner:null});

  modal(`<h3>대진표 관리</h3>
    <div class="hint" style="margin-bottom:8px">
      ${data.teamA||data.teamB
        ? `<b>${esc(data.teamA||'팀 A')}</b> 선수와 <b>${esc(data.teamB||'팀 B')}</b> 선수 이름만 입력하면 돼.`
        : `왼쪽 선수와 오른쪽 선수 이름만 입력하면 돼.`}
    </div>
    <div class="schedule-head">
      <div>경기</div><div>${esc(data.teamA||'왼쪽 선수')}</div><div>티어</div><div>종족</div><div>${esc(data.teamB||'오른쪽 선수')}</div><div>티어</div><div>종족</div><div>관리</div>
    </div>
    <div id="scheduleEditor" class="schedule-editor"></div>
    <div class="toolbar" style="margin-top:10px">
      <button class="btn" onclick="window.PredictionNative.addScheduleRow()">＋ 경기 추가</button>
      <button class="btn primary" onclick="window.PredictionNative.saveSchedule()">대진표 저장</button>
      <button class="btn" onclick="window.PredictionNative.closeModal()">취소</button>
    </div>`);
  document.getElementById('dialog').classList.add('schedule-dialog');
  renderScheduleEditor();
}

function renderScheduleEditor(){
  const box=document.getElementById('scheduleEditor');
  if(!box) return;
  box.innerHTML=scheduleDraft.map((r,i)=>`
    <div class="schedule-row">
      <div class="game-no">${i+1}</div>
      <input class="p1-input" value="${esc(r.p1)}" placeholder="${esc(data.teamA||'왼쪽 선수')}" oninput="window.PredictionNative.schedulePlayerInput(${i},1,this)">
      <select class="tier-select tier1-select" onchange="window.PredictionNative.setScheduleDraft(${i},\'tier1\',this.value)">${tierOptions(r.tier1||'')}</select>
      <select class="race-select race1-select" onchange="window.PredictionNative.setScheduleDraft(${i},\'race1\',this.value)">${raceOptions(r.race1||'')}</select>
      <input class="p2-input" value="${esc(r.p2)}" placeholder="${esc(data.teamB||'오른쪽 선수')}" oninput="window.PredictionNative.schedulePlayerInput(${i},2,this)">
      <select class="tier-select tier2-select" onchange="window.PredictionNative.setScheduleDraft(${i},\'tier2\',this.value)">${tierOptions(r.tier2||'')}</select>
      <select class="race-select race2-select" onchange="window.PredictionNative.setScheduleDraft(${i},\'race2\',this.value)">${raceOptions(r.race2||'')}</select>
      <div class="row-actions">
        <button class="mini" onclick="window.PredictionNative.moveScheduleRow(${i},-1)" ${i===0?'disabled':''}>▲</button>
        <button class="mini" onclick="window.PredictionNative.moveScheduleRow(${i},1)" ${i===scheduleDraft.length-1?'disabled':''}>▼</button>
        <button class="mini danger" onclick="window.PredictionNative.deleteScheduleRow(${i})">삭제</button>
      </div>
    </div>`).join('');
}

function addScheduleRow(){
  scheduleDraft.push({p1:'',p2:'',tier1:'',tier2:'',race1:'',race2:'',picks:{},locked:false,winner:null});
  renderScheduleEditor();
  const box=document.getElementById('scheduleEditor');
  if(box) setTimeout(()=>box.lastElementChild?.querySelector('input')?.focus(),0);
}

function deleteScheduleRow(i){
  if(scheduleDraft.length===1){
    scheduleDraft[0]={p1:'',p2:'',tier1:'',tier2:'',race1:'',race2:'',picks:{},locked:false,winner:null};
  }else{
    scheduleDraft.splice(i,1);
  }
  renderScheduleEditor();
}

function moveScheduleRow(i,dir){
  const j=i+dir;
  if(j<0||j>=scheduleDraft.length) return;
  [scheduleDraft[i],scheduleDraft[j]]=[scheduleDraft[j],scheduleDraft[i]];
  renderScheduleEditor();
}

function saveSchedule(){
  const clean=scheduleDraft
    .map(r=>({...r,p1:(r.p1||'').trim(),p2:(r.p2||'').trim()}))
    .filter(r=>r.p1||r.p2);

  if(clean.some(r=>!r.p1||!r.p2)){
    alert('선수 이름이 한쪽만 입력된 경기가 있어. 두 선수 모두 입력해줘.');
    return;
  }

  clean.forEach(r=>{rememberRace(r.p1,r.race1||'');rememberRace(r.p2,r.race2||'');rememberTier(r.p1,r.tier1||'');rememberTier(r.p2,r.tier2||'')});

  data.matches=clean.map(r=>({
    p1:r.p1,p2:r.p2,
    tier1:r.tier1||'',tier2:r.tier2||'',
    race1:r.race1||'',race2:r.race2||'',
    team1:data.teamA?'A':'',
    team2:data.teamB?'B':'',
    picks:r.picks||{},
    locked:!!r.locked,
    winner:r.winner||null
  }));

  if(!data.matches.length) data.current=-1;
  else if(data.current<0) data.current=0;
  else data.current=Math.min(data.current,data.matches.length-1);

  closeModal();
  save();
}

function openNewMatch(){
  modal(`<h3>경기 추가</h3>
    <div class="grid2">
      <div>
        <div class="field"><label>왼쪽 선수</label><input id="np1" placeholder="선수명" oninput="window.PredictionNative.autoPlayerMeta('np1','nr1','nt1')"></div>
        <div class="field"><label>티어</label><select id="nt1">${tierOptions('')}</select></div>
        <div class="field"><label>종족</label><select id="nr1">${raceOptions('')}</select></div>
      </div>
      <div>
        <div class="field"><label>오른쪽 선수</label><input id="np2" placeholder="선수명" oninput="window.PredictionNative.autoPlayerMeta('np2','nr2','nt2')"></div>
        <div class="field"><label>티어</label><select id="nt2">${tierOptions('')}</select></div>
        <div class="field"><label>종족</label><select id="nr2">${raceOptions('')}</select></div>
      </div>
    </div>
    <div class="hint">팀전이면 왼쪽=팀 A, 오른쪽=팀 B로 자동 적용돼. 통합 티어표에 있는 선수는 이름을 정확히 입력하면 티어와 종족이 자동으로 채워져.</div>
    <div class="toolbar" style="margin-top:12px">
      <button class="btn primary" onclick="window.PredictionNative.addMatch()">추가</button>
      <button class="btn" onclick="window.PredictionNative.closeModal()">취소</button>
    </div>`);
}

function addMatch(){
  const a=document.getElementById('np1').value.trim();
  const b=document.getElementById('np2').value.trim();
  const tier1=document.getElementById('nt1')?.value||'';
  const tier2=document.getElementById('nt2')?.value||'';
  const race1=document.getElementById('nr1')?.value||'';
  const race2=document.getElementById('nr2')?.value||'';
  if(!a||!b) return alert('두 선수 이름을 입력해줘.');
  rememberRace(a,race1);
  rememberRace(b,race2);
  rememberTier(a,tier1);
  rememberTier(b,tier2);

  data.matches.push({
    p1:a,
    p2:b,
    tier1,
    tier2,
    race1,
    race2,
    team1:data.teamA?'A':'',
    team2:data.teamB?'B':'',
    picks:{},
    locked:false,
    winner:null
  });

  if(data.current<0) data.current=0;
  closeModal();
  save();
}

function nextMatch(){
  if(!data.matches.length) return;
  if(data.current<data.matches.length-1){
    data.current++;
    save();
  }else{
    alert('마지막 경기야.');
  }
}

function prevMatch(){
  if(data.current>0){
    data.current--;
    save();
  }
}

function exportData(){let blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='승자예측_'+data.tournament+'.json';a.click()}
function restoreData(e){let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{let x=JSON.parse(r.result);if(!Array.isArray(x.participants)||!Array.isArray(x.matches))throw 0;data=x;ensureAsl();ensurePlayerMetaMemory();seedPlayerMetaMemory();save()}catch(_){alert('올바른 백업 파일이 아니야.')}};r.readAsText(f)}



document.addEventListener('keydown',e=>{
  const tag=(e.target?.tagName||'').toLowerCase();
  if(['input','textarea','select'].includes(tag)) return;
  if(e.key==='ArrowRight'){e.preventDefault();nextMatch();}
  else if(e.key==='ArrowLeft'){e.preventDefault();prevMatch();}
  else if(e.code==='Space'){e.preventDefault();toggleLock();}
  else if(e.key==='1'){e.preventDefault();const m=current();if(m&&m.locked)setWinner(1);}
  else if(e.key==='2'){e.preventDefault();const m=current();if(m&&m.locked)setWinner(2);}
});


function selectHistory(index){
  data.current=Number(index);
  save();
}
function setScheduleDraft(index,key,value){
  if(scheduleDraft[index])scheduleDraft[index][key]=value;
}

window.PredictionNative={addMatch,addScheduleRow,autoPlayerMeta,clearWinner,closeModal,deleteCurrentMatch,deleteScheduleRow,duplicateMatch,exportData,moveScheduleRow,nextMatch,openAslSettings,openEventSettings,openNewMatch,openParticipants,openSchedule,pick,prevMatch,quickAddParticipant,resetTournament,restoreData,saveAslSettings,saveEventSettings,saveParticipants,saveQuickParticipant,saveSchedule,schedulePlayerInput,selectHistory,setAslPick,setScheduleDraft,setWinner,toggleAslLock,toggleLock,toggleMissingOnly};
render();
  return host;
};
const existing=document.querySelector('[data-prediction-native-host]');
if(existing)window.mountPredictionNative(existing);
const RELEASE_VERSION='5.16.3';
function syncReleaseVersion(){
  document.querySelectorAll('.app-version-badge').forEach(el=>{if(el.textContent!=='v'+RELEASE_VERSION)el.textContent='v'+RELEASE_VERSION});
}
syncReleaseVersion();
new MutationObserver(syncReleaseVersion).observe(document.body,{childList:true,subtree:true});
})();
