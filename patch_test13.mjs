import fs from 'fs';
let content = fs.readFileSync('tests/ui/global-create-action.test.tsx', 'utf8');
content = content.replace('trigger.focus();\n    fireEvent.click(trigger);', 'fireEvent.click(trigger);');
fs.writeFileSync('tests/ui/global-create-action.test.tsx', content);
