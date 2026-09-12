# Galatea World Bible — V1.0.0

A private, local-first author workspace for worldbuilding, story planning, maps, mysteries, history, knowledge tracking, and long-term canon management.

V1.0 completes the original local roadmap through authoring workflows, timeline/maps, graph views, and portable export. It intentionally does **not** add remote sync: the roadmap made encrypted cross-device sync conditional on the single-device workflow becoming insufficient, and this release remains static/browser-first.

## Core workspace

- Dashboard with separate recently-created/recently-edited lists, favorites, current book, questions, mysteries, and fast idea capture
- Typed lore entries for world lore, gods/ancient beings, locations, maps, historical events, eras, civilizations/cultures, religions, characters, creatures, organizations, artifacts, languages, trilogy overview, books, chapters, scenes, mysteries, foreshadowing, questions, and ideas
- Canon status tracking: Canon, Provisional, Concept, Contradicted, Shelved, Unknown
- Separate Author Truth, Modern Scholarship, Common Belief, Cultural Interpretations, and Reader Knowledge layers where relevant
- Structured entry relationships and global search
- Reusable local media library
- Soft archive before permanent deletion

## Authoring workflows completed in V1

- Idea Inbox → structured entry conversion without copy/paste; source idea is retained and marked Converted
- Structured Location → Parent Location selector with generated `located_in` relationship
- Structured Chapter → Book and Scene → Chapter selectors
- Dedicated Trilogy Overview card/view
- Mystery clue subrecords tied directly to chapters/scenes
- Reader reveal records with Book / Chapter / Scene links
- Dedicated Reveal & Foreshadowing Board ordered by story position
- Character and Reader Knowledge records with truth/partial/incorrect/unaware states

## Timeline

Historical events support:

- written display date
- sortable numeric start/end range
- Exact / Approximate / Range / Traditional / Disputed / Unknown certainty
- structured Era link
- era-band timeline display and filtering
- optional manual sort override for edge cases

The sortable values exist only for organization. They do not replace the author's historical wording.

## Maps

Maps are now structured lore records instead of loose images.

Each map can have:

- multiple image versions
- variant type such as Political, Physical, Historical, Exploration, Ancient, or Current
- version label/date/notes
- location markers stored against stable Location IDs

Select a Location, arm marker placement, then click the image. Replacing or adding a map image version does not rewrite the Location record.

Legacy V0.1 media tagged `#map` remains preserved in Media and can be organized into map records manually.

## Graphs

- two-depth relationship graph from any structured entry
- family-tree visualization derived from `parent_of` / `child_of` relationship records
- subject-centered knowledge graph showing character/reader knowledge states

These visualizations are derived from normal records; they are not separate sources of truth.

## Backups and portability

Settings & Data supports:

- full JSON backup / restore
- full ZIP backup / restore with media as separate binary files
- Markdown export for human-readable/offline reference

Restore is replace-only by design. This avoids ambiguous record merging. Export a safety backup first.

V0.1 JSON backups are migrated deterministically when restored/opened; new stores default to empty and existing entry IDs are preserved.

## Run locally

```bash
npm run serve
```

Then open `http://localhost:8080`.

Browser modules and IndexedDB require an HTTP(S) origin; `file://` is not the supported workflow.

## Tests

```bash
npm test
```

The suite covers schema/status invariants, search, relationships, timeline sorting, story hierarchy, family/relationship graph semantics, V0.1 migration behavior, ZIP round trips, and Markdown export.

## Build deployment files

```bash
npm run build
```

This creates `dist/` containing only the static app files required for deployment.

## Privacy model

There is no remote lore database and no application account. World data and uploaded media remain in this browser's IndexedDB for the exact site origin until you deliberately export them.

For a deployed private author workspace, put the hostname behind a host-level access layer such as Cloudflare Access. `noindex` metadata prevents ordinary indexing but is not authentication.

Different hostnames/subdomains have separate browser storage. Use a backup to move data between origins.

## Deliberately not included

- remote/cloud synchronization
- multi-user collaboration
- server database
- AI-generated lore
- automatic conflict resolution between devices

Encrypted cross-device sync remains a future option only if the local-first workflow stops being sufficient. Adding it would require authentication, server-side authorization, encryption/key recovery design, and a real synchronization/conflict model rather than treating sync as a small add-on.
