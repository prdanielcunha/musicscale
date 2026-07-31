import fs from 'fs';
let content = fs.readFileSync('components/layout/GlobalCreateAction.tsx', 'utf8');
content = content.replace(
  'export const GlobalCreateAction: React.FC<GlobalCreateActionProps> = ({ variant }) => {',
  'export const GlobalCreateAction: React.FC<GlobalCreateActionProps> = ({ variant }) => {\nconsole.log("GlobalCreateAction rendering with variant:", variant);'
);
fs.writeFileSync('components/layout/GlobalCreateAction.tsx', content);
