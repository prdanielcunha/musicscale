const fs = require('fs');
let content = fs.readFileSync('tests/unit/team-member-setup.test.ts', 'utf8');

content = content.replace("describe('teamMemberSetup', () => {", "const createMockUser = (partial: Partial<UserProfile>): UserProfile => ({ uid: 'mock_uid', email: null, displayName: null, photoURL: null, roleId: '', ...partial });\n\ndescribe('teamMemberSetup', () => {");

content = content.replace(/{ uid: '' } as UserProfile/g, "createMockUser({ uid: '' })");
content = content.replace(/{ uid: '   ' } as UserProfile/g, "createMockUser({ uid: '   ' })");
content = content.replace(/{ uid: 'user1', email: 'first@test.com' } as UserProfile/g, "createMockUser({ uid: 'user1', email: 'first@test.com' })");
content = content.replace(/{ uid: 'user1', email: 'second@test.com' } as UserProfile/g, "createMockUser({ uid: 'user1', email: 'second@test.com' })");
content = content.replace(/{ uid: 'user1' } as UserProfile/g, "createMockUser({ uid: 'user1' })");
content = content.replace(/{ uid: 'comp1', roleId: 'r', specialtyIds: \['s'\] } as UserProfile/g, "createMockUser({ uid: 'comp1', roleId: 'r', specialtyIds: ['s'] })");
content = content.replace(/{ uid: 'incomp1' } as UserProfile/g, "createMockUser({ uid: 'incomp1' })");
content = content.replace(/{ uid: 'incomp1', email: '1' } as UserProfile/g, "createMockUser({ uid: 'incomp1', email: '1' })");
content = content.replace(/{ uid: 'incomp2', email: '2' } as UserProfile/g, "createMockUser({ uid: 'incomp2', email: '2' })");
content = content.replace(/{ uid: 'comp1', email: '3', roleId: 'r', specialtyIds: \['s'\] } as UserProfile/g, "createMockUser({ uid: 'comp1', email: '3', roleId: 'r', specialtyIds: ['s'] })");
content = content.replace(/{ uid: 'comp2', email: '4', roleId: 'r', specialtyIds: \['s'\] } as UserProfile/g, "createMockUser({ uid: 'comp2', email: '4', roleId: 'r', specialtyIds: ['s'] })");

// groupTeamFunctions
content = content.replace(/{ id: 'i1', category: 'Voz' } as Instrument/g, "{ id: 'i1', category: 'Voz', name: 'i1' }");
content = content.replace(/{ id: 'i2', category: 'Instrumento' } as Instrument/g, "{ id: 'i2', category: 'Instrumento', name: 'i2' }");
content = content.replace(/{ id: 'i3', category: 'Ministro' } as Instrument/g, "{ id: 'i3', category: 'Ministro', name: 'i3' }");
content = content.replace(/{ id: 'i4', category: 'Outro' } as Instrument/g, "{ id: 'i4', category: 'Outro', name: 'i4' }");
content = content.replace(/{ id: 'i1', category: 'Voz' } as unknown as Instrument/g, "{ id: 'i1', category: 'Voz', name: 'i1' }");
content = content.replace(/as Instrument/g, "");

fs.writeFileSync('tests/unit/team-member-setup.test.ts', content);
