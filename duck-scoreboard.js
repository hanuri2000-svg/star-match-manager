/* Duck scoreboard: individual scores first, external pinball teams later. */
(() => {
  const previousPanel = partyScorePanel;
  const pinballTeam = player => ['odd', 'even'].includes(player.pinballTeam) ? player.pinballTeam : '';
  const rankedPlayers = () => {
    let lastTotal = null, lastRank = 0;
    return s.partyScore.players.map(player => ({...player, total: partyTotal(player)}))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'ko'))
      .map((player, index) => {
        const rank = player.total === lastTotal ? lastRank : index + 1;
        lastTotal = player.total; lastRank = rank;
        return {...player, rank};
      });
  };
  partyScorePanel = function () {
    if (s.partyScore.game !== '덕몽어스') return previousPanel();
    const board = s.partyScore, ranked = rankedPlayers();
    const rounds = Array.from({length: board.rounds}, (_, index) => index);
    const current = Math.max(0, Math.min(board.rounds - 1, Number(board.scoreRound) || 0));
    const hasTeams = ranked.some(player => pinballTeam(player));
    const showTeams = board.pinballTeamsVisible || hasTeams;
    const unassigned = ranked.filter(player => !pinballTeam(player)).length;
    const teamSummary = ['odd', 'even'].map(team => {
      const members = ranked.filter(player => pinballTeam(player) === team);
      return `<div><span>${team === 'odd' ? '홀팀' : '짝팀'} · ${members.length}명</span><strong>${members.reduce((sum, player) => sum + player.total, 0)}점</strong></div>`;
    }).join('');
    return `<section class="panel party-score-panel duck-score-panel">
      <div class="party-score-head">
        <div><p class="eyebrow">ROUND SCOREBOARD</p><h2>덕몽어스 점수·순위</h2></div>
        <div class="party-score-actions">
          <label>게임<select data-party="game"><option selected>덕몽어스</option><option>폴가이즈</option></select></label>
          <label class="party-round-field">라운드 수<input type="number" min="1" max="30" value="${board.rounds}" data-party-round-count aria-label="라운드 수"></label>
          <button class="danger" data-party-act="reset">점수 초기화</button>
          <button type="button" class="primary party-save-image" data-party-image-save>순위 결과 이미지 저장</button>
        </div>
      </div>
      <div class="party-player-add"><input id="partyPlayerName" placeholder="참가자 이름" aria-label="참가자 이름"><button class="primary" data-party-act="add-player">참가자 추가</button></div>
      <div class="duck-round-tools">
        <label>입력 라운드<select data-duck-score-round>${rounds.map(index => `<option value="${index}" ${index === current ? 'selected' : ''}>${index + 1}라운드</option>`).join('')}</select></label>
        <p>점수를 입력하면 총점과 순위가 자동으로 바뀌어.<br>팀은 핀볼 홀짝 결과가 나온 뒤 배정해.</p>
        ${showTeams ? '' : '<button type="button" class="secondary" data-duck-show-teams>핀볼 홀짝 결과 입력</button>'}
      </div>
      ${showTeams ? `<div class="duck-pinball-status">핀볼 홀짝 배정 · 미정 ${unassigned}명</div>` : ''}
      ${hasTeams ? `<div class="duck-team-summary">${teamSummary}</div>` : ''}
      <div class="party-game-title"><strong>개인 순위</strong><span>${ranked.length}명 · ${board.rounds}라운드</span></div>
      <div class="party-table-wrap"><table class="party-table duck-score-table">
        <thead><tr><th>순위</th><th class="party-name-col">참가자</th><th class="party-total-col">총점</th>${rounds.map(index => `<th data-duck-round-column ${index === current ? 'data-current-round' : ''}>${index + 1}R 점수</th>`).join('')}${showTeams ? '<th>핀볼 홀짝</th>' : ''}<th></th></tr></thead>
        <tbody>${ranked.map(player => `<tr data-duck-player="${esc(player.id)}">
          <td><b class="party-rank ${player.rank <= 3 ? 'top' : ''}">${player.rank}</b></td>
          <td class="party-name"><strong>${esc(player.name)}</strong></td>
          <td class="party-total"><input class="party-total-input" type="number" inputmode="decimal" data-party-total="${esc(player.id)}" value="${player.total}" aria-label="${esc(player.name)} 총점" title="라운드 점수 자동 합계 · 직접 입력 가능"></td>
          ${rounds.map(index => `<td data-duck-round-column ${index === current ? 'data-current-round' : ''}><input class="party-score-input" type="number" inputmode="decimal" data-party-score="${esc(player.id)}" data-round="${index}" value="${esc((board.scores[player.id] || [])[index] ?? '')}" placeholder="0" aria-label="${esc(player.name)} ${index + 1}라운드 점수"></td>`).join('')}
          ${showTeams ? `<td><select data-duck-pinball-team="${esc(player.id)}" aria-label="${esc(player.name)} 핀볼 홀짝"><option value="">미정</option><option value="odd" ${pinballTeam(player) === 'odd' ? 'selected' : ''}>홀팀</option><option value="even" ${pinballTeam(player) === 'even' ? 'selected' : ''}>짝팀</option></select></td>` : ''}
          <td><button class="x" data-party-act="del-player" data-id="${esc(player.id)}" aria-label="${esc(player.name)} 삭제">×</button></td>
        </tr>`).join('') || `<tr><td colspan="${rounds.length + (showTeams ? 5 : 4)}" class="party-empty">참가자를 추가하면 라운드별 점수와 순위가 표시돼.</td></tr>`}</tbody>
      </table></div>
    </section>`;
  };
  document.addEventListener('click', event => {
    if (event.target.closest('[data-duck-show-teams]')) {
      s.partyScore.pinballTeamsVisible = true;
      save();
    }
  });
  document.addEventListener('change', event => {
    if (event.target.matches('[data-duck-score-round]')) {
      s.partyScore.scoreRound = Number(event.target.value);
      save();
    }
    if (event.target.matches('[data-duck-pinball-team]')) {
      const player = s.partyScore.players.find(player => player.id === event.target.dataset.duckPinballTeam);
      if (player) { player.pinballTeam = event.target.value; save(); }
    }
  });
  window.DORANG_DUCK_RANKING_CANVAS = () => {
    const ranked = rankedPlayers(), canvas = document.createElement('canvas');
    const hasTeams = ranked.some(player => pinballTeam(player));
    canvas.width = 1080; canvas.height = Math.max(620, 370 + ranked.length * 68);
    const ctx = canvas.getContext('2d');
    const font = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    const text = (value, x, y, size = 24, color = '#463451', align = 'left', maxWidth = 920) => {
      ctx.font = `800 ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align;
      ctx.fillText(String(value), x, y, maxWidth);
    };
    ctx.fillStyle = '#faf5fd'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    text('DORANG PARTY SCOREBOARD', 60, 58, 20, '#8a5aae');
    text('덕몽어스 순위 결과', 60, 122, 48);
    text(`참가자 ${ranked.length}명 · ${s.partyScore.rounds}라운드`, 60, 166, 22);
    if (hasTeams) {
      const teams = ['odd', 'even'].map(team => {
        const members = ranked.filter(player => pinballTeam(player) === team);
        return `${team === 'odd' ? '홀팀' : '짝팀'} ${members.reduce((sum, player) => sum + player.total, 0)}점 (${members.length}명)`;
      });
      const pending = ranked.filter(player => !pinballTeam(player)).length;
      text(`${teams.join('  ·  ')}  ·  미정 ${pending}명`, 60, 216, 23);
    } else text('핀볼 홀짝 배정 전 · 개인 순위', 60, 216, 23);
    ctx.fillStyle = '#5f496d'; ctx.fillRect(60, 250, 960, 52);
    text('순위', 110, 285, 22, '#fff', 'center');
    text('참가자', 180, 285, 22, '#fff');
    if (hasTeams) text('핀볼 홀짝', 760, 285, 22, '#fff', 'center');
    text('총점', 950, 285, 22, '#fff', 'center');
    ranked.forEach((player, index) => {
      const y = 310 + index * 68;
      ctx.fillStyle = index % 2 ? '#f2eaf8' : '#fff'; ctx.fillRect(60, y, 960, 60);
      text(player.rank, 110, y + 39, 24, '#725780', 'center');
      text(player.name, 180, y + 39, 25, '#463451', 'left', 450);
      if (hasTeams) text(pinballTeam(player) === 'odd' ? '홀팀' : pinballTeam(player) === 'even' ? '짝팀' : '미정', 760, y + 39, 22, '#725780', 'center');
      text(player.total, 950, y + 39, 28, '#416332', 'center');
    });
    text('도랑이꺼야 · 덕몽어스', 540, canvas.height - 24, 17, '#887a91', 'center');
    return canvas;
  };
  document.head.insertAdjacentHTML('beforeend', `<style>
    /* Let the document/view scroll before shrinking the score table away. */
    body.app-fit-screen #app > .party-score-view:has(.duck-score-panel){overflow:auto!important}
    body.app-fit-screen .duck-score-panel{height:auto;min-height:100%;overflow:visible}
    body.app-fit-screen .duck-score-panel > *{flex-shrink:0}
    body.app-fit-screen .duck-score-panel .party-table-wrap{flex:none;min-height:180px;overflow:auto}
    .duck-round-tools{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px}
    .duck-round-tools label{min-width:110px}.duck-round-tools p{flex:1;margin:0;color:var(--muted);font-size:12px;line-height:1.6}
    .duck-team-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0 12px}
    .duck-team-summary > div{display:flex;justify-content:space-between;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--panel)}
    .duck-pinball-status{font-size:12px;color:var(--muted);margin-bottom:8px}
    .duck-score-table .party-name-col{min-width:96px}
    .duck-score-table .party-name strong{overflow-wrap:anywhere}
    .duck-score-table .party-total-input{color:#345326!important;background:#fff!important}
    @media(max-width:760px){
      .duck-score-table{min-width:100%}.duck-score-table .party-name-col{min-width:84px}
      .duck-score-table [data-duck-round-column]{display:none}
      .duck-score-table [data-duck-round-column][data-current-round]{display:table-cell}
      .duck-score-table .party-total-col{min-width:64px}
      .duck-score-table .party-total-input{width:60px}
      .duck-score-table .party-score-input{width:58px}
      .duck-round-tools p{flex-basis:calc(100% - 130px)}
    }
  </style>`);
})();
