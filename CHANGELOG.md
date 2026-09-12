## 3.0.1 — Navigation and entry-flow polish

- Made the top toolbar non-sticky so global search/quick actions leave the viewport naturally while reading.
- Added a sidebar Search control and focused command/search palette; `Ctrl/Cmd + K` opens the same palette.
- Made desktop navigation collapsible with a persistent browser-local preference and retained mobile drawer behavior.
- Reworked All Lore / World / Characters / Geography / History / Story / Mysteries / Ideas / Questions into a single vertical flow: filters at the top, optional opened entry next, matching results below.
- Added live result counts and Clear filters.
- Added an explicit Close action for opened entry details.
- Opening entries, relationships, breadcrumbs, graph nodes, and archived records now scrolls the opened detail into view instead of leaving it above the current scroll position.
- No persistence, schema, D1/R2, Access, backup, or story-domain semantics changed.

## 3.0.0 — RC1 finalization fixes

- Made structured backup restore atomic by replacing the destructive multi-batch D1 restore with one transactional `DB.batch()` call.
- Moved revision history out of the normal snapshot; entry revisions now load lazily, while explicit backups still include revision records.
- Permanent entity deletion now purges that entity's revision snapshots.
- Entity revision creation and the corresponding entity update now commit together in one D1 batch.
- Knowledge records now reject ambiguous duplicates for the same subject, knower, and story point.
- Updated the service-worker cache to V3, precached the V3 intelligence/UI modules, and added static-runtime caching for same-origin shell misses.
- Changed the browser/PWA application name from `UnWritten.KayWorks` to `UnWritten` without overwriting editable project/story names.
- Added the selected U/W sigil as the UnWritten favicon, Apple/PWA icon set, and sidebar application mark; the editable project/story name remains separate from the app identity.
- Added release verification for the service-worker import graph and application title metadata.

# Changelog

## V3.0.0 — Canon intelligence and author workspace consolidation

### Continuity / story intelligence
- added character and reader knowledge inspection at Book/Chapter/Scene points
- added reader/character knowledge asymmetry, Mystery progression, Scene Continuity, backlinks/impact, plot coverage, character interaction and location-usage derivations
- added deterministic continuity warnings for hierarchy cycles, chronology ranges, birth/death/location existence, event dependencies, conflicting relationships/canon, and mystery setup

### Series / plotting
- generalized Trilogy Overview presentation to Series Overview without replacing the compatible entity type
- added optional Story Compass anchors for starting state, protagonists, end goal, central prize/truth, non-negotiable truths and intended ending
- added Plot Threads and Plot Grid beats tied to canonical Scenes

### Author workflow
- added contextual notes, tasks, saved views, dashboard customization, command-palette navigation, cross-link suggestions, completeness hints, Focus Mode, revision history, reader preview/static export, lightweight whiteboard, generators and manuscript drafting/export

### Maps / world tools
- fixed remote R2 media rendering, map zoom below 100%, help overflow, armed-pin leakage and editor double scrolling
- added map layers, categories/icons/custom marker images, clustering, draggable markers, search/filtering, routes, hierarchy breadcrumbs and historical-version navigation
- added custom calendars, parallel timeline/world tools, family/dynasty, diplomacy and generic content-tree views

### Cloud/data hardening
- added Cloudflare Access JWT validation with `TEAM_DOMAIN` / `POLICY_AUD`
- added server-enforced Owner / Reviewer roles through verified Access email and `OWNER_EMAILS`
- added optimistic entity concurrency conflicts and revision snapshots
- added multi-node Location/Map cycle validation, typed restore references and protected cascade delete routes
- added V3 workspace persistence migration, snapshot batching, R2 `_trash/` recovery flow and documented `_restore/` / `_trash/` lifecycle rules
- fixed schema-version nullish fallback so explicit invalid version `0` remains invalid

### Verification
- expanded the Node suite to 44 tests
- added true JS syntax checking and clean SQLite migration smoke
- added an optional Chromium browser smoke harness for environments that allow local test origins
- pinned direct Wrangler and `jose` versions in `package.json`

## V2.0.0 — Cloudflare-backed private workspace

### Storage architecture
- moved authoritative structured lore/story data from browser IndexedDB to Cloudflare D1
- moved maps/images/media binaries to a private Cloudflare R2 bucket
- added same-origin Cloudflare Worker API for all canonical reads/writes
- retained IndexedDB only for recoverable unsaved drafts and read-only legacy V1 migration
- disabled `workers.dev` and preview URLs in the production Worker configuration

### Cloudflare deployment
- added `wrangler.jsonc` with the production `unwritten` D1/R2 bindings
- added D1 migration `migrations/0001_initial.sql`
- added local Wrangler development workflow using simulated local D1/R2 resources
- added production migration/deploy npm scripts

### Migration / recovery
- preserved the V1 `kayworks-world-bible-backup` format
- added direct same-origin V1 IndexedDB → D1/R2 migration from Settings
- added staged R2 restore sessions so media uploads are not bundled into one giant restore request
- structured restore commits through one transactional D1 batch
- preserves old R2 objects until the new D1 snapshot commits successfully

### Editing safety
- added local unsaved-entry draft caching
- drafts are removed only after the cloud save succeeds
- draft auto-recovery checks the base server revision before applying an existing-entry draft

### Runtime hardening
- API GET requests bypass the service-worker cache
- media content is streamed from private R2 through protected same-origin Worker routes
- Worker validates entity/relationship/hierarchy/knowledge/map references before ordinary writes
- boot fails clearly when D1 migrations have not been applied instead of silently falling back to browser storage

### Verification
- expanded automated suite from 25 to 33 tests
- added binding/privacy/storage-boundary tests
- added D1 migration structure checks
- SQLite smoke-tested the production migration

## 1.1.1 — UnWritten.KayWorks naming baseline

- Renamed the visible application, repository package, PWA metadata, and documentation from Galatea World Bible to **UnWritten.KayWorks**.
- Preserved the IndexedDB database name and backup format identifiers so existing V1 data and backups remain compatible.
- Existing default project settings named exactly `Galatea` migrate to `UnWritten.KayWorks`; lore/location entries named Galatea are untouched.
- No persistence architecture changes are included here; Cloudflare D1/R2 migration is reserved for V2.0.


## 1.1.0 — Recovery hardening and visual atlas

### Visual atlas
- Added Geographic Scope to Map records so maps can represent the whole world or a specific continent, kingdom, city, ruin, or other Location.
- Added Parent / Overview Map links for explicit world → region → local-map drilldown.
- Added atlas thumbnails and hierarchy breadcrumbs.
- Map pins now open a detailed scoped map when one exists, otherwise the canonical Location entry.
- Added Location → “Map this location” workflow with sensible scope/parent defaults.
- Added Fit / zoom controls for large visual maps.
- Added child-map cards under overview maps.
- Renamed map-version action to the clearer “Upload map image”.
- Added explicit Map Version deletion with marker cleanup.
- Prevented Media deletion while a Map Version still depends on that image.

### Backup / restore reliability
- Added cross-store backup validation for entities, statuses, relationships, hierarchy IDs, settings, media, clues, reveals, knowledge, maps, and markers.
- Restore now decodes and validates everything before touching IndexedDB.
- Restore now replaces every store in one atomic multi-store transaction.
- Rejects backups created by unsupported future schemas instead of silently downgrading them.
- ZIP restore now rejects missing media files.
- ZIP reader now verifies CRC32 values and rejects corrupted members.
- Added deterministic normalization for legacy media arrays during migration.

### Referential integrity
- Permanent deletion now blocks active Location/Book/Chapter children rather than creating dangling hierarchy references.
- Optional embedded references are cleared when their target is permanently deleted.
- Project current-book selection is cleared if that Book is permanently deleted.
- Map media deletion preserves blobs that are still reused elsewhere.
- Archived parent values remain selectable on existing child records.
- Existing entry types are locked after creation to prevent hidden stale fields/relationships.
- Switching type on a new unsaved entry clears its unsaved type-specific fields.

### UX / accessibility
- Fixed Dashboard open-question count so the statistic is no longer capped by the five-item preview.
- Replaced primary clickable entry/search-result divs with native buttons.
- Added keyboard focus/activation to relationship/family graph nodes.
- Revoke cached media object URLs during state refresh.
- Status badge CSS classes are now selected from a fixed allowlist rather than derived from imported text.

### Tests / release engineering
- Expanded Node regression coverage from 17 to 25 tests.
- Added validation, future-schema, map-reference, relation-type, and ZIP corruption tests.
- Added a real-browser IndexedDB round-trip/rollback test harness for environments with Chromium/Chrome.
- Added `npm run verify` for tests, build, asset/import checks, duplicate-ID checks, and a basic secret scan.
- Updated service-worker cache for V1.1 and the new validation module.

## 1.0.0 — Roadmap-complete local author workspace

### Authoring workflow
- Added Idea Inbox → Entry conversion while retaining the source idea and a structured conversion link.
- Added structured parent-location selection plus generated `located_in` links.
- Added Book parent selection for Chapters and Chapter parent selection for Scenes.
- Added a dedicated Trilogy Overview working card/view.
- Added soft archive/restore; permanent deletion is only exposed for already-archived records.
- Preserved separate recently-created and recently-edited dashboard views.

### Mystery / reader knowledge
- Added first-class clue subrecords with kind, visibility, story location, first-read interpretation, true interpretation, and order.
- Added reader reveal records with Mystery, target lore, Book, Chapter, and Scene references.
- Added chronological Reveal & Foreshadowing Board.
- Added structured Character/Reader Knowledge records with truth/partial/incorrect/unaware/unknown states.
- Added subject-centered knowledge visualization.

### Timeline
- Added explicit written date + sortable start/end range model.
- Added explicit date uncertainty types.
- Added structured Era links, era filters, and era-band timeline sections.
- Retained optional manual sort override for unusual chronology.

### Maps
- Added Map as a structured entry type.
- Added multiple image versions/history per map.
- Added map variant metadata including political, physical, historical, exploration, ancient, and current maps.
- Added interactive marker placement against stable Location IDs.
- Preserved legacy V0.1 `#map` media without destructive conversion.

### Graphs
- Added two-depth relationship visualization.
- Added family-tree visualization derived from parent/child links.
- Added relationship/family navigation back to canonical entry records.

### Data portability
- Added schema migration defaults for V0.1 data.
- Added full ZIP backup/restore with media stored as separate archive files.
- Retained full JSON backup/restore.
- Added human-readable Markdown export.

### Reliability
- Expanded database stores for clues, reveals, knowledge records, map versions, and markers.
- Expanded service-worker cache manifest and release cache version.
- Expanded automated regression tests for roadmap-complete features.

### Intentionally deferred
- Remote encrypted cross-device sync remains conditional and is not enabled in V1.0.0.

## 0.1.0 — Initial foundation

- Added private local-first author workspace shell.
- Added IndexedDB persistence for entries, relationships, media, and settings.
- Added typed lore/story/planning schemas, canon states, knowledge-layer fields, cross-linking, search, media, basic timeline/maps, and JSON backup/restore.
