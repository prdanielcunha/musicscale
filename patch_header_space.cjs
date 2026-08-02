const fs = require('fs');
let content = fs.readFileSync('pages/DashboardPage.tsx', 'utf8');

content = content.replace(
  /<header className="space-y-1">/g,
  '<header>'
);

fs.writeFileSync('pages/DashboardPage.tsx', content);
