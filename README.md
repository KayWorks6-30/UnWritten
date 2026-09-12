# UnWritten.KayWorks — V2.0.0

A private author workspace for worldbuilding, story planning, visual maps, mysteries, historical timelines, knowledge tracking, and long-term canon management.

V2 is the storage transition release. The V1 authoring model and atlas remain intact, but **saved canon is no longer browser-only**:

- Cloudflare **D1** is the authoritative structured database.
- Private Cloudflare **R2** stores maps, character art, diagrams, and other uploaded media.
- Cloudflare **Access** remains the authentication/front-door layer.
- Browser **IndexedDB is used only for temporary unsaved drafts and read-only V1 migration detection**.
- JSON, ZIP, and Markdown exports remain available so the project is not trapped in Cloudflare.

## Production resources already configured

The repository is wired to the production resources requested for this project:

- Worker name: `unwritten`
- Production hostname: `unwritten.kayworks.dev`
- D1 database: `unwritten`
- D1 database ID: `15ab3fb3-8673-4f5b-8633-1746fb6fa677`
- D1 binding: `DB`
- R2 bucket: `unwritten`
- R2 binding: `MEDIA`
- `workers.dev`: disabled
- Worker preview URLs: disabled

The D1 UUID and R2 bucket name are resource identifiers, not credentials. No API key, R2 S3 key, database password, or secret is stored in the frontend.

## Architecture

```text
Cloudflare Access
      │
      ▼
unwritten.kayworks.dev
      │
      ▼
Cloudflare Worker: unwritten
      │
      ├── Static assets (vanilla HTML/CSS/JS)
      ├── /api/*
      │      ├── DB    → D1 unwritten
      │      └── MEDIA → private R2 unwritten
      │
Browser
      └── IndexedDB only for unsaved draft recovery
```

The browser never receives D1 or R2 credentials. All authoritative writes happen through same-origin Worker API routes.

## First production deployment

### 1. Keep a V1 backup first

If the current V1 site contains any real data, **export a V1 ZIP backup before replacing the deployed V1 files**.

V2 still understands the V1 backup format, and a same-origin V1 IndexedDB database can also be detected from V2 Settings for direct migration.

### 2. Authenticate Wrangler

From this repository:

```bash
npx wrangler login
```

### 3. Apply the D1 migration

The `unwritten` D1 database already exists, but it is intentionally empty until this migration is applied:

```bash
npm run db:migrate:remote
```

This applies `migrations/0001_initial.sql` to the production D1 database.

### 4. Deploy V2

```bash
npm run deploy
```

`npm run deploy` runs the complete verification/build first and then deploys the Worker plus static assets.

The Worker configuration in `wrangler.jsonc` binds:

```text
DB    → D1 unwritten
MEDIA → R2 unwritten
```

### 5. Confirm Cloudflare Access

The hostname `unwritten.kayworks.dev` must remain protected by your Cloudflare Access policy.

This repository intentionally disables `workers.dev` and preview URLs so those do not create alternate public routes around the protected production hostname.

If `unwritten.kayworks.dev` is still attached to an old Cloudflare Pages project, remove that custom-domain attachment before the first Worker Custom Domain deployment. The Worker is now the origin for the hostname.

### 6. Open Settings & Data

The Cloud Storage card should show **Connected**.

If the D1 migration was not applied, the app intentionally stops on a Storage Setup Required screen rather than silently falling back to browser-only data.

## Migrating V1 data

V2 supports two migration paths.

### Same browser + same hostname

If the old V1 IndexedDB still exists, Settings & Data shows **V1 browser migration**.

Choose **Import V1 browser database**. V2 reads the legacy database without modifying it, validates the snapshot, uploads its media to R2, and atomically replaces the structured D1 dataset.

The V1 browser database is retained afterward as an extra safety copy.

### V1 JSON or ZIP

Use **Restore JSON / ZIP** in Settings & Data.

The existing `kayworks-world-bible-backup` format remains supported. ZIP remains preferred for projects with substantial media.

## Restore behavior in V2

Restores use a staged server workflow:

1. Parse/migrate/validate the complete manifest.
2. Create a temporary restore session in private R2.
3. Upload each media file separately.
4. Verify every expected media file exists.
5. Write the complete D1 structured snapshot in one transactional `DB.batch()`.
6. Switch media metadata to newly written R2 objects.
7. Remove superseded R2 objects and temporary restore files.

If the D1 transaction fails, the previous structured database remains unchanged and newly staged final objects are cleaned up.

Restore remains **replace-only**, not merge, to keep recovery semantics deterministic.

## Normal save behavior

Entry save:

```text
Editor
→ /api/store/entities/:id
→ Worker validation
→ D1
```

Media save:

```text
File picker
→ /api/media/:id
→ Worker
→ private R2 object
→ D1 media metadata
```

Map versions continue linking stable Map/Location IDs to media metadata rather than embedding map images in entity records.

## Local draft recovery

While an entry editor is open, unsaved text is cached locally in a separate IndexedDB database.

That cache is **not canonical storage**. It exists only to recover accidental refreshes/tab closes before Save.

Saved entries are removed from the draft cache after the D1 write succeeds.

## Local development

There is still only one Cloudflare production environment. Development uses Wrangler's local resource simulation rather than a second hosted site/database/bucket.

First initialize local D1:

```bash
npm run db:migrate:local
```

Then run:

```bash
npm run dev
```

Wrangler uses local simulated D1/R2 storage by default for local development, so normal development does not write to the production `unwritten` resources.

## Verification

```bash
npm run verify
```

V2 verification includes:

- domain/schema regression tests
- backup/ZIP validation tests
- V2 Cloudflare binding tests
- D1 migration/table checks
- remote-vs-local persistence-boundary checks
- API service-worker cache protection
- JS import checks
- static asset checks
- duplicate HTML ID check
- basic committed-secret/private-key scan
- production static build

## Important privacy boundary

Cloudflare D1/R2 being private resources does **not** by itself authenticate visitors to the Worker. Keep Cloudflare Access enabled on the production Worker/hostname.

This repository does not contain a second username/password system.

## Portability

Even though D1/R2 are authoritative in V2, the application still supports:

- full JSON backup
- full ZIP backup with binary media
- restore from JSON/ZIP
- Markdown export
- V1 backup import

The goal is safer authoritative storage without turning the author's work into an opaque hosted-only format.
