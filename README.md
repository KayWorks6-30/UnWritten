# UnWritten.KayWorks — V3.0.1

UnWritten.KayWorks is a private author workspace for canon, continuity, worldbuilding, plot planning, maps, story knowledge, and long-series organization.

V3 keeps the V2 Cloudflare architecture and turns the application into a deeper narrative-intelligence workspace. The core design remains deliberately simple:

V3.0.1 is a focused interface patch: the navigation can collapse, global search moves into a sidebar-accessible palette when the top toolbar has scrolled away, collection filters stay once at the top of the page, and opened lore records can be closed again and are automatically brought into view. Storage and story semantics are unchanged.


```text
Browser
  ↓
Cloudflare Access
  ↓
Cloudflare Worker: unwritten
  ├── D1: authoritative structured data
  └── R2: authoritative private media

IndexedDB: unsaved editor drafts / legacy V1 migration only
```

There is one hosted environment: `unwritten.kayworks.dev`. Local development uses Wrangler's local resources; do not create a second hosted D1/R2/staging environment.

## What V3 adds

### Story Compass / Series Overview

The former Trilogy Overview is presented as a general Series Overview and can optionally capture the author's fixed story anchors:

- starting state / opening promise
- primary protagonists
- end goal / destination
- central prize, truth, answer, or equivalent destination
- non-negotiable story truths
- intended ending / final state
- the existing beginning / midpoint / climax / ending planning fields

These are optional. UnWritten does not require a writer to know the ending in advance.

### Continuity intelligence

V3 adds derived views over canonical records rather than duplicating lore:

- character knowledge at a selected Book / Chapter / Scene
- reader knowledge at a selected story point
- reader-vs-character knowledge gaps
- Mystery → clue / red herring → reveal progression
- scene continuity dashboards
- backlinks / dependency impact
- deterministic continuity warnings
- plot-thread coverage analysis
- character interaction matrices
- location usage views

Continuity warnings flag possible problems; they never rewrite canon automatically.

### Plotting and author workflow

- Plot Grid with reusable Plot Threads and Scene-linked beats
- contextual scratch notes and record-linked tasks
- saved views/workspaces
- command-palette style global quick open (`Ctrl/Cmd + K`)
- optional completeness prompts
- automatic cross-link suggestions requiring confirmation
- revision snapshots for edited entries
- Focus Mode
- lightweight scene manuscript drafting/export
- lightweight whiteboard
- simple placeholder/name generators
- Reader Preview and static reader-safe HTML export

### World tools

- family trees derived from canonical relationships
- faction/diplomacy view with optional Era / active-period metadata
- generic relationship/content trees
- multiple/parallel timeline views and filtering
- optional custom calendar records
- combined geographic/history navigation surfaces

### Atlas / Maps

The existing Location → Map → Map Version → Marker architecture remains authoritative. V3 expands the interface with:

- 25%–300% zoom
- map hierarchy breadcrumbs / drill-down
- map layers
- marker categories, symbols, labels, custom images and filters
- marker clustering when zoomed out
- draggable markers with persisted percentage coordinates
- map search
- character/book route records
- historical map-version navigation
- layer/era/book/faction/relevance metadata

Remote R2 media now renders through the central URL abstraction rather than requiring browser Blob objects.

## V3 security / data safety

V3 strengthens the Worker rather than adding another login system:

- Cloudflare Access remains the authentication provider.
- The Worker verifies the `Cf-Access-Jwt-Assertion` JWT.
- Verified Access email determines `Owner` vs `Reviewer`.
- Reviewers are server-enforced read-only users.
- Owner mutations remain available normally.
- stale entity edits receive HTTP `409` instead of silently overwriting a newer revision
- previous entity revisions are captured before successful overwrites
- Location/Map parent cycles are rejected
- generic deletion cannot bypass entity/map-version cascade logic
- restores validate typed references and workspace references
- R2 destructive deletion moves objects through `_trash/` first
- restore staging continues under `_restore/`

## Required production configuration

Before deploying V3, configure these Worker variables:

- `TEAM_DOMAIN` — your Access team URL, for example `https://example.cloudflareaccess.com`
- `POLICY_AUD` — the Application Audience (AUD) tag for the Access application protecting `unwritten.kayworks.dev`
- `OWNER_EMAILS` — comma-separated Access email addresses that should receive Owner mutation permissions

These values are intentionally not hard-coded in the repository.

See `docs/CLOUDFLARE-V3-SETUP.md` for exact setup and lifecycle commands.

## Install

```bash
npm install
```

`package.json` pins:

- `jose` for Access JWT validation
- Wrangler for development/deployment

## Local development

Create a local `.dev.vars` file from `.dev.vars.example` and keep `DEV_AUTH_BYPASS=true` only for local development.

Apply local migrations:

```bash
npm run db:migrate:local
```

Run the app:

```bash
npm run dev
```

Wrangler's local D1/R2 simulation keeps normal local development away from production resources.

## Production migration / deploy

Keep a ZIP backup before any major release.

Apply all pending D1 migrations:

```bash
npm run db:migrate:remote
```

Then deploy:

```bash
npm run deploy
```

V3 adds `migrations/0002_v3_workspace.sql`. Existing V2 data remains in the original tables and is not replaced by the migration.

## Verification

```bash
npm run verify
```

This runs:

- 44+ Node/domain/regression tests
- JS/MJS syntax checks
- clean in-memory SQLite migration smoke
- production static build
- asset/import checks
- Cloudflare binding/config checks
- duplicate HTML ID check
- basic committed-secret/private-key scan

An additional real-browser smoke harness is available as:

```bash
npm run browser:smoke
```

It launches Chromium against a local server snapshot to verify application boot and protected remote-media rendering. Managed browser environments that block loopback/local test origins can prevent this smoke from running; that is an environment restriction rather than an application fallback.

## Backups and portability

Cloud storage does not replace portable backups. V3 preserves:

- JSON export/restore
- full ZIP export/restore with binary media
- Markdown export
- V1/V2-compatible migration paths where supported
- static reader-safe HTML export

The ZIP remains the complete independent recovery artifact for both D1 records and R2 media.

## Production resources

- Worker: `unwritten`
- Hostname: `unwritten.kayworks.dev`
- D1: `unwritten` (`DB` binding)
- R2: `unwritten` (`MEDIA` binding)
- `workers.dev`: disabled
- preview URLs: disabled

The D1 UUID and bucket name in `wrangler.jsonc` are resource identifiers, not credentials.


## V3.0.0 finalization notes

- The browser/PWA application name is **UnWritten**. Repository/project documentation may still use the broader UnWritten.KayWorks identity.
- The UnWritten application mark is the gold U/W sigil in `assets/`; it is used for the browser favicon, PWA/install icons, and sidebar brand.
- Normal `/api/snapshot` responses exclude revision-history records; revisions are fetched per entity and are included explicitly when creating portable backups.
- Restore replaces the structured D1 dataset in one transactional `DB.batch()` call. R2 files are still staged first and are cleaned up if the structured commit fails.
- The V3 service-worker shell includes the full static JavaScript import graph required to boot the interface.
