# Architecture — V1.0.0

## Product boundary

Galatea World Bible is a static, local-first private author workspace. The deployed files are application code only. Canon, manuscript planning, maps, media, relationship records, and knowledge state live in the browser's IndexedDB database for the current origin.

The application remains vanilla HTML/CSS/JavaScript. No frontend framework, remote database, auth stack, analytics service, or sync service is required for the V1 workflow.

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

Fields are optional. Incomplete lore remains valid.

V1 adds `map` as a normal entity type so maps can participate in search, canon state, tags, media links, notes, and structured relationships.

## Stable structured hierarchy

Hierarchy helpers store IDs, not copied names:

- Location `parentLocationId` → Location
- Chapter `parentBookId` → Book
- Scene `parentChapterId` → Chapter
- Event `eraId` → Era

Location, Chapter, and Scene parent saves also maintain generated structured relationships for natural reverse navigation.

Legacy V0.1 free-text fields remain readable and are not silently deleted.

## Knowledge distinction

V1 uses two complementary mechanisms:

1. Lore-entry knowledge layers (`Author Truth`, `Modern Scholarship`, `Common Belief`, etc.) for broad narrative/world context.
2. `knowledge` records for explicit subject + knower + state + story-point tracking.

A knowledge record can say a Character knows the truth, knows part, believes something false, is unaware, or is intentionally unknown. Reader state uses the same model without pretending reader knowledge is objective world truth.

## Mystery/reveal model

Mysteries remain normal entities containing their actual answer and high-level planning notes.

Detailed clue progression is stored separately:

```text
Clue
- mysteryId
- kind
- label / description
- storyEntityId (Chapter or Scene)
- visibility
- intended first-read interpretation
- true interpretation
- order
```

Reader reveals are separate records with optional Mystery/target lore plus Book, Chapter, and Scene IDs. This lets one reveal affect multiple systems without copying chapter names into prose.

The Reveal Board derives a chronological view from these records and Foreshadowing entities.

## Timeline model

Historical event prose and sorting are intentionally separate:

```text
fields.dateText         human-facing wording
fields.dateStart        optional sortable numeric start
fields.dateEnd          optional sortable numeric end
fields.dateUncertainty  Exact / Approximate / Range / Traditional / Disputed / Unknown
fields.eraId            structured Era link
fields.timelineOrder    optional manual override
```

This preserves dates like “traditional date” or “approximately 3,000 years before present” while still allowing deterministic ordering.

## Maps

A Map is an Entity. Each image revision is a `mapVersions` record pointing to one reusable `media` record. Each marker references:

- one map-version ID
- one stable Location ID
- X/Y percentage coordinates

Therefore changing a map image, label, border interpretation, or historical period does not duplicate or rewrite Location lore.

## Graphs

Graphs are derived views, not databases:

- Relationship Graph derives from `relations`
- Family Tree derives from `parent_of` / `child_of`
- Knowledge Graph derives from `knowledge`

This prevents the visual layer from becoming a second source of truth.

## Archive semantics

Normal deletion is two-stage:

1. Archive: set `archivedAt`; hide from normal working/search views.
2. Permanent delete: only exposed after archive and explicitly confirmed.

Cascade deletion removes affected structured relations/subrecords and detaches media references. Contradicted lore can simply remain active with status `Contradicted`; it does not need to be archived.

## Migration

Database version upgrades create missing V1 stores without replacing existing stores. Existing entities are normalized deterministically to add fields such as `archivedAt` and timeline uncertainty defaults.

V0.1 JSON backups are accepted and migrated to the current logical schema with all new collections defaulting to empty.

No migration changes record IDs.

## Backup and portability

### JSON

Full portable JSON contains all stores. Media blobs are encoded as data URLs for one-file portability.

### ZIP

ZIP backup uses a standards-compliant store-only ZIP archive:

```text
manifest.json
media/<media-id>.<extension>
```

The manifest contains structured database records and media metadata. Binary media remains binary instead of being base64-expanded.

### Markdown

Markdown export resolves structural entity IDs back to readable names and includes entry fields, relationships, clues/reveals, and knowledge records. It is an author-readable escape hatch, not a lossless database replacement.

## Privacy

The application still has no remote content database. `noindex` metadata discourages indexing of the shell but does not constitute access control. Private deployment should use a hosting-layer policy such as Cloudflare Access.

Origin separation remains intentional: two hostnames do not share IndexedDB. Use backup/restore to move the world database.

## Cross-device sync decision

Encrypted cross-device sync was deliberately not implemented because the roadmap makes it conditional on actual need. Adding sync safely would introduce authentication, remote authorization, encryption/key recovery, synchronization conflict semantics, and operational responsibilities. Until that problem exists, keeping it out preserves the project's privacy and simplicity.
