# Connect → MusicScale: Assigned Next-Schedule Chart Read

`GET /api/v1/connect/next-schedule/chart?title=<song>` is the first real chart-content boundary.

Safety rules:

- MusicScale independently revalidates Firebase bearer and organization.
- The caller must have `scales.read` and `songs.read`.
- The selected song must be in the caller's next assigned schedule.
- This slice is deliberately restricted to `X-Connect-Channel: inapp`; WhatsApp/other-channel full chart delivery remains blocked until the channel-rights policy is implemented.
- Raw lyrics are not returned in this slice.
- Automatic transposition is allowed only when the stored chart has a verified `metadata.chordContentKey`.
- If the source key is unverified, the response is `requires_source_key_confirmation` and does not include chord content.
- If the scale has a per-song key override, MusicScale uses its canonical `transposeChordDocument` engine and validates the transposed preview before returning it.
- A failed preview validation returns `transposition_failed` without chord content.
- Cross-tenant songs and songs outside the assigned schedule are indistinguishable from not-found.

This preserves the blueprint rule: no source → no claim. Connect never performs its own production transposition.
