/* Personal annotations only. Official match facts are never changed or counted again. */
(function (global, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.StarlogNotes = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const owner = 443, maximum = 10000;
  const idOK = value => /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value));
  const keyFor = id => { if (!idOK(id)) throw new Error('경기번호를 확인해 주세요.'); return owner + ':' + Number(id); };
  function snapshot(match) {
    if (!match || !idOK(match.id) || typeof match.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(match.date) ||
        !['W', 'L'].includes(match.result) || typeof match.opponent !== 'string' || !match.opponent.trim()) throw new Error('경기 정보를 확인해 주세요.');
    return { id: Number(match.id), date: match.date, opponent: match.opponent,
      opponentId: idOK(match.opponentId) ? Number(match.opponentId) : null,
      race: ['P', 'T', 'Z', 'R'].includes(match.race) ? match.race : 'R',
      result: match.result, map: String(match.map || ''), type: String(match.type || '기타') };
  }
  function validNotes(notes) {
    if (notes === undefined) return true; // Backwards-compatible journal backups.
    if (!notes || typeof notes !== 'object' || Array.isArray(notes)) return false;
    return Object.entries(notes).every(([key, note]) => {
      try {
        return note && key === keyFor(note.match?.id) && snapshot(note.match) &&
          ['memo', 'feedback'].every(field => typeof note[field] === 'string' && note[field].length <= maximum) &&
          typeof note.star === 'boolean' && typeof note.updatedAt === 'string' && Number.isFinite(Date.parse(note.updatedAt));
      } catch { return false; }
    });
  }
  function get(notes, id) { return notes?.[keyFor(id)] || null; }
  function save(notes, match, memo, feedback, star = false, now = Date.now()) {
    if (!validNotes(notes) || [memo, feedback].some(text => typeof text !== 'string' || text.length > maximum)) throw new Error('메모와 피드백은 각각 10,000자 이하로 작성해 주세요.');
    const stored = snapshot(match);
    return { ...(notes || {}), [keyFor(stored.id)]: { match: stored, memo, feedback, star: Boolean(star), updatedAt: new Date(now).toISOString() } };
  }
  function enrich(matches, notes) {
    return matches.map(match => { const note = get(notes, match.id); return { ...match, memo: note?.memo || '', feedback: note?.feedback || '', star: Boolean(note?.star) }; });
  }
  function reviewRows(notes) {
    return Object.values(notes || {}).filter(note => note.memo.trim() || note.feedback.trim() || note.star).map(note => ({
      ...note.match, id: 'elo-note-' + note.match.id, eloMatchId: note.match.id, source: 'eloboard-note', myRace: 'P',
      build: '', enemyBuild: '', tags: '', star: note.star, created: Date.parse(note.updatedAt),
      memo: [['메모', note.memo], ['피드백', note.feedback]].filter(([, text]) => text.trim()).map(([label, text]) => '[' + label + ']\n' + text).join('\n\n')
    }));
  }
  return { keyFor, snapshot, validNotes, get, save, enrich, reviewRows };
});
