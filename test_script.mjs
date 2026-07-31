import fs from 'fs';
let content = fs.readFileSync('components/layout/GlobalCreateAction.tsx', 'utf8');
content = content.replace(
  'const handleExitComplete = () => {',
  'const handleExitComplete = () => { console.log("handleExitComplete called, pendingAction:", pendingActionRef.current);'
);
fs.writeFileSync('components/layout/GlobalCreateAction.tsx', content);
