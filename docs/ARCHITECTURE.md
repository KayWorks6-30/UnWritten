# Architecture — V0.1.0

## 1. Proposed architecture

V0.1 is a static browser application using vanilla HTML, CSS, and JavaScript. It uses IndexedDB behind a dedicated persistence module instead of scattering raw browser-storage calls through the UI.

Why IndexedDB is justified here:

- the project is explicitly expected to grow to thousands of records
- image/map/concept-art blobs are part of the core use case
- localStorage's small synchronous string store is a poor fit for that payload
- the application can still remain local-first, static-hostable, and backend-free

The main layers are:

- `js/data/` — IndexedDB persistence and portable backups
- `js/domain/` — entry schemas, search, relationship semantics
- `js/app.js` — routing, rendering, editing, and interaction orchestration
- `styles.css` — shared responsive application UI

This is intentionally smaller than a framework application. The model is structured enough to grow, but there is no frontend framework, server database, auth stack, or state library in V0.1.

## 2. Data model

### Entity

Most author data uses one durable entity envelope:

```text
Entity
- id
- type
- name
- summary
- status
- tags[]
- favorite
- fields{}
- notes
- createdAt
- updatedAt
```

`type` selects a schema describing optional fields. Empty fields are valid. This preserves the ability to sketch incomplete lore without satisfying a giant required form.

Supported V0.1 types:

- lore
- ancient being / god
- location
- historical event
- era / age
- civilization / culture
- religion / mythology
- character
- creature
- organization / faction
- artifact / object
- language
- book
- chapter
- scene
- mystery / reveal
- foreshadowing
- unresolved question
- idea inbox item

### Knowledge layers

Relevant lore schemas include separate fields for:

- Author Truth
- Modern Scholarship
- Common Belief
- Cultural Interpretations
- Reader Knowledge / Reveal Notes

These are not collapsed into one description because disagreement and partial knowledge are core story mechanics.

Character-specific knowledge and false beliefs are also first-class character fields.

### Relationship

Cross-linking is stored separately:

```text
Relationship
- id
- fromId
- toId
- type
- note
- createdAt
```

This avoids copying names into many records and gives future graphs, family trees, mystery clue visualizations, and map markers stable IDs to target.

Examples include:

- parent_of
- friend_of
- member_of
- located_in
- participated_in
- created_by
- appears_in
- introduced_in
- clue_in
- revealed_in
- contradicts
- supports

### Media

```text
Media
- id
- name
- title
- mime
- size
- blob
- tags[]
- entityIds[]
- createdAt
```

A single media record can be linked to multiple entries. Images are not duplicated just because they appear on several lore pages.

### Settings

V0.1 settings include the project name and current-book ID. Future preferences can be added without changing entity records.

## 3. Major page structure

### Dashboard

Useful working surface rather than decoration:

- total/canon/open-question/mystery counts
- quick idea capture
- current book
- recently edited
- favorites
- unresolved questions
- important mysteries
- recent ideas

### All Lore

Global structured-entry index with search, type, status, and tag filters.

### World

Focused index for broad lore, ancient beings, civilizations, religions, creatures, organizations, artifacts, and languages.

### Characters

Character-only profiles and relationships.

### Geography

Location hierarchy records. V0.1 can store parent-location text and, more importantly, structured `located_in`/`belongs_to` relationships.

### Maps

V0.1 map library using ordinary media tagged `map`, alongside the location index. This deliberately establishes stable location IDs before interactive markers are added.

### History / Timeline

Events and eras are editable in History. Timeline renders historical events in a dedicated chronological view. Written dates can remain uncertain (`Approximately 3,000 years before present`, `Traditional date`, etc.). An optional numeric sort field exists only for display ordering.

### Story

Books, chapters, and scenes remain separate from objective world lore.

### Mysteries & Foreshadowing

Dedicated mystery/reveal and foreshadowing records. Structured relationships can point them at chapters/scenes using link types such as `introduced_in`, `clue_in`, `revealed_in`, and `foreshadows`.

### Media

Searchable expansion point for maps, drawings, concept art, diagrams, family trees, and reference material.

### Idea Inbox / Questions

Fast, intentionally low-friction capture surfaces that do not force premature categorization.

### Settings & Data

Project identity, current book selection, database summary, backup, and restore.

## 4. V1 scope

The V0.1 implementation establishes the V1 foundation requested by the product prompt:

1. Dashboard
2. Lore entries and categories
3. Canon statuses
4. Cross-linking
5. Global/section search
6. Characters
7. Locations
8. History and master timeline
9. Story: books/chapters/scenes
10. Mystery tracker and foreshadowing records
11. Idea inbox
12. Image attachments/media reuse
13. Full backup/restore
14. Basic map-image section

Further V1 iterations should deepen these workflows before adding large visualization systems.

## 5. Deferred features

Deferred intentionally:

- interactive maps and marker editing
- relationship graph visualization
- family-tree visualization
- sophisticated timeline visualization
- detailed per-character knowledge graph
- automatic reader-reveal visualization
- Markdown export
- partial/merge import
- cross-device sync
- remote authentication
- collaborative editing
- AI lore parsing/suggestion layer

The current IDs and relationship model are designed so these do not require rebuilding the core database.

## 6. Storage and backup

IndexedDB stores entities, relationships, settings, and binary media locally.

Full export creates a human-readable JSON structure. Media blobs are converted to portable data URLs for backup and reconstructed as blobs on restore.

Tradeoff: full JSON backups can become large. A later release can add a ZIP-based backup package with separate `/media` files while keeping the same logical export schema.

## 7. Privacy/authentication approach

V0.1 does not need an author login because it has no remote content database. The hosted files are only the empty application shell; unpublished lore remains in the browser.

The HTML explicitly asks search engines not to index the app shell via `robots` metadata. For an actually private hosted URL, deployment should additionally use a private access layer at the host (for example an access policy) if the author does not want the empty shell reachable by others.

If future sync stores manuscript/lore data remotely, the privacy model changes immediately. That version must introduce authentication, access control, transport security, server-side authorization, and encrypted backup/recovery discipline before remote data storage ships.

## 8. Architectural risks

### Origin-bound local data

IndexedDB is tied to the exact site origin. Dev/prod/subdomain changes do not share data automatically. Backups are the migration path.

### Browser storage is not archival storage

Local persistence can be cleared. The UI therefore makes backup/export a core feature rather than an afterthought.

### Media backup growth

Base64/data-URL encoding makes portable JSON larger than the original binary media. Later use a ZIP bundle.

### Linear search

V0.1 scans the local entity set. That is easy to reason about and likely fine early. If the corpus reaches a size where search latency is visible, add a derived full-text index rather than changing canonical records.

### Flexible typed fields

A generic entity envelope is useful, but uncontrolled schema churn can create messy data. New field definitions should be versioned and migrations should be deterministic once real content accumulates.

### Relationship semantics

Some relation types are directional and some are effectively symmetric. V0.1 displays direction but does not automatically create inverse relationship records. A later domain layer can formalize inverse semantics (`parent_of ↔ child_of`, etc.) without changing IDs.

## 9. Folder structure

```text
Galatea-World-Bible-v0.1.0/
├── index.html
├── styles.css
├── manifest.webmanifest
├── sw.js
├── package.json
├── README.md
├── CHANGELOG.md
├── js/
│   ├── app.js
│   ├── data/
│   │   ├── db.js
│   │   └── backup.js
│   └── domain/
│       ├── schema.js
│       ├── search.js
│       └── relations.js
├── docs/
│   ├── ARCHITECTURE.md
│   └── ROADMAP.md
└── tests/
    ├── schema.test.js
    ├── search.test.js
    └── relations.test.js
```

## 10. Staged implementation plan

### Stage 1 — Foundation (implemented in V0.1)

- persistence boundary
- typed entry schemas
- canon statuses
- CRUD editor
- search/filtering
- structured relationships
- dashboard
- major section routing
- local media
- backup/restore

### Stage 2 — Authoring depth

- dedicated trilogy overview
- explicit chapter → scene hierarchy
- richer mystery clue records instead of some freeform text
- reader-knowledge reveal records tied to chapter/scene IDs
- convert Idea → real entry workflow
- better location parent picker
- media search/tag filtering
- soft archive/history for destructive edits

### Stage 3 — Historical/geographic tooling

- era-aware timeline lanes
- event date-range model with uncertainty metadata
- map records separate from media records
- interactive markers targeting location IDs
- historical border/map variants

### Stage 4 — Knowledge and relationships

- inverse relationship semantics
- character knowledge claims
- claim truth-state (`true`, `false`, `partial`, `unknown`)
- family tree visualization
- relationship graph
- reader reveal timeline

### Stage 5 — Portability and scale

- ZIP backup with separate media files
- Markdown export
- selective export by category/book
- full-text search index if needed
- optional encrypted remote sync only if cross-device use becomes worth the added security/auth complexity
