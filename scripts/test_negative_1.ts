import { createCurationApprovalHttpHandler } from "../services/server/curationApprovalHttpHandler";
import { vi } from "vitest";

async function run() {
  const handler = createCurationApprovalHttpHandler({ db: null, admin: null, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } });
  const req = {
    method: "POST",
    headers: { authorization: "Bearer token" },
    body: {
      candidateId: "valid_id",
      occurrenceId: "valid_occ",
      idempotencyKey: { foo: "bar" } // Sending object
    }
  };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    setHeader: vi.fn()
  };
  
  await handler(req as any, res as any);
  console.log("Status called with:", res.status.mock.calls[0][0]);
  console.log("JSON called with:", res.json.mock.calls[0][0]);
}
run().catch(console.error);
