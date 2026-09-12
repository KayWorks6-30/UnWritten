# Roadmap Status — V1.1.0

The original predetermined local/offline roadmap is complete. V1.1 additionally closes the reliability findings from the first V1 review and upgrades Maps into a practical visual atlas.

## Foundation — complete

- IndexedDB local database
- typed lore/story/planning entries
- canon / question / idea state models
- author/in-world/reader knowledge distinctions
- structured relationships and hierarchy IDs
- global and section search
- media reuse
- responsive desktop/mobile application shell

## Authoring workflow — complete

- Idea → Entry conversion
- structured Location, Book, Chapter hierarchy helpers
- mystery clues and reader reveals
- Trilogy Overview
- soft archive before permanent deletion
- archived-parent preservation
- entry-type locking after creation

## Timeline / atlas — complete

- uncertain historical dates and era bands
- map entities with image-version history
- Map Geographic Scope → Location
- Parent / Overview Map hierarchy
- world/continent/kingdom/city-style atlas drilldown
- location pins with automatic detailed-map navigation
- location → map creation workflow
- image fit/zoom controls
- safe map-version/media lifecycle

## Visualization / portability — complete

- character/reader knowledge graph
- family tree
- relationship graph
- reveal/foreshadowing board
- JSON backup/restore
- ZIP backup/restore
- Markdown export

## Recovery integrity — complete for the current local model

- supported-schema migration only
- future-schema rejection
- cross-record validation
- fully decoded media before writes
- atomic multi-store database replacement
- missing/corrupt ZIP member rejection
- referential-integrity handling for permanent deletion
- regression coverage for validation and ZIP integrity
- optional real-browser IndexedDB integration harness

## Conditional future work — not currently justified

### Encrypted cross-device sync

Only consider this if maintaining a single authoritative browser/origin becomes a real constraint. A safe implementation would require authentication/authorization, remote-storage threat modeling, end-to-end encryption and key recovery, conflict handling, offline sync semantics, and operational backups.

## Future changes should now be usage-driven

Do not invent another large architecture roadmap simply because V1.1 exists. Use the application on the real novel and respond to proven friction. Plausible future improvements include polygon/region hotspots on maps, editor keyboard shortcuts, bulk edits, richer Markdown packages, map drawing/annotation tools, or stronger full-text indexing at very large scale—but only after actual usage shows they would help.
