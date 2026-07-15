const fs = require('fs');

let content = fs.readFileSync('pages/DashboardPage.tsx', 'utf8');

// Inject the requested premium mobile background at the start of DashboardPage
const rootRegex = /<div className="relative isolate max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 animate-fade-in touch-manipulation">/;

if (content.match(rootRegex)) {
  const bgCode = `
      {/* Mobile Premium Global Background Layer */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden hidden dark:block" aria-hidden="true">
        <div className="absolute top-[-80px] right-[-80px] h-56 w-56 rounded-full bg-blue-500/10 blur-3xl md:bg-blue-500/20 md:blur-[90px]" aria-hidden="true"/>
        <div className="absolute bottom-[30%] left-[-80px] h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl md:bg-indigo-500/20 md:blur-[100px]" aria-hidden="true"/>
      </div>
  `;
  content = content.replace(rootRegex, '<div className="relative isolate max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 animate-fade-in touch-manipulation">' + bgCode);
  fs.writeFileSync('pages/DashboardPage.tsx', content);
  console.log("Added background layer.");
} else {
  console.log("Root element not found.");
}
