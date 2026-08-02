const fs = require('fs');
let content = fs.readFileSync('components/scales/AssignmentResponseActions.tsx', 'utf8');

content = content.replace(/transition-all duration-200/g, 'transition-all duration-300 ease-out');
content = content.replace(/transition-colors/g, 'transition-all duration-300 ease-out');

fs.writeFileSync('components/scales/AssignmentResponseActions.tsx', content);
