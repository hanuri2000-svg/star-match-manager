import { readFile, writeFile } from 'node:fs/promises';

const SOURCE_URL = 'https://eloboard.co.kr/tiers';
const PLAYER_FILE = 'players.json';

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
  const used = new Set();

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
    if (!found && !['T', 'Z', 'P'].includes(item.race)) {
      throw new Error(`Unsafe new player race: ${item.name} (${item.id})`);
    }
    if (found && used.has(found)) throw new Error(`Player matched twice: ${item.name}`);
    if (!found) {
      return {
        name: item.name, tier: item.tier, tierLabel: item.tier === '유스' ? '베이비' : item.tier,
        race: item.race, aliases: [], active: true, eloId: item.id, soopId: '',
        thumbUrl: item.thumbUrl
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
    if (['T', 'Z', 'P'].includes(item.race)) player.race = item.race;
    if (!['T', 'Z', 'P'].includes(player.race)) throw new Error(`Unsafe player race: ${item.name} (${item.id})`);
    player.active = true;
    player.eloId = item.id;
    if (item.thumbUrl) player.thumbUrl = item.thumbUrl;
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
  console.log(`EloBoard ${source.version ? `v${source.version}` : '(version unavailable)'}: synced ${active.length} active, ${inactive.length} inactive`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
