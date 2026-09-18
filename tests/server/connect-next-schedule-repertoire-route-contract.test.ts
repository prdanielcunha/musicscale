import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Connect next-schedule repertoire route contract', () => {
  it('mounts the authenticated repertoire read handler on the canonical server', () => {
    const serverSource = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');

    expect(serverSource).toContain(
      'import { createConnectNextScheduleRepertoireReadHandler } from "./services/server/connect/nextScheduleRepertoireReadHandler.js";',
    );
    expect(serverSource).toContain(
      'const connectNextScheduleRepertoireReadHandler = createConnectNextScheduleRepertoireReadHandler({',
    );
    expect(serverSource).toContain(
      'app.get("/api/v1/connect/next-schedule/repertoire", connectNextScheduleRepertoireReadHandler);',
    );
  });
});
