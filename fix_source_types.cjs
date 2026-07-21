const fs = require('fs');
let code = fs.readFileSync('services/server/curationApprovalService.ts', 'utf8');

const regex2 = /if \(occData\.source\) \{\s*if \(occData\.source\.organizationId && typeof occData\.source\.organizationId !== 'string'\) \{\s*throw new CurationError\('OCCURRENCE_SNAPSHOT_INVALID', 'organizationId do source inválido\.', 400\);\s*\}\s*if \(occData\.source\.songId && typeof occData\.source\.songId !== 'string'\) \{\s*throw new CurationError\('OCCURRENCE_SNAPSHOT_INVALID', 'songId do source inválido\.', 400\);\s*\}\s*\}/;

const replacement2 = `if (occData.source) {
                normalizedOptionalString(occData.source.organizationId, 'source.organizationId', 'OCCURRENCE_SNAPSHOT_INVALID');
                normalizedOptionalString(occData.source.songId, 'source.songId', 'OCCURRENCE_SNAPSHOT_INVALID');
            }`;
code = code.replace(regex2, replacement2);

const regex3 = /const normArtistsArray = Array\.isArray\(canonical\.normalizedArtists\) \? canonical\.normalizedArtists : \[\];\s*const normArtists = normArtistsArray\.filter\(\(a: any\) => normalizedOptionalString\(a, 'normalizedArtists item', 'CANONICAL_IDENTITY_INVALID'\) !== null\)\.map\(\(a: any\) => a\.trim\(\)\);/;
const replacement3 = `if (canonical.normalizedArtists !== undefined && !Array.isArray(canonical.normalizedArtists)) {
                throw new CurationError('CANONICAL_IDENTITY_INVALID', 'normalizedArtists deve ser um array.', 400);
            }
            const normArtistsArray = Array.isArray(canonical.normalizedArtists) ? canonical.normalizedArtists : [];
            const normArtists = normArtistsArray.filter((a: any) => normalizedOptionalString(a, 'normalizedArtists item', 'CANONICAL_IDENTITY_INVALID') !== null).map((a: any) => a.trim());`;
code = code.replace(regex3, replacement3);

fs.writeFileSync('services/server/curationApprovalService.ts', code);
