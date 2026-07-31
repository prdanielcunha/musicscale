import fs from 'fs';
let content = fs.readFileSync('components/layout/GlobalCreateAction.tsx', 'utf8');

content = content.replace(
  '<ul className="flex flex-col w-full outline-none" role="menu">',
  '<ul id="global-create-menu" className="flex flex-col w-full outline-none" role="menu">'
);

content = content.replace(
  'id="global-create-menu"\n              ref={popoverRef}',
  'ref={popoverRef}'
);

fs.writeFileSync('components/layout/GlobalCreateAction.tsx', content);
