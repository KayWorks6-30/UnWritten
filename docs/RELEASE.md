# V3.1.1 Release Verification

## Character portrait checks

- Open an existing Character and verify the Portrait section is visible.
- Upload a portrait and confirm it appears immediately and also remains in Images & media.
- Attach a second image and use **Use as portrait** to switch the primary portrait without re-uploading.
- Use **Remove as portrait** and confirm the media item remains in the gallery/library.
- Confirm a media item cannot be deleted while it is assigned as a character portrait.
- Export/restore a backup with a character portrait and confirm the portrait reference survives.
- No D1 migration is required for V3.1.1.


## Automated release gate

Run:

```bash
npm run verify
```

The release gate covers:

- domain/schema/search/story/relationship regressions
- backup migration/validation/ZIP integrity
- schema `0` rejection and future-schema rejection
- typed restore references
- multi-node Location/Map cycle rejection
- V3 workspace reference model
- knowledge-at-story-point and reader/character asymmetry
- mystery multi-link/progression behavior
- deterministic continuity warnings
- plot coverage and character interaction derivations
- Cloudflare binding and privacy boundaries
- Worker JWT/reviewer/concurrency/delete/revision/R2-trash hardening assertions
- remote-media and map-zoom regressions
- JS/MJS syntax checks
- clean SQLite migration smoke
- production static build
- asset/import/config checks
- duplicate HTML IDs
- basic committed-secret/private-key scan

## Browser smoke

When the environment permits a local Chromium origin:

```bash
npm run browser:smoke
```

The smoke boots the real browser client against a local HTTP/API fixture and checks Media/Maps rendering with R2-style protected URLs.

If a managed Chromium policy blocks loopback/local test origins, record that as an environment limitation and perform the equivalent local Wrangler browser smoke manually.

## Pre-deploy checklist

1. Export and retain a full production ZIP backup.
2. Confirm `TEAM_DOMAIN`, `POLICY_AUD`, and `OWNER_EMAILS` are configured.
3. Confirm `DEV_AUTH_BYPASS` is not configured in production.
4. Apply `npm run db:migrate:remote`.
5. Configure `_restore/` and `_trash/` R2 lifecycle rules.
6. Run `npm run verify`.
7. Deploy with `npm run deploy`.

## Production acceptance

Owner:

- health endpoint reports `3.1.1`, correct email and `owner`
- old production content still loads
- entity save/reload works
- stale two-browser edit returns a conflict instead of silent overwrite
- previous entity revision appears after edit
- remote media renders after reload
- map zoom, layers, marker drag/search/filter/drill-down work
- backup/export and restore staging work
- Story Compass is optional and does not affect old Series/Trilogy data
- Continuity, Plot Grid, World Tools, Workbench, Reader Preview routes open

Reviewer:

- can browse all intended read surfaces
- cannot mutate data through UI
- direct non-GET API mutation is rejected

Recovery:

- create a fresh V3 ZIP backup after the deployment is proven
- keep the pre-upgrade backup until the release has been used successfully
