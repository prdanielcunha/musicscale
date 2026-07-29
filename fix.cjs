const fs = require('fs');

let code = fs.readFileSync('services/server/bandScale/bandScaleCommandService.ts', 'utf8');

const toReplace = `// Reconcile assignments
      const existingAssignments = currentScale.assignments || [];
      const reconciled = AssignmentNormalizer.reconcile(existingAssignments, rawAssignments, scaleId);
      
      // Perform Diff
      const diff = AssignmentDiffService.diff(existingAssignments, reconciled);

      const responsesCount = diff.created.length + diff.updated.length + diff.removed.length;`;

code = code.replace(toReplace, `const responsesCount = diff.created.length + diff.updated.length + diff.removed.length;`);

fs.writeFileSync('services/server/bandScale/bandScaleCommandService.ts', code);
