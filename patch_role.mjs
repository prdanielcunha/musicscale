import fs from 'fs';
let content = fs.readFileSync('components/layout/GlobalCreateAction.tsx', 'utf8');

content = content.replace(
  'id="global-create-menu"\n              role="menu"\n              ref={popoverRef}',
  'id="global-create-menu"\n              ref={popoverRef}'
);

fs.writeFileSync('components/layout/GlobalCreateAction.tsx', content);
