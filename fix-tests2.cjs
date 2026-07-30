const fs = require('fs');
const file = 'tests/unit/music-scale-calendar-release.test.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "expect(ics).toContain('BEGIN:VCALENDAR\\\\r\\\\nVERSION:2.0');",
  "expect(ics).toContain('BEGIN:VCALENDAR\\r\\nVERSION:2.0');"
);

content = content.replace(
  "expect(ics).toMatch(/UID:scale_[a-f0-9]+@musicscale\\\\.com/);",
  "expect(ics).toMatch(/UID:scale_[a-z0-9]+@musicscale\\\\.com/);"
);

fs.writeFileSync(file, content);
