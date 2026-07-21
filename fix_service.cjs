const fs = require('fs');
let code = fs.readFileSync('services/server/curationApprovalService.ts', 'utf8');

const regex1 = /export interface CurationApprovalDependencies \{/;
const replacement1 = `function normalizedOptionalString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export interface CurationApprovalDependencies {`;

code = code.replace(regex1, replacement1);

const regexAuth = /if \(!decodedToken \|\| !decodedToken\.uid\) \{\s+throw new CurationError\('UNAUTHORIZED', 'Contexto de usuário \(ator\) ausente\.', 401\);\s+\}/;
const replacementAuth = `const safeUid = normalizedOptionalString(decodedToken?.uid);
        if (!decodedToken || !safeUid) {
            throw new CurationError('ACTOR_CONTEXT_MISSING', 'Contexto de usuário (ator) ausente.', 401);
        }`;
code = code.replace(regexAuth, replacementAuth);

const regexTitles = /const normTitle = canonical\.normalizedTitle\?\.trim\(\) \|\| '';[\s\S]*?const fLyrics = canonical\.lyricsFingerprint\?\.trim\(\) \|\| '';\s+const fContent = canonical\.contentFingerprint\?\.trim\(\) \|\| '';/;
const replacementTitles = `const normTitle = normalizedOptionalString(canonical.normalizedTitle) || '';
            const normArtistsArray = Array.isArray(canonical.normalizedArtists) ? canonical.normalizedArtists : [];
            const normArtists = normArtistsArray.filter((a: any) => normalizedOptionalString(a) !== null).map((a: any) => a.trim());
            
            const fLyrics = normalizedOptionalString(canonical.lyricsFingerprint) || '';
            const fContent = normalizedOptionalString(canonical.contentFingerprint) || '';`;
code = code.replace(regexTitles, replacementTitles);

const regexReserv = /if \(!reservationId \|\| reservationId === '_' \|\| reservationId\.trim\(\) === ''\) \{/;
const replacementReserv = `if (!normalizedOptionalString(reservationId) || reservationId === '_') {`;
code = code.replace(regexReserv, replacementReserv);

const regexOcc = /if \(!snapshot\.title \|\| typeof snapshot\.title !== 'string' \|\| snapshot\.title\.trim\(\) === ''\) \{/;
const replacementOcc = `if (!normalizedOptionalString(snapshot.title)) {`;
code = code.replace(regexOcc, replacementOcc);

const regexCan = /normalizedLyrics: typeof canonical\.normalizedLyrics === 'string' \? canonical\.normalizedLyrics : null,\s+openingLyrics: typeof canonical\.openingLyrics === 'string' \? canonical\.openingLyrics : null,\s+chorusLyrics: typeof canonical\.chorusLyrics === 'string' \? canonical\.chorusLyrics : null,/;
const replacementCan = `normalizedLyrics: normalizedOptionalString(canonical.normalizedLyrics),\n                openingLyrics: normalizedOptionalString(canonical.openingLyrics),\n                chorusLyrics: normalizedOptionalString(canonical.chorusLyrics),`;
code = code.replace(regexCan, replacementCan);

fs.writeFileSync('services/server/curationApprovalService.ts', code);
