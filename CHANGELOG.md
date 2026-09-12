# Changelog

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
