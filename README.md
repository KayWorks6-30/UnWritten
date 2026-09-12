# Galatea World Bible — V1.1.0

A private, local-first author workspace for worldbuilding, story planning, visual maps, mysteries, history, knowledge tracking, and long-term canon management.

V1.1 keeps the existing static/browser-first architecture and focuses on two things: **data-recovery integrity** and a much more useful **visual atlas workflow**. It intentionally does not add a backend, accounts, or cloud sync.

## Core workspace

- Dashboard with recently-created/recently-edited lists, favorites, current book, questions, mysteries, and fast idea capture
- Typed lore entries for world lore, gods/ancient beings, locations, maps, historical events, eras, civilizations/cultures, religions, characters, creatures, organizations, artifacts, languages, trilogy overview, books, chapters, scenes, mysteries, foreshadowing, questions, and ideas
- Canon status tracking: Canon, Provisional, Concept, Contradicted, Shelved, Unknown
- Separate Author Truth, Modern Scholarship, Common Belief, Cultural Interpretations, and Reader Knowledge layers where relevant
- Structured entry relationships and global search
- Reusable local media library
- Soft archive before permanent deletion

## Visual Atlas

Maps are structured entries backed by real image files stored locally in IndexedDB.

A Map can now define:

- **Geographic Scope** — the Location the map actually depicts, such as Galatea, a continent, kingdom, province, or city
- **Parent / Overview Map** — the broader map this one drills down from
- multiple image versions for political, physical, historical, exploration, ancient, current, or other views
- location pins stored against stable Location IDs
- child/detail maps

### Typical workflow

1. Create the geographic Location hierarchy, for example `Galatea → Continent → Kingdom → City`.
2. Open a Location and choose **Map this location**, or create a Map from the Maps page.
3. Set its Geographic Scope. For a kingdom map, select that Kingdom Location.
4. Optionally set a Parent / Overview Map, such as the world or continent map.
5. Choose **Upload map image** and select your existing PNG/JPG/WebP/etc.
6. Place pins for Locations visible on that map.
7. If a pinned Location has its own scoped Map, clicking that pin drills directly into the detailed map. Otherwise it opens the Location lore page.
8. Use **Fit / − / +** to navigate large map images.

This means you can keep a complete world map while also maintaining detailed maps for specific kingdoms, cities, ruins, historical borders, or any other area without duplicating the underlying geography records.

The app does not generate map artwork. You provide the map image; Galatea stores, versions, links, and navigates it.

## Data integrity and recovery

V1.1 hardens backup/restore substantially:

- restore migrates only explicitly supported older schemas
- backups from a newer unsupported schema are rejected rather than silently downgraded
- entities, statuses, relationships, hierarchy references, knowledge records, map records, media, markers, and settings are validated before restore
- media is fully decoded before the database is touched
- restore replaces all IndexedDB stores in **one multi-store transaction**
- failed restore leaves the previous database intact
- ZIP restore rejects missing media members
- ZIP entries are CRC-checked for corruption
- media used by a Map Version cannot be deleted directly from the Media page
- Map Versions have an explicit delete workflow that also removes their markers
- permanent deletion blocks active hierarchical children instead of leaving dangling parent IDs
- optional references to permanently deleted entries are cleared deterministically

Restore remains replace-only by design. Export a safety backup before restoring another file.

## Editing safeguards

- Existing entry types are locked after creation so changing `Location → Character`, for example, cannot leave hidden stale type-specific fields or generated relationships.
- New unsaved entries can still change type; switching type clears unsaved type-specific fields.
- Archived parents remain visible in existing parent selectors as `— Archived`, preventing accidental relationship loss when editing a child.
- Cached media object URLs are revoked whenever media state refreshes.
- Primary entry lists and global search results are native buttons; graph nodes expose keyboard focus/activation.

## Timeline, story, mysteries, and graphs

V1 retains the completed V1.0 systems:

- uncertain historical dates with sortable start/end values and era bands
- Book → Chapter → Scene hierarchy
- Idea Inbox → structured entry conversion
- clue/reveal tracking tied to story positions
- character/reader knowledge records
- relationship, family-tree, and knowledge visualizations
- JSON, ZIP, and Markdown export

## Storage and privacy

All lore and images live in the browser's IndexedDB database for this site/origin. There is no remote lore database.

Clearing site data, losing the browser profile/device, or changing origins can remove access to that local history. Keep ZIP backups somewhere outside the browser.

If the static shell is hosted online, use something such as Cloudflare Access when you also want the site itself hidden behind authentication. `noindex` is not authentication.

## Run locally

```bash
npm run serve
```

Then open the shown localhost address.

## Tests and release checks

```bash
npm test
npm run build
npm run verify
```

`npm run verify` runs the Node regression suite, builds the deploy folder, checks asset/import references, scans duplicate HTML IDs, and performs a basic committed-secret scan.

A real browser IndexedDB recovery harness is also included:

```bash
npm run test:browser
```

It requires Chromium/Chrome on `PATH` (or `CHROME_BIN`). The harness tests IndexedDB → JSON backup → replace → restore, media recovery, future-schema rejection, and multi-store transaction rollback.

## Deployment

This remains a static app. Deploy the contents of `dist/` (or the provided deploy ZIP) to the chosen static origin.
