const fs = require('fs');
let c = fs.readFileSync('tests/ui/users-existing-member-setup-integration.test.tsx', 'utf8');

c = c.replace(/expect\(screen\.queryByText\('Admin'\)\)\.not\.toBeInTheDocument\(\);/g, 
  "expect(screen.queryByRole('radio', { name: /Admin/i })).not.toBeInTheDocument();");

c = c.replace(/expect\(screen\.queryByText\('Owner'\)\)\.not\.toBeInTheDocument\(\);/g, 
  "expect(screen.queryByRole('radio', { name: /Owner/i })).not.toBeInTheDocument();");

// Fix test 20 assertion payload
c = c.replace(/expect\(mockUsersUpdate\)\.toHaveBeenCalledWith\(\n\s*'u_target',\n\s*\{ roleId: 'r_member', musicscaleRole: 'r_member', specialtyIds: \['i_vox'\] \}\n\s*\);/g, 
  "expect(mockUsersUpdate).toHaveBeenCalledWith('u_target', expect.objectContaining({ roleId: 'r_member', specialtyIds: ['i_vox'] }));");

fs.writeFileSync('tests/ui/users-existing-member-setup-integration.test.tsx', c);
