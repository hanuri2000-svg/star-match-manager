import { readFile, writeFile } from 'node:fs/promises';

const SOURCE_URL = 'https://eloboard.co.kr/tiers';
const THUMB_BASE_URL = 'https://eloboard.co.kr/static/';
const PLAYER_FILE = 'players.json';

async function isUsableThumbnail(path) {
  // Only accept EloBoard's relative player images; a source field must not
  // cause the scheduled job to request an arbitrary URL.
  if (!/^players\/[a-zA-Z0-9._-]+\.(?:jpe?g|png|webp|gif)(?:\?v=\d+)?$/.test(path)) return false;
  try {
    const response = await fetch(new URL(path, THUMB_BASE_URL), {
      headers: { accept: 'image/*', 'user-agent': 'star-match-manager-tier-sync/1.0' },
      signal: AbortSignal.timeout(8000)
    });
    const contentType = response.headers?.get('content-type')?.trim() || '';
    await response.body?.cancel?.();
    // EloBoard can return its HTML fallback with HTTP 200 for a missing image.
    return response.ok && /^image\/(?:jpeg|png|webp|gif|avif)(?:;|$)/i.test(contentType);
  } catch {
    return false;
  }
}

function decodeHtml(value = '') {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .trim();
}

function parseFlightData(html) {
  const chunks = [];
  const pattern = /self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)<\/script>/g;
  for (const match of html.matchAll(pattern)) chunks.push(JSON.parse(match[1]));
  if (!chunks.length) throw new Error('EloBoard Next.js data was not found');
  return chunks.join('\n');
}

function parseJsonValue(source, marker) {
  const markerAt = source.indexOf(marker);
  if (markerAt < 0) throw new Error(`EloBoard data marker was not found: ${marker}`);
  const start = markerAt + marker.length;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '[' || char === '{') depth += 1;
    else if (char === ']' || char === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(source.slice(start, index + 1));
    }
  }
  throw new Error(`EloBoard data was incomplete after marker: ${marker}`);
}

function parseSourceMeta(html) {
  // EloBoard has changed this visible block over time (from a version/date pair
  // under "변경사항" to a plain "최종 갱신" date). Treat metadata as optional:
  // valid player data may still sync, while the caller keeps the last-known
  // values when the page no longer publishes them.
  const visible = decodeHtml(html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));
  const normalized = visible.replace(/\s+/g, ' ').trim();
  const contexts = [...normalized.matchAll(/(?:변경사항|최종\s*갱신|최종\s*업데이트|버전|version)[\s\S]{0,240}/gi)]
    .map(match => match[0]);
  const versionMatch = contexts
    .map(context => context.match(/(?:version|버전)\s*[:：]?\s*v?(\d{1,3}\.\d+(?:\.\d+){0,2})|(?:변경사항)[^0-9]{0,40}(\d{1,3}\.\d+(?:\.\d+){0,2})/i))
    .find(Boolean);
  const dateContexts = contexts.filter(context => /최종\s*(?:갱신|업데이트)/i.test(context));
  const dateMatch = [...(dateContexts.length ? dateContexts : contexts)]
    .map(context => context.match(/\b(20\d{2}-\d{2}-\d{2})\b/))
    .find(Boolean);
  return {
    version: versionMatch ? (versionMatch[1] || versionMatch[2]) : null,
    date: dateMatch ? dateMatch[1] : null
  };
}
function parsePlayers(html) {
  const flightData = parseFlightData(html);
  const sections = parseJsonValue(flightData, '"sections":');
  if (!Array.isArray(sections) || sections.length === 0 || sections.some(section =>
    !section || !Array.isArray(section.players) ||
    typeof section.label !== 'string' || !section.label.trim()
  )) {
    throw new Error('Unsafe EloBoard result: invalid tier sections');
  }
  const players = sections.flatMap(section => section.players.map(player => ({
    id: Number(player.player_id),
    name: player.name,
    tier: section.key === '9' ? '유스' : section.label,
    race: player.race,
    thumbUrl: player.thumb_url || ''
  })));
  const ids = new Set(players.map(player => player.id));
  if (players.length < 300 || ids.size !== players.length) {
    throw new Error(`Unsafe EloBoard result: ${players.length} players, ${ids.size} unique IDs`);
  }
  return players;
}

function koreaDate() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

async function main() {
  const response = await fetch(SOURCE_URL, {
    headers: { 'user-agent': 'star-match-manager-tier-sync/1.0' }
  });
  if (!response.ok) throw new Error(`EloBoard request failed: ${response.status}`);
  const html = await response.text();
  const source = parseSourceMeta(html);
  const official = parsePlayers(html);
  const db = JSON.parse(await readFile(PLAYER_FILE, 'utf8'));
  // Stable IDs identify players. A shared name must never migrate an identity.
  const validId = value => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
  const nameKey = value => typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase() : '';
  const currentById = new Map();
  const currentByName = new Map();
  for (const player of db.players) {
    const key = nameKey(player.name);
    if (!key) throw new Error('Unsafe player DB: empty name');
    const id = player.eloId;
    if (id != null && id !== '') {
      if (!validId(id) || currentById.has(id)) throw new Error(`Unsafe player DB: invalid or duplicate ID ${id}`);
      currentById.set(id, player);
    }
    currentByName.set(key, [...(currentByName.get(key) || []), player]);
  }
  const officialIds = new Set();
  for (const item of official) {
    const key = nameKey(item.name);
    if (!validId(item.id) || officialIds.has(item.id)) throw new Error(`Unsafe EloBoard ID: ${item.id}`);
    if (!key) throw new Error(`Unsafe EloBoard name: ${item.name}`);
    if (typeof item.tier !== 'string' || !item.tier.trim()) throw new Error(`Unsafe EloBoard tier: ${item.name}`);
    officialIds.add(item.id);
  }
  // A large loss of known active IDs can indicate a partial source response,
  // even when the absolute 300-player floor still passes.
  const knownActive = db.players.filter(player => player.active !== false && validId(player.eloId));
  const retained = knownActive.filter(player => officialIds.has(player.eloId));
  if (knownActive.length >= 300 && retained.length < Math.ceil(knownActive.length * 0.95)) {
    throw new Error(`Unsafe EloBoard coverage: ${retained.length}/${knownActive.length} known active IDs`);
  }
  // A photo may work from the Actions runner while serving HTML to visitors.
  // Keep browser-confirmed failures on their player record until the source
  // publishes a different URL, regardless of the runner's response.
  const isRejectedThumbnail = (player, path) => Array.isArray(player?.rejectedThumbUrls)
    && player.rejectedThumbUrls.includes(path);
  const thumbnailCandidates = [...new Set(official
    .filter(item => item.thumbUrl && item.thumbUrl !== currentById.get(item.id)?.thumbUrl
      && !isRejectedThumbnail(currentById.get(item.id), item.thumbUrl))
    .map(item => item.thumbUrl))];
  const validThumbnails = new Set();
  for (let index = 0; index < thumbnailCandidates.length; index += 4) {
    await Promise.all(thumbnailCandidates.slice(index, index + 4).map(async path => {
      if (await isUsableThumbnail(path)) validThumbnails.add(path);
      else console.warn(`Skipping unavailable EloBoard thumbnail: ${path}`);
    }));
  }
  const used = new Set();
  const isKnownRace = race => ['T', 'Z', 'P'].includes(race);
  const isUndecidedRace = race => race == null || (typeof race === 'string' && ['', '미정'].includes(race.trim()));

  const active = official.map(item => {
    let found = currentById.get(item.id);
    const sameName = currentByName.get(nameKey(item.name)) || [];
    if (!found && sameName.length) {
      // A same-name player with a different ID is never used as the match.
      // Keep both records only when every existing same-name ID is also
      // present in this official snapshot, proving these are concurrent IDs.
      const existingIdentitiesRemainOfficial = sameName.every(player =>
        validId(player.eloId) && officialIds.has(player.eloId)
      );
      if (existingIdentitiesRemainOfficial) {
        found = undefined; // create a separate record for this distinct ID
      } else if (sameName.length === 1 && (sameName[0].eloId == null || sameName[0].eloId === '')) {
        // Only a unique legacy record without any ID may acquire an official ID.
        found = sameName[0];
      } else {
        throw new Error(`Player identity conflict: ${item.name}, existing IDs [${sameName.map(p => p.eloId).join(', ')}], incoming ID ${item.id}. Verify identities before syncing.`);
      }
    }
    // An explicit undecided race is valid roster data, stored consistently as null.
    // Malformed values may only be ignored when a known local race can be kept.
    if (!isKnownRace(item.race) && !isUndecidedRace(item.race) && !isKnownRace(found?.race)) {
      throw new Error(`Unsafe player race: ${item.name} (${item.id})`);
    }
    if (found && used.has(found)) throw new Error(`Player matched twice: ${item.name}`);
    if (!found) {
      return {
        name: item.name, tier: item.tier, tierLabel: item.tier === '유스' ? '베이비' : item.tier,
        race: isKnownRace(item.race) ? item.race : null, aliases: [], active: true, eloId: item.id, soopId: '',
        thumbUrl: validThumbnails.has(item.thumbUrl) ? item.thumbUrl : ''
      };
    }
    used.add(found);
    const player = { ...found };
    if (player.name !== item.name) {
      player.aliases = [...new Set([...(player.aliases || []), player.name].filter(name => name && name !== item.name))];
      player.name = item.name;
    }
    player.tier = item.tier;
    player.tierLabel = item.tier === '유스' ? '베이비' : item.tier;
    // Missing or unknown source values must not erase a known race.
    if (isKnownRace(item.race)) player.race = item.race;
    else if (!isKnownRace(player.race)) player.race = null;
    player.active = true;
    player.eloId = item.id;
    if (validThumbnails.has(item.thumbUrl) && !isRejectedThumbnail(found, item.thumbUrl)) {
      player.thumbUrl = item.thumbUrl;
    }
    return player;
  });

  const inactive = db.players
    .filter(player => !used.has(player))
    .map(player => ({ ...player, active: false }));

  const nextSource = {
    name: '스타CK 밸런스 티어표',
    version: source.version || db.source?.version || null,
    date: source.date || db.source?.date || null
  };
  const nextPlayers = [...active, ...inactive];
  const unchanged = JSON.stringify(db.source) === JSON.stringify(nextSource)
    && JSON.stringify(db.players) === JSON.stringify(nextPlayers);
  if (unchanged) {
    console.log(`EloBoard ${source.version ? `v${source.version}` : '(version unavailable)'}: already current (${active.length} active)`);
    return;
  }
  const next = { ...db, updatedAt: koreaDate(), source: nextSource, players: nextPlayers };
  const after = JSON.stringify(next, null, 2) + '\n';
  await writeFile(PLAYER_FILE, after);
  console.log(`EloBoard ${source.version ? `v${source.version}` : '(version unavailable)'}: synced ${active.length} active, ${inactive.length} retained outside imported roster, ${active.filter(player => player.race == null).length} undecided`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
