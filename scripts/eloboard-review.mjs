import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, access } from 'node:fs/promises';
import { isDeepStrictEqual as equal } from 'node:util';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const knownRace = value => ['T', 'Z', 'P'].includes(value);
const validId = value => Number.isSafeInteger(value) && value > 0;
const allowed = new Set(['name', 'aliases', 'tier', 'tierLabel', 'race', 'active', 'eloId', 'thumbUrl']);
const groups = [['name', 'aliases'], ['tier', 'tierLabel'], ['race'], ['active'], ['eloId'], ['thumbUrl']];
const pick = (record, fields) => Object.fromEntries(fields.filter(f => Object.hasOwn(record, f)).map(f => [f, record[f]]));
const identity = p => p ? {name: p.name, tier: p.tier, race: p.race ?? null, eloId: p.eloId ?? null} : null;
const fail = message => { throw new Error(message); };

export function operationsFor(records) {
  return records.flatMap(({index, before, after}) => {
    const key = after.eloId != null && after.eloId !== '' ? String(after.eloId) : `legacy-${index}`;
    const common = {index, eloId: after.eloId ?? null};
    if (!before) return [{...common, key: `${key}:add`, before: null, after}];
    return groups.filter(fields => !equal(pick(before, fields), pick(after, fields)))
      .map(fields => ({...common, key: `${key}:${fields[0]}`, before: pick(before, fields), after: pick(after, fields)}));
  });
}

export function makeReview(db, nextPlayers, previousRecords, mirrors) {
  const byId = new Map(db.players.filter(p => p.eloId != null && p.eloId !== '').map(p => [p.eloId, p]));
  const records = nextPlayers.flatMap(after => {
    const before = previousRecords.get(after) || previousRecords.get(after.eloId) || byId.get(after.eloId)
      || db.players.find(p => (p.eloId == null || p.eloId === '') && p.name === after.name);
    return equal(before, after) ? [] : [{index: before ? db.players.indexOf(before) : null, before: before || null, after}];
  });
  return {schemaVersion: 2, records, operations: operationsFor(records),
    assets: [...mirrors].map(([path, bytes]) => ({path, sha256: digest(bytes), base64: bytes.toString('base64')}))};
}

export function renderReview(proposal) {
  const esc = v => JSON.stringify(v ?? null).replace(/[&<>|\r\n]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '|':'&#124;', '\r':' ', '\n':' '}[c]));
  const rows = proposal.records.map(r => `| ${esc(identity(r.before))} | ${esc(identity(r.after))} | ${proposal.operations.filter(o => o.index === r.index && o.eloId === (r.after.eloId ?? null)).map(o => '`'+o.key+'`').join(', ')} |`);
  return `# EloBoard 검토 제안\n\n확인: ${proposal.checkedAt}\n\n변경 전후는 ID로 비교해. 이름·별칭, 티어·표시 티어는 함께 승인돼. 신규 선수는 add 전체를 검토해.\n\n| 변경 전 (이름·티어·종족·ID) | 변경 후 | 승인 키 |\n|---|---|---|\n${rows.join('\n') || '| 변경 없음 | 변경 없음 | — |'}\n\n## 세부 변경\n\n${proposal.operations.map(o => `- \`${o.key}\`: ${esc(o.before)} → ${esc(o.after)}`).join('\n')}\n\n소스 SHA-256: \`${proposal.sourceSha256}\`\n\nDB SHA-256: \`${proposal.dbSha256}\`\n\nGitHub Actions → Prepare approved EloBoard changes → Run workflow에서 이 실행 번호와 승인 키를 입력해. PR 생성 승인과 main 병합·운영 배포는 각각 별도야.\n`;
}

export function applyProposal({dbRaw, source, proposalRaw, expectedSource, expectedDb, expectedProposal, approved, now = Date.now()}) {
  if (digest(source) !== expectedSource) fail('Reviewed EloBoard snapshot hash does not match; compare the source again');
  if (digest(dbRaw) !== expectedDb) fail('Player DB changed since review; compare the proposal again');
  if (digest(proposalRaw) !== expectedProposal) fail('Reviewed proposal hash does not match');
  const proposal = JSON.parse(proposalRaw), db = JSON.parse(dbRaw);
  if (proposal.schemaVersion !== 2 || proposal.sourceUrl !== 'https://eloboard.co.kr/tiers'
      || proposal.sourceSha256 !== expectedSource || proposal.dbSha256 !== expectedDb) fail('Invalid proposal binding');
  const age = now - Date.parse(proposal.checkedAt);
  if (!Number.isFinite(age) || age < -60_000 || age > 7 * 86400_000) fail('Proposal expired or invalid date; compare again');
  if (!Array.isArray(proposal.records) || !Array.isArray(proposal.operations) || !Array.isArray(proposal.assets)) fail('Invalid proposal schema');
  const used = new Set(), ids = new Set();
  for (const p of db.players) {
    if (p.eloId != null && p.eloId !== '') {
      if (!validId(p.eloId) || ids.has(p.eloId)) fail('Invalid or duplicate DB ID');
      ids.add(p.eloId);
    }
  }
  for (const {index, before, after} of proposal.records) {
    if (!after || typeof after.name !== 'string' || !after.name.trim()
      || ((!before || !equal(before.tier, after.tier)) && (typeof after.tier !== 'string' || !after.tier.trim()))
      || ((!before || !equal(before.race, after.race)) && !knownRace(after.race) && after.race !== null)) fail('Invalid candidate fields');
    if (index === null) {
      if (before !== null || !validId(after.eloId) || ids.has(after.eloId)
        || Object.keys(after).some(k => !allowed.has(k) && k !== 'soopId')
        || after.soopId !== '' || !equal(after.aliases, []) || after.active !== true) fail('Unsafe new identity');
      ids.add(after.eloId);
    } else {
      if (!Number.isSafeInteger(index) || index < 0 || used.has(index) || !equal(db.players[index], before)) fail('Candidate before state changed');
      used.add(index);
      for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (!allowed.has(key) && !equal(before[key], after[key])) fail(`Protected field changed: ${key}`);
      }
      if (validId(before.eloId) && before.eloId !== after.eloId) fail('Existing player ID replacement is forbidden');
      if (!validId(before.eloId) && after.eloId !== before.eloId) {
        if (!validId(after.eloId) || ids.has(after.eloId)) fail('Unsafe legacy ID link');
        ids.add(after.eloId);
      }
      if (knownRace(before.race) && !knownRace(after.race)) fail('Known race cannot be erased');
      const expectedAliases = before.name === after.name ? before.aliases
        : [...new Set([...(before.aliases || []), before.name].filter(n => n && n !== after.name))];
      if (!equal(after.aliases, expectedAliases)) fail('Aliases may only preserve a renamed player');
    }
  }
  const operations = operationsFor(proposal.records);
  if (!equal(proposal.operations, operations) || new Set(operations.map(o => o.key)).size !== operations.length) fail('Proposal operations changed');
  const keys = typeof approved === 'string' ? approved.split(',').map(s => s.trim()).filter(Boolean) : [];
  if (!keys.length || new Set(keys).size !== keys.length || keys.some(k => !operations.some(o => o.key === k))) fail('Choose explicit, unique approval keys from this proposal');
  const selected = operations.filter(o => keys.includes(o.key));
  const next = structuredClone(db);
  for (const op of selected) {
    if (op.index === null) next.players.push(structuredClone(op.after));
    else {
      for (const k of Object.keys(op.before)) if (!Object.hasOwn(op.after, k)) delete next.players[op.index][k];
      Object.assign(next.players[op.index], op.after);
    }
  }
  const resultIds = next.players.map(p => p.eloId).filter(validId);
  if (new Set(resultIds).size !== resultIds.length) fail('Duplicate resulting IDs');
  const assets = [];
  for (const path of new Set(selected.map(o => o.after.thumbUrl).filter(p => p?.startsWith('assets/')))) {
    const asset = proposal.assets.find(a => a.path === path);
    if (!/^assets\/eloboard-players\/\d+-[a-zA-Z0-9._-]+\.(?:jpe?g|png|webp|gif)$/.test(path)) fail('Unsafe asset path');
    if (!asset) continue; // Existing tracked mirror; no new bytes required.
    const bytes = Buffer.from(asset.base64, 'base64');
    if (bytes.length > 5_000_000 || digest(bytes) !== asset.sha256) fail('Reviewed image hash does not match');
    assets.push({path, bytes});
  }
  // Partial approvals must not claim the entire source version has been applied.
  // Preserve source/updatedAt, array order and all unrelated bytes semantically.
  const after = JSON.stringify(next, null, 2) + '\n';
  return {after, assets, receipt: {schemaVersion: 1, sourceSha256: expectedSource, dbSha256: expectedDb,
    proposalSha256: expectedProposal, resultSha256: digest(after), approved: keys.sort(), operations: selected}};
}

export async function applyReviewedFiles(args) {
  const names = ['source-file', 'expected-sha256', 'expected-db-sha256', 'proposal-file', 'expected-proposal-sha256', 'approved-changes'];
  const options = {};
  for (const arg of args) {
    if (arg === '--apply') continue;
    const m = arg.match(/^--([^=]+)=(.+)$/);
    if (!m || !names.includes(m[1]) || options[m[1]]) fail('Unknown or duplicate apply option');
    options[m[1]] = m[2];
  }
  if (names.some(n => !options[n]) || names.filter(n => n.includes('sha256')).some(n => !/^[a-f0-9]{64}$/.test(options[n]))) {
    fail('Applying reviewed tiers requires source file, proposal file, three hashes and explicit approved changes');
  }
  const [dbRaw, source, proposalRaw] = await Promise.all([readFile('players.json', 'utf8'), readFile(options['source-file']), readFile(options['proposal-file'], 'utf8')]);
  const result = applyProposal({dbRaw, source, proposalRaw, expectedSource: options['expected-sha256'],
    expectedDb: options['expected-db-sha256'], expectedProposal: options['expected-proposal-sha256'], approved: options['approved-changes']});
  // Validate everything before any writes. Existing assets may never be overwritten.
  for (const asset of result.assets) {
    try { if (!equal(await readFile(asset.path), asset.bytes)) fail('Existing mirror differs from reviewed bytes'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (await readFile('players.json', 'utf8') !== dbRaw) fail('DB changed during apply');
  for (const asset of result.assets) {
    await mkdir('assets/eloboard-players', {recursive: true});
    try { await access(asset.path); } catch { await writeFile(asset.path, asset.bytes, {flag: 'wx'}); }
  }
  await writeFile('players.json.review-tmp', result.after, {flag: 'wx'});
  if (await readFile('players.json', 'utf8') !== dbRaw) fail('DB changed during apply');
  await rename('players.json.review-tmp', 'players.json');
  await writeFile('eloboard-approval.json', JSON.stringify(result.receipt, null, 2) + '\n');
  console.log(`Applied ${result.receipt.approved.length} approved operations; no network requests`);
}
