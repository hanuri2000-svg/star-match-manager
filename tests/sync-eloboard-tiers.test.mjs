import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/sync-eloboard-tiers.mjs', import.meta.url));

test('tier sync preserves known races for invalid values and accepts valid race changes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'eloboard-tier-test-'));
  try {
    const invalid = [null, '', ' ', 'unknown', 't', 0, undefined];
    const cases = ['T', 'Z', 'P'].flatMap(race => invalid.map(incoming => ({ race, incoming })));
    cases.push({ race: 'P', incoming: 'Z' }, { race: 'Z', incoming: 'T' }, { race: 'T', incoming: 'P' });
    const players = Array.from({ length: 300 }, (_, index) => ({
      name: `player-${index}`, eloId: index + 1, race: cases[index]?.race ?? 'T',
      tier: 'old', aliases: [], active: true, soopId: `soop-${index}`
    }));
    const sections = Array.from({ length: 15 }, (_, index) => ({
      key: String(index), label: `tier-${index}`, players: players.slice(index * 20, index * 20 + 20).map(player => ({
        player_id: player.eloId, name: player.name,
        race: cases[player.eloId - 1] ? cases[player.eloId - 1].incoming : 'T'
      }))
    }));
    const flight = JSON.stringify({ sections });
    const html = `<h2>변경사항</h2><span>3.62</span><span>2026-10-03</span><script>self.__next_f.push([1,${JSON.stringify(flight)}])</script>`;
    await writeFile(join(dir, 'players.json'), JSON.stringify({ players }));
    await writeFile(join(dir, 'mock-fetch.mjs'), `globalThis.fetch = async () => ({ ok: true, text: async () => ${JSON.stringify(html)} });`);
    execFileSync(process.execPath, ['--import', join(dir, 'mock-fetch.mjs'), script], { cwd: dir });
    const first = await readFile(join(dir, 'players.json'), 'utf8');
    const result = JSON.parse(first).players;
    for (const [index, item] of cases.entries()) {
      assert.equal(result[index].race, ['T', 'Z', 'P'].includes(item.incoming) ? item.incoming : item.race);
      assert.equal(result[index].soopId, players[index].soopId);
      assert.equal(result[index].tier, sections[Math.floor(index / 20)].label);
    }
    // The next scheduled sync must preserve the same data too.
    execFileSync(process.execPath, ['--import', join(dir, 'mock-fetch.mjs'), script], { cwd: dir });
    assert.equal(await readFile(join(dir, 'players.json'), 'utf8'), first);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
