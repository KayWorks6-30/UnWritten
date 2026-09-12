# Roadmap Status — V2.0.0

## Completed product foundation

The original authoring roadmap is implemented:

- typed lore/wiki entries
- canon/question/idea state systems
- knowledge layers
- hierarchical geography
- visual atlas with world/area drill-down maps
- history/eras/timeline uncertainty
- story/trilogy/books/chapters/scenes
- mysteries, structured clues, reveals, foreshadowing
- relationship graphs and family trees
- character/reader knowledge records
- archive/restore/permanent-delete safeguards
- reusable media library
- JSON, ZIP, and Markdown portability

## V2 storage transition — complete

- D1 authoritative structured data
- private R2 authoritative media
- same-origin Worker API
- production binding configuration
- D1 schema migration
- V1 JSON/ZIP import compatibility
- same-origin V1 IndexedDB migration helper
- staged R2 + transactional D1 restore flow
- local unsaved-draft recovery
- API cache exclusion from the service worker
- no dev Cloudflare environment; local Wrangler resources only

## Next phase

Do not create another speculative architecture roadmap immediately.

Use UnWritten on the real project and collect concrete authoring friction. Candidate improvements should be driven by repeated real use, such as:

- polygon/region hotspots instead of pin-only maps
- editor keyboard shortcuts
- richer text/Markdown editing if plain text becomes limiting
- bulk tag/status operations
- stronger search if the real dataset becomes large enough to justify it
- revision history for individual entries if accidental content replacement becomes a real problem
- scheduled server-side backup/snapshot tooling if D1 Time Travel + manual exports prove insufficient

The default next action after V2 is **authoring**, not another stack migration.
