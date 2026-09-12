# V1.1.0 Release Verification

## Automated checks completed in this build environment

- all JavaScript source files pass `node --check`
- `npm test`: **25/25 passing**
- `npm run build` succeeds
- `npm run verify` checks tests/build plus static asset/import references, duplicate HTML IDs, and basic secret/private-key patterns
- ZIP corruption regression test verifies CRC rejection
- backup validation regressions cover future schemas, invalid relationships, bad hierarchy IDs, and missing map media
- deploy ZIP and full-repo ZIP are integrity-tested before handoff

## Browser IndexedDB integration harness

The repository includes `npm run test:browser`, which exercises:

1. real IndexedDB writes
2. JSON backup including a Blob
3. replacement with different data
4. JSON restore back to the original data
5. media Blob recovery
6. failed multi-store transaction rollback
7. unsupported-future-schema rejection without changing the database

The managed Chromium installed in this build container blocks both localhost and `file:` pages by organization policy, so that harness **could not be executed here**. This is recorded as unverified rather than claimed as a pass. Run `npm run test:browser` in a normal local Chrome/Chromium environment.

## Manual smoke test after deployment

1. Create/edit/archive/restore an entry.
2. Archive a parent Book/Location and edit its child; confirm the archived parent remains selected.
3. Confirm an existing entry cannot change type.
4. Create `World → Continent → Kingdom` Location hierarchy.
5. From the World Location choose **Map this location**, save the Map, and upload a world-map image.
6. Pin the Kingdom on the world map.
7. Create a scoped Kingdom Map whose Parent / Overview Map is the world map.
8. Click the Kingdom pin on the world map and confirm it drills into the Kingdom Map.
9. Test Fit / zoom controls and location-lore fallback for a pin without a child map.
10. Confirm map-version images cannot be deleted directly from Media.
11. Delete a Map Version and confirm its markers disappear.
12. Export JSON and ZIP safety backups; restore them on a disposable browser profile/origin before relying on them as the sole recovery copy.
13. Check phone and desktop layouts, especially map scrolling/zoom and editor dialogs.
