# Architecture — V3.0.0

## Product boundary

UnWritten.KayWorks is a private author database and narrative-continuity workspace. It is not a generic SaaS platform and V3 does not introduce another framework, graph database, GIS stack, collaboration protocol, or second authentication system.

## Runtime

```text
Cloudflare Access
      │
      ▼
unwritten.kayworks.dev
      │
      ▼
Cloudflare Worker
      │
      ├── static vanilla HTML/CSS/JS
      ├── /api/*
      │    ├── D1 (structured source of truth)
      │    └── private R2 (binary source of truth)
      │
Browser
      └── IndexedDB: unsaved drafts / read-only V1 migration source only
```

## Authentication and authorization

Every `/api/*` request is authenticated inside the Worker by validating Cloudflare Access's `Cf-Access-Jwt-Assertion` against:

- `TEAM_DOMAIN`
- `POLICY_AUD`

The verified JWT email is compared with `OWNER_EMAILS`.

- Owner: read + mutation routes
- Reviewer: read-only API access

UI hiding is convenience only. The Worker rejects reviewer mutations server-side.

`DEV_AUTH_BYPASS` exists only for local Wrangler development and must not be configured in production.

## Structured storage

D1 tables:

- `entities`
- `relations`
- `settings`
- `media`
- `clues`
- `reveals`
- `knowledge`
- `map_versions`
- `map_markers`
- `workspace`

The flexible entity envelope remains authoritative:

```text
id, type, name, summary, status, tags, favorite,
fields, notes, archivedAt, createdAt, updatedAt
```

Type-specific lore remains in `fields_json` rather than one SQL table per lore type.

### Workspace records

The V3 `workspace` table stores non-canon authoring/support records with a small generic envelope:

```text
id, kind, title, data, createdAt, updatedAt
```

Current kinds include plot threads/beats, contextual notes, tasks, saved views, custom calendars/dates, map layers/routes, whiteboard nodes/edges, manuscript documents, entry revisions, and reader profiles.

This deliberately avoids creating a dozen tiny databases while keeping these records portable and referentially validated.

## Derived intelligence

Graphs, family trees, backlinks, interaction matrices, plot coverage, continuity dashboards, reader views, diplomacy views, location usage, and knowledge-at-scene answers are derived from the canonical stores.

They are views, not parallel truth stores.

## Optimistic concurrency and revisions

Entity editors retain the `updatedAt` value loaded from D1. Update requests send that as `x-base-updated-at`.

If D1 contains a different revision, the Worker returns HTTP `409` and does not overwrite the newer record.

The Worker stores the previous entity snapshot as a `revision` workspace record in the same D1 batch as the entity overwrite, so revision creation and the new entity version commit together.

This is deliberately lightweight: no CRDTs, WebSockets, or real-time collaborative editing.

## Referential integrity

Both ordinary writes and backup restore validate domain references. V3 additionally protects:

- multi-node Location and Map hierarchy cycles
- typed Book / Chapter / Scene references
- Plot Thread / Plot Beat references
- Map Layer / Route references
- marker media/layer/faction/book references
- custom calendar references
- reader/manuscript references
- whiteboard graph references

Entity and Map Version deletion use dedicated cascade routes. Generic store deletion cannot bypass those routes.

## R2 media lifecycle

Live media is private and served through:

```text
/api/media/:id/content
```

Remote media objects expose a protected URL to the UI. Rendering must use the central media URL abstraction rather than Blob existence.

Deleted/superseded live media is copied to `_trash/` before the live key is deleted. Restore uploads stage under `_restore/`.

Production should have lifecycle rules for both prefixes so abandoned restore sessions and deleted-media recovery objects do not grow forever. See `CLOUDFLARE-V3-SETUP.md`.

## Backup/restore

Portable backups remain first-class. Restore follows:

```text
parse → migrate → validate complete snapshot
      → stage restore manifest/media in R2
      → verify expected media
      → transactional D1 batch replacement
      → finalize R2 media
      → move superseded live media to trash
      → cleanup restore staging
```

D1 and R2 cannot form one distributed ACID transaction. The staged model prevents a failed structured commit from first destroying the prior media set.

## Snapshot loading

The browser keeps the existing `getAll(store)` abstraction but coalesces reads into one `/api/snapshot` request. The Worker batches D1 SELECT statements and logs payload/row timing information without adding premature pagination. Cold `revision` rows are excluded from the normal snapshot and fetched lazily for the selected entity; explicit backup exports request revision history separately so recovery remains complete.

## Story Compass

Series Overview continues using the existing `trilogy` entity type for compatibility. V3 generalizes its label and fields instead of creating a competing Series table. Story Compass fields are optional planning anchors, not required canon.

## Compatibility

V3 schema version: `6`.

V3 preserves the established backup format identifier and migration behavior so historical exports are not renamed merely because the runtime architecture evolved.
