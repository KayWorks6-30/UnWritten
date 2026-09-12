# Cloudflare Production Setup — V2.0.0

This project uses **one production environment only**.

## Existing resources

- D1 database name: `unwritten`
- D1 database ID: `15ab3fb3-8673-4f5b-8633-1746fb6fa677`
- R2 bucket name: `unwritten`
- Worker name: `unwritten`
- Production hostname: `unwritten.kayworks.dev`

No development D1 database, R2 bucket, or hosted dev site is used.

Local development uses Wrangler's local simulated bindings.

## Bindings

`wrangler.jsonc` is the source of truth:

```text
DB    → D1 unwritten
MEDIA → R2 unwritten
```

No R2 S3 API credentials are needed.

## Required first deployment sequence

```bash
npx wrangler login
npm run db:migrate:remote
npm run deploy
```

## Cloudflare Access

Keep `unwritten.kayworks.dev` behind the existing Access policy that allows only the author.

V2 sets:

```text
workers_dev = false
preview_urls = false
```

so the normal Wrangler deployment does not also publish alternate `workers.dev`/preview endpoints.

Cloudflare also supports protecting the Worker itself across its domains from the Workers dashboard. That can be used as additional route-management hardening, but the existing protected custom hostname remains the required production boundary.

## Existing Pages deployment

If the hostname is currently attached to Cloudflare Pages, remove `unwritten.kayworks.dev` from the Pages project's custom domains before the V2 Worker deployment. V2's Worker Custom Domain becomes the origin for that hostname.

Do not delete the old Pages project until V2 has been verified if you want an easy rollback of the static application code.

## D1 migrations

Schema files are versioned in `migrations/` and tracked by D1's migrations table.

Do not manually create/edit production tables through the dashboard for normal development. Add a migration to the repository and apply it through Wrangler instead.

## R2 privacy

Keep the `unwritten` bucket private:

- no `r2.dev` public access
- no public R2 custom domain
- no browser-embedded S3 credentials

Media is streamed through the Access-protected Worker.
