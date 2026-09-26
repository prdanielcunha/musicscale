# Medleys — implementation status

The scale keeps `songIds` as a unique, backward compatible projection for scheduling, notifications and lookup. An optional `medleys` array contains approved excerpts with independent step IDs, source revision, exact text snapshot, associated tablature and transitions. A medley can use A → B → A without duplicating `songIds`.

The editor offers explicit sections, paragraphs, whole songs and manual line ranges. It preserves source whitespace and line endings. Library edits do not mutate an approved snapshot; an editor compares the saved and current content before accepting a refresh. The scale command service verifies every referenced song against the active organization and source content in the publication transaction. Previously published excerpts may retain their approved snapshot after a library edit. The total medley snapshot payload is limited to 400 KB per scale.

The scale detail exposes an independent, read-only stage reader from approved snapshots. It has keyboard and touch controls and a direct excerpt jump. Local pad and metronome must be opened and started explicitly; advancing to another excerpt unmounts them, stopping audio. The existing offline stage cache carries the snapshots with the scale. A script-free, self-contained HTML presentation exports the same approved arrangement and tabs. External Connect chart reads of a medley member return a schedule deep link rather than incorrectly returning the mutable source song chart.

The UI groups each medley into one scheduled repertoire item while retaining unique `songIds` for legacy consumers. The editor supports organization-scoped reusable templates; applying one adds missing song IDs and requires review when its source revisions changed. Stage direction pins to a published scale revision and broadcasts medley/step IDs, repetition and monotonic sequence. A follower can opt out and navigate locally. Transition suggestions compare known keys and tempos but never alter audio or the approved chart. Per-excerpt BPM can be edited independently. A different performance key requires a verified source key; rendering transposes only chord text, retaining the exact approved source snapshot. Major/minor mode changes and attached tabs are blocked rather than guessed.

Validation must be rerun after every change. Firebase Tools 14 works with the available Java 17; the installed Firebase Tools 15 requires Java 21. No physical-device acceptance has yet been performed.

## Remaining gates before production

- Confirm that remaining legacy consumers (notifications, search and the standalone Performance reader) do not present an excerpt as an independent performed item. The `songIds` projection remains intentionally unique for assignment and compatibility.
- Run live direction reconnect, follower opt-out, conductor race and offline-to-online scenarios with real devices and accounts. Firestore rules validate tenant, actor and revision; the trusted manager client validates the step membership transactionally.
- Test pad/metronome output devices and transitions with real audio hardware. Automatic pad retuning is deliberately absent; there is no silent playback transition.
- Optional AI segmentation is not enabled: deterministic local section suggestions already work without sending copyrighted repertoire to an AI provider or incurring unbounded costs.
- Exercise the complete route on actual iPhone, Android and desktop browsers, with and without connectivity, including old scales, clone, edition and republish. Validate accessibility and external chart/link behavior. Obtain release approval and CI evidence before production promotion.

Do not merge into `production` until these gates are met.
