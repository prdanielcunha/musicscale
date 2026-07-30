const fs = require('fs');
const file = 'tests/unit/music-scale-calendar-release.test.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  `      const anchorMock = {\n        href: '',\n        download: '',\n        click: vi.fn(),\n      } as HTMLAnchorElement;`,
  `      const anchorMock = document.createElement('a');\n      anchorMock.click = vi.fn();`
);
fs.writeFileSync(file, content);
