const fs = require('fs');

let code = fs.readFileSync('services/server/bandScale/bandScaleCommandService.ts', 'utf8');

code = code.replace(`const rawAssignments = payload.assignments || [];`, `const rawAssignments: any[] = Array.isArray(payload.assignments) ? payload.assignments : [];`);
code = code.replace(`const rawAssignments = payload.assignments || [];`, `const rawAssignments: any[] = Array.isArray(payload.assignments) ? payload.assignments : [];`);

fs.writeFileSync('services/server/bandScale/bandScaleCommandService.ts', code);
