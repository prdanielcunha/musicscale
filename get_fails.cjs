const fs = require('fs');
const lines = fs.readFileSync('/tmp/.19effefaffdef43c-00000000.hm', 'utf8').split('\n');
lines.forEach(l => {
  if (l.includes('tests/ui/users-existing-member-setup-integration.test.tsx:')) {
    console.log(l.trim());
  }
});
