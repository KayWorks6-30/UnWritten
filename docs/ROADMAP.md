# Roadmap Status — V3.5.1

V3.4 hardened the domain architecture. V3.5 stabilizes the implementation architecture so feature development can resume without letting future code bypass the rules established in V3.4.

## V3.5 stabilization implemented

### Runtime read/query boundary

- normal data adapter no longer depends on whole-project `/api/snapshot`
- per-store and per-record GET routes
- independent client store caches
- same-store request coalescing
- successful writes update relevant cache rather than forcing global reload
- server-side entity query/search with filters, cursor, and limit
- snapshot retained only for backup/deep diagnostics

The current UI still compatibility-hydrates the stores needed by existing cross-domain views at boot. Feature-scoped lazy loading is now an incremental UI optimization instead of a backend/storage redesign.

### Mutation discipline

- centralized structured-record mutation path
- common stale-write check
- server-authoritative update timestamps
- shared validation boundary
- Entity revision capture
- canonical upsert and reverse-index maintenance in the same normal mutation batch
- authoritative saved record returned to the browser

### Generalized concurrency

- stale Entity writes remain protected
- schema 8 adds `updated_at` to Settings, Media metadata, and Map Versions
- client automatically supplies `x-base-updated-at` from cached records
- deletes/cascade operations use known base timestamps where applicable

### Database structural safety

- D1 trigger safety nets under application validation
- relationship endpoint/era existence
- clue/reveal reference existence
- knowledge reference existence
- map-version map/media existence
- marker map-version/location/media/faction existence
- marker coordinate range enforcement

### Backup migration architecture

- explicit sequential portable migrations 1→2→3→4→5→6→7→8
- current-version idempotent normalization
- future-version rejection remains intact
- SQL migrations stay independently cumulative

### Derived-data integrity

- shallow architecture health diagnostics
- deep reverse-index expected-vs-actual comparison
- orphan reverse-target reporting
- narrative-position integrity reporting
- SQLite integrity check
- owner-only reverse-index rebuild
- bounded rebuild batches for large indexes

### Scale evidence

- synthetic stress harness
- configurable entity/relation/knowledge/scene counts
- dependency-index construction timing
- search timing
- narrative-order sorting timing
- payload-size reporting
- reference-edge volume reporting

### Implementation boundaries

- low-level API transport extracted from canonical data adapter
- D1 row/read/upsert translation extracted to Worker record library
- domain story lookup cache avoids repeated entity-map reconstruction
- further UI feature extraction should happen opportunistically alongside feature work rather than through a risky all-at-once framework rewrite

## V3.4 domain hardening retained

- optional Part and one narrative-position model
- generated/indexed hot `fields_json` values
- canonical structured-reference registry
- structured semantic links where repeated traversal matters
- relationship claim status
- projectable relationship filtering
- reverse dependency index / Impact API
- Part-aware Knowledge, Reader Preview, Clues, Reveals, manuscripts, and Story organizer
- scene-scoped continuity
- legacy semantic-reference auditing

## Feature development can resume

Architecture-only releases should now stop unless actual data or profiling exposes a structural problem.

The next releases should primarily improve or add author-facing capabilities while respecting these boundaries:

- use query/record APIs rather than introducing new monolithic snapshot dependencies
- route structured writes through the mutation boundary
- add DB constraints only for structural invariants; keep domain semantics in validators
- make derived data rebuildable/verifiable
- add query projections only when real usage demonstrates repeated query need
- preserve sequential backup migrations for every future schema bump
- use diagnostics/stress evidence before adding generalized caching/materialization

## Deliberately deferred

Do not build these merely because they are architecturally possible:

- graph database migration
- event sourcing or diff-based revision history
- full project merge/import algorithm
- autonomous cross-link creation
- formal Species entity before the world data proves the correct model
- full scheduling/calendar engine
- generative whiteboard layout engine
- generalized materialized-view/cache framework before profiling proves it useful
- universal world-time coordinate until calendar/history requirements justify it

## Evidence to collect during normal use

Watch:

- entity/relation/knowledge counts
- search/API latency
- deep diagnostics timing
- reference-index size and drift (should remain zero in healthy operation)
- continuity/Reader Preview timing
- whether initial compatibility hydration becomes noticeable with real project size
- which `fields_json` values repeatedly need server-side filtering/ordering
- whether selective import/merge becomes a real workflow
- whether custom calendars need a universal chronological coordinate

The center of UnWritten remains:

**What is true, who knows it, when they know it, where it happened, how the reader learns it, and what depends on it.**
