const fs = require('fs');
let c = fs.readFileSync('tests/ui/users-existing-member-setup-integration.test.tsx', 'utf8');

function fixTest(num) {
  let regex = new RegExp(`(it\\('${num}\\.[^']+?', async \\(\\) => \\{\\n\\s+mockOrgOwnerId = '[^']+';\\n\\s+mockUsers = \\[\\];.*?)(await renderPage)`, 's');
  // wait, the tests might not have mockOrgOwnerId. Let's just find the mockUsers assignment.
}

c = c.replace(/it\('9\. usuário atual recebe acesso em modo somente leitura', async \(\) => \{\n    mockUsers = \[createProfile\(\{ uid: 'current-user-123', displayName: 'Current', roleId: '', specialtyIds: \[\] \}\)\];\n    await renderPage\(\);/g, 
`it('9. usuário atual recebe acesso em modo somente leitura', async () => {
    mockUsers = [
      createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: '', specialtyIds: [] }),
      createProfile({ uid: 'other', displayName: 'Other', roleId: '', specialtyIds: [] })
    ];
    await renderPage();`);

c = c.replace(/it\('10\. usuário atual consegue avançar para funções', async \(\) => \{\n    mockUsers = \[createProfile\(\{ uid: 'current-user-123', displayName: 'Current', roleId: '', specialtyIds: \[\] \}\)\];\n    await renderPage\(\);/g, 
`it('10. usuário atual consegue avançar para funções', async () => {
    mockUsers = [
      createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: '', specialtyIds: [] }),
      createProfile({ uid: 'other', displayName: 'Other', roleId: '', specialtyIds: [] })
    ];
    await renderPage();`);

c = c.replace(/it\('22\. usuário atual envia somente specialtyIds', async \(\) => \{\n    mockUsers = \[createProfile\(\{ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: \[\] \}\)\];\n    await renderPage\(\);/g, 
`it('22. usuário atual envia somente specialtyIds', async () => {
    mockUsers = [
      createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }),
      createProfile({ uid: 'other', displayName: 'Other', roleId: '', specialtyIds: [] })
    ];
    await renderPage();`);

fs.writeFileSync('tests/ui/users-existing-member-setup-integration.test.tsx', c);
