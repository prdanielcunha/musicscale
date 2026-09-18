import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const viewer = fs.readFileSync(
  path.join(process.cwd(), "components/songs/ChordsViewerModal.tsx"),
  "utf8",
);

describe("Live personal focus cue contract", () => {
  it("derives the personal live cue from the existing directed section", () => {
    expect(viewer).toContain("liveFocusedSectionItem");
    expect(viewer).toContain("liveSession?.activeSection");
    expect(viewer).toContain("focusedSectionIndexes.has(target.sectionIndex)");
    expect(viewer).toContain("target.songId !== song.id");
  });

  it("only surfaces the cue while following a live direction", () => {
    expect(viewer).toContain("!isLive");
    expect(viewer).toContain("!isFollowingDirection");
    expect(viewer).toContain('t("performance.live_your_part_now")');
    expect(viewer).toContain("performanceAssignmentLabel");
  });

  it("does not create another broadcast cue or write path", () => {
    expect(viewer).not.toContain('pushCue("personal-focus"');
    expect(viewer).not.toContain('changeSection(song.id');
  });
});
