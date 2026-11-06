# EloBoard tier review

The scheduled **Review EloBoard tiers** workflow reads the official tier page and
uploads `source.html` and `proposal.json`. It does not commit player data.

1. Open the latest successful run's `eloboard-tier-proposal` artifact. Confirm
   `sourceUrl`, `checkedAt`, `sourceSha256`, `dbSha256`, and the player counts.
   A successful run alone does not prove that a changed identity or race is correct.
2. Compare each proposed name, tier, race, active state, and photo to the official
   tier page and the linked `/players/<eloId>` profile. Match by **eloId**, not
   display name. A duplicate name can represent two different players. Check
   source publication time and preserve local `soopId`, aliases, and history.
3. If the page or profile cannot be verified, leave `players.json` unchanged.
   Never infer a current LIVE broadcast from the tier snapshot or a cached badge.
4. For a fully reviewed snapshot in the repository root, run:

   ```sh
   node scripts/sync-eloboard-tiers.mjs --apply \
     --source-file=path/to/source.html \
     --expected-sha256=<sourceSha256-from-proposal> \
     --expected-db-sha256=<dbSha256-from-proposal>
   ```

   Both hashes prevent applying a different page or a proposal against a changed
   DB. Inspect the exact `players.json` and `assets/eloboard-players/` diff,
   run `node --test tests/*.test.mjs`, then submit the reviewed change through
   the main branch's regression and deployment gate.

The proposal artifact expires after seven days. If it expires or the DB changes,
run a fresh comparison. A profile or relay outage is not evidence that a player
changed tier, race, name, or LIVE status.
