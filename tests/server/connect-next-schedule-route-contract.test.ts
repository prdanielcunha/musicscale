import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Connect next-schedule server route contract', () => {
  it('keeps the authenticated read handler mounted on the canonical Express server', () => {
    const serverSource = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');

    expect(serverSource).toContain(
      'import { createConnectNextScheduleReadHandler } from "./services/server/connect/nextScheduleReadHandler.js";',
    );
    expect(serverSource).toContain(
      'const connectNextScheduleReadHandler = createConnectNextScheduleReadHandler({',
    );
    expect(serverSource).toContain(
      'app.get("/api/v1/connect/next-schedule", connectNextScheduleReadHandler);',
    );
  });
});
