import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const scaleDetail = fs.readFileSync(
  path.join(process.cwd(), "components/scales/ScaleDetailModal.tsx"),
  "utf8",
);
const modalContext = fs.readFileSync(
  path.join(process.cwd(), "contexts/ModalContext.tsx"),
  "utf8",
);
const songDetail = fs.readFileSync(
  path.join(process.cwd(), "components/songs/SongDetailModal.tsx"),
  "utf8",
);
const technicalParts = fs.readFileSync(
  path.join(process.cwd(), "components/songs/TechnicalPartsModal.tsx"),
  "utf8",
);

describe("assignment-aware song parts UI contract", () => {
  it("derives personal focus from the current scale assignment instead of global profile guesses", () => {
    expect(scaleDetail).toContain("currentAssignmentNames");
    expect(scaleDetail).toContain("scale.eventAssignments");
    expect(scaleDetail).toContain("assignment.userId === user.uid");
    expect(scaleDetail).toContain("linkedBandScale?.assignments");
    expect(scaleDetail).toContain("assignment.user?.uid === user.uid");
    expect(scaleDetail).not.toContain("userProfile?.specialtyIds");
  });

  it("carries assignment names through song navigation without losing scale context", () => {
    expect(scaleDetail).toContain("buildSongScaleContext");
    expect(scaleDetail).toContain("assignmentNames: currentAssignmentNames");
    expect(modalContext).toContain("ScaleSongNavigationContext");
    expect(modalContext).toContain("...scaleNavigationContext");
    expect(modalContext).toContain("currentIndex: newIndex");
  });

  it("surfaces relevant-part counts before opening the part viewer", () => {
    expect(scaleDetail).toContain("countFocusedSongParts");
    expect(scaleDetail).toContain("technicalParts.for_you_count");
    expect(songDetail).toContain("getFocusedSongParts");
    expect(songDetail).toContain("focus_badge_title");
    expect(songDetail).toContain("focusAssignmentNames={scaleContext?.assignmentNames}");
  });

  it("defaults to My Focus but always preserves access to all detected parts", () => {
    expect(technicalParts).toContain("getFocusedSongParts");
    expect(technicalParts).toContain("focusMode");
    expect(technicalParts).toContain("technicalParts.my_focus");
    expect(technicalParts).toContain("technicalParts.all_parts");
    expect(technicalParts).toContain(
      "focusMode && hasPersonalFocus ? focusedParts : parts",
    );
  });
});
