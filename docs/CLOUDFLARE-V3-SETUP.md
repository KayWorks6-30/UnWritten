# Cloudflare Production Setup — V3.5.1

V3 uses the existing single production environment:

- Worker: `unwritten`
- custom domain: `unwritten.kayworks.dev`
- D1: `unwritten` bound as `DB`
- R2: `unwritten` bound as `MEDIA`

Do not create a second hosted dev/staging D1 or R2 resource. Wrangler local resources are the development environment.

## 1. Keep a full ZIP backup

Before production migration/deploy, export the current application's complete ZIP backup and retain it until V3.5 is verified and a fresh V3.5 backup has been exported.

## 2. Configure Access JWT variables

Configure these production Worker variables:

```text
TEAM_DOMAIN=https://<your-team-name>.cloudflareaccess.com
POLICY_AUD=<the Access application's AUD tag>
OWNER_EMAILS=<owner email>[,<another owner email>]
```

To find the AUD tag:

1. Zero Trust → Access controls → Applications.
2. Open the application protecting `unwritten.kayworks.dev`.
3. Open Additional settings.
4. Copy the Application Audience (AUD) Tag.

Do not add a second authentication system. Approved non-owner Access users are read-only Reviewers.

## 3. Apply D1 migrations

From the repository:

```bash
npm install
npm run db:migrate:remote
```

Migrations are cumulative:

- `0002_v3_workspace.sql` adds V3 workspace structures
- `0003_v34_architecture_hardening.sql` upgrades schema 6 → 7 with generated query projections, relationship status, Reveal Part support, `narrative_positions`, and `reference_index`
- `0004_v35_architecture_stabilization.sql` upgrades schema 7 → 8 with generalized revision timestamps, additional indexes, and structural reference/coordinate safety triggers

Existing canonical content is preserved.

## 4. Configure R2 lifecycle rules

Internal prefixes:

- `_restore/` — temporary restore sessions
- `_trash/` — recoverable deleted/superseded media

Recommended policy:

```bash
npx wrangler r2 bucket lifecycle add unwritten unwritten-restore-staging _restore/ --expire-days 1
npx wrangler r2 bucket lifecycle add unwritten unwritten-media-trash _trash/ --expire-days 30
```

## 5. Verify Access / endpoint exposure

`unwritten.kayworks.dev` should remain Access-protected. `workers.dev` and preview URLs remain disabled in `wrangler.jsonc` so they do not create alternate public endpoints.

## 6. Run local/repository verification

```bash
npm run verify
npm run stress
```

`npm run stress` is separate from deploy verification and gives a scale baseline.

## 7. Deploy

```bash
npm run deploy
```

`npm run deploy` runs the repository verification/build before Wrangler deploys.

## 8. Production smoke test

As Owner, verify:

- `/api/health` reports ready, version 3.5.1, your verified email, and role `owner`
- existing lore/story/map data is present
- save/reload an Entity
- stale two-tab edits produce conflict handling instead of silent overwrite
- upload/reload Media and Maps
- Story ordering still handles optional Part and direct Chapters
- global search returns canonical records through server-side query
- Entity Impact returns indexed inbound references
- Settings → Architecture diagnostics shallow check passes
- Deep verify reports SQLite integrity `ok`, no broken narrative positions, and synchronized reverse index
- owner-only reverse-index rebuild completes and verifies
- export a fresh V3.5 ZIP backup

As one approved non-owner Access user, verify:

- browse/search/maps/timeline/continuity/reader views remain available
- edit/create/upload/import/restore/delete/repair actions are unavailable or rejected
- direct mutation/repair API requests receive server-side `403`

## Local development auth

Copy `.dev.vars.example` to `.dev.vars`:

```text
DEV_AUTH_BYPASS=true
DEV_USER_EMAIL=owner@local.test
```

Never configure `DEV_AUTH_BYPASS=true` in production.
