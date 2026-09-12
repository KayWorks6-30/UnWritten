# Galatea World Bible — V0.1.0

A private, local-first author workspace for worldbuilding, story planning, mysteries, history, and long-term canon management.

## What this version includes

- Dashboard with recent entries, favorites, current book, unresolved questions, mysteries, and quick idea capture
- Typed lore entries for world lore, ancient beings, locations, events, eras, civilizations/cultures, religions, characters, creatures, organizations, artifacts, languages, trilogy overview, books, chapters, scenes, mysteries, foreshadowing, questions, and ideas
- Canon status tracking: Canon, Provisional, Concept, Contradicted, Shelved, Unknown
- Separate knowledge layers for Author Truth, Modern Scholarship, Common Belief, Cultural Interpretations, and Reader Knowledge / Reveal Notes where relevant
- Structured cross-links between entries
- Global search plus section filters
- Searchable media gallery
- Master timeline with uncertain written dates and an optional manual sort key
- Reusable image/media library; one image can be linked to multiple entries
- Simple image-based Maps section
- Full JSON backup/restore including media
- Local IndexedDB persistence
- Offline application-shell caching through a service worker when served over HTTP/HTTPS
- `noindex`/`nofollow` metadata

## Run locally

Use any static HTTP server. From this folder:

```bash
npm run serve
```

Then open `http://localhost:8080`.

The app uses browser modules and IndexedDB, so opening `index.html` directly with `file://` is not the supported workflow.

## Privacy model

V0.1 has no backend and no author account. Lore entries and uploaded images are stored in this browser's IndexedDB database for the current site origin. Hosting the static app does not upload the author's world database.

That also means browser storage is not a backup. Clearing site data, losing the device/profile, or moving to a different origin can make the local database unavailable. Export full JSON backups regularly.

## Backup behavior

`Settings & Data → Export full JSON backup` includes:

- entries
- structured relationships
- project settings
- media encoded into the JSON backup

Restore is replace-only in V0.1. This avoids unsafe or ambiguous record merges while the schema is still young.

## Tests

```bash
npm test
```

The current suite protects schema validity, search behavior, canon/question status rules, and relationship invariants.

## Important V0.1 limitations

- Search is intentionally linear over local records. That is simple and sufficient for early development; a dedicated full-text index can be added later without changing entry IDs.
- Media inside JSON backups increases file size because binary files are encoded for portability.
- Interactive map markers, family trees, relationship graphs, rich character-knowledge graphs, Markdown export, and visual reveal timelines are deferred.
- There is no cloud sync or multi-device merge.
- Authentication is intentionally absent because the content database never leaves the browser in this version. If remote sync is added later, authentication becomes mandatory.

## Build a deploy folder

```bash
npm run build
```

This creates `dist/`, which contains only the static application files needed for deployment.
