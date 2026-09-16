# Architecture — V3.5.1

## Purpose

UnWritten.KayWorks is a private author database and narrative-continuity workspace. V3.5 stabilizes the V3/V3.4 architecture for larger data volume and continued feature growth. It does not replace Cloudflare D1/R2, vanilla JavaScript, the hybrid entity model, or the existing domain architecture.

The architecture is organized around a single principle:

> Canonical fictional facts are stored once; search, graphs, continuity, Reader Preview, impact analysis, timelines, and other intelligence are projections over that canon.

## Runtime layers

```text
Browser UI
  ↓
Feature/domain helpers
  ↓
Data adapter / API transport
  ↓
Cloudflare Worker
  ├── authentication / authorization
  ├── read/query routes
  ├── mutation pipeline
  ├── diagnostics / repair
  └── backup / media orchestration
       ↓
       D1 + private R2
```

IndexedDB is restricted to unsaved drafts and legacy browser-database migration. It is not canonical production storage.

## Canonical stores

D1 stores:

- entities
- relations
- settings
- media metadata
- clues
- reveals
- knowledge
- map versions
- map markers
- workspace records

R2 stores binary media.

`reference_index` and `narrative_positions` are derived structures, not portable canon stores.

## Entity model

The common Entity envelope remains deliberately stable:

```text
Entity {
  id
  type
  name
  summary
  status
  tags
  favorite
  fields
  notes
  archivedAt
  createdAt
  updatedAt
}
```

Type-specific authoring data lives in `fields_json`. This provides flexibility without requiring a separate SQL table for every worldbuilding type.

### Hot-field rule

A value should remain ordinary flexible JSON when it is primarily authored/displayed prose or low-frequency metadata.

A value should gain a query projection/structured representation when UnWritten repeatedly needs to:

- join on it
- filter/sort by it
- validate it
- order narrative or chronology by it
- traverse it as a reference
- calculate derived intelligence from it

Migration 0003 adds generated columns/indexes for the current high-use subset. These are projections of `fields_json`, not competing author-editable values.

## Canonical-reference rule

When a concept has a structured canonical representation, free text cannot act as an independent competing truth.

Examples include location ancestry, story hierarchy, Character homeland/current location, Civilization homeland, Organization headquarters, and Artifact creator/owners.

Legacy text survives where migration cannot safely infer an entity ID. Audit warnings surface those records rather than guessing.

## Narrative position

Narrative position is first-class:

```text
Series Overview
  └── Book
      ├── Part (optional)
      │   └── Chapter
      │       └── Scene
      └── Chapter
          └── Scene
```

The same domain helpers and D1 `narrative_positions` view underpin story ordering, knowledge-at-point, Reader Preview, reveals, clues, plot coverage, and continuity.

The optional Part level prevents a future Book→Chapter retrofit while retaining direct chapters for books that do not use Parts.

## Relationships

Relationship records are first-class claims with:

- from / to endpoint IDs
- relationship type
- note
- independent status
- optional era
- active-from / active-to scope
- timestamps

Relationship status is independent from endpoint status. Default projections omit non-projectable claims/endpoints without deleting them.

Symmetric and directional semantics are interpreted from one canonical record rather than storing inverse duplicates.

## Read architecture

### Normal reads

V3.5 removes `/api/snapshot` from normal runtime data access.

Available boundaries include:

```text
GET /api/store/:store
GET /api/store/:store/:key
GET /api/entities/query
GET /api/entities/:id/impact
GET /api/entities/:id/revisions
GET /api/revisions
```

The client adapter caches stores independently and coalesces concurrent same-store loads. A successful write patches the relevant cache instead of invalidating all canonical data.

`/api/entities/query` establishes the server-side query/search boundary and supports text search, type, status, archive filter, limit, and cursor.

### Compatibility hydration

Many existing screens are intentionally cross-domain: continuity, maps, story intelligence, and dashboard widgets often need several stores. V3.5 therefore retains an initial compatibility hydration of the stores used by the current UI.

This is no longer an architectural requirement of the backend. Future screens can move to feature-scoped/lazy loading incrementally using the record/store/query APIs without changing storage formats again.

### Snapshot role

`/api/snapshot` is retained for backup and deep diagnostics. It is no longer the ordinary screen-read primitive.

## Mutation architecture

Structured writes pass through a common Worker boundary:

```text
Authorize
→ load current record
→ optimistic-concurrency check
→ normalize server timestamps
→ domain validation
→ revision snapshot when applicable
→ canonical upsert
→ derived-reference maintenance
→ one canonical mutation batch
→ return authoritative record
```

The server preserves `createdAt`, supplies current `updatedAt`, and requires an `x-base-updated-at` precondition when an existing record is changed or deleted. Missing base versions return HTTP 428; stale base versions return HTTP 409. The client remembers record versions from store loads, single-record reads, and entity-query results so future lazy screens retain the same protection.

Media writes follow the same concurrency principle but also coordinate R2 lifecycle operations.

Destructive cascades are planned separately from ordinary writes. Entity, Map Version, Map Marker, Clue/Reveal, and Workspace deletion paths clean dependent structured references before rebuilding derived references. Shared media is retained whenever another surviving map version, layer, marker, portrait, or attachment still uses it. This prevents a valid project from becoming invalid merely because a referenced record was deleted through an otherwise supported route.

### Why not event sourcing

Full Entity snapshots are still adequate for the present recovery/history workflow. Event sourcing/diff history would add major complexity without a demonstrated requirement.

## Database safety nets

Application validation owns type-aware domain rules.

D1 schema 8 adds lower-level structural triggers so normalized records cannot easily reference absent rows even if a future route omits a validator.

Current trigger coverage includes:

- relationship endpoints and era references
- Clue mystery/story references
- Reveal mystery/target/story hierarchy references
- Knowledge subject/knower/story references
- Map Version map/media references
- Map Marker map-version/location/media/faction references
- marker coordinate range 0–100

This is intentionally layered validation rather than attempting to encode every fictional rule into SQL.

## Reverse dependency index

`reference_index` stores derived inbound reference edges:

```text
source store
source record
source field
→ target entity
```

It is maintained during normal canonical mutations and regenerated after operations that replace/cascade substantial data.

Because the index is derived:

- it is excluded from backups
- deep diagnostics can recompute expected edges
- owner repair can rebuild it
- rebuild insertion is chunked into bounded D1 batches
- an interrupted repair cannot corrupt canon; it can only leave derived rows incomplete until rerun

## Diagnostics / self-healing

`GET /api/diagnostics` performs inexpensive structural checks.

`GET /api/diagnostics?deep=1` additionally reconstructs canonical reference edges and compares them with `reference_index`.

Owner-only `POST /api/diagnostics/reference-index/rebuild` repairs the derived index and follows with deep verification.

Diagnostics include counts, orphaned reverse targets, narrative-position integrity, SQLite integrity, expected/missing/stale reference rows, payload size, and elapsed timings.

## Backup migration architecture

Portable backup schema is now **8**.

`BACKUP_MIGRATIONS` contains sequential transforms:

```text
1→2→3→4→5→6→7→8
```

The migration driver advances one schema version at a time and rejects future schema versions. Current-version normalization remains idempotent.

This avoids a future monolithic migration function that must understand every historical source shape simultaneously.

SQL migrations remain cumulative and numbered independently:

- `0001_initial.sql`
- `0002_v3_workspace.sql`
- `0003_v34_architecture_hardening.sql`
- `0004_v35_architecture_stabilization.sql`

## Continuity / knowledge performance

Narrative entity indexing in `domain/story.js` is cached by the stable entity-array identity so repeated story comparisons do not rebuild the same lookup map on every comparison.

Scene Continuity performs scene-scoped checks instead of invoking the complete project audit for a single scene.

No general materialized-view/cache layer is introduced yet. Diagnostics and stress tests should provide evidence before more derived data is cached.

## Search

Global entity search now has a server-side service boundary rather than depending entirely on all entities being present in browser memory.

Current backend search is SQL `LIKE` over name, summary, notes, tags JSON, and fields JSON with structured filters. This is intentionally an interface/foundation decision, not a commitment to one search technology forever. A future indexed/FTS implementation can replace the backend without changing callers.

## Stress harness

`scripts/stress.mjs` generates a synthetic project and benchmarks:

- reverse-reference index construction
- entity search
- narrative-position scene sorting
- derived edge volume
- structured payload size

The default fixture is 10k entities / 50k relations / 25k knowledge records / 5k scenes, configurable via environment variables.

## Security

Cloudflare Access is the authentication provider. The Worker verifies Access JWTs and maps verified email to Owner or Reviewer.

Reviewers are server-enforced read-only. Alternate `workers.dev` and preview endpoints remain disabled.

## Media lifecycle

Private R2 media uses application-controlled protected URLs.

Internal prefixes:

- `_restore/` — staged restore payloads
- `_trash/` — recoverable deleted/superseded objects

Lifecycle rules should expire these prefixes on suitable schedules.

## Deliberately deferred

V3.5 does **not** add:

- graph database migration
- event sourcing
- diff revision storage
- generic Species entity solely for completeness
- project merge/import algorithm
- autonomous cross-link creation
- generalized materialized-view caching
- full scheduling/calendar engine
- generative whiteboard engine
- universal world-time coordinate model

The last item should be revisited before substantially expanding custom-calendar/history conversion features.

## Compatibility

- Application: `3.5.1`
- Portable backup schema: `8`
- Backup format identifier: `kayworks-world-bible-backup`
- Part remains optional
- old relationship records remain migratable
- V3.4 schema 7 upgrades to schema 8 without replacing canonical content
