# V3.5.1 Release Verification — Architecture Stabilization & Scale

V3.5.1 is the post-handoff stabilization patch. It keeps portable schema **8**, preserves the V3.5 architecture, and hardens destructive cascades plus optimistic-concurrency preconditions. The schema-8 migration remains `migrations/0004_v35_architecture_stabilization.sql`.

It is not a rewrite and does not replace canonical records.

## Major release changes

- per-store/record runtime read APIs; normal client reads no longer use `/api/snapshot`
- independent browser store caches with request coalescing and targeted cache updates
- `/api/entities/query` server-side search/filter/cursor foundation
- common mutation pipeline: concurrency → normalization → validation → revision → canonical write → reference maintenance
- generalized optimistic concurrency timestamps for Settings, Media metadata, and Map Versions in addition to stores that already had them
- D1 structural safety triggers for normalized references and marker coordinates
- sequential backup migrations through schema 8
- architecture diagnostics and deep reverse-index comparison
- owner-only reverse-index rebuild using bounded batches
- synthetic scale/stress harness
- cached narrative entity indexing
- service-worker/static asset version bump to 3.5.1

V3.4 hardening remains intact: optional Part, narrative positions, relationship status, hot-field projections, canonical semantic references, reverse dependency indexing, and Part-aware knowledge/reveal/continuity features.

## Required verification

1. Export and retain a complete V3.4 ZIP backup before production migration.
2. Run `npm run verify` and require all tests/syntax/migration/build/repository checks to pass.
3. Run `npm run stress` and retain the timing/payload output for comparison with later releases.
4. Apply all migrations locally and confirm schema 8 succeeds from a clean DB.
5. Confirm schema 6 → 7 → 8 migration smoke passes.
6. Confirm normal browser data access uses `/api/store/...` rather than `/api/snapshot`.
7. Search for an entity through global quick search and confirm `/api/entities/query` returns results.
8. Edit an Entity and confirm the saved record receives a new server `updatedAt`.
9. Open the same record in two browser tabs; save in one, then confirm stale save in the other receives conflict handling rather than overwriting.
10. Repeat a stale-write check for a non-Entity mutable store (for example project Settings or a Map Version where practical).
11. Verify relationship, clue, reveal, knowledge, map-version, and map-marker writes reject missing normalized references.
12. Verify map-marker coordinates outside 0–100 are rejected.
13. Open Settings → Architecture diagnostics and run the shallow health check.
14. Run Deep verify and confirm SQLite integrity reports `ok`, narrative broken-position count is zero, and reference index reports synchronized.
15. Rebuild the reference index as Owner and confirm the post-rebuild deep check reports synchronized.
16. Confirm a Reviewer cannot invoke the rebuild/mutation endpoints.
17. Confirm Entity Impact still returns indexed inbound references after create/edit/delete operations.
18. Confirm `/api/snapshot` still functions for backup/diagnostic paths but is not used by ordinary runtime data adapter code.
19. Export JSON and ZIP backups and restore locally. Confirm the restored project is schema 8 and retains V3.4 domain content.
20. Restore an older supported backup and confirm sequential migration reaches schema 8.
21. Verify Reader Preview, Story organizer, Knowledge, Mysteries, Maps, Timeline, Continuity, and Relationships still render correctly.
22. Verify Media and Maps still load protected R2 image URLs.
23. Verify mobile and desktop layouts remain usable.
24. Export a fresh post-upgrade V3.5 ZIP backup after production smoke testing.

## Automated verification commands

```bash
npm test
npm run syntax
npm run migration:smoke
npm run stress
npm run build
node scripts/verify.mjs
```

Or the standard combined suite:

```bash
npm run verify
```

`npm run stress` is intentionally separate from `npm run verify` so normal deploy verification remains deterministic and fast.

A Chromium smoke harness is available as `npm run browser:smoke`; managed environments may block Chromium loopback access, so production/local-browser smoke remains part of release verification even when the harness cannot run in CI/sandbox infrastructure.

## Compatibility / intentional limits

- Application version: `3.5.1`
- Portable schema version: `8`
- Backup format identifier unchanged
- optional Part remains compatible with direct Book → Chapter projects
- replacement restore remains the supported restore semantic
- full Entity revision snapshots remain in use
- initial UI boot still performs compatibility hydration across current canonical stores; the backend no longer requires monolithic snapshot reads, enabling later feature-scoped lazy loading without another persistence redesign
- no graph database, formal Species model, event sourcing, autonomous cross-linking, merge restore, generalized materialized caching, or full calendar/whiteboard engine was introduced
