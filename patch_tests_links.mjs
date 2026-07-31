import fs from 'fs';
let content = fs.readFileSync('tests/ui/global-create-action.test.tsx', 'utf8');

content = content.replace(
  'expect(links[4]).toHaveAttribute(\'href\', \'/settings\');',
  'expect(links[4]).toHaveAttribute(\'href\', \'/profile\');'
);

fs.writeFileSync('tests/ui/global-create-action.test.tsx', content);
