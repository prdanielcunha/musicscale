const fs = require('fs');

let code = fs.readFileSync('tests/server/music-scale-command-service.test.ts', 'utf8');

code = code.replace(`} catch (e: unknown) {\n            const error = e as Error;\n            if (error && error.message === "TRANSIENT_ERROR") {\n                // Retry\n                continue;\n            }\n            reject(e);\n            return;\n          }`, `} catch (e: any) {\n            if (e.message === "TRANSIENT_ERROR") {\n                continue;\n            }\n            reject(e);\n            return;\n          }`);

fs.writeFileSync('tests/server/music-scale-command-service.test.ts', code);

let bandCode = fs.readFileSync('services/server/bandScale/bandScaleCommandService.ts', 'utf8');
bandCode = bandCode.replace(`const responsesCount = diff.created.length + diff.updated.length + diff.removed.length;`, `// Reconcile assignments\n      const existingAssignments = currentScale.assignments || [];\n      const reconciled = AssignmentNormalizer.reconcile(existingAssignments, rawAssignments, scaleId);\n      \n      // Perform Diff\n      const diff = AssignmentDiffService.diff(existingAssignments, reconciled);\n\n      const responsesCount = diff.created.length + diff.updated.length + diff.removed.length;`);
fs.writeFileSync('services/server/bandScale/bandScaleCommandService.ts', bandCode);

