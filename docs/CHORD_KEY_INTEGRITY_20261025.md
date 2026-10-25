# Chart key integrity and performance key persistence (2026-10-25)

Version: 0.11.2-beta.4. No customer-data migration, permission, billing, Rules, Functions, or infrastructure changes.

## Behavior

- Transposing a performance chart exposes Save, with separate scale/repertoire destinations according to existing capabilities. A scale write changes only `songSettings/{songId}/key`; BPM, other songs and the repertoire remain intact. A repertoire write atomically updates key, selectedKey, chart text and chordContentKey from the canonical organization song. Existing explicit scale keys and original/import provenance remain intact.
- Firestore transactions re-read organization ownership, scale membership, chart text and expected keys. Existing Firestore Rules authorize writes. Stale content and denied/offline transactions retain the unsaved UI and surface an error.
- Display adaptation uses explicit chart-content metadata before the selected-key fallback and updates only the display copy's metadata, making repeated scale adaptation idempotent. Capo is never applied again to normalized concert-pitch content.
- Strong source-key conflicts and unconfirmed shape-only provenance require the existing key-review flow before repertoire replacement. No probabilistic inference rewrites stored songs.
- The chart workspace offers an on-demand, read-only repertoire key check. Results are possible mismatches, not a claim that borrowed harmony, secondary dominants, modulations, or a particular arrangement are incorrect.
- Musical token mapping preserves lyric words A/E/Em, handles attached ChordPro markers, extension/slash chords and section headers with chords. Preview validation compares invariant text/spacing plus the expected transposition of each musical token.
- AI repair now uses the existing App Check + Firebase identity helper. It includes written/performance key and capo context, requests preservation of arrangement/lyrics, validates response shape, and returns a draft for explicit Save. Network, access and usage failures preserve the editor. Shared chord-save errors propagate instead of reporting success.

## Validation

New regression coverage exercises both persistence destinations, returning to a previously saved key, permission-limited UI, failure retention, tenant/stale-data rejection, minor/capo behavior, source conflicts, lyric preservation and the authenticated AI request.

Local `npm run lint` passed. Final complete Vitest: 264 files passed, 8 skipped; 2,124 tests passed and 174 skipped (emulator-dependent suites remain gated). New behavioral tests include both save destinations, failed writes, and saving again after returning to the initial key.

The local `npm run build` wrapper cannot create tsx's IPC socket (`EPERM`). Its exact materialization, Vite, esbuild and brand-validation stages pass when TypeScript scripts are executed through `node --import tsx`, without changing repository scripts or dependencies. Physical-browser and emulator QA remain the responsibility of the existing GitHub workflow before production promotion. A repository PR is not proof of deployment.
