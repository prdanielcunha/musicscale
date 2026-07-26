const fs = require('fs');
let c = fs.readFileSync('tests/ui/users-existing-member-setup-integration.test.tsx', 'utf8');
c = c.replace(/expect\.objectContaining\(\{ roleId: 'r_member', specialtyIds: \['i_vox'\] \}\)/g, 
  "expect.objectContaining({ roleId: 'r_member', musicscaleRole: 'viewer', specialtyIds: ['i_vox'] })");
fs.writeFileSync('tests/ui/users-existing-member-setup-integration.test.tsx', c);
