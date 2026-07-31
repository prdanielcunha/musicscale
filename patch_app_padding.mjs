import fs from 'fs';
let content = fs.readFileSync('App.tsx', 'utf8');

content = content.replace(
  'pb-[calc(100px+env(safe-area-inset-bottom))]',
  'pb-[calc(140px+env(safe-area-inset-bottom))]'
);

fs.writeFileSync('App.tsx', content);
