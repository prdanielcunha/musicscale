import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Connect next-schedule presence route contract', () => {
  it('mounts the own-presence read boundary on the canonical server', () => {
    const serverSource = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
    expect(serverSource).toContain(
      'import { createConnectNextSchedulePresenceReadHandler } from "./services/server/connect/nextSchedulePresenceReadHandler.js";',
    );
    expect(serverSource).toContain(
      'app.get("/api/v1/connect/next-schedule/presence", connectNextSchedulePresenceReadHandler);',
    );
  });
});
