const fs = require('fs');
const file = 'hooks/useHomeExperience.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  'const homeExperience = evaluateHomeExperience({',
  'console.log("Upcoming events built:", upcomingEvents); const homeExperience = evaluateHomeExperience({'
);
fs.writeFileSync(file, content);
