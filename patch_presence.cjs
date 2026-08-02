const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HomeFocusCard.tsx', 'utf8');

content = content.replace(
  /\{\/\* Response Actions Container \*\/\}\s*\{responseActions && \(\s*<div className="pt-4">\s*\{responseActions\}\s*<\/div>\s*\)\}/,
  `{/* Response Actions Container */}
        {responseActions && (
          <div className="pt-1">
            {responseActions}
          </div>
        )}`
);

fs.writeFileSync('components/dashboard/HomeFocusCard.tsx', content);
