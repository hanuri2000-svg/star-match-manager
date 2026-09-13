/* 스폰노트 v1.6.0 통합 모듈 · iframe 없이 Shadow DOM에서 실행 */
(()=>{
const TEMPLATE="<div class=\"spwn-body\">\n    <header>\n      <div class=\"brand\">\n        <div class=\"brandtext\">\n          <h1>스폰노트 <span class=\"version-badge\">v1.6.0</span></h1>\n          <div class=\"brand-subtitle\">STARCRAFT RECORD</div>\n        </div>\n      </div>\n      <div class=\"headright\">\n        <div class=\"storage-note\">이 기기에 자동 저장</div>\n        <div class=\"tabs\">\n          <button id=\"dashTab\" class=\"active\" onclick=\"window.SpwnNative.showTab('dash')\">\n            대시보드</button\n          ><button id=\"logTab\" onclick=\"window.SpwnNative.showTab('log')\">스폰일지</button\n          ><button id=\"tierTab\" onclick=\"window.SpwnNative.showTab('tier')\">티어표</button>\n        </div>\n      </div>\n    </header>\n    <main>\n      \n      <section id=\"dash\">\n        <div class=\"player-setting\">\n          <div class=\"player-setting-copy\">\n            <strong>기준 선수 설정</strong>\n            <span>한 번 저장하면 대시보드, ELO 전적 가져오기, 상대전적 검색에 계속 적용돼.</span>\n          </div>\n          <div class=\"player-setting-controls\">\n            <input\n              id=\"basePlayer\"\n              maxlength=\"30\"\n              placeholder=\"ELOBOARD 여자부 선수 이름\"\n              onkeydown=\"if(event.key==='Enter') window.SpwnNative.saveBasePlayer()\"\n            />\n            <button id=\"basePlayerSaveButton\" type=\"button\" class=\"btn\" onclick=\"window.SpwnNative.saveBasePlayer()\">\n              저장·전적 갱신\n            </button>\n          </div>\n          <div id=\"basePlayerStatus\" class=\"player-setting-status\" aria-live=\"polite\"></div>\n        </div>\n        <div class=\"cards\" id=\"cards\"></div>\n        <div class=\"section\">\n          <h2>종족별 전적</h2>\n          <div class=\"races\" id=\"races\"></div>\n        </div>\n        <div class=\"section\">\n          <h2>🔎 ELOBOARD 상대전적 검색</h2>\n          <div class=\"rival-search\">\n            <div class=\"rival-base-chip\">\n              <span>기준 선수</span>\n              <b id=\"rivalBaseName\">먼저 기준 선수를 저장해줘</b>\n            </div>\n            <input id=\"rivalPlayer\" type=\"hidden\" />\n            <div class=\"field\">\n              <label for=\"rivalOpponent\">상대 선수</label>\n              <input\n                id=\"rivalOpponent\"\n                maxlength=\"30\"\n                placeholder=\"상대 이름\"\n                onkeydown=\"if(event.key==='Enter') window.SpwnNative.searchRival()\"\n              />\n            </div>\n            <button id=\"rivalSearchButton\" type=\"button\" class=\"btn\" onclick=\"window.SpwnNative.searchRival()\">\n              상대전적 조회\n            </button>\n          </div>\n          <div id=\"rivalStatus\" class=\"rival-status\"></div>\n          <div id=\"rivalResult\" class=\"rival-result hidden\"></div>\n        </div>\n        <div class=\"section\">\n          <h2>🔥 최근 작성 10경기</h2>\n          <div class=\"recent\" id=\"recent\"></div>\n        </div>\n        <div class=\"notice\">\n          ※ 기준 선수의 ELOBOARD 전체 공식전을 기준으로 집계·표시됩니다.<br>\n          최근 작성 목록과 스폰일지의 메모·느낀점·피드백은 현재\n          브라우저에 저장되며, 다른 기기로 옮길 때는 백업 파일을 사용해 주세요.\n        </div>\n      </section>\n      <section id=\"log\" class=\"hidden\">\n        <div class=\"toolbar\">\n          <button class=\"btn\" onclick=\"window.SpwnNative.openForm()\">＋ 기록 추가</button\n          ><button class=\"btn\" onclick=\"window.SpwnNative.openEloDialog()\">\n            ↻ ELO 전적 가져오기</button\n          ><input\n            id=\"search\"\n            class=\"search\"\n            placeholder=\"상대·빌드·맵·메모 검색\"\n            oninput=\"window.SpwnNative.renderTable()\"\n          /><button class=\"btn secondary\" onclick=\"window.SpwnNative.exportCsv()\">\n            CSV 내보내기</button\n          ><button class=\"btn secondary\" onclick=\"window.SpwnNative.exportJson()\">\n            백업 저장</button\n          ><label class=\"btn secondary\"\n            >백업 불러오기<input\n              type=\"file\"\n              accept=\".json\"\n              hidden\n              onchange=\"window.SpwnNative.importJson(this)\" /></label\n          ><button class=\"btn danger\" onclick=\"window.SpwnNative.resetAllRecords()\">\n            전체 리셋\n          </button>\n        </div>\n        <div class=\"tablewrap\">\n          <table>\n            <thead>\n              <tr>\n                <th>날짜</th>\n                <th>상대</th>\n                <th>티어</th>\n                <th>종족</th>\n                <th>승패</th>\n                <th>사용 빌드</th>\n                <th>상대 빌드</th>\n                <th>맵</th>\n                <th>패인</th>\n                <th>느낀점 미리보기</th>\n                <th>피드백 미리보기</th>\n                <th>관리</th>\n              </tr>\n            </thead>\n            <tbody id=\"tbody\"></tbody>\n          </table>\n        </div>\n      </section>\n      <section id=\"tier\" class=\"hidden\">\n        <div class=\"section\">\n          <div class=\"tier-head\">\n            <div>\n              <h2>스타 티어표</h2>\n              <div id=\"tierStatus\" class=\"tier-status\" aria-live=\"polite\">\n                티어표를 열면 ELOBOARD 최신 자료를 확인해.\n              </div>\n            </div>\n            <button id=\"tierRefreshButton\" type=\"button\" class=\"btn\" onclick=\"window.SpwnNative.loadTierTable(true)\">\n              ↻ 티어표·LIVE 갱신\n            </button>\n          </div>\n          <div id=\"tierLevelFilters\" class=\"tier-level-filters\" role=\"group\" aria-label=\"티어 선택\"></div>\n          <div class=\"tier-tools\">\n            <input\n              id=\"tierSearch\"\n              class=\"tier-search\"\n              placeholder=\"선수 이름 검색\"\n              oninput=\"window.SpwnNative.setTierSearch(this.value)\"\n            />\n            <div class=\"tier-race-filters\" role=\"group\" aria-label=\"종족 선택\">\n              <button type=\"button\" class=\"active\" data-tier-race=\"ALL\" onclick=\"window.SpwnNative.setTierRace('ALL')\">전체</button>\n              <button type=\"button\" data-tier-race=\"T\" onclick=\"window.SpwnNative.setTierRace('T')\">T</button>\n              <button type=\"button\" data-tier-race=\"Z\" onclick=\"window.SpwnNative.setTierRace('Z')\">Z</button>\n              <button type=\"button\" data-tier-race=\"P\" onclick=\"window.SpwnNative.setTierRace('P')\">P</button>\n            </div>\n            <button id=\"tierLiveOnly\" type=\"button\" class=\"tier-live-toggle\" onclick=\"window.SpwnNative.toggleTierLiveOnly()\" aria-pressed=\"false\">\n              ○ LIVE만\n            </button>\n          </div>\n          <div id=\"tierGroups\" class=\"tier-groups\">\n            <div class=\"empty tier-empty\">티어표를 불러올 준비 중이야</div>\n          </div>\n          <p class=\"tier-note\">\n            여러 티어를 동시에 선택할 수 있어. 선수 사진은 SOOP 방송국, 이름은 ELOBOARD 선수 페이지로 연결돼.\n          </p>\n        </div>\n      </section>\n    </main>\n    \n    <dialog id=\"eloDlg\" class=\"elo-dialog\">\n      <div class=\"modalhead\"><h2>ELOBOARD 전적 가져오기</h2></div>\n      <div class=\"elo-controls\">\n        <div class=\"field\">\n          <label>기준 선수</label\n          ><input\n            id=\"eloPlayer\"\n            placeholder=\"대시보드에서 먼저 설정\"\n            maxlength=\"30\"\n            readonly\n          />\n        </div>\n        <div class=\"field\">\n          <label>조회 시작 날짜</label><input id=\"eloFromDate\" type=\"date\" />\n        </div>\n        <div class=\"field\">\n          <label>최대 가져오기</label\n          ><select id=\"eloPages\">\n            <option value=\"25\" selected>25경기</option>\n            <option value=\"50\">50경기</option>\n            <option value=\"100\">100경기</option>\n          </select>\n        </div>\n        <button\n          id=\"eloLookupButton\"\n          type=\"button\"\n          class=\"btn\"\n          onclick=\"window.SpwnNative.previewElo()\"\n        >\n          전적 조회\n        </button>\n      </div>\n      <div id=\"eloStatus\" class=\"elo-status\"></div>\n      <div class=\"elo-tablewrap\">\n        <table>\n          <thead>\n            <tr>\n              <th>\n                <input\n                  id=\"eloSelectAll\"\n                  type=\"checkbox\"\n                  onchange=\"window.SpwnNative.toggleEloAll(this.checked)\"\n                />\n              </th>\n              <th>날짜</th>\n              <th>상대</th>\n              <th>종족</th>\n              <th>승패</th>\n              <th>맵</th>\n              <th>ELO</th>\n              <th>상태·경기방식</th>\n            </tr>\n          </thead>\n          <tbody id=\"eloPreviewBody\">\n            <tr>\n              <td colspan=\"8\" class=\"empty\">아직 조회하지 않았어</td>\n            </tr>\n          </tbody>\n        </table>\n      </div>\n      <div class=\"elo-actions\">\n        <div class=\"elo-help\">\n          이름으로 선수 개인 페이지를 찾아 전적을 조회해. 기존 기록과 겹치는\n          경기는 자동으로 제외돼.\n        </div>\n        <div>\n          <button type=\"button\" class=\"btn secondary\" onclick=\"window.SpwnNative.closeEloDialog()\">\n            닫기\n          </button>\n          <button\n            id=\"eloImportButton\"\n            type=\"button\"\n            class=\"btn\"\n            onclick=\"window.SpwnNative.importSelectedElo()\"\n            disabled\n          >\n            선택 기록 추가\n          </button>\n        </div>\n      </div>\n    </dialog>\n    <dialog id=\"dlg\">\n      <div class=\"modalhead\"><h2 id=\"formTitle\">기록 추가</h2></div>\n      <form id=\"form\" onsubmit=\"window.SpwnNative.submitForm(event)\">\n        <div class=\"form\">\n          <input type=\"hidden\" name=\"id\" />\n          <div class=\"field\">\n            <label>날짜 *</label><input name=\"date\" type=\"date\" required />\n          </div>\n          <div class=\"field\">\n            <label>상대 *</label><input name=\"opponent\" required oninput=\"window.SpwnNative.autoFillRecordPlayer(this)\" />\n          </div>\n          <div class=\"field\">\n            <label>티어</label\n            ><select name=\"tier\">\n              <option></option>\n              <option>유스</option>\n              <option>8티어</option>\n              <option>7티어</option>\n              <option>6티어</option>\n              <option>5티어</option>\n              <option>4티어</option>\n              <option>3티어</option>\n              <option>2티어</option>\n              <option>1티어</option>\n              <option>Spade</option>\n              <option>Joker</option>\n              <option>Jack</option>\n              <option>King</option>\n              <option>God</option>\n            </select>\n          </div>\n          <div class=\"field\">\n            <label>종족</label\n            ><select name=\"race\">\n              <option></option>\n              <option>테란</option>\n              <option>저그</option>\n              <option>토스</option>\n            </select>\n          </div>\n          <div class=\"field\">\n            <label>승패 *</label\n            ><select name=\"result\" required>\n              <option>승</option>\n              <option>패</option>\n            </select>\n          </div>\n          <div class=\"field\">\n            <label>사용 빌드</label><input name=\"myBuild\" />\n          </div>\n          <div class=\"field\">\n            <label>상대 빌드</label><input name=\"enemyBuild\" />\n          </div>\n          <div class=\"field\"><label>맵</label><input name=\"map\" /></div>\n          <div class=\"field\">\n            <label>패인</label\n            ><select name=\"cause\">\n              <option></option>\n              <option>멀티</option>\n              <option>빌드</option>\n              <option>컨트롤</option>\n              <option>운영</option>\n              <option>판단</option>\n              <option>견제</option>\n              <option>멘탈</option>\n            </select>\n          </div>\n          <div class=\"field span2\">\n            <label>느낀점</label><textarea name=\"note\" rows=\"3\"></textarea>\n          </div>\n          <div class=\"field span2\">\n            <label>피드백</label><textarea name=\"feedback\" rows=\"3\"></textarea>\n          </div>\n        </div>\n        <div class=\"actions\">\n          <button type=\"button\" class=\"btn secondary\" onclick=\"window.SpwnNative.closeRecordDialog()\">\n            취소\n          </button>\n          <button class=\"btn\">저장</button>\n        </div>\n      </form>\n    </dialog>\n    \n    \n  </div>";
const STYLES="\n      :host {\n        --violet: #8b5574;\n        --violet2: #5e3f5a;\n        --navy: #3f3040;\n        --silver: #f3e8ee;\n        --cyan: #d89ab7;\n        --line: #ead8e2;\n        --win: #eff8f3;\n        --lose: #fff0f4;\n      }\n      * {\n        box-sizing: border-box;\n      }\n      .spwn-body {\n        margin: 0;\n        font-family: \"Malgun Gothic\", Arial, sans-serif;\n        color: #4a3742;\n        background:\n          radial-gradient(circle at 85% 5%, #eadff5 0, transparent 27%),\n          radial-gradient(circle at 5% 90%, #f7e3ec 0, transparent 24%),\n          linear-gradient(150deg, #fffafd, #f8f1f5);\n        min-height: 100vh;\n      }\n      .spwn-body::before {\n        content: \"\";\n        position: fixed;\n        left: 72%;\n        top: 57%;\n        width: min(46vw, 720px);\n        aspect-ratio: 464 / 580;\n        transform: translate(-50%, -50%);\n        background: url(\"./assets/brand-watermark.png\") center / contain\n          no-repeat;\n        opacity: 0.12;\n        filter: saturate(0.9) contrast(1.08);\n        pointer-events: none;\n        z-index: 20;\n      }\n      .spwn-body::before {\n        content: none;\n      }\n      header {\n        background: linear-gradient(\n          120deg,\n          #493344 0%,\n          #6d4560 55%,\n          #655072 100%\n        );\n        color: white;\n        padding: 14px 28px;\n        display: flex;\n        align-items: center;\n        justify-content: space-between;\n        box-shadow: 0 8px 28px #3d273644;\n        border-bottom: 2px solid #c68aa8;\n      }\n      .brand {\n        display: flex;\n        align-items: center;\n        gap: 15px;\n        min-height: 82px;\n      }\n      .brandtext h1 {\n        margin: 0;\n        font-size: 25px;\n        letter-spacing: -0.5px;\n      }\n      .brand-subtitle {\n        font-weight: 900;\n        letter-spacing: 4px;\n        color: #f2dfea;\n        font-size: 12px;\n        margin-top: 5px;\n      }\n      .version-badge {\n        display: inline-block;\n        margin-left: 8px;\n        padding: 3px 8px;\n        border-radius: 999px;\n        background: #fff;\n        color: #5e3f5a;\n        font-size: 11px;\n        font-weight: 900;\n        vertical-align: 2px;\n      }\n      .headright {\n        display: flex;\n        align-items: center;\n        gap: 15px;\n      }\n      .storage-note {\n        padding: 8px 11px;\n        border: 1px solid #ffffff38;\n        border-radius: 999px;\n        background: #ffffff12;\n        color: #fff4fa;\n        font-size: 12px;\n        font-weight: 700;\n        white-space: nowrap;\n      }\n      .app-exit {\n        border: 1px solid #ffffff38 !important;\n        background: #a93655 !important;\n        color: #fff !important;\n        box-shadow: 0 4px 12px #12091b33;\n      }\n      .app-exit:disabled {\n        opacity: 0.65;\n        cursor: wait;\n      }\n      .tablewrap th:nth-child(10),\n      .tablewrap td:nth-child(10) {\n        width: 420px;\n        min-width: 420px;\n        max-width: 420px;\n        white-space: normal;\n        overflow-wrap: anywhere;\n        word-break: break-word;\n        line-height: 1.55;\n        vertical-align: top;\n      } /*xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx*/\n      .tabs button,\n      .btn {\n        border: 0;\n        border-radius: 9px;\n        padding: 10px 15px;\n        font-weight: 700;\n        cursor: pointer;\n      }\n      .tabs button {\n        background: #ffffff17;\n        color: white;\n        margin-left: 7px;\n        border: 1px solid #ffffff1c;\n      }\n      .tabs button.active {\n        background: white;\n        color: var(--violet2);\n      }\n      main {\n        padding: 22px;\n        max-width: 1600px;\n        margin: auto;\n      }\n      .hidden {\n        display: none !important;\n      }\n      .cards {\n        display: grid;\n        grid-template-columns: repeat(5, minmax(165px, 1fr));\n        gap: 13px;\n        margin-bottom: 18px;\n      }\n      .player-setting {\n        display: grid;\n        grid-template-columns: minmax(220px, 1fr) minmax(320px, 0.9fr);\n        gap: 14px 22px;\n        align-items: center;\n        margin-bottom: 16px;\n        padding: 17px 19px;\n        border: 1px solid #dfcbd7;\n        border-left: 5px solid #9a607f;\n        border-radius: 14px;\n        background: linear-gradient(145deg, #fff, #f9edf4);\n        box-shadow: 0 7px 24px #633d5112;\n      }\n      .player-setting-copy strong {\n        display: block;\n        color: #543847;\n        font-size: 17px;\n      }\n      .player-setting-copy span {\n        display: block;\n        margin-top: 5px;\n        color: #735e6b;\n        font-size: 12px;\n        line-height: 1.5;\n      }\n      .player-setting-controls {\n        display: grid;\n        grid-template-columns: minmax(170px, 1fr) auto;\n        gap: 8px;\n      }\n      .player-setting-controls input {\n        width: 100%;\n        padding: 10px 12px;\n        border: 1px solid #d9c2cf;\n        border-radius: 9px;\n        background: #fff;\n        color: #483440;\n        font-weight: 800;\n      }\n      .player-setting-status {\n        grid-column: 1 / -1;\n        padding-top: 11px;\n        border-top: 1px solid #ead7e1;\n        color: #624656;\n        font-size: 13px;\n        font-weight: 700;\n      }\n      .card {\n        background: linear-gradient(150deg, #fff, #fcf7fa);\n        border: 1px solid var(--line);\n        border-radius: 15px;\n        padding: 17px;\n        box-shadow: 0 7px 22px #633d5112;\n        border-top: 3px solid #b77798;\n      }\n      .card h3 {\n        margin: 0 0 9px;\n        color: #6f4e64;\n        font-size: 14px;\n      }\n      .big {\n        font-size: 24px;\n        font-weight: 900;\n        color: #493445;\n      }\n      .sub {\n        margin-top: 5px;\n        color: #74616d;\n      }\n      .section {\n        background: #ffffffde;\n        border: 1px solid var(--line);\n        border-radius: 15px;\n        padding: 18px;\n        margin-bottom: 16px;\n        box-shadow: 0 7px 24px #633d510d;\n      }\n      .section h2 {\n        margin: 0 0 13px;\n        font-size: 18px;\n        color: #5e3f5a;\n      }\n      .races {\n        display: grid;\n        grid-template-columns: repeat(3, 1fr);\n        gap: 12px;\n      }\n      .race {\n        background: linear-gradient(140deg, #fbf2f7, #faf6fd);\n        border: 1px solid #e7d8e1;\n        border-radius: 11px;\n        padding: 14px;\n      }\n      .rival-search {\n        display: grid;\n        grid-template-columns: minmax(180px, 0.75fr) minmax(200px, 1.25fr) auto;\n        gap: 10px;\n        align-items: end;\n      }\n      .rival-base-chip {\n        min-height: 39px;\n        padding: 8px 11px;\n        border: 1px solid #e0ced8;\n        border-radius: 9px;\n        background: #f6eaf0;\n      }\n      .rival-base-chip span {\n        display: block;\n        color: #806878;\n        font-size: 10px;\n        font-weight: 800;\n      }\n      .rival-base-chip b {\n        display: block;\n        margin-top: 2px;\n        color: #533a49;\n        font-size: 14px;\n      }\n      .rival-search .btn {\n        min-height: 39px;\n      }\n      .rival-status {\n        margin-top: 12px;\n        padding: 10px 12px;\n        border-radius: 9px;\n        background: #f7eaf1;\n        color: #5c4050;\n        font-size: 13px;\n      }\n      .rival-result {\n        margin-top: 12px;\n        padding: 15px;\n        border: 1px solid #e4d2dc;\n        border-radius: 12px;\n        background: linear-gradient(145deg, #fff, #fbf3f8);\n      }\n      .tier-head {\n        display: flex;\n        align-items: flex-end;\n        justify-content: space-between;\n        gap: 14px;\n        margin-bottom: 12px;\n      }\n      .tier-head h2 {\n        margin: 0 0 4px;\n        color: #513849;\n        font-size: 22px;\n      }\n      .tier-status {\n        color: #745e6b;\n        font-size: 13px;\n        font-weight: 700;\n      }\n      .tier-level-filters {\n        display: flex;\n        flex-wrap: wrap;\n        gap: 6px;\n        margin-bottom: 10px;\n      }\n      .tier-level-filters button,\n      .tier-race-filters button,\n      .tier-live-toggle {\n        padding: 7px 11px;\n        border: 1px solid #dac6d2;\n        border-radius: 999px;\n        background: #fff;\n        color: #5a4350;\n        font-weight: 850;\n        cursor: pointer;\n      }\n      .tier-level-filters button.active {\n        border-color: #9a607f;\n        background: linear-gradient(135deg, #8b5574, #b77798);\n        color: #fff;\n      }\n      .tier-tools {\n        display: grid;\n        grid-template-columns: minmax(220px, 1fr) auto auto;\n        gap: 9px;\n        align-items: center;\n        margin-bottom: 13px;\n      }\n      .tier-search {\n        width: 100%;\n        padding: 10px 12px;\n        border: 1px solid #d9c2cf;\n        border-radius: 9px;\n        background: #fff;\n        color: #483440;\n        font-weight: 800;\n      }\n      .tier-race-filters {\n        display: flex;\n        gap: 5px;\n      }\n      .tier-race-filters button {\n        min-width: 42px;\n        border-radius: 9px;\n      }\n      .tier-race-filters button.active {\n        background: #684d62;\n        color: #fff;\n      }\n      .tier-live-toggle {\n        border: 2px solid #dc315a;\n        border-radius: 9px;\n        color: #c51f4b;\n      }\n      .tier-live-toggle.active {\n        background: #dc315a;\n        color: #fff;\n      }\n      .tier-groups {\n        display: grid;\n        grid-template-columns: repeat(3, minmax(0, 1fr));\n        gap: 11px;\n        align-items: start;\n      }\n      .tier-group {\n        overflow: hidden;\n        border: 1px solid #dfccd7;\n        border-radius: 13px;\n        background: #fff;\n        box-shadow: 0 5px 16px #633d510b;\n      }\n      .tier-group > header {\n        display: flex;\n        align-items: center;\n        justify-content: space-between;\n        padding: 9px 12px;\n        border: 0;\n        border-bottom: 1px solid #ead7e1;\n        background: linear-gradient(90deg, #f5e8f0, #f8f1fb);\n        box-shadow: none;\n        color: #543847;\n      }\n      .tier-group h3 {\n        margin: 0;\n        font-size: 17px;\n      }\n      .tier-group header span {\n        color: #735e6b;\n        font-size: 12px;\n        font-weight: 800;\n      }\n      .tier-players {\n        display: grid;\n        grid-template-columns: repeat(2, minmax(0, 1fr));\n        gap: 2px;\n        padding: 6px;\n      }\n      .tier-player {\n        display: grid;\n        grid-template-columns: 34px 24px minmax(0, 1fr) auto;\n        gap: 6px;\n        align-items: center;\n        min-height: 42px;\n        padding: 4px 6px;\n        border-radius: 9px;\n      }\n      .tier-player:hover {\n        background: #f9f1f6;\n      }\n      .tier-avatar-link {\n        display: grid;\n        width: 32px;\n        height: 32px;\n        place-items: center;\n        overflow: hidden;\n        border: 2px solid #ead0de;\n        border-radius: 50%;\n        background: #f1e5ec;\n        text-decoration: none;\n      }\n      .tier-avatar {\n        display: block;\n        width: 100%;\n        height: 100%;\n        object-fit: cover;\n      }\n      .tier-avatar-fallback {\n        width: 100%;\n        height: 100%;\n        place-items: center;\n        color: #765368;\n        font-size: 13px;\n        font-weight: 900;\n      }\n      .tier-race {\n        display: grid;\n        width: 23px;\n        height: 23px;\n        place-items: center;\n        border-radius: 6px;\n        color: #fff;\n        font-size: 11px;\n      }\n      .race-T .tier-race { background: #3989cf; }\n      .race-Z .tier-race { background: #cb527f; }\n      .race-P .tier-race { background: #df8438; }\n      .tier-player-name {\n        overflow: hidden;\n        color: #44313d;\n        font-size: 13px;\n        font-weight: 850;\n        text-decoration: none;\n        text-overflow: ellipsis;\n        white-space: nowrap;\n      }\n      .tier-live {\n        padding: 4px 6px;\n        border: 2px solid #df365c;\n        border-radius: 8px;\n        background: #fff;\n        color: #c71942;\n        font-size: 10px;\n        font-weight: 950;\n        text-decoration: none;\n        white-space: nowrap;\n      }\n      .tier-empty {\n        grid-column: 1 / -1;\n        padding: 40px 16px;\n      }\n      .tier-note {\n        margin: 13px 2px 0;\n        color: #715d69;\n        font-size: 12px;\n        text-align: center;\n      }\n      .rival-scoreboard {\n        display: grid;\n        grid-template-columns: 1fr auto 1fr;\n        gap: 18px;\n        align-items: center;\n      }\n      .rival-player {\n        font-size: 18px;\n        color: #4f3947;\n      }\n      .rival-player.right {\n        text-align: right;\n      }\n      .rival-player > div {\n        display: flex;\n        gap: 8px;\n        align-items: center;\n      }\n      .rival-player.right > div {\n        justify-content: flex-end;\n      }\n      .rival-player > span {\n        display: block;\n        margin-top: 5px;\n        color: #796270;\n        font-size: 13px;\n        font-weight: 700;\n      }\n      .rival-score {\n        text-align: center;\n        white-space: nowrap;\n      }\n      .rival-score b {\n        font-size: 31px;\n        color: #6c435d;\n      }\n      .rival-score em {\n        margin: 0 9px;\n        color: #aa7892;\n        font-style: normal;\n        font-weight: 900;\n      }\n      .rival-score span {\n        display: block;\n        margin-top: 3px;\n        color: #745e6b;\n        font-size: 13px;\n        font-weight: 700;\n      }\n      .rival-race {\n        display: inline-grid;\n        width: 25px;\n        height: 25px;\n        place-items: center;\n        border-radius: 50%;\n        color: #fff;\n        font-size: 12px;\n        font-weight: 900;\n      }\n      .rival-race.T {\n        background: #477f9c;\n      }\n      .rival-race.Z {\n        background: #9b527a;\n      }\n      .rival-race.P {\n        background: #8767a3;\n      }\n      .rival-overall {\n        display: grid;\n        grid-template-columns: 1fr 1fr;\n        gap: 10px;\n        margin-top: 14px;\n      }\n      .rival-overall span {\n        padding: 9px 11px;\n        border-radius: 8px;\n        background: #f4e8ee;\n        color: #59424f;\n        font-size: 13px;\n        text-align: center;\n      }\n      .rival-recent {\n        margin-top: 14px;\n      }\n      .rival-recent h3 {\n        margin: 0 0 8px;\n        color: #604153;\n        font-size: 14px;\n      }\n      .rival-recent > div {\n        margin-top: 6px;\n        padding: 8px 10px;\n        border-left: 4px solid #b77798;\n        border-radius: 7px;\n        color: #4b3944;\n        font-size: 13px;\n      }\n      .rival-recent .rival-empty {\n        border-left: 0;\n        padding: 16px;\n      }\n      .toolbar {\n        display: flex;\n        gap: 9px;\n        flex-wrap: wrap;\n        margin-bottom: 14px;\n      }\n      .btn {\n        background: linear-gradient(135deg, #8b5574, #72517f);\n        color: white;\n      }\n      .btn.secondary {\n        background: #f1e7ed;\n        color: #543b4a;\n      }\n      .btn.danger {\n        background: #b23d5a;\n      }\n      .search {\n        padding: 10px;\n        border: 1px solid var(--line);\n        border-radius: 9px;\n        min-width: 220px;\n      }\n      table {\n        width: 100%;\n        border-collapse: separate;\n        border-spacing: 0;\n        font-size: 13px;\n      }\n      th {\n        background: #5e3f5a;\n        color: white;\n        position: sticky;\n        top: 0;\n        z-index: 1;\n      }\n      th,\n      td {\n        padding: 9px 8px;\n        border-right: 1px solid #eadde4;\n        border-bottom: 1px solid #eadde4;\n        text-align: left;\n        white-space: nowrap;\n      }\n      tbody tr:hover {\n        outline: 2px solid #c493aa;\n        outline-offset: -2px;\n      }\n      .tablewrap {\n        overflow: auto;\n        max-height: 68vh;\n        border: 1px solid var(--line);\n        border-radius: 10px;\n      }\n      .win {\n        background: var(--win);\n      }\n      .lose {\n        background: var(--lose);\n      }\n      dialog {\n        border: 0;\n        border-radius: 16px;\n        padding: 0;\n        box-shadow: 0 20px 60px #3b293566;\n        width: min(900px, 94vw);\n      }\n      dialog::backdrop {\n        background: #33242e99;\n      }\n      .modalhead {\n        padding: 16px 20px;\n        background: linear-gradient(120deg, #493344, #72517f);\n        color: white;\n      }\n      .modalhead h2 {\n        margin: 0;\n      }\n      .form {\n        padding: 18px;\n        display: grid;\n        grid-template-columns: repeat(3, 1fr);\n        gap: 12px;\n      }\n      .field label {\n        display: block;\n        font-size: 12px;\n        font-weight: 700;\n        color: #604858;\n        margin-bottom: 5px;\n      }\n      .field input,\n      .field select,\n      .field textarea {\n        width: 100%;\n        padding: 9px;\n        border: 1px solid #dfd0d8;\n        border-radius: 8px;\n      }\n      .span2 {\n        grid-column: span 2;\n      }\n      .span3 {\n        grid-column: span 3;\n      }\n      .actions {\n        padding: 0 18px 18px;\n        text-align: right;\n      }\n      .recent {\n        display: grid;\n        gap: 7px;\n      }\n      .recent div {\n        padding: 10px 12px;\n        border-radius: 8px;\n        border-left: 4px solid #b77798;\n      }\n      .empty {\n        text-align: center;\n        padding: 35px;\n        color: #76636f;\n      }\n      @media (max-width: 1000px) {\n        header {\n          align-items: flex-start;\n        }\n        .headright {\n          flex-direction: column;\n          align-items: flex-end;\n        }\n        .cards {\n          grid-template-columns: repeat(2, 1fr);\n        }\n        .races {\n          grid-template-columns: repeat(2, 1fr);\n        }\n      }\n      @media (max-width: 700px) {\n        .spwn-body::before {\n          left: 66%;\n          top: 60%;\n          width: 82vw;\n          opacity: 0.1;\n        }\n        header {\n          padding: 12px;\n          flex-direction: column;\n        }\n        .headright {\n          align-items: flex-start;\n          width: 100%;\n        }\n        .brand {\n          min-height: 65px;\n        }\n        .form {\n          grid-template-columns: 1fr;\n        }\n        .span2,\n        .span3 {\n          grid-column: span 1;\n        }\n        .rival-search,\n        .rival-scoreboard,\n        .rival-overall,\n        .player-setting,\n        .player-setting-controls {\n          grid-template-columns: 1fr;\n        }\n        .rival-player,\n        .rival-player.right {\n          text-align: center;\n        }\n        .rival-player > div,\n        .rival-player.right > div {\n          justify-content: center;\n        }\n        .tier-head {\n          align-items: flex-start;\n          flex-direction: column;\n        }\n        .tier-tools,\n        .tier-groups {\n          grid-template-columns: 1fr;\n        }\n      }\n      @media (min-width: 701px) and (max-width: 1100px) {\n        .tier-groups { grid-template-columns: repeat(2, minmax(0, 1fr)); }\n      }\n      .notice {\n        margin: 18px 2px 5px;\n        padding: 13px 16px;\n        border: 1px solid #e5d5de;\n        border-radius: 11px;\n        background: #fbf3f7;\n        color: #604b57;\n        font-size: 13px;\n        line-height: 1.6;\n        text-align: center;\n      }\n      .site-credit {\n        padding: 4px 20px 24px;\n        color: #795f70;\n        font-size: 12px;\n        font-weight: 700;\n        letter-spacing: 0.7px;\n        text-align: center;\n      }\n      .site-credit span {\n        color: #8b5574;\n        font-weight: 900;\n      }\n      .site-credit {\n        display: none;\n      }\n    \n\n      .game-row td {\n        border-bottom: 0;\n      }\n      .note-row td {\n        padding: 0 10px 13px !important;\n        white-space: normal !important;\n      }\n      .note-row:hover {\n        outline: none;\n      }\n      .note-row td > div {\n        white-space: normal !important;\n      }\n      .note-label {\n        display: inline-block;\n        margin: 4px 0 6px;\n        padding: 4px 9px;\n        border-radius: 6px;\n        background: #8b5574;\n        color: #fff;\n        font-weight: 800;\n        font-size: 12px;\n      }\n      .note-label.feedback-label {\n        margin-top: 12px;\n        background: #72517f;\n      }\n      .note-text {\n        width: 100%;\n        padding: 11px 13px;\n        border: 1px solid #e2d3db;\n        border-radius: 9px;\n        background: #fff;\n        line-height: 1.65;\n        overflow-wrap: anywhere;\n        word-break: break-word;\n        color: #493742;\n        min-height: 42px;\n      }\n    \n\n      .game-row {\n        cursor: pointer;\n      }\n      .tablewrap tbody .game-row td:first-child {\n        font-size: 15px;\n        font-weight: 800;\n      }\n      .game-row:hover td {\n        background: #f7e9f0;\n      }\n      .game-row td:first-child::before {\n        content: \"▸\";\n        margin-right: 6px;\n        color: #8b5574;\n        font-weight: 900;\n      }\n      .note-row td {\n        padding: 4px 12px 16px !important;\n      }\n      .note-text {\n        font-size: 14px;\n      }\n    \n\n      .tablewrap th:nth-child(10),\n      .tablewrap td:nth-child(10),\n      .tablewrap th:nth-child(11),\n      .tablewrap td:nth-child(11) {\n        width: 300px;\n        min-width: 300px;\n        max-width: 300px;\n      }\n      .note-preview {\n        white-space: nowrap !important;\n        overflow: hidden;\n        text-overflow: ellipsis;\n        color: #5d4654;\n        font-weight: 600;\n      }\n      .note-preview::after {\n        content: \"  ▾\";\n        color: #8b5574;\n        font-weight: 900;\n      }\n    \n\n        .elo-badge {\n          display: inline-block;\n          margin-left: 5px;\n          padding: 2px 6px;\n          border-radius: 999px;\n          background: #efd5e2;\n          color: #55394a;\n          font-size: 10px;\n          font-weight: 900;\n          vertical-align: middle;\n        }\n        .elo-detail {\n          margin: 6px 0 10px;\n          padding: 9px 11px;\n          border-radius: 8px;\n          background: #faedf4;\n          color: #604153;\n          font-size: 12px;\n          font-weight: 700;\n        }\n        .elo-dialog {\n          width: min(1180px, 96vw);\n        }\n        .elo-controls {\n          display: grid;\n          grid-template-columns: 1.2fr 1fr 0.8fr auto;\n          gap: 10px;\n          align-items: end;\n          padding: 16px 18px 10px;\n        }\n        .elo-controls .field input,\n        .elo-controls .field select {\n          width: 100%;\n          padding: 9px;\n          border: 1px solid #dfd0d8;\n          border-radius: 8px;\n        }\n        .elo-status {\n          margin: 0 18px 12px;\n          padding: 10px 12px;\n          border-radius: 8px;\n          background: #f7eaf1;\n          color: #5c4050;\n          font-size: 13px;\n        }\n        .elo-tablewrap {\n          margin: 0 18px 14px;\n          max-height: 48vh;\n          overflow: auto;\n          border: 1px solid var(--line);\n          border-radius: 10px;\n        }\n        .elo-tablewrap th,\n        .elo-tablewrap td {\n          padding: 8px;\n          white-space: nowrap;\n        }\n        .elo-duplicate {\n          opacity: 0.55;\n          background: #f1f1f5;\n        }\n        .elo-actions {\n          display: flex;\n          justify-content: space-between;\n          align-items: center;\n          padding: 0 18px 18px;\n        }\n        .elo-help {\n          font-size: 12px;\n          color: #735e6b;\n        }\n        @media (max-width: 850px) {\n          .elo-controls {\n            grid-template-columns: 1fr 1fr;\n          }\n          .elo-controls .btn {\n            width: 100%;\n          }\n        }\n      \n:host{display:block;height:100%;color:#44374e}\n.spwn-body{min-height:100%!important;background:linear-gradient(145deg,#fff9fc,#f7f2ff 58%,#eef8ff)!important;color:#44374e!important;overflow-x:hidden}\n.spwn-body::before{content:none!important}\nheader{background:linear-gradient(120deg,#fff8fc,#f3edff 56%,#eaf6ff)!important;color:#51445d!important;border-bottom:2px solid #e7b6d1!important;box-shadow:0 7px 22px rgba(91,66,116,.13)!important;padding:11px 22px!important}\n.brand{min-height:62px!important}.brand-subtitle{color:#9b7bd5!important}.storage-note{color:#6d5a8f!important;background:#fff!important;border-color:#dbcbe5!important}\n.tabs button{background:#fff!important;color:#6d5a8f!important;border-color:#d9cae4!important}.tabs button.active{background:linear-gradient(135deg,#b99bea,#efa8c9)!important;color:#fff!important;border-color:#b99bea!important}\nmain{padding:14px!important}.player-setting{display:none!important}#tierTab{display:none!important}.site-credit{display:none!important}\n.card,.section{border-color:#dfd0e8!important;box-shadow:0 6px 20px rgba(91,66,116,.09)!important}\n.btn{background:linear-gradient(135deg,#9b7bd5,#e58aae)!important}.btn.secondary{background:#f5eef9!important;color:#574662!important}.btn.danger{background:#d85a7b!important}\nth{background:#6d5a8f!important}.tablewrap{max-height:60vh!important}\n";
window.mountSpwnNoteNative=function(host){
  if(!host||host.dataset.spwnMounted==='1')return;
  host.dataset.spwnMounted='1';
  const root=host.shadowRoot||host.attachShadow({mode:'open'});
  root.innerHTML='<style>'+STYLES+'</style>'+TEMPLATE;
  const realDocument=window.document;
  const document={
    querySelector:root.querySelector.bind(root),
    querySelectorAll:root.querySelectorAll.bind(root),
    getElementById:root.getElementById.bind(root),
    createElement:realDocument.createElement.bind(realDocument),
    body:root
  };
  window.SPAWN_NOTE_ELO_API_BASE=window.SPAWN_NOTE_ELO_API_BASE||'https://spawn-note-elo-relay.hajimayo8130.workers.dev';
const STORAGE_KEY = "spawnNote.records.v1";
const PLAYER_KEY = "spawnNote.eloPlayer";
const DASHBOARD_CACHE_KEY = "spawnNote.eloDashboard.v1";
const RIVAL_PLAYER_KEY = "spawnNote.rivalPlayer";
const RIVAL_OPPONENT_KEY = "spawnNote.rivalOpponent";
const TIER_CACHE_KEY = "spawnNote.tierTable.v1";
const LEGACY_STORAGE_KEY = "new" + "catsleSpawnNote.records.v1";
const LEGACY_PLAYER_KEY = "new" + "catsleEloPlayer";
const ELO_API_BASE = String(window.SPAWN_NOTE_ELO_API_BASE || "").replace(/\/$/, "");
const LIVE_API_BASE = "https://dorang-live.hajimayo8130.workers.dev";
const TIER_LIVE_NAME_ALIASES = {
  낭니: ["냥니"],
  빵체리: ["땡세리"],
  럭키위키: ["럭키워키"],
};

let records = [];
let eloPreviewRecords = [];
let eloDashboard = null;
let eloDashboardPlayer = "";
let eloDashboardLoading = false;
let eloDashboardError = "";
let tierPayload = null;
let tierLive = {};
let tierLiveByName = {};
let tierLoading = false;
let tierLiveLoading = false;
let tierError = "";
let tierLiveStatus = "LIVE 확인 준비 중";
let tierRace = "ALL";
let tierLevels = new Set();
let tierSearch = "";
let tierLiveOnly = false;
let tierRefreshTimer = null;

const $ = (selector) => document.querySelector(selector);
const form = document.getElementById("form");
const dlg = document.getElementById("dlg");
const eloDlg = document.getElementById("eloDlg");
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );

function cleanRecord(record) {
  const clean = { ...(record || {}) };
  clean.feedback = clean.feedback == null ? "" : String(clean.feedback);
  clean.note = clean.note == null ? "" : String(clean.note);
  clean.id = Number(clean.id) || Date.now();
  return clean;
}

function readRecords() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    const legacy = current == null ? localStorage.getItem(LEGACY_STORAGE_KEY) : null;
    const stored = JSON.parse(current ?? legacy ?? "[]");
    if (current == null && legacy != null && Array.isArray(stored)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    }
    return Array.isArray(stored) ? stored.map(cleanRecord) : [];
  } catch (error) {
    console.error("저장된 기록을 읽지 못했어.", error);
    return [];
  }
}

function saveRecords() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    alert("브라우저 저장 공간에 기록을 저장하지 못했어. 먼저 JSON 백업을 받아줘.");
    throw error;
  }
}

function getBasePlayer() {
  return String(
    localStorage.getItem(PLAYER_KEY) ||
      localStorage.getItem(RIVAL_PLAYER_KEY) ||
      localStorage.getItem(LEGACY_PLAYER_KEY) ||
      "",
  ).trim();
}

function saveBasePlayerName(player) {
  localStorage.setItem(PLAYER_KEY, player);
  localStorage.setItem(RIVAL_PLAYER_KEY, player);
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readDashboardCache(player) {
  try {
    const cached = JSON.parse(localStorage.getItem(DASHBOARD_CACHE_KEY) || "null");
    return cached && normalizeName(cached.player) === normalizeName(player) ? cached.data : null;
  } catch {
    return null;
  }
}

function writeDashboardCache(player, data) {
  try {
    localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({ player, data }));
  } catch (error) {
    console.warn("ELOBOARD 대시보드 임시 저장에 실패했어.", error);
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "요청을 처리하지 못했어.");
  return data;
}

function load() {
  records = readRecords();
  const player = getBasePlayer();
  if (player) {
    saveBasePlayerName(player);
    eloDashboard = readDashboardCache(player);
    eloDashboardPlayer = player;
  }
  loadBasePlayerInputs();
  $("#tierTab")?.classList.add("hidden");
  renderAll();
  loadRivalInputs();
  if (player) refreshEloDashboard();
}

function pct(wins, total) {
  return total ? Math.round((wins / total) * 1000) / 10 : 0;
}

function stat(list) {
  const wins = list.filter((record) => record.result === "승").length;
  const losses = list.filter((record) => record.result === "패").length;
  return { w: wins, l: losses, t: wins + losses, p: pct(wins, wins + losses) };
}

function renderAll() {
  renderDash();
  renderTable();
}

function showTab(tab) {
  $("#dash").classList.toggle("hidden", tab !== "dash");
  $("#log").classList.toggle("hidden", tab !== "log");
  $("#tier").classList.toggle("hidden", tab !== "tier");
  $("#dashTab").classList.toggle("active", tab === "dash");
  $("#logTab").classList.toggle("active", tab === "log");
  $("#tierTab").classList.toggle("active", tab === "tier");
  if (tab === "tier" && !tierPayload && !tierLoading) loadTierTable();
}

function renderDash() {
  const player = getBasePlayer();
  const summary =
    eloDashboard && normalizeName(eloDashboardPlayer) === normalizeName(player)
      ? eloDashboard
      : null;
  const blank = { wins: 0, losses: 0, games: 0, winRate: 0 };
  const allStats = summary?.overall || blank;
  const monthStats = summary?.month || blank;
  const weekStats = summary?.week || blank;
  const last = [...records].sort(
    (a, b) => String(b.date).localeCompare(String(a.date)) || Number(b.id) - Number(a.id),
  )[0];
  const statText = (value) => (summary ? `${value.wins}승 ${value.losses}패` : "-");
  const statSub = (value) =>
    summary ? `총 ${value.games}경기 · 승률 ${value.winRate}%` : player ? "ELOBOARD 조회 중" : "기준 선수 설정 필요";

  $("#cards").innerHTML =
    card("🏆 전체 전적", statText(allStats), statSub(allStats)) +
    card("📅 이번 달", statText(monthStats), statSub(monthStats)) +
    card("📆 이번 주", statText(weekStats), statSub(weekStats)) +
    card("🎮 총 경기", summary ? `${summary.totalGames}경기` : "-", "ELOBOARD 전체 공식전") +
    card("📌 최근 작성", last ? last.date : "-", "내 스폰일지");

  $("#races").innerHTML = [
    { race: "T", raceLabel: "테란" },
    { race: "Z", raceLabel: "저그" },
    { race: "P", raceLabel: "토스" },
  ]
    .map((raceInfo) => {
      const raceStats = summary?.races?.find((item) => item.race === raceInfo.race) || blank;
      const icon = raceInfo.race === "T" ? "👽" : raceInfo.race === "Z" ? "🐜" : "⚔️";
      return `<div class="race"><b>${icon} vs ${raceInfo.raceLabel}</b><div class="big">${
        summary ? `${raceStats.wins}승 ${raceStats.losses}패` : "-"
      }</div><div class="sub">${
        summary ? `총 ${raceStats.games}경기 · 승률 ${raceStats.winRate}%` : "ELOBOARD 기준"
      }</div></div>`;
    })
    .join("");

  const recent = [...records]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || Number(b.id) - Number(a.id))
    .slice(0, 10);
  $("#recent").innerHTML = recent.length
    ? recent
        .map(
          (record) =>
            `<div class="${record.result === "승" ? "win" : "lose"}"><b>${esc(
              record.result,
            )}</b> · ${esc(record.date)} · vs ${esc(record.opponent)} (${esc(
              record.race || "-",
            )}) · ${esc(record.map || "-")} ${
              record.source === "eloboard" ? '<span class="elo-badge">ELO</span>' : ""
            }</div>`,
        )
        .join("")
    : '<div class="empty">기록이 없어</div>';

  renderBasePlayerStatus();
}

function card(heading, body, sub) {
  return `<div class="card"><h3>${heading}</h3><div class="big">${body}</div><div class="sub">${sub}</div></div>`;
}

function loadBasePlayerInputs() {
  const player = getBasePlayer();
  const input = $("#basePlayer");
  if (input) input.value = player;
  const eloPlayer = $("#eloPlayer");
  if (eloPlayer) eloPlayer.value = player;
}

function renderBasePlayerStatus() {
  const status = $("#basePlayerStatus");
  if (!status) return;
  const player = getBasePlayer();
  if (!player) {
    status.textContent = "ELOBOARD에 등록된 여자부 선수 이름을 한 번 저장해줘.";
    return;
  }
  if (eloDashboardLoading) {
    status.textContent = `${player} 선수의 ELOBOARD 전체 공식전 통계를 불러오고 있어…`;
    return;
  }
  if (eloDashboardError) {
    status.textContent = eloDashboardError;
    return;
  }
  if (eloDashboard?.player) {
    const info = eloDashboard.player;
    status.textContent = `${info.name} · ${info.raceLabel || "종족 미상"} · ELO ${
      info.elo || "-"
    }${eloDashboard.latestMatchDate ? ` · 최근 경기 ${eloDashboard.latestMatchDate}` : ""}`;
    return;
  }
  status.textContent = `${player} 선수를 기준으로 ELOBOARD 통계를 준비하고 있어.`;
}

async function refreshEloDashboard() {
  const player = getBasePlayer();
  if (!player || !ELO_API_BASE) {
    eloDashboardError = !ELO_API_BASE ? "ELO 조회 서버가 아직 연결되지 않았어." : "";
    renderDash();
    return;
  }
  eloDashboardLoading = true;
  eloDashboardError = "";
  renderDash();
  const button = $("#basePlayerSaveButton");
  if (button) button.disabled = true;
  try {
    const query = new URLSearchParams({ player, today: localDateKey() });
    const data = await fetchJson(`${ELO_API_BASE}/api/elo/dashboard?${query}`);
    eloDashboard = data;
    eloDashboardPlayer = player;
    writeDashboardCache(player, data);
  } catch (error) {
    eloDashboardError = error.message;
  } finally {
    eloDashboardLoading = false;
    if (button) button.disabled = false;
    renderDash();
  }
}

async function saveBasePlayer() {
  const input = $("#basePlayer");
  const player = String(input?.value || "").trim();
  if (!player || player.length > 30) {
    eloDashboardError = "기준 선수 이름을 1~30자로 입력해줘.";
    renderBasePlayerStatus();
    return;
  }
  const changed = normalizeName(player) !== normalizeName(getBasePlayer());
  saveBasePlayerName(player);
  if (changed) {
    eloDashboard = readDashboardCache(player);
    eloDashboardPlayer = player;
  }
  loadBasePlayerInputs();
  loadRivalInputs();
  $("#rivalResult")?.classList.add("hidden");
  await refreshEloDashboard();
}

function loadRivalInputs() {
  const baseInput = $("#rivalPlayer");
  const opponentInput = $("#rivalOpponent");
  if (!baseInput || !opponentInput) return;
  const player = getBasePlayer();
  baseInput.value = player;
  const baseName = $("#rivalBaseName");
  if (baseName) baseName.textContent = player || "먼저 기준 선수를 저장해줘";
  opponentInput.value = localStorage.getItem(RIVAL_OPPONENT_KEY) || "";
  $("#rivalStatus").textContent = !player
    ? "위에서 기준 선수를 먼저 저장해줘."
    : ELO_API_BASE
      ? `${player} 선수를 기준으로 상대 이름만 입력하면 돼.`
    : "ELO 조회 중계 서버가 아직 연결되지 않았어.";
}

function raceMark(race) {
  return race ? `<span class="rival-race ${esc(race)}">${esc(race)}</span>` : "";
}

function renderRivalResult(data) {
  const base = data.base || {};
  const opponent = data.opponent || {};
  const head = data.headToHead || {};
  const recent = Array.isArray(data.recentMatches) ? data.recentMatches : [];
  $("#rivalStatus").textContent = head.games
    ? `ELOBOARD 전체 기록에서 ${head.games}경기를 찾았어.${
        head.lastPlayedOn ? ` 최근 맞대결은 ${head.lastPlayedOn}이야.` : ""
      }`
    : "ELOBOARD에 두 선수의 맞대결 기록이 없어.";
  $("#rivalResult").innerHTML = `
    <div class="rival-scoreboard">
      <div class="rival-player"><div>${raceMark(base.race)}<b>${esc(base.name)}</b></div><span>ELO ${esc(base.elo || "-")}</span></div>
      <div class="rival-score"><b>${Number(head.wins || 0)}</b><em>:</em><b>${Number(head.losses || 0)}</b><span>${Number(head.winRate || 0)}% · ${Number(head.games || 0)}경기</span></div>
      <div class="rival-player right"><div>${raceMark(opponent.race)}<b>${esc(opponent.name)}</b></div><span>ELO ${esc(opponent.elo || "-")}</span></div>
    </div>
    <div class="rival-overall">
      <span><b>${esc(base.name)}</b> 통산 ${Number(base.wins || 0)}승 ${Number(base.losses || 0)}패 · ${Number(base.winRate || 0)}%</span>
      <span><b>${esc(opponent.name)}</b> 통산 ${Number(opponent.wins || 0)}승 ${Number(opponent.losses || 0)}패 · ${Number(opponent.winRate || 0)}%</span>
    </div>
    <div class="rival-recent">
      <h3>최근 맞대결</h3>
      ${
        recent.length
          ? recent
              .map(
                (match) =>
                  `<div class="${match.result === "승" ? "win" : "lose"}"><b>${esc(
                    match.result,
                  )}</b> · ${esc(match.date)} · ${esc(match.map || "-")} · ${esc(match.type || "-")}</div>`,
              )
              .join("")
          : '<div class="empty rival-empty">최근 경기 정보가 없어</div>'
      }
    </div>`;
  $("#rivalResult").classList.remove("hidden");
}

async function searchRival() {
  const player = getBasePlayer();
  const opponent = $("#rivalOpponent").value.trim();
  if (!player || !opponent) {
    $("#rivalStatus").textContent = player
      ? "상대 선수 이름을 입력해줘."
      : "위에서 기준 선수를 먼저 저장해줘.";
    return;
  }
  if (normalizeName(player) === normalizeName(opponent)) {
    $("#rivalStatus").textContent = "서로 다른 선수 이름을 입력해줘.";
    return;
  }
  if (!ELO_API_BASE) {
    $("#rivalStatus").textContent = "ELO 조회 서버가 아직 연결되지 않았어.";
    return;
  }

  localStorage.setItem(RIVAL_OPPONENT_KEY, opponent);
  $("#rivalSearchButton").disabled = true;
  $("#rivalStatus").textContent = "ELOBOARD에서 상대전적을 확인하고 있어…";
  $("#rivalResult").classList.add("hidden");
  try {
    const query = new URLSearchParams({ player, opponent });
    renderRivalResult(await fetchJson(`${ELO_API_BASE}/api/elo/rival?${query}`));
  } catch (error) {
    $("#rivalStatus").textContent = error.message;
    $("#rivalResult").innerHTML = "";
  } finally {
    $("#rivalSearchButton").disabled = false;
  }
}

function readTierCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(TIER_CACHE_KEY) || "null");
    return Array.isArray(cached?.tiers) ? cached : null;
  } catch {
    return null;
  }
}

function writeTierCache(data) {
  try {
    localStorage.setItem(TIER_CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("티어표 임시 저장에 실패했어.", error);
  }
}

function tierProfileUrl(player) {
  return player.playerId ? `https://eloboard.co.kr/players/${encodeURIComponent(player.playerId)}` : "#";
}

function normalizeTierLiveName(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]/g, "");
}

function tierPlayerLiveUrl(player) {
  const soopId = String(player.soopId || "").toLowerCase();
  if (soopId && tierLive[soopId]) return tierLive[soopId];

  const names = [player.name, ...(TIER_LIVE_NAME_ALIASES[player.name] || [])]
    .map(normalizeTierLiveName)
    .filter(Boolean);
  for (const name of names) {
    if (tierLiveByName[name]) return tierLiveByName[name];
  }

  const matches = Object.entries(tierLiveByName).filter(([nickname]) =>
    names.some((name) => nickname.startsWith(name)),
  );
  return matches.length === 1 ? matches[0][1] : "";
}

function tierPlayerCard(player) {
  const liveUrl = tierPlayerLiveUrl(player);
  const channelUrl = player.soopId ? `https://ch.sooplive.co.kr/${encodeURIComponent(player.soopId)}` : "";
  const imageUrl = player.thumbUrl ? `https://eloboard.co.kr/static/${player.thumbUrl}` : "";
  const avatarUrl = liveUrl || channelUrl || tierProfileUrl(player);
  return `<div class="tier-player race-${esc(player.race)}">
    <a class="tier-avatar-link" href="${esc(avatarUrl)}" target="_blank" rel="noopener noreferrer" title="${
      liveUrl ? "현재 SOOP 방송 보기" : "선수 정보 보기"
    }">
      ${
        imageUrl
          ? `<img class="tier-avatar" src="${esc(imageUrl)}" alt="${esc(
              player.name,
            )} 프로필" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">`
          : ""
      }
      <span class="tier-avatar-fallback" style="${imageUrl ? "display:none" : ""}">${esc(
        String(player.name || "?").slice(0, 1),
      )}</span>
    </a>
    <b class="tier-race">${esc(player.race)}</b>
    <a class="tier-player-name" href="${esc(tierProfileUrl(player))}" target="_blank" rel="noopener noreferrer">${esc(
      player.name,
    )}</a>
    ${
      liveUrl
        ? `<a class="tier-live" href="${esc(
            liveUrl,
          )}" target="_blank" rel="noopener noreferrer">● LIVE</a>`
        : ""
    }
  </div>`;
}

function renderTierTable() {
  const status = $("#tierStatus");
  const filterBox = $("#tierLevelFilters");
  const groupBox = $("#tierGroups");
  if (!status || !filterBox || !groupBox) return;

  const tiers = Array.isArray(tierPayload?.tiers) ? tierPayload.tiers : [];
  status.textContent = tierLoading
    ? "ELOBOARD 최신 티어표를 불러오고 있어…"
    : tierError ||
      (tierPayload
        ? `v${tierPayload.version || "-"} · ${tierPayload.updatedOn || "기준일 미상"} 기준 · ${tierLiveStatus}`
        : "티어표를 열면 ELOBOARD 최신 자료를 확인해.");

  filterBox.innerHTML = tiers.length
    ? `<button class="${tierLevels.size ? "" : "active"}" onclick="window.SpwnNative.toggleTierLevel('ALL')">전체</button>${tiers
        .map(
          (tier) =>
            `<button class="${tierLevels.has(tier.label) ? "active" : ""}" onclick="window.SpwnNative.toggleTierLevel('${esc(
              tier.label,
            )}')">${tierLevels.has(tier.label) ? "✓ " : ""}${esc(tier.label)}</button>`,
        )
        .join("")}`
    : "";

  document.querySelectorAll("[data-tier-race]").forEach((button) =>
    button.classList.toggle("active", button.dataset.tierRace === tierRace),
  );
  $("#tierLiveOnly")?.classList.toggle("active", tierLiveOnly);
  if ($("#tierLiveOnly")) {
    $("#tierLiveOnly").textContent = tierLiveOnly ? "✓ LIVE만" : "○ LIVE만";
    $("#tierLiveOnly").setAttribute?.("aria-pressed", String(tierLiveOnly));
  }

  const query = tierSearch.trim().toLowerCase();
  const groups = tiers
    .filter((tier) => !tierLevels.size || tierLevels.has(tier.label))
    .map((tier) => {
      const players = (tier.players || []).filter((player) => {
        const live = tierPlayerLiveUrl(player);
        return (
          (tierRace === "ALL" || player.race === tierRace) &&
          (!query || String(player.name || "").toLowerCase().includes(query)) &&
          (!tierLiveOnly || live)
        );
      });
      if (!players.length) return "";
      return `<section class="tier-group"><header><h3>${esc(tier.label)}</h3><span>${
        players.length
      }명</span></header><div class="tier-players">${players.map(tierPlayerCard).join("")}</div></section>`;
    })
    .join("");

  groupBox.innerHTML = groups || '<div class="empty tier-empty">조건에 맞는 선수가 없어</div>';
  const refreshButton = $("#tierRefreshButton");
  if (refreshButton) refreshButton.disabled = tierLoading || tierLiveLoading;
}

async function fetchTierLive() {
  tierLiveLoading = true;
  try {
    const data = await fetchJson(`${LIVE_API_BASE}/?t=${Date.now()}`, { cache: "no-store" });
    const broadcasts = Array.isArray(data.live) ? data.live : [];
    tierLive = Object.fromEntries(
      broadcasts
        .filter((broadcast) => broadcast.soop_id)
        .map((broadcast) => [
          String(broadcast.soop_id).toLowerCase(),
          broadcast.url || `https://ch.sooplive.co.kr/${broadcast.soop_id}`,
        ]),
    );
    tierLiveByName = Object.fromEntries(
      broadcasts
        .map((broadcast) => [
          normalizeTierLiveName(broadcast.nick || broadcast.nickname),
          broadcast.url ||
            (broadcast.soop_id ? `https://ch.sooplive.co.kr/${broadcast.soop_id}` : ""),
        ])
        .filter(([nickname, url]) => nickname && url),
    );
    const checked = new Date(data.updatedAt || Date.now());
    tierLiveStatus = `LIVE ${checked.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })} 확인 · 60초 자동 갱신`;
  } catch {
    tierLiveStatus = "LIVE 연결 실패 · 티어표는 정상 표시 중";
  } finally {
    tierLiveLoading = false;
  }
}

async function loadTierTable(force = false) {
  if (tierLoading) return;
  if (!tierPayload) tierPayload = readTierCache();
  if (!ELO_API_BASE) {
    tierError = "ELO 조회 서버가 아직 연결되지 않았어.";
    renderTierTable();
    return;
  }
  tierLoading = true;
  tierError = "";
  renderTierTable();
  try {
    const requests = [fetchJson(`${ELO_API_BASE}/api/elo/tiers${force ? `?t=${Date.now()}` : ""}`), fetchTierLive()];
    const [tierResult] = await Promise.allSettled(requests);
    if (tierResult.status === "rejected") throw tierResult.reason;
    tierPayload = tierResult.value;
    writeTierCache(tierPayload);
    if (!tierRefreshTimer) {
      tierRefreshTimer = setInterval(() => {
        if (!$("#tier")?.classList.contains("hidden")) fetchTierLive().then(renderTierTable);
      }, 60000);
    }
  } catch (error) {
    tierError = tierPayload
      ? `${error.message} 저장된 티어표를 대신 표시하고 있어.`
      : error.message;
  } finally {
    tierLoading = false;
    renderTierTable();
    autoFillRecordPlayer(form?.elements?.opponent);
  }
}

function toggleTierLevel(level) {
  if (level === "ALL") tierLevels.clear();
  else if (tierLevels.has(level)) tierLevels.delete(level);
  else tierLevels.add(level);
  renderTierTable();
}

function setTierRace(race) {
  tierRace = race;
  renderTierTable();
}

function setTierSearch(value) {
  tierSearch = value;
  renderTierTable();
}

function toggleTierLiveOnly() {
  tierLiveOnly = !tierLiveOnly;
  renderTierTable();
}

function eloDetails(record) {
  if (record.source !== "eloboard") return "";
  const parts = ["ELOBOARD에서 가져온 기록"];
  if (record.eloChange) parts.push(`ELO 변동 ${record.eloChange}`);
  if (record.eloMatchType) parts.push(record.eloMatchType);
  if (record.eloMemo) parts.push(record.eloMemo);
  return `<div class="elo-detail">${parts.map(esc).join(" · ")}</div>`;
}

function renderTable() {
  const query = ($("#search")?.value || "").toLowerCase();
  const list = [...records]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || Number(b.id) - Number(a.id))
    .filter(
      (record) =>
        !query ||
        Object.values(record).some((value) => String(value).toLowerCase().includes(query)),
    );

  $("#tbody").innerHTML =
    list
      .map((record) => {
        let notePreview = (record.note || "내용 없음").replace(/\s+/g, " ").trim();
        if (notePreview.length > 28) notePreview = `${notePreview.slice(0, 28)}…`;
        let feedbackPreview = (record.feedback || "내용 없음").replace(/\s+/g, " ").trim();
        if (feedbackPreview.length > 28) feedbackPreview = `${feedbackPreview.slice(0, 28)}…`;
        const sourceBadge =
          record.source === "eloboard" ? ' <span class="elo-badge">ELO</span>' : "";
        return `<tr class="game-row ${
          record.result === "승" ? "win" : "lose"
        }" onclick="window.SpwnNative.toggleNote(${Number(record.id)})" title="클릭하면 느낀점과 피드백 전체 내용을 볼 수 있어"><td>${esc(
          record.date,
        )}</td><td>${esc(record.opponent)}${sourceBadge}</td><td>${esc(
          record.tier,
        )}</td><td>${esc(record.race)}</td><td><b>${esc(
          record.result,
        )}</b></td><td>${esc(record.myBuild)}</td><td>${esc(
          record.enemyBuild,
        )}</td><td>${esc(record.map)}</td><td>${esc(
          record.cause,
        )}</td><td class="note-preview">${esc(notePreview)}</td><td class="note-preview">${esc(
          feedbackPreview,
        )}</td><td><button class="btn secondary" onclick="event.stopPropagation();window.SpwnNative.editRec(${Number(
          record.id,
        )})">수정</button> <button class="btn danger" onclick="event.stopPropagation();window.SpwnNative.delRec(${Number(
          record.id,
        )})">삭제</button></td></tr><tr id="note-${Number(record.id)}" class="note-row hidden ${
          record.result === "승" ? "win" : "lose"
        }"><td colspan="12">${eloDetails(
          record,
        )}<div class="note-label">느낀점 전체 내용</div><div class="note-text">${esc(
          record.note || "내용 없음",
        )}</div><div class="note-label feedback-label">피드백 전체 내용</div><div class="note-text">${esc(
          record.feedback || "내용 없음",
        )}</div></td></tr>`;
      })
      .join("") || '<tr><td colspan="12" class="empty">검색 결과가 없어</td></tr>';
}

function toggleNote(id) {
  document.getElementById(`note-${id}`)?.classList.toggle("hidden");
}

function sharedPlayerDirectory() {
  try {
    return window.parent?.HARINA_PLAYER_DIRECTORY || window.HARINA_PLAYER_DIRECTORY || {};
  } catch {
    return {};
  }
}

function findPlayerMeta(name) {
  const key = normalizeName(name);
  if (!key) return null;
  const shared = sharedPlayerDirectory()[key];
  if (shared) return shared;
  const payload = tierPayload || readTierCache();
  for (const tier of payload?.tiers || []) {
    const player = (tier.players || []).find((item) => normalizeName(item.name) === key);
    if (player) return { name: player.name, tier: tier.label || tier.tier || "", race: player.race || "" };
  }
  return null;
}

function formTierValue(value) {
  return ({ 갓: "God", 킹: "King", 잭: "Jack", 조커: "Joker", 스페이드: "Spade", 베이비: "유스" })[value] || value || "";
}

function formRaceValue(value) {
  return ({ P: "토스", T: "테란", Z: "저그", R: "랜덤" })[String(value || "").toUpperCase()] || value || "";
}

function autoFillRecordPlayer(input) {
  if (!input || input !== form?.elements?.opponent) return;
  const meta = findPlayerMeta(input.value);
  if (!meta) return;
  const tier = form.elements.tier;
  const race = form.elements.race;
  if (tier) tier.value = formTierValue(meta.tier);
  if (race) race.value = formRaceValue(meta.race);
}

function openForm() {
  form.reset();
  form.id.value = "";
  form.date.value = new Date().toISOString().slice(0, 10);
  $("#formTitle").textContent = "기록 추가";
  dlg.showModal();
  if (!tierPayload && !tierLoading) loadTierTable();
}

function editRec(id) {
  const record = records.find((item) => Number(item.id) === Number(id));
  if (!record) return;
  for (const [key, value] of Object.entries(record)) {
    if (form.elements[key]) form.elements[key].value = value ?? "";
  }
  $("#formTitle").textContent = "기록 수정";
  dlg.showModal();
}

function submitForm(event) {
  event.preventDefault();
  const fields = Object.fromEntries(new FormData(form));
  const id = fields.id ? Number(fields.id) : Date.now();
  const index = records.findIndex((record) => Number(record.id) === id);
  const record = cleanRecord({ ...(index >= 0 ? records[index] : {}), ...fields, id });
  if (index >= 0) records[index] = record;
  else records.push(record);
  saveRecords();
  dlg.close();
  renderAll();
}

function delRec(id) {
  if (!confirm("이 기록을 삭제할까?")) return;
  records = records.filter((record) => Number(record.id) !== Number(id));
  saveRecords();
  renderAll();
}

function download(name, text, type) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([`\ufeff${text}`], { type }));
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function exportJson() {
  download("스폰노트_백업.json", JSON.stringify(records, null, 2), "application/json");
}

function exportCsv() {
  const keys = [
    "date",
    "opponent",
    "tier",
    "race",
    "result",
    "myBuild",
    "enemyBuild",
    "map",
    "cause",
    "note",
    "feedback",
  ];
  const heads = [
    "날짜",
    "상대",
    "티어",
    "종족",
    "승패",
    "사용 빌드",
    "상대 빌드",
    "맵",
    "패인",
    "느낀점",
    "피드백",
  ];
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  download(
    "스폰노트.csv",
    [heads.map(quote).join(","), ...records.map((record) => keys.map((key) => quote(record[key])).join(","))].join("\r\n"),
    "text/csv",
  );
}

async function importJson(element) {
  const file = element.files[0];
  if (!file) return;
  try {
    const text = (await file.text()).replace(/^\ufeff/, "");
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("백업 형식 오류");
    if (!confirm("현재 기록을 백업 파일 내용으로 교체할까?")) return;
    records = data.map(cleanRecord);
    saveRecords();
    renderAll();
    alert("불러오기 완료");
  } catch {
    alert("올바른 백업 파일이 아니야");
  } finally {
    element.value = "";
  }
}

function resetAllRecords() {
  if (!confirm("스폰일지의 모든 기록을 삭제할까?\n삭제한 기록은 되돌릴 수 없어.")) return;
  if (!confirm("정말 전체 기록을 리셋할까?\n필요하면 먼저 백업 저장을 눌러줘.")) return;
  records = [];
  saveRecords();
  renderAll();
  alert("스폰일지 기록을 모두 리셋했어");
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]/g, "");
}

function recordKey(record) {
  return [record.date, normalizeName(record.opponent), record.result, normalizeName(record.map)].join("|");
}

function markDuplicates(items) {
  const sourceIds = new Set(records.map((record) => record.sourceId).filter(Boolean));
  const existingCounts = new Map();
  for (const record of records) {
    const key = recordKey(record);
    existingCounts.set(key, (existingCounts.get(key) || 0) + 1);
  }
  const seenCounts = new Map();
  return items.map((item) => {
    const key = recordKey(item);
    const occurrence = (seenCounts.get(key) || 0) + 1;
    seenCounts.set(key, occurrence);
    return {
      ...item,
      duplicate: sourceIds.has(item.sourceId) || occurrence <= (existingCounts.get(key) || 0),
    };
  });
}

function openEloDialog() {
  eloPreviewRecords = [];
  const savedPlayer = getBasePlayer();
  $("#eloPlayer").value = savedPlayer;
  const latestDate = [...records]
    .map((record) => record.date)
    .filter(Boolean)
    .sort()
    .at(-1);
  $("#eloFromDate").value =
    latestDate || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  $("#eloStatus").textContent = ELO_API_BASE
    ? savedPlayer
      ? "기준 선수와 조회 시작 날짜를 확인한 뒤 전적 조회를 눌러줘."
      : "대시보드에서 기준 선수를 먼저 저장해줘."
    : "ELO 자동 조회 중계 서버가 아직 연결되지 않았어.";
  $("#eloPreviewBody").innerHTML =
    '<tr><td colspan="8" class="empty">아직 조회하지 않았어</td></tr>';
  $("#eloImportButton").disabled = true;
  $("#eloSelectAll").checked = false;
  eloDlg.showModal();
}

async function previewElo() {
  const player = $("#eloPlayer").value.trim();
  const fromDate = $("#eloFromDate").value;
  const pages = $("#eloPages").value;
  if (!player) {
    alert("대시보드에서 기준 선수를 먼저 저장해줘.");
    return;
  }
  if (!ELO_API_BASE) {
    $("#eloStatus").textContent =
      "ELO 조회 서버 주소가 설정되지 않았어. 저장소의 config.js에 중계 서버 주소를 입력해줘.";
    return;
  }
  $("#eloLookupButton").disabled = true;
  $("#eloImportButton").disabled = true;
  $("#eloStatus").textContent = "ELOBOARD에서 전적을 확인하고 있어…";
  $("#eloPreviewBody").innerHTML = '<tr><td colspan="8" class="empty">조회 중이야…</td></tr>';

  try {
    const query = new URLSearchParams({ player, fromDate, pages });
    const data = await fetchJson(`${ELO_API_BASE}/api/elo/preview?${query}`);
    eloPreviewRecords = markDuplicates(data.items || []);
    renderEloPreview({ ...data, items: eloPreviewRecords });
  } catch (error) {
    eloPreviewRecords = [];
    $("#eloStatus").textContent = error.message;
    $("#eloPreviewBody").innerHTML =
      '<tr><td colspan="8" class="empty">전적을 불러오지 못했어</td></tr>';
  } finally {
    $("#eloLookupButton").disabled = false;
  }
}

function renderEloPreview(data = {}) {
  const newCount = eloPreviewRecords.filter((record) => !record.duplicate).length;
  const duplicateCount = eloPreviewRecords.length - newCount;
  const checkedMatches = Number(data.checkedMatches || eloPreviewRecords.length);
  const fromDate = $("#eloFromDate").value;
  $("#eloStatus").textContent = eloPreviewRecords.length
    ? `ELOBOARD 스폰 전적 ${checkedMatches}경기를 확인해 ${eloPreviewRecords.length}경기를 찾았어. 새 기록 ${newCount}개, 기존 기록과 겹치는 항목 ${duplicateCount}개야.`
    : data.latestAvailableDate && fromDate > data.latestAvailableDate
      ? `개인 페이지의 최신 전적은 ${data.latestAvailableDate}이야. 조회 시작 날짜를 그 날짜 이전으로 바꿔줘.`
      : "선수의 스폰 전적을 확인했지만 조건에 맞는 기록이 없어. 조회 시작 날짜를 더 이전으로 조정해봐.";

  $("#eloPreviewBody").innerHTML =
    eloPreviewRecords
      .map(
        (record, index) =>
          `<tr class="${record.duplicate ? "elo-duplicate" : ""}"><td><input class="elo-check" type="checkbox" data-index="${index}" ${
            record.duplicate ? "disabled" : "checked"
          }></td><td>${esc(record.date)}</td><td>${esc(record.opponent)}</td><td>${esc(
            record.race || "-",
          )}</td><td><b>${esc(record.result)}</b></td><td>${esc(
            record.map || "-",
          )}</td><td>${esc(record.eloChange || "-")}</td><td>${
            record.duplicate ? "기존 기록" : esc(record.eloMatchType || "-")
          }</td></tr>`,
      )
      .join("") || '<tr><td colspan="8" class="empty">조건에 맞는 전적이 없어</td></tr>';
  $("#eloImportButton").disabled = newCount === 0;
  $("#eloSelectAll").checked = newCount > 0;
}

function toggleEloAll(checked) {
  document
    .querySelectorAll(".elo-check:not(:disabled)")
    .forEach((input) => (input.checked = checked));
}

function importSelectedElo() {
  const selected = [...document.querySelectorAll(".elo-check:checked")].map(
    (input) => eloPreviewRecords[Number(input.dataset.index)],
  );
  if (!selected.length) {
    alert("가져올 전적을 선택해줘.");
    return;
  }
  if (!confirm(`선택한 ELO 전적 ${selected.length}개를 스폰일지에 추가할까?`)) return;

  const sourceIds = new Set(records.map((record) => record.sourceId).filter(Boolean));
  const existingCounts = new Map();
  for (const record of records) {
    const key = recordKey(record);
    existingCounts.set(key, (existingCounts.get(key) || 0) + 1);
  }
  const incomingCounts = new Map();
  let nextId = Math.max(0, ...records.map((record) => Number(record.id) || 0)) + 1;
  let added = 0;
  let skipped = 0;

  for (const raw of selected) {
    if (
      raw?.source !== "eloboard" ||
      !raw.sourceId ||
      !raw.date ||
      !raw.opponent ||
      !["승", "패"].includes(raw.result) ||
      sourceIds.has(raw.sourceId)
    ) {
      skipped += 1;
      continue;
    }
    const key = recordKey(raw);
    const occurrence = (incomingCounts.get(key) || 0) + 1;
    incomingCounts.set(key, occurrence);
    if (occurrence <= (existingCounts.get(key) || 0)) {
      skipped += 1;
      continue;
    }
    const record = cleanRecord({
      ...raw,
      id: nextId,
      source: "eloboard",
      tier: raw.tier || "",
      myBuild: raw.myBuild || "",
      enemyBuild: raw.enemyBuild || "",
      cause: raw.cause || "",
      note: raw.note || "",
      feedback: raw.feedback || "",
    });
    delete record.duplicate;
    records.push(record);
    sourceIds.add(record.sourceId);
    nextId += 1;
    added += 1;
  }

  saveRecords();
  renderAll();
  eloDlg.close();
  showTab("log");
  alert(`ELO 전적 ${added}개를 추가했어.${skipped ? ` 중복·오류 ${skipped}개는 제외했어.` : ""}`);
}


/* v1.6.0 · shared player master DB */
const PLAYER_MASTER_URL = "https://hanuri2000-svg.github.io/star-match-manager/players.json";
let masterPlayerPayload = null;
let masterPlayerDirectory = {};

function masterNameKey(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

async function loadSharedPlayerMaster(force = false) {
  try {
    const response = await fetch(`${PLAYER_MASTER_URL}${force ? `?t=${Date.now()}` : ""}`, { cache: "no-store" });
    if (!response.ok) throw new Error("공용 선수 DB를 불러오지 못했어.");
    const payload = await response.json();
    const players = Array.isArray(payload.players) ? payload.players.filter((p) => p && p.active !== false && p.name) : [];
    const directory = {};
    players.forEach((player) => {
      const meta = { name: player.name, tier: player.tier || "", race: player.race || "" };
      directory[masterNameKey(player.name)] = meta;
      (player.aliases || []).forEach((alias) => { if (alias) directory[masterNameKey(alias)] = meta; });
    });
    masterPlayerPayload = payload;
    masterPlayerDirectory = directory;

    const order = Array.isArray(payload.tierOrder) ? payload.tierOrder : [];
    const groups = new Map();
    players.forEach((player) => {
      const label = player.tierLabel || (player.tier === "유스" ? "베이비" : player.tier || "미지정");
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push({
        name: player.name,
        race: player.race || "",
        playerId: player.eloId || null,
        soopId: player.soopId || "",
        thumbUrl: player.thumbUrl || "",
      });
    });
    const labels = [...order.map((t) => t === "유스" ? "베이비" : t), ...groups.keys()]
      .filter((v, i, a) => a.indexOf(v) === i && groups.has(v));
    tierPayload = {
      version: payload.source?.version || "master",
      updatedOn: payload.source?.date || payload.updatedAt || "",
      tiers: labels.map((label) => ({ label, players: groups.get(label) })),
    };
    writeTierCache(tierPayload);

    let list = document.getElementById("masterPlayerNames");
    if (!list) {
      list = document.createElement("datalist");
      list.id = "masterPlayerNames";
      document.body.appendChild(list);
    }
    list.innerHTML = players.map((p) => `<option value="${esc(p.name)}">${esc(p.tier || "")} · ${esc(p.race || "")}</option>`).join("");
    const opponent = form?.elements?.opponent;
    if (opponent) {
      opponent.setAttribute("list", "masterPlayerNames");
      autoFillRecordPlayer(opponent);
    }
    renderTierTable();
    return payload;
  } catch (error) {
    console.warn("공용 선수 DB 연결 실패, 저장된/ELO 티어표 사용", error);
    return null;
  }
}

const legacySharedPlayerDirectory = sharedPlayerDirectory;
sharedPlayerDirectory = function () {
  let parentDirectory = {};
  try { parentDirectory = window.parent?.HARINA_PLAYER_DIRECTORY || {}; } catch {}
  return Object.assign({}, legacySharedPlayerDirectory(), parentDirectory, masterPlayerDirectory);
};

const legacyLoadTierTable = loadTierTable;
loadTierTable = async function (force = false) {
  if (tierLoading) return;
  tierLoading = true;
  tierError = "";
  renderTierTable();
  try {
    const [masterResult] = await Promise.allSettled([loadSharedPlayerMaster(force), fetchTierLive()]);
    if (masterResult.status === "rejected" || !masterResult.value) {
      const cached = readTierCache();
      if (cached) tierPayload = cached;
      else return legacyLoadTierTable(force);
    }
    if (!tierRefreshTimer) {
      tierRefreshTimer = setInterval(() => {
        if (!$("#tier")?.classList.contains("hidden")) fetchTierLive().then(renderTierTable);
      }, 60000);
    }
  } finally {
    tierLoading = false;
    renderTierTable();
    autoFillRecordPlayer(form?.elements?.opponent);
  }
};

const legacyLoad = load;
load = function () {
  legacyLoad();
  loadSharedPlayerMaster(false);
};



window.SpwnNative={
  showTab,
  saveBasePlayer,
  searchRival,
  openForm,
  openEloDialog,
  renderTable,
  exportCsv,
  exportJson,
  importJson,
  resetAllRecords,
  loadTierTable,
  setTierSearch,
  setTierRace,
  toggleTierLiveOnly,
  toggleEloAll,
  previewElo,
  importSelectedElo,
  submitForm,
  autoFillRecordPlayer,
  toggleTierLevel,
  toggleNote,
  editRec,
  delRec,
  closeRecordDialog:()=>dlg.close(),
  closeEloDialog:()=>eloDlg.close()
};
load();
};
const existing=document.querySelector('[data-spwn-native-host]');
if(existing)window.mountSpwnNoteNative(existing);
})();

