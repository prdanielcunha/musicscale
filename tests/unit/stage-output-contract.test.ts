import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const transport = fs.readFileSync(
  path.join(process.cwd(), "services/stageOutputService.ts"),
  "utf8",
);
const coordinator = fs.readFileSync(
  path.join(process.cwd(), "services/stageOutputCoordinator.ts"),
  "utf8",
);
const player = fs.readFileSync(
  path.join(process.cwd(), "components/songs/StagePadPlayer.tsx"),
  "utf8",
);
const copy = fs.readFileSync(
  path.join(process.cwd(), "lib/stageOutputCopy.ts"),
  "utf8",
);

describe("MusicScale Stage Output", () => {
  it("reuses the tenant-scoped live realtime channel without transporting audio", () => {
    expect(transport).toContain('doc(db, "liveSessions"');
    expect(transport).toContain("organizationId");
    expect(transport).toContain("targetDeviceId");
    expect(transport).toContain("onSnapshot");
    expect(transport).not.toContain("MediaRecorder");
    expect(transport).not.toContain("getUserMedia");
    expect(transport).not.toContain("ArrayBuffer");
  });

  it("keeps receiver presence fresh and rejects stale playback commands", () => {
    expect(transport).toContain("STAGE_RECEIVER_STALE_MS = 90_000");
    expect(coordinator).toContain("HEARTBEAT_MS = 30_000");
    expect(coordinator).toContain("COMMAND_MAX_AGE_MS = 15_000");
    expect(coordinator).toContain("isStale && !isStop");
    expect(coordinator).toContain('"STALE_COMMAND"');
  });

  it("fails safe when the selected physical audio interface disappears", () => {
    expect(coordinator).toContain("handleAudioOutputsChanged");
    expect(coordinator).toContain("isOutputDeviceAvailable");
    expect(coordinator).toContain("stagePadEngine.stop(0.12)");
    expect(coordinator).toContain('"OUTPUT_DISCONNECTED"');
    expect(coordinator).toContain("this.ready = false");
  });

  it("requires an explicit receiver and exposes emergency stop and output test UX", () => {
    expect(player).toContain("enableReceiver");
    expect(player).toContain("disableReceiver");
    expect(player).toContain("emergencyStop");
    expect(player).toContain("testOutput");
    expect(player).toContain("chooseOutput");
    expect(player).toContain("selectedTargetDeviceId");
  });

  it("ships the Stage Output surface in Portuguese, English and Spanish", () => {
    expect(copy).toContain("Saída de Palco");
    expect(copy).toContain("Stage Output");
    expect(copy).toContain("Salida de Escenario");
    expect(copy).toContain("outputDisconnected");
  });
});
