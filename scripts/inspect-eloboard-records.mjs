import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Read-only: ordinary public pages only. No rejected JSON API, credentials,
// DB writes, scheduled collection, or production deployment.
const output = 'record-access-diagnostic';
const origin = 'https://eloboard.com';
const playerId = 443, target = 50, maxRecentPages = 7;

function flightData(html) {
  const chunks = [];
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)<\/script>/g)) chunks.push(JSON.parse(match[1]));
  if (!chunks.length) throw new Error('Public profile data not found');
  return chunks.join('');
}
function jsonValue(source, start) {
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === '[' || c === '{') depth++;
    else if ((c === ']' || c === '}') && --depth === 0) return JSON.parse(source.slice(start, i + 1));
  }
  throw new Error('Incomplete public profile data');
}
function matchRows(html) {
  const flight = flightData(html);
  for (const match of flight.matchAll(/"playerId":443,"initial":/g)) {
    const rows = jsonValue(flight, match.index + match[0].length);
    if (!Array.isArray(rows) || !rows.every(row => Number.isSafeInteger(row.id) &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.played_on || '') && Array.isArray(row.participants) &&
      row.participants.some(p => p.player_id === playerId))) continue;
    if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Duplicate IDs in one response');
    if (rows.some((row, i) => i && row.played_on > rows[i - 1].played_on)) throw new Error('Source order is not newest first');
    return rows;
  }
  throw new Error('Match list not found');
}

const fixture = process.argv.find(arg => arg.startsWith('--fixture='));
if (fixture) {
  const rows = matchRows(await readFile(fixture.slice('--fixture='.length), 'utf8'));
  console.log(JSON.stringify({fixture: true, rows: rows.length, first: rows[0]?.id, last: rows.at(-1)?.id}));
} else {
  await mkdir(output, {recursive: true});
  const report = {checkedAt: new Date().toISOString(), playerId, checks: [], recent: {target, status: 'not_checked'}};
  let stopped = false;
  async function page(name, path) {
    if (stopped) return null;
    const row = {name, requestedUrl: new URL(path, origin).href};
    try {
      const response = await fetch(row.requestedUrl, {
        headers: {'user-agent': 'star-match-manager-stat-check/1.0', accept: 'text/html'},
        signal: AbortSignal.timeout(15_000),
      });
      Object.assign(row, {status: response.status, finalUrl: response.url, contentType: response.headers.get('content-type')});
      const reader = response.body.getReader(), chunks = [];
      let size = 0;
      while (true) {
        const {value, done} = await reader.read();
        if (done) break;
        if ((size += value.length) > 5_000_000) {
          await reader.cancel();
          throw new Error('Public page exceeds diagnostic size bound');
        }
        chunks.push(value);
      }
      const bytes = Buffer.concat(chunks), body = bytes.toString('utf8');
      row.bytes = bytes.length;
      row.sha256 = createHash('sha256').update(bytes).digest('hex');
      row.title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
      const challenge = /site unavailable|access denied|just a moment|verify you are human|cf-chl-|captcha/i.test(body);
      row.ok = response.ok && !challenge && /최도랑/.test(row.title) && /text\/html/.test(row.contentType || '');
      if ([401, 403, 429].includes(response.status) || challenge) stopped = true;
      if (!row.ok) throw new Error('Public page response is unavailable or unexpected');
      await writeFile(output + '/' + name + '.html', bytes);
      row.visibleExcerpt = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 2300);
      report.checks.push(row);
      console.log(JSON.stringify({...row, visibleExcerpt: undefined}));
      return body;
    } catch (error) {
      row.ok = false; row.error = error.message;
      report.checks.push(row); console.log(JSON.stringify(row));
      return null;
    }
  }
  try {
    await page('summary', '/players/' + playerId);
    await page('maps', '/players/' + playerId + '?tab=maps');
    await page('rival-513', '/players/' + playerId + '?tab=rivals&vs=513');
    const seen = new Map(), batches = [];
    let boundaryIds = [];
    let boundary = '', status = 'page_bound_reached';
    for (let i = 0; i < maxRecentPages; i++) {
      // MatchFilters exposes this ordinary date filter. Include the boundary
      // day again; skipping directly to the preceding day loses games.
      const path = '/players/' + playerId + '?tab=matches' + (boundary ? '&to=' + boundary : '');
      const html = await page('recent-' + (i + 1), path);
      if (!html) { status = 'public_page_unavailable'; break; }
      const rows = matchRows(html);
      if (boundary && rows.some(row => row.played_on > boundary)) throw new Error('Public date filter was not honored');
      if (boundary && JSON.stringify(rows.slice(0, boundaryIds.length).map(row => row.id)) !== JSON.stringify(boundaryIds)) {
        throw new Error('Boundary prefix changed; consistent recent-list continuity not established');
      }
      const overlap = rows.filter(row => seen.has(row.id)).length;
      if (boundary && rows.length && overlap === 0) throw new Error('Boundary overlap missing; continuity not established');
      const before = seen.size;
      for (const row of rows) {
        if (seen.has(row.id) && JSON.stringify(seen.get(row.id)) !== JSON.stringify(row)) throw new Error('Overlapping match changed during the snapshot');
        if (!seen.has(row.id)) seen.set(row.id, row);
      }
      const oldest = rows.at(-1)?.played_on || '';
      batches.push({queryTo: boundary || null, count: rows.length, overlap, added: seen.size - before, oldest, unique: seen.size});
      console.log(JSON.stringify({batch: batches.at(-1)}));
      if (seen.size >= target) { status = 'target_collected'; break; }
      if (rows.length < 15) { status = 'short_public_page'; break; }
      if (boundary && oldest >= boundary) { status = 'same_day_window_saturated'; break; }
      boundary = oldest;
      boundaryIds = rows.filter(row => row.played_on === boundary).map(row => row.id);
    }
    const rows = [...seen.values()];
    report.recent = {target, status, uniqueCollected: rows.length, displayed: Math.min(target, rows.length), batches};
    await writeFile(output + '/recent-matches.json', JSON.stringify(rows.slice(0, target), null, 2) + '\n');
  } catch (error) {
    report.recent.status = 'validation_failed'; report.recent.error = error.message;
  } finally {
    await writeFile(output + '/report.json', JSON.stringify(report, null, 2) + '\n');
    const lines = ['# 공개 통계·상대전적·최근 50경기 확인', '', '확인: ' + report.checkedAt, '',
      '| 공개 페이지 | HTTP | 내용 확인 |', '|---|---:|---|',
      ...report.checks.map(r => '| ' + r.name + ' | ' + (r.status || '—') + ' | ' + (r.ok ? '성공' : '실패') + ' |'), '',
      '최근 경기: ' + report.recent.status + ', 고유 ' + (report.recent.uniqueCollected || 0) + '건, 표시 ' + (report.recent.displayed || 0) + '건', '',
      '일반 공개 페이지의 날짜 필터만 확인했습니다. 거절된 API를 재요청하지 않습니다.',
      '진단 완료와 자동 연동 배포 완료는 다릅니다. 선수DB·개인 기록·운영 배포는 변경하지 않습니다.', ''];
    await writeFile(output + '/report.md', lines.join('\n'));
    console.log(JSON.stringify({recent: report.recent}));
  }
}
