const fs = require('fs');

let code = fs.readFileSync('services/server/bandScale/bandScaleCommandService.ts', 'utf8');

code = code.replace(`const existingAssignments = currentScale.assignments || [];`, `const existingAssignments: any[] = Array.isArray(currentScale.assignments) ? currentScale.assignments : [];`);
code = code.replace(`const existingAssignments = currentScale.assignments || [];`, `const existingAssignments: any[] = Array.isArray(currentScale.assignments) ? currentScale.assignments : [];`); // in case there's multiple

fs.writeFileSync('services/server/bandScale/bandScaleCommandService.ts', code);

let uiCode = fs.readFileSync('tests/ui/music-scale-publish-integrity.test.tsx', 'utf8');
uiCode = uiCode.replace(`vi.mock('../../contexts/EcosystemContext', () => ({\n  useEcosystem: () => ({\n    organization: {\n      id: 'org-1',\n      get featureFlags() {\n        return { 'musicscale.musicScalePublishCommandV1': currentFlag };\n      },\n      get features() {\n        return { 'musicscale.musicScalePublishCommandV1': currentFlag };\n      }\n    }\n  }),\n}));`, `let currentFlag = true;\nvi.mock('../../contexts/EcosystemContext', () => ({\n  useEcosystem: () => ({\n    organization: {\n      id: 'org-1',\n      get featureFlags() {\n        return { 'musicscale.musicScalePublishCommandV1': currentFlag };\n      },\n      get features() {\n        return { 'musicscale.musicScalePublishCommandV1': currentFlag };\n      }\n    }\n  }),\n}));`);
fs.writeFileSync('tests/ui/music-scale-publish-integrity.test.tsx', uiCode);
