const fs = require('fs');
let content = fs.readFileSync('pages/DashboardPage.tsx', 'utf8');

content = content.replace(
  /<div className="relative isolate max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 animate-fade-in touch-manipulation">/,
  '<div className="relative isolate max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 animate-fade-in touch-manipulation">'
);

fs.writeFileSync('pages/DashboardPage.tsx', content);
