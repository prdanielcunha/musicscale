const fs = require('fs');
let c = fs.readFileSync('tests/ui/users-existing-member-setup-integration.test.tsx', 'utf8');

c = c.replace(/vi\.spyOn\(roleHierarchy, 'canAssignOrganizationRole'\)\.mockImplementation\(\(\{ \{ targetOrganizationRole \}: any \}\) => \{\n      if \(\{ targetOrganizationRole \}: any === 'r_admin'\) return \{ canAssign: false, error: "Cannot assign Admin" \};\n      return \{ canAssign: true \};\n    \}\);/, 
`vi.spyOn(roleHierarchy, 'canAssignOrganizationRole').mockImplementation((context: any) => {
      if (context.targetOrganizationRole === 'r_admin') return { canAssign: false, error: "Cannot assign Admin" };
      return { canAssign: true };
    });`);

fs.writeFileSync('tests/ui/users-existing-member-setup-integration.test.tsx', c);
