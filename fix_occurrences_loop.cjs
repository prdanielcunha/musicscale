const fs = require('fs');
let code = fs.readFileSync('services/server/curationApprovalService.ts', 'utf8');

const regex = /const sourceOrg = oData\.source\?\.organizationId;\s*const sourceSongId = oData\.source\?\.songId;/;
const replacement = `const sourceOrg = normalizedOptionalString(oData.source?.organizationId, 'source.organizationId', 'OCCURRENCE_SNAPSHOT_INVALID');
                const sourceSongId = normalizedOptionalString(oData.source?.songId, 'source.songId', 'OCCURRENCE_SNAPSHOT_INVALID');`;
code = code.replace(regex, replacement);

fs.writeFileSync('services/server/curationApprovalService.ts', code);
