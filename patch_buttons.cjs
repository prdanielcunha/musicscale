const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HomeFocusCard.tsx', 'utf8');

content = content.replace(
  /className="w-full sm:w-auto text-base h-14 rounded-2xl"/g,
  'className="w-full sm:w-auto" size="lg"'
);

fs.writeFileSync('components/dashboard/HomeFocusCard.tsx', content);
