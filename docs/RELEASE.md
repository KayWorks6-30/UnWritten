# V1.0.0 Release Verification

Completed in the build environment:

- all JavaScript files passed `node --check`
- `npm test`: 17/17 passing
- static build completed with `npm run build`
- index asset references resolve
- JavaScript relative imports resolve
- duplicate HTML ID scan passed
- basic secret/private-key pattern scan passed
- deploy ZIP contains only static runtime files

Browser visual verification could not be completed in the build container because the installed headless Chromium process hangs before returning a rendered DOM. This is an environment limitation, not a claimed pass. Perform a short manual Chrome/mobile smoke test after deployment, especially:

1. create/edit/archive/restore an entry
2. convert an Idea into an Entry
3. create Book → Chapter → Scene hierarchy
4. add a Mystery clue and Reader reveal
5. add a Knowledge record
6. create a Map, add a version, and place a Location marker
7. export JSON and ZIP safety backups
8. confirm mobile dialogs and map/graph horizontal overflow remain usable
