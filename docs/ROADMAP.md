# Roadmap Status — V1.0.0

The original V0.1 future roadmap is complete through the local/offline feature set.

## Foundation — complete

- IndexedDB local database
- typed lore/story/planning entries
- canon status model
- author/in-world/reader knowledge layers
- structured relationships
- global and section search
- media reuse
- JSON backup/restore
- responsive desktop/mobile application shell

## Authoring Workflow — complete

- Idea → Entry conversion
- structured Parent Location picker
- Book → Chapter and Chapter → Scene parent helpers
- mystery clue subrecords linked to chapters/scenes
- dedicated Trilogy Overview working view
- reader-reveal records with Book/Chapter/Scene links
- separate recent-created/recent-edited Dashboard sections
- soft archive before permanent deletion

## Timeline & Maps — complete

- display date + sortable start/end + uncertainty model
- era bands and era/certainty filters
- Map records
- map image version/history
- marker placement against stable Location IDs
- political/physical/historical/exploration/ancient/current variants

## Visualization & Portability — complete

- character/reader knowledge records and graph
- family tree visualization
- relationship graph
- reveal/foreshadowing visualization
- ZIP backup/restore
- Markdown export

## Conditional future work — not currently justified

### Encrypted cross-device sync

Only consider this if maintaining a single authoritative browser/origin becomes a real constraint.

A safe implementation would require a new architecture phase covering:

- authentication and authorization
- remote storage threat model
- end-to-end encryption/key management
- conflict detection/resolution
- offline-first synchronization semantics
- recovery when a key/device is lost
- private deployment and operational backup

Do not add a server simply to mark the roadmap as larger. V1.0.0 is considered the completed local-first product baseline.

## Future improvements should be usage-driven

After real authoring use, prioritize observed friction rather than predetermined feature expansion. Reasonable examples could include stronger full-text indexing at very large scale, editor keyboard shortcuts, bulk edits, richer Markdown packages, graph filtering, or map drawing tools—but only when the actual workflow demonstrates a need.
