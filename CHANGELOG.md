## 3.5.1 — Stabilization audit integrity patch

- Audited the exact V3.5.0 handoff tree and reproduced its verification baseline before modifying it.
- Hardened entity deletion so secondary structured references are cleaned as well as primary ownership links, including relationship eras, secondary mystery links, Series protagonist arrays, map-marker faction/book references, workspace dependents, and media attachment metadata.
- Hardened map-version deletion so cross-version routes/layers are cleaned and shared media is never deleted while still referenced by another layer, marker, portrait, map version, or attachment.
- Added workspace cascade planning for plot-thread beats, calendar dates, whiteboard edges, and map-layer marker cleanup.
- Deleting Clues/Reveals now clears optional Plot Beat links instead of leaving invalid workspace references.
- Existing-record mutation/deletion now requires an optimistic-concurrency base version; missing preconditions return HTTP 428 and stale versions remain HTTP 409.
- Client data access now remembers per-record versions from single-record reads and server-side entity queries, so lazy/query-driven screens retain concurrency protection without whole-store hydration.
- Added regression coverage for cascade/reference integrity and strict concurrency. Portable schema remains 8.

## 3.5.0 — Architecture stabilization and scale foundation

- Stabilized V3.4 in place rather than rewriting the application.
- Advanced portable backup schema to **8** and added `0004_v35_architecture_stabilization.sql`.
- Removed `/api/snapshot` from normal browser data access; added per-store and per-record read routes with independent client caches and same-store request coalescing.
- Added `/api/entities/query` as the server-side search/filter/cursor boundary while retaining local fallback behavior.
- Centralized ordinary structured writes through a mutation pipeline covering optimistic concurrency, server timestamp normalization, validation, Entity revision capture, canonical upsert, and reverse-index maintenance.
- Generalized concurrency timestamps to Settings, Media metadata, and Map Versions and propagated cached base versions through writes/deletes.
- Added D1 structural safety triggers for normalized relationship, clue, reveal, knowledge, map-version, and map-marker references plus map coordinate bounds.
- Replaced catch-all portable backup upgrading with explicit sequential migrations from schema 1 through schema 8.
- Added owner architecture diagnostics with shallow integrity checks, deep expected-vs-actual reference-index verification, and rebuild/repair controls.
- Reverse-index rebuilds now use bounded D1 batches so large derived indexes do not require one enormous batch; interrupted rebuilds remain recoverable because canon is unchanged.
- Added `scripts/stress.mjs` with configurable synthetic entity/relation/knowledge/scene counts and timings for reverse indexing, search, narrative sorting, and payload size.
- Cached narrative entity lookup maps to reduce repeated Book/Part/Chapter/Scene ordering overhead.
- Extracted low-level browser API transport and Worker record adapters into dedicated modules, creating clearer service boundaries without a framework rewrite.
- Updated verification, migration smoke, browser-smoke fixture, service-worker cache/versioning, release docs, Cloudflare setup, and architecture documentation for V3.5.
- Deliberately retained D1/R2, vanilla JS, replacement restore, full revision snapshots, and the V3.4 domain model; universal world-time and generalized materialized caching remain evidence-driven future work.

## 3.4.0 — Architecture hardening and narrative position

- Hardened V3.3 in place rather than rewriting the application.
- Advanced backup schema to **7** and added `0003_v34_architecture_hardening.sql`.
- Added optional **Part** story entities and formal Book → optional Part → Chapter → Scene narrative ordering.
- Added a derived D1 `narrative_positions` view used as the server/query model for narrative position.
- Added generated/indexed D1 projections for high-use values still canonically stored in `fields_json`.
- Added independent relationship canon/status (`Canon`, `Provisional`, `Concept`, `Contradicted`, `Shelved`, `Unknown`); legacy relationships migrate to `Canon`.
- Default graph/intelligence projections now avoid Contradicted/Shelved relationship claims and blocked endpoint entities while retaining those records for author review.
- Added canonical structured-reference registry used by validation and reference indexing.
- Added structured semantic references for Character/Civilization homeland, Character current location, Organization headquarters, and Artifact creator/original owner/current owner. Legacy text remains descriptive/migration data and Continuity flags records that still rely on it alone.
- Added a rebuildable D1 `reference_index` and `/api/entities/:id/impact` so dependency/impact views no longer need to scan every canonical store on demand.
- Reference-index maintenance is batched with ordinary canonical writes; cascades/restores rebuild it from canonical data.
- Added Part support to Knowledge, Reader Profiles, Clues, Reveals, manuscript records, Reader Preview, mystery progression, and Story organizer UI.
- Chapter editor derives/synchronizes Book from selected Part; Reveal save normalizes Book/Part/Chapter from the most-specific selected story point.
- Scene Continuity now computes scene-scoped warnings directly instead of running the full project continuity pass.
- Added hardening regression tests covering narrative position, relation status, structured semantic references, reverse indexing, Part-aware story data, and migration/Worker wiring.
- Intentionally retained full revision snapshots, replacement-style restore, confirmed-only cross-link suggestions, lightweight whiteboard/calendar tools, and text Species modeling rather than overengineering those systems prematurely.

## 3.3.0 — Relationship workspace, family tree, and connection graph

- Expanded existing canonical Relationship records instead of creating any parallel graph or family-tree store.
- Added a shared relationship-semantics layer for symmetric relationships, directional inverse labels, grouping, and graph direction.
- Character and ancient-being pages now show grouped Family, Personal, Affiliations, Political, Historical, Creation / Influence, Story, and Other relationships from either endpoint.
- Relationship records can now be created and edited with explicit From / Type / To fields, notes, era, active-from, and active-to; deletion remains available from the same panel.
- Added warning-based validation for exact duplicates, inverse duplicates, circular parent claims, and parent/child contradictions while still allowing unusual fictional relationships when intentionally confirmed.
- Rebuilt Family Tree as a multi-generation derived view supporting parent/child chains, siblings and half-siblings through shared parents, spouses, former spouses, adoptive parents, and guardians with distinct visual styles.
- Rebuilt Connection Graph as a bounded depth 1–3 local network with entity-type, relationship-type, era, and active-period filters plus family/personal/political/historical/creation/story presets.
- Directional graph edges use arrowheads only when semantics require direction; edge hover details expose notes, era, and active period.
- Added direct graph/tree entry points from character and deity relationship panels and click-to-refocus traversal.
- Optimized graph traversal with indexed adjacency lookup for larger relationship sets.
- Added targeted relationship-system regression tests.
- No schema or D1 migration is required; existing backups and canonical IDs remain compatible.

## 3.2.2 — Lore collection card view polish

- Made Cards the default view across All Lore and the main lore collections while preserving the Compact list option.
- Mixed collections such as All Lore, World, History, Story, and Mysteries now default to grouping by type so large libraries are easier to scan.
- Reworked non-portrait cards into clean text-first cards instead of showing repetitive placeholder portrait blocks.
- Archive now uses the same card grid and a total entry count instead of another long vertical list.
- Added edited-date context and a clearer empty-summary state to collection cards.
- Versioned collection layout preferences so existing automatic list defaults upgrade once, while new user choices continue to persist normally.
- No D1 migration is required.

## 3.2.1 — Filter controls and inline detail editing

- keeps multi-tag filtering while adding switchable searchable and browse-all tag pickers
- lets the tag picker collapse so large tag libraries do not dominate the page
- changes collection filters to explicit Search/apply behavior, with Enter-to-search support
- shows one clear total result count above the current collection results
- removes A–Z grouping and per-group counts to avoid redundant or contradictory organization controls
- keeps card/list views plus Type, Status, and no-grouping organization
- adds in-place editing for visible Summary, Author Notes, and structured detail fields without opening the full entry editor
- preserves the full Edit dialog for larger edits such as tags, status, and multiple fields at once
- no D1 migration required

## 3.2.0 — Multi-tag search and organized character library

- Added searchable multi-tag filtering across lore collection pages.
- Added Match All / Match Any behavior for selected tags.
- Added tag-name search so large tag vocabularies remain usable.
- Added persistent per-section sort, grouping, and view preferences.
- Characters & Beings now defaults to an A–Z grouped card library with portraits when available.
- Added compact-list/card switching, favorite-first and date/name sorting, plus type/status/A–Z grouping.
- No database migration is required.

## 3.1.2 — Portrait layout and media controls polish

- Fixed promoted character/deity portraits so the portrait image stays inside its column instead of overlapping the title and portrait controls.
- Added zoom controls to the full-screen image viewer from 100% through 400%, with a Fit reset and scrollable zoomed canvas.
- Replaced the page-wide media size control with per-image size controls above each attached image.
- Per-image resizing updates in place instead of rerendering the lore page, so using the size buttons no longer jumps the user back to the top.
- Kept the V3.1.1 archive correction and permanent Wrangler `keep_vars` behavior unchanged.
- No D1 migration is required.

## 3.1.1 — Media viewer, archive fix, beings in Characters

- Ancient Being / God entries now appear in both World and Characters & Beings without changing their underlying lore type.
- Ancient beings/gods can use the same primary portrait workflow as characters.
- Attached images are clickable and open in a large modal viewer with previous/next navigation and keyboard arrows.
- Images & media now has inline +/- thumbnail sizing controls, and thumbnails use contain sizing so artwork is not aggressively cropped.
- Fixed Archive entry using a newly-generated editor timestamp as its optimistic-concurrency base, which could make the confirmation appear to do nothing.
- Wrangler now sets `keep_vars: true` so dashboard-configured Access variables such as TEAM_DOMAIN, POLICY_AUD, and OWNER_EMAILS are preserved on normal deploys.

## 3.1.0 — Character portraits

- Added an optional primary portrait to character lore entries.
- Added a one-step portrait upload flow that reuses the private media library and automatically links the image to the character.
- Existing attached character media can be promoted to the primary portrait without re-uploading it.
- Portrait assignment can be removed without deleting the underlying media item.
- Media deletion is blocked while an image is serving as a character portrait.
- Backup and server validation now reject dangling character portrait media references.
- No D1 migration is required; the portrait reference is stored in the existing character `fields` JSON.

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
