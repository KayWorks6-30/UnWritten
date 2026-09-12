# V2.0.0 Release Verification

## Automated checks

Run:

```bash
npm run verify
```

V2 currently passes 33 automated Node tests covering the established domain behavior plus Cloudflare binding/storage-boundary regressions.

The release verification also checks:

- JS source syntax/import targets
- HTML asset references
- duplicate HTML IDs
- exact production D1 binding name/database UUID
- exact production R2 binding name/bucket
- `workers.dev` and preview URLs disabled
- D1 migration includes all authoritative tables
- service worker excludes `/api/*` from Cache Storage
- basic committed-secret/private-key markers
- static asset build

The initial migration SQL has also been smoke-tested against SQLite successfully.

## Required live Cloudflare smoke test

These cannot be truthfully verified inside the build container because it has no authenticated access to the user's Cloudflare account/resources.

After first deployment:

1. Confirm Access login is required at `unwritten.kayworks.dev`.
2. Confirm Settings & Data shows Cloud Storage: Connected.
3. Create one temporary Lore entry and reload the page.
4. Confirm it survives reload and appears from a second browser session after Access login.
5. Upload one temporary image; confirm it renders after reload.
6. Create a temporary map using that image and place a location marker.
7. Export ZIP.
8. Create another temporary record.
9. Restore the ZIP and confirm the post-backup record disappears while backed-up records/media return.
10. If migrating V1, verify record/media counts against the V1 backup before starting serious authoring.
11. Delete all temporary smoke-test entries/media you do not want retained.

## Rollback posture

Keep:

- the final V1.1.x ZIP backup
- the V1.1.1 repository/release
- the first successful V2 ZIP backup

D1 also provides Cloudflare-managed recovery capabilities, but portable exports remain part of the project's recovery strategy.
