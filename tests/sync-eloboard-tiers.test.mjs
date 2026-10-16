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


async function withSyncFixture(change, check) {
  const dir = await mkdtemp(join(tmpdir(), 'eloboard-identity-test-'));
  try {
    const players = Array.from({ length: 300 }, (_, index) => ({
      name: `player-${index}`, eloId: index + 1, race: 'T', tier: '7티어',
      aliases: [], active: true, soopId: `soop-${index}`, thumbUrl: `old-${index}.jpg`
    }));
    const official = players.map(p => ({ player_id: p.eloId, name: p.name, race: p.race }));
    change(players, official);
    const sections = Array.from({ length: 15 }, (_, index) => ({
      key: String(index), label: '7티어', players: official.slice(index * 20, index * 20 + 20)
    }));
    const html = `<h2>변경사항</h2><span>3.62</span><span>2026-10-16</span><script>self.__next_f.push([1,${JSON.stringify(JSON.stringify({ sections }))}])</script>`;
    const before = JSON.stringify({ players });
    await writeFile(join(dir, 'players.json'), before);
    await writeFile(join(dir, 'mock-fetch.mjs'), `globalThis.fetch = async () => ({ ok: true, text: async () => ${JSON.stringify(html)} });`);
    const run = () => execFileSync(process.execPath, ['--import', join(dir, 'mock-fetch.mjs'), script], { cwd: dir, stdio: 'pipe' });
    await check({ run, before, read: () => readFile(join(dir, 'players.json'), 'utf8') });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('same-name ID replacement (Sewol 6029 to 763) aborts without writing anything', async () => {
  await withSyncFixture((players, official) => {
    players[0] = { ...players[0], name: '세월', eloId: 6029 };
    official[0] = { ...official[0], name: '세월', player_id: 763, race: 'P' };
  }, async ({ run, read, before }) => {
    assert.throws(run, error => /identity conflict.*세월.*6029.*763/.test(String(error.stderr)));
    assert.equal(await read(), before);
  });
});

test('same-ID rename retains local metadata and adds the previous name as an alias', async () => {
  await withSyncFixture((players, official) => {
    official[0].name = 'renamed';
    official[0].race = 'P';
  }, async ({ run, read }) => {
    run();
    const p = JSON.parse(await read()).players.find(p => p.eloId === 1);
    assert.equal(p.name, 'renamed');
    assert.equal(p.race, 'P');
    assert.equal(p.soopId, 'soop-0');
    assert.equal(p.thumbUrl, 'old-0.jpg');
    assert.deepEqual(p.aliases, ['player-0']);
  });
});

test('unique ID-less legacy player may acquire its official ID', async () => {
  await withSyncFixture(players => { players[0].eloId = null; }, async ({ run, read }) => {
    run();
    const result = JSON.parse(await read()).players;
    assert.equal(result.length, 300);
    assert.equal(result[0].eloId, 1);
    assert.equal(result[0].soopId, 'soop-0');
  });
});

test('new ID adds a separate player and missing ID remains inactive with its metadata', async () => {
  await withSyncFixture((players, official) => {
    official[0] = { player_id: 999, name: 'new player', race: 'Z' };
  }, async ({ run, read }) => {
    run();
    const result = JSON.parse(await read()).players;
    assert.equal(result.length, 301);
    assert.equal(result.find(p => p.eloId === 999).race, 'Z');
    const missing = result.find(p => p.eloId === 1);
    assert.equal(missing.active, false);
    assert.equal(missing.soopId, 'soop-0');
    assert.equal(missing.race, 'T');
  });
});

for (const scenario of [
  { name: 'duplicate normalized source names', change: (p, o) => { o[1].name = ' PLAYER-0 '; } },
  { name: 'duplicate source IDs', change: (p, o) => { o[1].player_id = 1; } },
  { name: 'invalid source IDs', change: (p, o) => { o[0].player_id = 0; } },
  { name: 'duplicate DB IDs', change: (p, o) => { p[1].eloId = 1; } },
  { name: 'invalid new player race', change: (p, o) => { o[0] = { player_id: 999, name: 'new', race: null }; } },
  { name: 'empty source name', change: (p, o) => { o[0].name = ''; } },
  { name: 'ambiguous legacy names', change: (p, o) => { p[0].eloId = null; p.push({ ...p[0] }); } }
]) {
  test(`${scenario.name} aborts without partial writes`, async () => {
    await withSyncFixture(scenario.change, async ({ run, read, before }) => {
      assert.throws(run);
      assert.equal(await read(), before);
    });
  });
}

for (const scenario of [
  { name: 'normalized same-name replacement', change: (p, o) => { o[0].name = ' PLAYER-0 '; o[0].player_id = 999; } },
  { name: 'inactive same-name replacement', change: (p, o) => { p[0].active = false; o[0].player_id = 999; } },
  { name: 'late identity conflict after earlier valid changes', change: (p, o) => { o[0].race = 'P'; o[299].player_id = 999; } }
]) {
  test(`${scenario.name} preserves the complete DB on failure`, async () => {
    await withSyncFixture(scenario.change, async ({ run, read, before }) => {
      assert.throws(run, error => /identity conflict/.test(String(error.stderr)));
      assert.equal(await read(), before);
    });
  });
}

test('known IDs keep separate metadata when local players share a name', async () => {
  await withSyncFixture((players, official) => {
    players[1].name = players[0].name;
    official[1].name = 'renamed second player';
  }, async ({ run, read }) => {
    run();
    const result = JSON.parse(await read()).players;
    assert.equal(result.find(p => p.eloId === 1).soopId, 'soop-0');
    assert.equal(result.find(p => p.eloId === 2).soopId, 'soop-1');
    assert.equal(result.find(p => p.eloId === 2).name, 'renamed second player');
  });
});

test('verified Sewol identity history and custom metadata survive repeated canonical-ID syncs', async () => {
  const db = JSON.parse(await readFile(new URL('../players.json', import.meta.url), 'utf8'));
  const canonical = db.players.find(p => p.eloId === 763);
  assert.equal(db.players.some(p => p.eloId === 6029), false);
  assert.equal(canonical.name, '세월');
  const history = canonical.eloIdentityHistory;
  assert.equal(history[0].previous.eloId, 6029);
  assert.equal(history[0].previous.race, 'T');
  assert.equal(history[0].previous.thumbUrl, 'players/6029.jpg?v=1788008345');
  assert.equal(history[0].canonicalId, 763);
  for (const key of ['name', 'tier', 'tierLabel', 'aliases', 'soopId', 'active']) {
    assert.deepEqual(canonical[key], history[0].previous[key]);
  }
  await withSyncFixture((players, official) => {
    players[0] = { ...canonical, soopId: 'local-account', aliases: ['local alias'], notes: { keep: true } };
    official[0] = { player_id: 763, name: '세월', race: 'P', thumb_url: 'new-photo.jpg' };
  }, async ({ run, read }) => {
    run();
    const first = await read();
    const p = JSON.parse(first).players.find(p => p.eloId === 763);
    assert.deepEqual(p.eloIdentityHistory, history);
    assert.deepEqual(p.notes, { keep: true });
    assert.deepEqual(p.aliases, ['local alias']);
    assert.equal(p.soopId, 'local-account');
    assert.equal(p.thumbUrl, 'new-photo.jpg');
    run();
    assert.equal(await read(), first);
  });
});
