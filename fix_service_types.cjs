const fs = require('fs');
let code = fs.readFileSync('services/server/curationApprovalService.ts', 'utf8');

const regex1 = /function normalizedOptionalString[\s\S]*?return trimmed\.length > 0 \? trimmed : null;\s*\}/;
const replacement1 = `function normalizedOptionalString(value: unknown, fieldName: string, errorCode: any): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') {
        throw new CurationError(errorCode, 'Campo ' + fieldName + ' possui tipo inválido.', 400);
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}`;
code = code.replace(regex1, replacement1);

// Now I have to replace all calls to normalizedOptionalString to pass fieldName and errorCode.
code = code.replace(/normalizedOptionalString\(decodedToken\?\.uid\)/g, "normalizedOptionalString(decodedToken?.uid, 'uid', 'ACTOR_CONTEXT_MISSING')");
code = code.replace(/normalizedOptionalString\(canonical\.normalizedTitle\)/g, "normalizedOptionalString(canonical.normalizedTitle, 'normalizedTitle', 'CANONICAL_IDENTITY_INVALID')");
code = code.replace(/normalizedOptionalString\(a\)/g, "normalizedOptionalString(a, 'normalizedArtists item', 'CANONICAL_IDENTITY_INVALID')");
code = code.replace(/normalizedOptionalString\(canonical\.lyricsFingerprint\)/g, "normalizedOptionalString(canonical.lyricsFingerprint, 'lyricsFingerprint', 'CANONICAL_IDENTITY_INVALID')");
code = code.replace(/normalizedOptionalString\(canonical\.contentFingerprint\)/g, "normalizedOptionalString(canonical.contentFingerprint, 'contentFingerprint', 'CANONICAL_IDENTITY_INVALID')");
code = code.replace(/normalizedOptionalString\(reservationId\)/g, "normalizedOptionalString(reservationId, 'reservationId', 'CANONICAL_IDENTITY_INVALID')");
code = code.replace(/normalizedOptionalString\(snapshot\.title\)/g, "normalizedOptionalString(snapshot.title, 'snapshot.title', 'OCCURRENCE_SNAPSHOT_INVALID')");
code = code.replace(/normalizedOptionalString\(canonical\.normalizedLyrics\)/g, "normalizedOptionalString(canonical.normalizedLyrics, 'normalizedLyrics', 'CANONICAL_IDENTITY_INVALID')");
code = code.replace(/normalizedOptionalString\(canonical\.openingLyrics\)/g, "normalizedOptionalString(canonical.openingLyrics, 'openingLyrics', 'CANONICAL_IDENTITY_INVALID')");
code = code.replace(/normalizedOptionalString\(canonical\.chorusLyrics\)/g, "normalizedOptionalString(canonical.chorusLyrics, 'chorusLyrics', 'CANONICAL_IDENTITY_INVALID')");

const extRefRegex = /canonical\.externalReferences && typeof canonical\.externalReferences === "object" \? canonical\.externalReferences : \{\}/;
const extRefRep = `(canonical.externalReferences ? (typeof canonical.externalReferences === "object" && !Array.isArray(canonical.externalReferences) ? canonical.externalReferences : (() => { throw new CurationError('CANONICAL_IDENTITY_INVALID', 'externalReferences invalido', 400) })()) : {})`;
code = code.replace(extRefRegex, extRefRep);

fs.writeFileSync('services/server/curationApprovalService.ts', code);
