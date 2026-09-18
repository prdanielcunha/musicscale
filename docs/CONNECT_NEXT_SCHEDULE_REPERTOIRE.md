# Connect → MusicScale: Next Schedule Repertoire Read

This vertical extends the existing authenticated read boundary without moving MusicScale domain ownership into Connect.

## Route

`GET /api/v1/connect/next-schedule/repertoire`

Required transport evidence:

- Firebase bearer (standard Authorization or the existing Connect fallback header);
- `X-Organization-Id`;
- optional locale via `Accept-Language`.

MusicScale independently resolves identity and organization authorization, requires both `scales.read` and `songs.read`, finds the next schedule actually assigned to the caller, and then reads only the songs referenced by that schedule.

## Response

The response contains the assigned schedule reference plus an ordered repertoire projection:

- song id/order;
- title and artist;
- canonical/source key;
- per-scale scheduled key override;
- effective BPM;
- whether chords and lyrics exist.

Raw chord/lyric text is intentionally not returned in this slice. The canonical deep link opens the assigned scale in MusicScale.

The boundary is read-only, tenant-scoped, audited server-side and never trusts roles/capabilities supplied by Connect as authority.
