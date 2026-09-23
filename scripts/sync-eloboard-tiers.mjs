import { readFile, writeFile } from 'node:fs/promises';

const SOURCE_URL = 'https://eloboard.co.kr/tiers';
const PLAYER_FILE = 'players.json';

const tierIds = [
  ['god', '갓'], ['king', '킹'], ['jack', '잭'], ['joker', '조커'],
  ['spade', '스페이드'], ['0', '0티어'], ['1', '1티어'], ['2', '2티어'],
  ['3', '3티어'], ['4', '4티어'], ['5', '5티어'], ['6', '6티어'],
  ['7', '7티어'], ['8', '8티어'], ['9', '유스']
];

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

function parseSourceMeta(html) {
  const match = html.match(/<h2>변경사항<\/h2>\s*<span[^>]*>([^<]+)<\/span>\s*<span[^>]*>(\d{4}-\d{2}-\d{2})<\/span>/);
  if (!match) throw new Error('EloBoard version metadata was not found');
  return { version: decodeHtml(match[1]), date: match[2] };
}

function parsePlayers(html) {
  const players = [];
  for (const [id, tier] of tierIds) {
    const marker = `id="tier-${id}"`;
    const start = html.indexOf(marker);
    if (start < 0) throw new Error(`Missing tier section: ${tier}`);
    const end = html.indexOf('</section>', start);
    if (end < 0) throw new Error(`Unclosed tier section: ${tier}`);
    const section = html.slice(start, end);
    const links = section.matchAll(/<a\b([^>]*\bhref="\/players\/(\d+)"[^>]*)>([\s\S]*?)<\/a>/g);
    for (const match of links) {
      const attrs = match[1];
      const body = match[3];
      const race = attrs.match(/__([TZP])(?:\s|"|$)/)?.[1];
      const nameMatches = [...body.matchAll(/<span\b[^>]*class="[^"]*__nm[^"]*"[^>]*>([\s\S]*?)<\/span>/g)];
      const name = decodeHtml(nameMatches.at(-1)?.[1]);
      if (!race || !name) continue;
      const rawImage = body.match(/<img\b[^>]*\bsrc="([^"]+)"/)?.[1] || '';
      const thumbUrl = decodeHtml(rawImage).replace(/^https:\/\/eloboard\.co\.kr\/static\//, '');
      players.push({ id: Number(match[2]), name, tier, race, thumbUrl });
    }
  }
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
