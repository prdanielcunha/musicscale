import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatPadDisplayKey, normalizePadKey, STAGE_PAD_KEYS } from "../../services/stagePadEngine";

const engine = fs.readFileSync(
  path.join(process.cwd(), "services/stagePadEngine.ts"),
  "utf8",
);
const viewer = fs.readFileSync(
  path.join(process.cwd(), "components/songs/ChordsViewerModal.tsx"),
  "utf8",
);

describe("Stage native pad", () => {
  it("provides all 12 musical keys with enharmonic normalization", () => {
    expect(STAGE_PAD_KEYS).toHaveLength(12);
    expect(normalizePadKey("Db")).toBe("C#");
    expect(normalizePadKey("G#m")).toBe("Ab");
    expect(normalizePadKey("Am")).toBe("A");
    expect(formatPadDisplayKey("Am")).toBe("Am");
    expect(formatPadDisplayKey("A")).toBe("A");
    expect(normalizePadKey("Bb")).toBe("Bb");
  });

  it("uses Web Audio synthesis with crossfade and no external audio dependency", () => {
    expect(engine).toContain("AudioContext");
    expect(engine).toContain("exponentialRampToValueAtTime");
    expect(engine).toContain("createOscillator");
    expect(engine).toContain("createBiquadFilter");
    expect(engine).not.toContain("youtube");
    expect(engine).not.toContain(".mp3");
  });

  it("adds Pad beside the existing stage metronome without replacing it", () => {
    expect(viewer).toContain("StagePadPlayer");
    expect(viewer).toContain("isStagePadOpen");
    expect(viewer).toContain("isStageMetronomeOpen");
    expect(viewer).toContain("<Metronome");
    expect(viewer).toContain("setIsAutoScrolling");
  });

  it("follows the effective Performance key instead of the raw song metadata key", () => {
    expect(viewer).toContain("basePerformanceKey");
    expect(viewer).toContain("song?.key || song?.selectedKey || song?.originalKey");
    expect(viewer).toContain("effectivePerformanceKey");
    expect(viewer).toContain("<StagePadPlayer songKey={effectivePerformanceKey}");
    expect(viewer).toContain("formatPadDisplayKey(effectivePerformanceKey)");
    expect(viewer).not.toContain("<StagePadPlayer songKey={song.key}");
  });
});
