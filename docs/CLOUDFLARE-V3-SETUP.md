# Cloudflare Production Setup — V3.0.0

V3 uses the existing single production environment:

- Worker: `unwritten`
- custom domain: `unwritten.kayworks.dev`
- D1: `unwritten` bound as `DB`
- R2: `unwritten` bound as `MEDIA`

Do not create a second hosted dev/staging D1 or R2 resource. Wrangler local resources are the development environment.

## 1. Keep a full ZIP backup

Before production migration/deploy, export the current application's full ZIP backup and retain it until V3 is verified.

## 2. Configure Access JWT variables

In Cloudflare, open the `unwritten` Worker and configure these production variables:

```text
TEAM_DOMAIN=https://<your-team-name>.cloudflareaccess.com
POLICY_AUD=<the Access application's AUD tag>
OWNER_EMAILS=<owner email>[,<another owner email>]
```

To find the AUD tag:

1. Zero Trust → Access controls → Applications.
2. Configure the application protecting `unwritten.kayworks.dev`.
3. Open Additional settings.
4. Copy the Application Audience (AUD) Tag.

Do not add a second login/password system. Approved non-owner Access users automatically become read-only Reviewers.

## 3. Apply D1 migrations

From the repository:

```bash
npm install
npm run db:migrate:remote
```

For a V2 production database, migration `0002_v3_workspace.sql` adds the V3 workspace table and V3 columns while preserving existing content.

## 4. Configure R2 lifecycle rules

V3 uses two internal prefixes:

- `_restore/` — temporary restore sessions
- `_trash/` — recoverable deleted/superseded media

Recommended production policy:

```bash
npx wrangler r2 bucket lifecycle add unwritten unwritten-restore-staging _restore/ --expire-days 1
npx wrangler r2 bucket lifecycle add unwritten unwritten-media-trash _trash/ --expire-days 30
```

The first prevents abandoned restore sessions from living indefinitely. The second creates a modest deleted-media recovery window before permanent R2 expiration.

These are bucket-level rules and only need to be configured once unless the policy changes.

## 5. Verify Access still protects the custom domain

`unwritten.kayworks.dev` should remain an Access-protected hostname/application. `workers.dev` and preview URLs remain disabled in `wrangler.jsonc` so they do not create alternate public endpoints.

## 6. Deploy

```bash
npm run deploy
```

`npm run deploy` executes repository verification/build before Wrangler deploys.

## 7. Production smoke test

After deployment, verify as the Owner:

- `/api/health` reports ready, the verified email, and role `owner`
- existing V2 lore is present
- save an entry and reload it
- upload an image and reload Media/Maps
- map zoom works below 100%
- export a fresh V3 ZIP backup

Then verify with one approved non-owner Access email:

- the user can browse/search/maps/timeline/continuity/reader views
- edit/create/upload/import/restore/delete operations are unavailable in UI
- a direct mutation API request is rejected server-side with `403`

## Local development auth

Copy `.dev.vars.example` to `.dev.vars` and use the local-only bypass:

```text
DEV_AUTH_BYPASS=true
DEV_USER_EMAIL=owner@local.test
```

Never configure `DEV_AUTH_BYPASS=true` in production.
