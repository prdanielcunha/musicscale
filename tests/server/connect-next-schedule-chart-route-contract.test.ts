import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Connect next-schedule chart route contract', () => {
  it('mounts the authenticated in-app chart boundary on the canonical server', () => {
    const serverSource = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
    expect(serverSource).toContain(
      'import { createConnectNextScheduleChartReadHandler } from "./services/server/connect/nextScheduleChartReadHandler.js";',
    );
    expect(serverSource).toContain(
      'app.get("/api/v1/connect/next-schedule/chart", connectNextScheduleChartReadHandler);',
    );
  });
});
