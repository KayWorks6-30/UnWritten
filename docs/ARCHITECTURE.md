# Architecture — V2.0.0

## Purpose

UnWritten.KayWorks is a private single-author worldbuilding and story-planning workspace. V2 deliberately introduces a backend because the project is expected to contain years of irreplaceable writing and media, and the author has chosen a private Cloudflare-hosted deployment protected by Access.

This is not a generic multi-user SaaS architecture.

## Persistence boundary

### Authoritative

- **D1**: structured canon/story data
- **R2**: image/map/media binaries

### Local only

- **IndexedDB draft cache**: unsaved editor recovery
- **legacy V1 IndexedDB**: read-only migration source when detected
- Service Worker Cache Storage: application shell only, never API data

The UI does not manipulate D1 or R2 directly. `js/data/db.js` is the browser persistence boundary and speaks only to same-origin `/api/*` routes.

## Cloudflare resources

```text
Worker: unwritten
Custom Domain: unwritten.kayworks.dev
D1 binding: DB → unwritten
R2 binding: MEDIA → unwritten
workers.dev: disabled
preview URLs: disabled
```

The production hostname must remain protected by Cloudflare Access.

## D1 tables

V2 uses explicit tables for the existing domain stores:

- `entities`
- `relations`
- `settings`
- `media`
- `clues`
- `reveals`
- `knowledge`
- `map_versions`
- `map_markers`

Flexible type-specific entry fields stay JSON in `entities.fields_json`. Tags and similar flexible arrays are also stored as JSON. This preserves the useful V1 entity envelope without creating dozens of narrow tables.

## R2 model

R2 stores only binary media. D1's `media` table stores metadata and the private `r2_key`.

R2 has no public custom domain and does not require S3 credentials for this application. The Worker uses the `MEDIA` binding.

The browser requests a protected same-origin URL:

```text
/api/media/:id/content
```

The Worker looks up the private R2 key in D1 and streams the object.

## API

Primary routes:

- `GET /api/health`
- `GET /api/snapshot`
- `PUT/DELETE /api/store/:store/:key`
- `PUT/DELETE /api/media/:id`
- `GET /api/media/:id/content`
- `DELETE /api/entities/:id/cascade`
- `DELETE /api/map-versions/:id/cascade`
- staged restore routes under `/api/restore/*`

The API is same-origin and intended to sit behind Cloudflare Access.

## Data loading

The V1 UI expected a local `getAll(store)` API. V2 keeps that interface but implements it using a shared in-flight `/api/snapshot` request. A UI refresh that asks for all nine stores therefore does not issue nine remote database requests.

Any successful mutation invalidates the browser-side snapshot cache.

## Mutation validation

The Worker validates authoritative writes, including:

- entry schema/type/status
- relationship type and endpoints
- hierarchy references
- story references
- mystery/clue links
- knowledge subject/character references
- map/media/location references
- marker coordinates
- current-book references

Backup restores receive full cross-store validation before commit.

## Restore transaction model

D1 `batch()` is used as the transactional structured-data boundary.

R2 and D1 cannot share one distributed ACID transaction, so V2 uses staged object keys:

```text
validate manifest
→ stage restore media under _restore/<session>/...
→ confirm every media file exists
→ copy each to a new immutable-ish final key
→ transactional D1 replace points metadata at those new keys
→ delete old R2 media
→ delete temporary restore objects
```

If D1 commit fails, new final R2 keys are deleted and the previous D1 snapshot remains authoritative.

This is much safer than clearing/replacing each store independently.

## V1 compatibility

The portable backup identifier remains:

`kayworks-world-bible-backup`

It is intentionally not renamed because that string is a compatibility contract, not branding.

V2 can also detect the legacy V1 IndexedDB database named `kayworks_world_bible` on the same origin. It only reads that database for explicit migration and does not delete it.

## Draft recovery

Drafts use a separate database named `unwritten_local_drafts`.

A draft stores:

- entry ID
- current unsaved entity snapshot
- base server `updatedAt`
- local `savedAt`

A draft is auto-recovered only when its base revision still matches the current server entry, avoiding blind overwrites after another device has changed the record.

## Authentication

UnWritten does not implement accounts/passwords.

Cloudflare Access is the authentication boundary. `workers.dev` and preview URLs are disabled to reduce alternate public ingress.

A future defense-in-depth enhancement could validate Access JWT audience/signature in the Worker once the project's Team Domain and Application AUD are intentionally added to deployment configuration. It is not fabricated or hard-coded in V2 because those account-specific values were not supplied.

## Offline behavior

V2 is **not an offline-authoritative application**. The service worker caches only the application shell. API requests bypass Cache Storage and always go to the Worker.

If the network is unavailable, unsaved text can still remain in the local draft cache, but canonical reads/writes require the server.

## Why no framework migration

The existing vanilla UI/domain architecture remains appropriate. The storage boundary changed because the reliability requirement changed; that does not create a reason to rewrite the frontend in React/Vue/TypeScript or introduce a separate application server.
