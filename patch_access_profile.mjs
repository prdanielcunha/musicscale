import fs from 'fs';

const path = 'components/team/AccessProfileSelector.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /onClick=\{\(\) => onSelect\(role\.id\)\}/,
  `onClick={() => onSelect(role.id)}\n              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(role.id); } }}`
);

fs.writeFileSync(path, content);
