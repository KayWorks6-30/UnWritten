# UnWritten.KayWorks — V3.5.1

UnWritten.KayWorks is a private author workspace for canon, continuity, worldbuilding, plot planning, maps, story knowledge, and long-series organization.

V3.5.1 is the audited **architecture-stabilization and scale release** built directly on the V3.4 hardening work. It includes a post-handoff integrity patch for cascade deletion and stricter optimistic concurrency without changing portable schema 8. It is not a framework rewrite. The Cloudflare Worker + D1 + private R2 + vanilla HTML/CSS/JS architecture remains intact.

V3.4 made the domain rules explicit: narrative position, structured canonical references, relationship state, queryable hot fields, and reverse dependency indexing. V3.5 makes those rules harder for future code to violate as the application and project grow.

Major V3.5 changes:

- normal runtime reads no longer depend on `/api/snapshot`; canonical stores have independent read APIs and client caches
- server-side entity query/search endpoint with filtering, limits, and cursors
- centralized mutation pipeline for concurrency, normalization, validation, revision capture, canonical writes, and derived-index maintenance
- generalized optimistic concurrency across mutable stores rather than Entity-only conflict protection
- schema-level safety triggers for normalized references and marker coordinate bounds
- sequential portable-backup migration registry through schema **8**
- owner-only architecture diagnostics, deep reverse-index verification, and self-healing reverse-index rebuild
- bounded/chunked reverse-index rebuild so large derived indexes do not require one enormous D1 batch
- synthetic large-project stress harness for dependency indexing, search, narrative ordering, and payload sizing
- cached narrative entity indexing to reduce repeated story-order reconstruction work
- clearer source boundaries: low-level API transport, D1 record adapters, domain rules, and UI remain separate concerns

The V3.4 domain architecture remains authoritative:

- formal narrative position: **Series → Book → optional Part → Chapter → Scene**
- flexible `fields_json` with generated/indexed SQL projections for high-use query values
- relationship claims with their own Canon / Provisional / Concept / Contradicted / Shelved / Unknown state
- central registry of structured entity-reference fields
- structured canonical replacements for important semantic text-only links
- rebuildable reverse `reference_index` for dependency/impact lookup
- Part-aware knowledge, Reader Preview, clues, reveals, manuscripts, continuity, and story organization

```text
Browser
  ↓
Cloudflare Access
  ↓
Cloudflare Worker: unwritten
  ├── read/query APIs
  ├── centralized mutation boundary
  ├── diagnostics / derived-data repair
  ├── D1: authoritative structured data
  │    ├── canonical records
  │    ├── generated/indexed query projections
  │    └── rebuildable reverse-reference index
  └── R2: authoritative private media

IndexedDB: unsaved editor drafts / legacy migration only
```

There is one hosted environment: `unwritten.kayworks.dev`. Local development uses Wrangler local resources; do not create a second hosted D1/R2/staging environment unless the project intentionally changes that policy.

## Architectural rules

### One canonical fact, one authoritative representation

UnWritten remains intentionally hybrid. Flexible prose stays flexible. Values that drive joins, narrative ordering, validation, dependency tracking, chronology, or repeated filtering use structured IDs or queryable values.

When a concept has a structured canonical field, that field is authoritative. Legacy text may remain as descriptive or migration information, but it must not silently compete as a second canonical fact.

### Flexible JSON with queryable hot fields

The common entity envelope remains:

```text
id, type, name, summary, status, tags, favorite,
fields, notes, archivedAt, createdAt, updatedAt
```

Type-specific data remains in `fields_json`. UnWritten does not explode every lore type into a rigid SQL table. Migration `0003_v34_architecture_hardening.sql` exposes selected high-use values as SQLite generated columns and indexes them. Canon remains in `fields_json`; generated columns are query surfaces, not duplicate author-editable truth.

### Formal narrative position

```text
Series Overview
  └── Book
      ├── Part (optional)
      │   └── Chapter
      │       └── Scene
      └── Chapter (direct chapters remain valid)
```

Story organization, Knowledge, Reader Preview, mysteries/reveals, plot coverage, and continuity use this same ordering model. D1 exposes the derived `narrative_positions` view.

### Relationship claims have state

Relationships carry their own status independently from endpoint entities. Existing pre-V3.4 relationships migrate to `Canon`. Default derived views avoid silently projecting Contradicted/Shelved claims or blocked endpoint entities while preserving the records for author inspection.

### Derived dependency data is rebuildable

`reference_index` accelerates inbound-reference and Impact queries. It is derived from canonical records and excluded from the portable backup format.

Normal mutations maintain source reference rows with the canonical write. Owner diagnostics can compare the entire expected index against D1 and rebuild it. Large rebuilds use bounded batches; if interrupted, the canonical records remain authoritative and a deep diagnostic identifies missing/stale derived edges.

## V3.5 read architecture

Normal application code does **not** fetch `/api/snapshot` to service ordinary screens.

Instead:

- `/api/store/:store` reads one canonical store
- `/api/store/:store/:id` reads one record
- `/api/entities/query` performs server-side entity search/filter/pagination
- `/api/entities/:id/impact` reads inbound structured references from the reverse index
- revision routes remain lazy

The browser keeps independent per-store caches and coalesces duplicate same-store reads. Successful mutations update the relevant cache rather than invalidating and redownloading the whole project.

V3.5.1 also keeps a lightweight per-record version cache populated by single-record reads and server-side entity-query results. That means screens can progressively stop hydrating full stores without losing optimistic-concurrency protection.

The current UI still performs a compatibility hydration of the stores it needs during application boot because many existing derived views intentionally operate across several canonical stores. The important V3.5 boundary is that the backend and data adapter no longer require a monolithic project snapshot; future feature-specific lazy loading can be introduced without another storage/API redesign.

`/api/snapshot` remains available as a backup/diagnostic primitive, not the normal runtime read model.

## V3.5 mutation architecture

Ordinary structured writes use one mutation boundary:

```text
request
  ↓
authorization
  ↓
optimistic-concurrency check
  ↓
server-side normalization / timestamps
  ↓
domain validation
  ↓
revision capture where applicable
  ↓
canonical write
  ↓
derived reference-index maintenance
  ↓
response with authoritative saved record
```

Existing records require a base `updatedAt` version before they can be changed or deleted. The Worker returns HTTP 428 when that precondition is missing and HTTP 409 when the supplied version is stale.

Deletion is treated as a structured mutation rather than a blind row removal. Cascade planners clean dependent workspace/map/story references and retain media that is still shared elsewhere before the reverse-reference index is rebuilt.

The Worker supplies authoritative `updatedAt` values and preserves `createdAt` where appropriate. Stale writes return `409` rather than silently overwriting a newer record.

Entity revision snapshots remain full snapshots. V3.5 deliberately does not introduce event sourcing or diff storage.

## Database safety boundary

Application validation remains responsible for domain/type rules such as “this ID must be a Mystery” or “this Part belongs to this Book.”

Schema 8 adds D1 structural safety triggers beneath that layer so future routes cannot easily create normalized dangling references. Safety nets cover relationship endpoints/eras, clue and reveal references, knowledge references, map-version references, map-marker references, and marker coordinate bounds.

This gives the database responsibility for structural impossibilities while keeping fictional/domain semantics in application code.

## Architecture diagnostics

Owner Settings exposes an Architecture diagnostics card.

Shallow diagnostics report:

- canonical store counts
- revision count
- reverse-index row count
- orphan reverse-index targets
- broken narrative-position count
- SQLite integrity result
- timing information

Deep diagnostics additionally reconstruct canonical references in memory and compare them with `reference_index`, reporting expected rows, missing edges, stale edges, synchronization state, snapshot size, and deep-check time.

The reverse index can be rebuilt from canonical records from the same owner-only surface.

## Stress testing

Run:

```bash
npm run stress
```

The default synthetic project generates approximately:

- 10,000 entities
- 50,000 relationships
- 25,000 knowledge records
- 5,000 scenes

It measures reverse-index construction, entity search, narrative-position sorting, edge count, and portable structured payload size.

Override sizes with:

```bash
STRESS_ENTITIES=20000 \
STRESS_RELATIONS=100000 \
STRESS_KNOWLEDGE=50000 \
STRESS_SCENES=10000 \
npm run stress
```

The harness is a regression/profiling tool, not a claim that every browser view should eagerly render those counts at once.

## Continuity intelligence

Derived views remain projections of canonical records rather than parallel truth stores:

- character knowledge at Book / Part / Chapter / Scene
- reader knowledge at story point
- reader-vs-character knowledge gaps
- Mystery → clue/red herring → reveal progression
- scene continuity
- dependency Impact
- deterministic continuity warnings
- plot-thread coverage
- character interaction matrices
- location usage

Scene-level continuity remains scoped so inspecting one scene does not require running every whole-project continuity rule.

## Plotting and author workflow

- Series Overview / Story Compass
- Book → optional Part → Chapter → Scene organizer
- Plot Threads + Scene-linked beats
- contextual notes and tasks
- saved views
- quick-open / command palette
- confirmed-only cross-link suggestions
- revision snapshots
- Focus Mode
- manuscript drafting/export
- lightweight whiteboard
- simple generators
- Reader Preview and reader-safe HTML export

Whiteboard, calendar, automatic linking, revision diffs, Species modeling, project merge, and generic graph-database work remain deliberately limited until real usage proves a need.

## Atlas / maps

The authoritative geography/media structure remains:

```text
Location → Map → Map Version → Map Marker
```

V3 includes map hierarchy, historical versions, layers, marker metadata, custom marker images, clustering, draggable percentage coordinates, search/filtering, character/book routes, and story/era/faction relevance data.

Private R2 media renders through protected application URLs.

## Security / data safety

- Cloudflare Access remains the authentication provider.
- Worker verifies the `Cf-Access-Jwt-Assertion` JWT.
- Verified Access email determines Owner vs Reviewer.
- Reviewers are server-enforced read-only.
- optimistic concurrency protects mutable structured stores
- previous Entity snapshots are captured before successful overwrites
- Location/Map/story hierarchy rules are validated
- D1 safety triggers reject normalized dangling references
- dedicated cascade routes protect entity/map-version deletion
- backup restore validates typed/workspace references
- R2 destructive deletion moves objects through `_trash/`
- restore staging uses `_restore/`
- derived reference-index integrity can be verified/rebuilt

## Required production configuration

Configure these Worker variables:

- `TEAM_DOMAIN`
- `POLICY_AUD`
- `OWNER_EMAILS`

They are intentionally not hard-coded. See `docs/CLOUDFLARE-V3-SETUP.md`.

## Install

```bash
npm install
```

Direct dependencies are pinned to exact versions.

## Local development

Create `.dev.vars` from `.dev.vars.example`. Keep `DEV_AUTH_BYPASS=true` local only.

```bash
npm run db:migrate:local
npm run dev
```

## Production migration / deploy

Export and retain a complete ZIP backup first.

Apply cumulative migrations:

```bash
npm run db:migrate:remote
```

V3.4 introduced `0003_v34_architecture_hardening.sql` (schema 6 → 7).

V3.5 introduces `0004_v35_architecture_stabilization.sql` (schema 7 → 8), adding generalized revision timestamps, hot indexes, and D1 structural reference/coordinate safety triggers.

Then:

```bash
npm run deploy
```

## Verification

```bash
npm run verify
```

This runs:

- 92+ Node/domain/regression/architecture tests
- JS/MJS syntax checks
- clean in-memory SQLite migration smoke from schema 6 through schema 8
- static production build
- asset/import verification
- Cloudflare binding/config checks
- duplicate HTML ID checks
- committed-secret/private-key scan

Run scale profiling separately:

```bash
npm run stress
```

A Chromium browser smoke harness is also included:

```bash
npm run browser:smoke
```

Some managed execution environments block Chromium from reaching loopback hosts; that environmental restriction is separate from the Node/Worker verification suite.

## Backups and portability

Cloud storage does not replace portable backups. V3 preserves:

- JSON export/restore
- full ZIP export/restore with binary media
- Markdown export
- sequential historical backup migrations
- static reader-safe HTML export

Portable schema migrations now advance one version at a time through a migration registry instead of one ever-growing catch-all conversion function.

Restore remains replacement-based in V3.5. Merge/import semantics remain deferred until a concrete workflow needs them. `reference_index` and `narrative_positions` are derived and are not competing portable truth stores.

## Production resources

- Worker: `unwritten`
- Hostname: `unwritten.kayworks.dev`
- D1: `unwritten` (`DB` binding)
- R2: `unwritten` (`MEDIA` binding)
- `workers.dev`: disabled
- preview URLs: disabled

The D1 UUID and R2 bucket name in `wrangler.jsonc` are resource identifiers, not credentials.

## Compatibility

- Application version: `3.5.1`
- Backup schema version: `8`
- Backup format: `kayworks-world-bible-backup`
- schema 6 projects migrate through 7 to 8
- Part remains optional
- pre-V3.4 relationships still migrate to `Canon`
- full revision snapshots remain supported
- replacement restore remains supported
- no graph database, event sourcing, formal Species model, autonomous cross-linking, or giant calendar/whiteboard subsystem was introduced
