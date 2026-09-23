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
  const match = html.match(/<h2>변경사항<\/h2>\s*<span[^>]*>([^<]+)<\/span>\s*<span[^>]*>(\d{4}-\d{2}-\d{2})<\/span>/);
  if (!match) throw new Error('EloBoard version metadata was not found');
  return { version: decodeHtml(match[1]), date: match[2] };
}

function parsePlayers(html) {
  const flightData = parseFlightData(html);
  const sections = parseJsonValue(flightData, '"sections":');
  if (!Array.isArray(sections) || sections.length !== 15) {
    throw new Error(`Unsafe EloBoard result: ${sections?.length || 0} tier sections`);
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
  const currentById = new Map(db.players.map(player => [Number(player.eloId), player]));
  const currentByName = new Map(db.players.map(player => [player.name, player]));
  const used = new Set();

  const active = official.map(item => {
    const found = currentById.get(item.id) || currentByName.get(item.name);
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
    player.race = item.race;
    player.active = true;
    player.eloId = item.id;
    if (item.thumbUrl) player.thumbUrl = item.thumbUrl;
    return player;
  });

  const inactive = db.players
    .filter(player => !used.has(player) && !official.some(item => item.id === Number(player.eloId) || item.name === player.name))
    .map(player => ({ ...player, active: false }));

  const nextSource = { name: '스타CK 밸런스 티어표', version: source.version, date: source.date };
  const nextPlayers = [...active, ...inactive];
  const unchanged = JSON.stringify(db.source) === JSON.stringify(nextSource)
    && JSON.stringify(db.players) === JSON.stringify(nextPlayers);
  if (unchanged) {
    console.log(`EloBoard v${source.version}: already current (${active.length} active)`);
    return;
  }
  const next = { ...db, updatedAt: koreaDate(), source: nextSource, players: nextPlayers };
  const after = JSON.stringify(next, null, 2) + '\n';
  await writeFile(PLAYER_FILE, after);
  console.log(`EloBoard v${source.version}: synced ${active.length} active, ${inactive.length} inactive`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
