# Architecture — V1.1.0

## Product boundary

Galatea World Bible is a static, local-first private author workspace. The deployed files are application code only. Canon, manuscript planning, maps, media, relationship records, and knowledge state live in the browser's IndexedDB database for the current origin.

The application remains vanilla HTML/CSS/JavaScript. No frontend framework, remote database, auth stack, analytics service, or sync service is required for the current workflow.

## Persistence boundary

`js/data/db.js` is the authoritative browser persistence boundary.

IndexedDB stores:

- `entities` — durable typed lore/story/planning records
- `relations` — structured links between entry IDs
- `media` — reusable image blobs and metadata
- `settings` — project preferences
- `clues` — mystery clue/red-herring/evidence subrecords
- `reveals` — explicit reader reveal records
- `knowledge` — character/reader knowledge states
- `mapVersions` — version/history metadata tying a Map entry to one media record
- `mapMarkers` — location coordinates tied to one map-version ID

UI code does not own a second canonical copy of these records.

## Entity model

The durable entity envelope remains:

```text
Entity
- id
- type
- name
- summary
- status
- tags[]
- favorite
- archivedAt
- fields{}
- notes
- createdAt
- updatedAt
```

Fields remain optional so incomplete lore is valid.

Existing entity `type` is immutable in the normal editor after creation. This protects type-specific fields and generated structural relationships from becoming hidden stale data. Idea → Entry remains the explicit conversion workflow.

## Stable hierarchy and referential integrity

Structured IDs include:

- Location `parentLocationId` → Location
- Chapter `parentBookId` → Book
- Scene `parentChapterId` → Chapter
- Event / Map `eraId` → Era
- Map `scopeLocationId` → Location
- Map `parentMapId` → Map

Location, Chapter, and Scene parent saves also maintain generated relationships for reverse navigation.

Permanent deletion is deliberately conservative:

- active hierarchical children block deletion of their parent
- optional embedded references are cleared when the target is permanently deleted
- dedicated subrecords/relationships are cascaded
- project current-book selection is cleared if its Book is deleted

Archived parent IDs remain visible in existing selectors as archived values rather than silently becoming `None`.

## Knowledge distinction

The app uses two complementary mechanisms:

1. Lore-entry knowledge layers (`Author Truth`, `Modern Scholarship`, `Common Belief`, etc.) for broad narrative/world context.
2. `knowledge` records for explicit subject + knower + state + story-point tracking.

Reader/character belief does not become objective truth merely because it is recorded.

## Mystery/reveal model

Mysteries are normal entities containing the actual answer and high-level planning notes. Detailed clues and reveals are first-class records linked by stable IDs to story locations and lore targets.

The Reveal Board is derived from those records and Foreshadowing entities rather than storing a second manually synchronized timeline.

## Timeline model

Historical event prose and sorting remain intentionally separate:

```text
fields.dateText         human-facing wording
fields.dateStart        optional sortable numeric start
fields.dateEnd          optional sortable numeric end
fields.dateUncertainty  Exact / Approximate / Range / Traditional / Disputed / Unknown
fields.eraId            structured Era link
fields.timelineOrder    optional manual override
```

## Visual Atlas

A Map is an Entity, not just an uploaded file.

```text
Map Entity
- scopeLocationId   Location represented by the image
- parentMapId       broader/overview map
- mapKind
- eraId
- description
- coverage note

Map Version
- mapId
- mediaId
- label
- variant
- effectiveDate
- notes

Map Marker
- mapVersionId
- locationId
- x/y percentage coordinates
```

This supports an atlas such as:

```text
Galatea World Map
  → Northern Continent Map
      → Kingdom of X Map
          → Capital City Map
```

A marker always targets the canonical Location ID. If that Location has a scoped child/detail Map, the visual marker drills into that Map. Otherwise it opens the Location entry.

Image versions are separate from Map identity so historical/political/physical revisions do not duplicate geography. Map media cannot be deleted underneath a live Map Version.

## Backup / restore boundary

Restore is treated as untrusted input even for a private application.

The pipeline is:

```text
parse
→ reject unsupported future schema
→ deterministic migration of supported older schema
→ structural + cross-record validation
→ fully decode/verify media
→ validate again
→ one IndexedDB transaction across every store
→ commit all stores or preserve the old database
```

`js/data/validation.js` validates IDs, entity types/statuses, relationship types/endpoints, hierarchy references, settings, media links, clues/reveals, knowledge records, map versions, and map-marker coordinates.

ZIP restore verifies every referenced media member exists and checks ZIP CRC32 before database replacement.

## Graphs

Relationship, family, and knowledge graphs remain derived views rather than independent data sources.

## Media lifecycle

Media object URLs are UI-session resources, not persistence. Cached object URLs are revoked whenever persisted media state is refreshed.

Map Version deletion removes its markers and only deletes the underlying media blob when that blob is not still reused elsewhere.

## Backup formats

### JSON

All stores are exported. Media blobs are encoded as data URLs for one-file portability.

### ZIP

```text
manifest.json
media/<media-id>.<extension>
```

Media remains binary and CRC-checked on restore.

### Markdown

Human-readable export resolves stable IDs to names. It is an escape hatch/reference format, not a lossless database replacement.

## Privacy

There is still no remote content database. `noindex` discourages indexing of the static shell but is not access control. A hosted private deployment should use hosting-layer protection such as Cloudflare Access.

Origin separation remains intentional: different hostnames do not share IndexedDB. Use backups when moving the authoritative workspace.

## Cross-device sync decision

Encrypted sync remains deliberately out of scope until real usage proves a need. Adding it safely would require a separate threat model for authentication, remote authorization, encryption/key recovery, offline conflicts, and operational backups.
