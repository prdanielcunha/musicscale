const fs = require('fs');
let content = fs.readFileSync('tests/unit/home-experience.test.ts', 'utf8');

content = content.replace(/organizationId: 'o', /g, '');
content = content.replace(/createdAt: \{ seconds: \d+ \}/g, "createdAt: { seconds: 0 } as any");
content = content.replace(/updatedAt: \{ seconds: \d+ \}/g, "updatedAt: { seconds: 0 } as any");
content = content.replace(/lastModifiedAt: \{ seconds: \d+ \}/g, "lastModifiedAt: { seconds: 0 } as any");
content = content.replace(/createdAt: \{ seconds: 1000 \}/g, "createdAt: { seconds: 1000 } as any");
content = content.replace(/updatedAt: \{ seconds: 100 \}/g, "updatedAt: { seconds: 100 } as any");
content = content.replace(/lastModifiedAt: \{ seconds: 10 \}/g, "lastModifiedAt: { seconds: 10 } as any");

content = content.replace(/createdAt: 1000/g, "createdAt: { seconds: 1000 } as any");
content = content.replace(/updatedAt: 100/g, "updatedAt: { seconds: 100 } as any");
content = content.replace(/lastModifiedAt: 10/g, "lastModifiedAt: { seconds: 10 } as any");

fs.writeFileSync('tests/unit/home-experience.test.ts', content);
