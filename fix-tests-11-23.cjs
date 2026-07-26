const fs = require('fs');
let c = fs.readFileSync('tests/ui/users-existing-member-setup-integration.test.tsx', 'utf8');

c = c.replace(/it\('11\. owner identificado por ownerUserId recebe somente leitura', async \(\) => \{\n    mockOrgOwnerId = 'owner-id';\n    mockUsers = \[createProfile\(\{ uid: 'owner-id', displayName: 'Owner User', roleId: 'r_member', specialtyIds: \[\] \}\)\];/g, 
`it('11. owner identificado por ownerUserId recebe somente leitura', async () => {
    mockOrgOwnerId = 'owner-id';
    mockUsers = [
      createProfile({ uid: 'owner-id', displayName: 'Owner User', roleId: 'r_member', specialtyIds: [] }),
      createProfile({ uid: 'other', displayName: 'Other', roleId: '', specialtyIds: [] })
    ];`);

c = c.replace(/it\('23\. owner envia somente specialtyIds', async \(\) => \{\n    mockOrgOwnerId = 'owner-id';\n    mockUsers = \[createProfile\(\{ uid: 'owner-id', displayName: 'Owner User', roleId: 'r_member', specialtyIds: \[\] \}\)\];/g, 
`it('23. owner envia somente specialtyIds', async () => {
    mockOrgOwnerId = 'owner-id';
    mockUsers = [
      createProfile({ uid: 'owner-id', displayName: 'Owner User', roleId: 'r_member', specialtyIds: [] }),
      createProfile({ uid: 'other', displayName: 'Other', roleId: '', specialtyIds: [] })
    ];`);

fs.writeFileSync('tests/ui/users-existing-member-setup-integration.test.tsx', c);
