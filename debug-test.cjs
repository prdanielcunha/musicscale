const fs = require('fs');
const file = 'tests/ui/music-scale-dashboard-release.test.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  'renderWithRouter(<DashboardPage />);',
  'console.log("music:", mockUseMusic()); console.log("sugg:", mockUseSuggestionsContext()); renderWithRouter(<DashboardPage />);'
);
fs.writeFileSync(file, content);
