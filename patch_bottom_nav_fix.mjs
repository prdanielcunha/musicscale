import fs from 'fs';
let content = fs.readFileSync('components/layout/BottomNav.tsx', 'utf8');

content = content.replace(
  '    </div>\n  );\n};',
  '      </div>\n    </div>\n  );\n};'
);

fs.writeFileSync('components/layout/BottomNav.tsx', content);
