const fs = require('fs');
let c = fs.readFileSync('tests/ui/users-existing-member-setup-integration.test.tsx', 'utf8');

c = c.replace(/pt.teamSetup.progress.viewAction/g, 'pt.teamSetup.progress.reviewAction');
c = c.replace(/pt.teamSetup.progress.reviewAction/g, 'pt.teamSetup.progress.reviewCompletedAction');
// wait, the previous replace will change viewAction to reviewAction, and then the next line will change that to reviewCompletedAction too.
