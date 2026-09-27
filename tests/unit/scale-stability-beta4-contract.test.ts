import fs from "node:fs";
import { describe, expect, it } from "vitest";

const form = fs.readFileSync("components/scales/ModernScaleForm.tsx", "utf8");
const settings = fs.readFileSync("utils/scaleSongSettings.ts", "utf8");
const viewer = fs.readFileSync("components/songs/ChordsViewerModal.tsx", "utf8");

describe("MusicScale beta.4 scale stability contract", () => {
  it("distinguishes an actual load failure from a genuinely empty setup", () => {
    expect(form).toContain("hasReferenceDataLoadFailure");
    expect(form).toContain("canOfferReferenceBootstrap");
    expect(form).toContain("Boolean(musicDataError)");
    expect(form).toContain("!musicDataError");
  });

  it("does not present initial setup while critical music data is still loading", () => {
    expect(form).toContain("!musicDataLoading && !musicDataError");
  });

  it("blocks required selectors when their source data failed", () => {
    expect(form).toContain("disabled={musicDataLoading || hasReferenceDataLoadFailure}");
    expect(form).toContain('aria-describedby={hasReferenceDataLoadFailure ? "scale-reference-data-alert" : undefined}');
  });

  it("renders an accessible warning instead of pretending the organization is empty", () => {
    expect(form).toContain('id="scale-reference-data-alert"');
    expect(form).toContain('role="alert"');
    expect(form).toContain("referenceDataLoadFailedTitle");
  });

  it("offers a direct data retry path", () => {
    expect(form).toContain("handleRetryReferenceData");
    expect(form).toContain("await refreshData()");
    expect(form).toContain("referenceDataRetry");
  });

  it("keeps the safe bootstrap path for a genuinely new organization", () => {
    expect(form).toContain("handleExplicitBootstrap");
    expect(form).toContain("canOfferReferenceBootstrap");
    expect(form).toContain("referenceDataPrepare");
  });

  it("fails visibly when automatic bootstrap fails", () => {
    expect(form).toContain("referenceDataBootstrapFailed");
    expect(form).toContain("Bootstrap failed with status");
  });

  it("prioritizes the musician-facing selected key in effective key resolution", () => {
    expect(settings).toContain("if (song.selectedKey) return song.selectedKey;");
    expect(settings.indexOf("song.selectedKey")).toBeLessThan(settings.indexOf("if (song.key) return song.key;"));
  });

  it("transposes scale-local overrides from the selected key", () => {
    expect(settings).toContain('const baseKey = song.selectedKey || song.key || song.originalKey || "";');
  });

  it("uses the same selected-key precedence in the chord performance viewer", () => {
    expect(viewer).toContain('song?.selectedKey || song?.key || song?.originalKey || "C"');
  });
});
