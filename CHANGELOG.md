# Changelog

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
