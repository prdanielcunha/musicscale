const fs = require('fs');
let content = fs.readFileSync('tests/unit/team-member-setup.test.ts', 'utf8');

content = content.replace(/{ uid: 'current' } as UserProfile/g, "createMockUser({ uid: 'current' })");
content = content.replace(/{ uid: 'add1' } as UserProfile/g, "createMockUser({ uid: 'add1' })");
content = content.replace(/{ uid: 'current', roleId: 'r', specialtyIds: \['s'\] } as UserProfile/g, "createMockUser({ uid: 'current', roleId: 'r', specialtyIds: ['s'] })");
content = content.replace(/{ uid: 'add1', roleId: 'r', specialtyIds: \['s'\] } as UserProfile/g, "createMockUser({ uid: 'add1', roleId: 'r', specialtyIds: ['s'] })");
content = content.replace(/{ uid: 'u1', roleId: 'r', specialtyIds: \['s'\] } as UserProfile/g, "createMockUser({ uid: 'u1', roleId: 'r', specialtyIds: ['s'] })");
content = content.replace(/{ uid: 'u1', organizationRole: 'admin', specialtyIds: \['s'\] } as UserProfile/g, "createMockUser({ uid: 'u1', organizationRole: 'admin', specialtyIds: ['s'] })");
content = content.replace(/{ uid: 'u1', roleId: 'r' } as UserProfile/g, "createMockUser({ uid: 'u1', roleId: 'r' })");
content = content.replace(/{ uid: 'u2', roleId: 'r', specialtyIds: \[\] } as UserProfile/g, "createMockUser({ uid: 'u2', roleId: 'r', specialtyIds: [] })");
content = content.replace(/{ uid: 'u3', roleId: 'r', specialtyIds: \['s'\] } as UserProfile/g, "createMockUser({ uid: 'u3', roleId: 'r', specialtyIds: ['s'] })");
content = content.replace(/{ uid: '1' } as UserProfile/g, "createMockUser({ uid: '1' })");
content = content.replace(/{ uid: '1', roleId: 'r' } as UserProfile/g, "createMockUser({ uid: '1', roleId: 'r' })");
content = content.replace(/as unknown as/g, "");

fs.writeFileSync('tests/unit/team-member-setup.test.ts', content);
