const fs = require('fs');
const file = 'pages/DashboardPage.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace hover: with md:hover: inside className strings
content = content.replace(/\bhover:/g, 'md:hover:');
content = content.replace(/\bgroup-md:hover:/g, 'md:group-hover:'); 
content = content.replace(/\bgroup-hover:/g, 'md:group-hover:');
content = content.replace(/\bmd:md:hover:/g, 'md:hover:'); 
content = content.replace(/\bmd:md:group-hover:/g, 'md:group-hover:');

// Let's also remove massive blurs on mobile and tone it down
content = content.replace(/\bblur-\[100px\]/g, 'md:blur-[100px] blur-[30px]');
content = content.replace(/\bblur-\[80px\]/g, 'md:blur-[80px] blur-[20px]');
content = content.replace(/\bblur-\[60px\]/g, 'md:blur-[60px] blur-[15px]');

fs.writeFileSync(file, content);
console.log('Fixed hover and blurs');
