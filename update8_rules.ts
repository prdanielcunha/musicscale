import fs from 'fs';
import path from 'path';

const rulesPath = 'firestore.rules';
if (fs.existsSync(rulesPath)) {
  let rules = fs.readFileSync(rulesPath, 'utf8');

  const responsesRule = `
    match /scales/{musicScaleId}/responses/{responseId} {
      allow read: if isAuthenticated() && (
        hasCapability(getOrgId(), 'scales.manage') ||
        isGlobalFullAccess() ||
        resource.data.userId == request.auth.uid
      );
      allow create, update, delete: if false; // Only via backend Command API
    }
    
    match /scales/{musicScaleId}/responseHistory/{historyId} {
      allow read: if isAuthenticated() && (
        hasCapability(getOrgId(), 'scales.manage') ||
        isGlobalFullAccess()
      );
      allow create, update, delete: if false;
    }`;

  if (!rules.includes('/responses/{responseId}')) {
    rules = rules.replace(
      /match \/scales\/\{scaleId\} \{/g,
      responsesRule + '\n    match /scales/{scaleId} {'
    );
    fs.writeFileSync(rulesPath, rules);
    console.log('Rules updated successfully.');
  } else {
    console.log('Rules already exist.');
  }
} else {
  console.log('firestore.rules not found in root.');
}
