import {mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Read-only diagnostic in the same runner that already fetches the tier list.
// Do not change the player DB, import user records, or retry access challenges.
const output = 'record-access-diagnostic';
const origin = 'https://eloboard.co.kr';
const checks = [
  ['profile', '/players/443?tab=matches', 'html'],
  // The existing public player DB already supplies ID 443. The legacy player
  // search route returned 403, so do not retry it; check the distinct match
  // endpoint needed for records directly, without a directory lookup.
  ['matches', '/api/matches?player_id=443&limit=2&offset=0', 'json'],
  ['races', '/api/players/443/stats/races', 'json'],
];
await mkdir(output, {recursive: true});
const report = {checkedAt: new Date().toISOString(), playerId: 443, checks: []};
let apiBlocked = false;
for (const [name, path, expected] of checks) {
  if (expected === 'json' && apiBlocked) {
    report.checks.push({name, skipped: 'Earlier API response was an access challenge or rate limit'});
    continue;
  }
  const url = new URL(path, origin);
  const row = {name, requestedUrl: url.href};
  try {
    const response = await fetch(url, {
      headers: {'user-agent': 'star-match-manager-record-check/1.0', accept: expected === 'json' ? 'application/json' : 'text/html'},
      signal: AbortSignal.timeout(20_000),
    });
    Object.assign(row, {status: response.status, finalUrl: response.url, contentType: response.headers.get('content-type')});
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 5_000_000) {
        await reader.cancel();
        throw new Error('Response exceeds the 5 MB diagnostic bound');
      }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    const body = bytes.toString('utf8');
    row.bytes = bytes.length;
    row.sha256 = createHash('sha256').update(bytes).digest('hex');
    row.title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
    const challenge = /site unavailable|access denied|just a moment|verify you are human|cf-chl-|captcha/i.test(body);
    row.accessChallenge = challenge;
    if (expected === 'json' && ([401, 403, 429].includes(response.status) || challenge)) apiBlocked = true;
    let data;
    try { data = JSON.parse(body); } catch {}
    row.json = data !== undefined;
    if (data !== undefined) {
      row.shape = Array.isArray(data) ? {kind: 'array', length: data.length, firstKeys: Object.keys(data[0] || {})} : {kind: typeof data, keys: Object.keys(data || {})};
    }
    row.ok = response.ok && !challenge && (expected === 'html' ? /<html[\s>]/i.test(body) && /최도랑/.test(body) : data !== undefined);
    if (row.ok) await writeFile(`${output}/${name}.${expected}`, bytes);
    else row.excerpt = body.replace(/\s+/g, ' ').slice(0, 500);
  } catch (error) {
    row.ok = false;
    row.error = error.message;
  }
  report.checks.push(row);
  console.log(JSON.stringify(row));
}
await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n');
const summary = ['# EloBoard 전적 접근 확인', '', `확인: ${report.checkedAt}`, '', '| 자료 | HTTP | 실제 내용 확인 |', '|---|---:|---|', ...report.checks.map(r => `| ${r.name} | ${r.status || '—'} | ${r.skipped ? '제한 응답 후 추가 API 요청 중단' : r.ok ? '확인' : '확인 실패'} |`), '', '읽기 전용 진단이며 선수DB·개인 경기 기록·운영 사이트는 변경하지 않습니다.', '프로필 HTML 성공만으로 전체 경기 수집 성공을 의미하지 않습니다.', ''];
await writeFile(`${output}/report.md`, summary.join('\n'));
