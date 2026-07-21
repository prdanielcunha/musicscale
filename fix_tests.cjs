const fs = require('fs');
let code = fs.readFileSync('tests/server/curation-approval-service.test.ts', 'utf8');

// The tests must be independent and verify malformed inputs
// I need to add tests for:
// uid numérico; uid objeto; uid somente com espaços;
// normalizedTitle numérico; normalizedTitle objeto;
// contentFingerprint objeto; lyricsFingerprint array;
// snapshot.title numérico; source.organizationId numérico; source.songId objeto;
// externalReferences array; normalizedArtists não array.

