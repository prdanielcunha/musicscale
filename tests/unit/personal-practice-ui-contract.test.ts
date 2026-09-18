import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dashboard = fs.readFileSync(
  path.join(process.cwd(), "pages/DashboardPage.tsx"),
  "utf8",
);
const focus = fs.readFileSync(
  path.join(process.cwd(), "components/dashboard/HomeFocusCard.tsx"),
  "utf8",
);
const week = fs.readFileSync(
  path.join(process.cwd(), "components/dashboard/HomePreparationWeek.tsx"),
  "utf8",
);

describe("personal practice dashboard contract", () => {
  it("builds the queue from the current scale assignment and routes to the first relevant song", () => {
    expect(dashboard).toContain("buildPersonalPracticeSummary");
    expect(dashboard).toContain("personalPracticeByEventId");
    expect(dashboard).toContain("practiceSummary?.firstSongId");
    expect(dashboard).toContain("scale.songs.findIndex");
  });

  it("preserves assignment names when opening preparation and Performance from Home", () => {
    const occurrences = dashboard.match(/assignmentNames: eventSummary\.userFunctionNames/g) || [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it("surfaces personal focus without replacing the existing preparation state machine", () => {
    expect(focus).toContain("practiceSummary");
    expect(focus).toContain("dashboard.preparation.personalFocusTitle");
    expect(focus).toContain("dashboard.preparation.practiceMyFocus");
    expect(week).toContain("practiceByEventId");
    expect(week).toContain("dashboard.preparation.focusParts");
    expect(week).toContain("requiresRepertoirePreparation");
  });
});
