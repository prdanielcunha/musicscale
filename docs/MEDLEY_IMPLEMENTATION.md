# Medleys — implementation status

The scale keeps `songIds` as a unique, backward compatible projection for scheduling, notifications and lookup. An optional `medleys` array contains approved excerpts with independent step IDs, source revision, exact text snapshot, associated tablature and transitions. A medley can use A → B → A without duplicating `songIds`.

The editor offers explicit sections, paragraphs, whole songs and manual line ranges. It preserves source whitespace and line endings. Library edits do not mutate an approved snapshot; an editor compares the saved and current content before accepting a refresh. The scale command service verifies every referenced song against the active organization and source content in the publication transaction. Previously published excerpts may retain their approved snapshot after a library edit. The total medley snapshot payload is limited to 400 KB per scale.

The scale detail exposes an independent, read-only stage reader from approved snapshots. It has keyboard and touch controls and does not cause audio changes on scrolling or advancing. The existing offline stage cache carries the snapshots with the scale.

Validation on this branch: TypeScript check passed, production Vite/server bundle passed with the `node --import tsx` entrypoint, 1,696 UI/unit tests passed, and 105 scale/security tests passed with Firebase Auth/Firestore emulators using Firebase Tools 14 on Java 17. The installed Firebase Tools 15 requires Java 21. The current scope has not been verified on physical devices or published.

## Remaining gates before production

- Make the composed item the canonical repertoire unit across all schedule cards, search, export, sharing, notifications and the existing Performance reader. The current `songIds` projection still has consumers that treat every referenced song as a separate performed item.
- Integrate `itemId`/`stepId`, revision and monotonic sequence into shared Live Worship conductor state; verify reconnect, follower opt-out and published revision pinning.
- Add reusable organization templates and the authorized tenant-scoped model. The current arrangement exists only in an individual scale.
- Add deterministic transition suggestions and safe per-step key/BPM handling. Pad and metronome control must be tied to the authorized playback device and explicit transition action. Optional server-only AI segmentation needs bounds, caching and measured costs.
- Implement presentation export and external integration safeguards.
- Exercise the complete route on actual iPhone, Android and desktop browsers, with and without connectivity, including old scales, clone, edition and republish. Validate accessibility and external chart/link behavior.

The code in this branch is an initial implementation, not a production-ready completion of the roadmap. Do not merge into `production` until these gates are met.
