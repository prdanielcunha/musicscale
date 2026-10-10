# MusicScale — Medley Studio 2.0 (isolated rollout)

Checkpoint: 2026-10-10. Base ref: main at `f169d8b87e105f46f64b6e830b4265f2ba527209`. Work branch: `chatgpt/medley-studio-v2-isolated-20261010`.

## Customer safety / invariants

- The new editor is **OFF by default**. Only `musicscale.medleyStudioV2 === true` in an existing, authorized organization featureFlags/features object switches the view. No flag-writing or permission-changing code is included.
- Existing MedleyComposer, ScaleMedley/MedleyExcerpt, MusicRepository, APIs, publication validator, Firestore rules, memberships, organizations, roles, billing, auth, scales, bands, stage and offline persistence remain unchanged.
- When enabled, the new editor uses **only** the existing scale-draft callback. It does not directly write to Firestore. Saving/publishing the scale must still pass its canonical server-side validator.
- Original charts, tabs and other songs are never mutated. Each excerpt includes its original snapshot/source revision; stale source revision is blocked until a user explicitly compares and approves re-snapshotting.
- 1–8 repetitions and up to 30 excerpts honor the **existing** production validator. The proposed 1–16 repetitions cannot go live before a separately reviewed and tested backward-compatible API/server contract. This is intentional.
- No new schema, migration, claims, Roles, entitlements, IAM, automatic writes, or rollout to existing customers.

## Added feature-isolated implementation

- `utils/medleyStudioV2.ts`: typed editing draft, reorder/clone and non-destructive adapter to existing saved ScaleMedley.
- `utils/medleyStudioHarmony.ts`: deterministic, strictly advisory musical sketches based on chords recognized in selected snippets. Human inspection is required; no AI API or audio costs.
- `components/scales/MedleyStudioV2.tsx`: responsive three-column editing surface (stacked on narrow devices), sequence, selection, section/line editing, duplication, move up/down, undo/redo, previews, suggestions, legacy template save and explicit confirmation of source changes.
- `components/scales/MusicBuilder.tsx`: feature-flagged studio (legacy UI still default), full authorized catalog, append-only selection projection (never discards existing scale repertoire).
- `pages/SongsPage.tsx` + `components/songs/SongDetailModal.tsx`: new repertoire and song-level entry points, hidden when the organization flag is off; explicit saving uses the EXISTING organization-scoped `medleyTemplates` service, never alters published scales.
- `components/scales/MedleyStudioV2.tsx`: human-confirmed bridge suggestion can be added as an editable **cue** in the existing safe transition field, not a guessed rewrite of chord charts.
- `utils/medleyStudioDraft.ts`: bounded session-only recovery of IDs and editing controls, scoped by user, organization and scale; no source chart snapshots, passwords, tokens or memberships stored.
- `locales/pt.json`, `locales/en.json`, `locales/es.json`: new strings only.

## Not yet implemented / DO NOT enable flag or release

The complete master plan is broader than this isolated increment. The scale-wide picker, repertoire entry and song-level action have been added. The current scale `ScaleMedley` snapshot + revision format is already read by the existing Performance Mode/offline reader, so this increment intentionally reuses that established compatibility layer rather than deploying an unverified v2 collection or destructive migration. A tab-session-scoped editing draft can be explicitly recovered. Remaining gates: robust multi-device draft conflict/revision protocol, structured editable multi-bar harmony beyond cue text, musical corpus validation, full emulator authorization/E2E QA, real-device accessibility and visual QA, backup/restore rehearsal, deployed SHA verification and production smoke test.

In particular, the suggestions here are **advisory sketches**, not proven instrument- or genre-specific bridges; they never overwrite the musician's manual passage. The unchanged production validator controls the saved arrangement.

## Release gate

1. Audit any other work concurrently changing `main`/`production`. They currently have divergent histories and content; do not blindly merge or overwrite either.
2. Run `npm run lint`, `npm run test:ui`, `npm run build`, `npm run test:e2e`, security emulator and release tests on the exact candidate SHA, plus PT/EN/ES and iOS/Android/iPad real-device QA.
3. Verify **all** changes and existing scale/member/tenant/auth/AI/role/purchase regressions, with zero new failures.
4. Merge isolated PR only with green checks and no drift, keeping flag off. Activation is a separate gated release.
5. After an approved main candidate and a reviewed safe reconciliation of both branches, verify Firebase Hosting/Cloud Run (not Vercel), exact deployed SHA and monitored production smoke; rollback only by flag/build, never by deleting customer data.
