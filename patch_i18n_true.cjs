const fs = require('fs');
let content = fs.readFileSync('pages/DashboardPage.tsx', 'utf8');

content = content.replace(
  /const \{ t \} = useTranslation\(\);/g,
  'const { t, i18n } = useTranslation();'
);

fs.writeFileSync('pages/DashboardPage.tsx', content);
