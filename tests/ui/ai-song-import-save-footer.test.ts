import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AI song import save action", () => {
  const source = readFileSync("components/songs/AiSongImportModal.tsx", "utf8");

  it("renders the preview save action in the Modal footer outside scrollable content", () => {
    expect(source).toContain('data-testid="ai-import-preview-footer"');
    expect(source).toContain('data-testid="ai-import-save-button"');
    expect(source).toMatch(/footer=\{[\s\S]*step === "preview"[\s\S]*ai-import-save-button/);
  });

  it("does not rely on the old viewport-fixed mobile footer or bottom-of-content desktop action", () => {
    expect(source).not.toContain("Mobile Sticky Footer");
    expect(source).not.toContain("hidden sm:flex flex-row justify-between items-center pt-6");
    expect(source).not.toContain("sm:hidden fixed bottom-0 left-0 right-0");
  });

  it("blocks a no-destination save and exposes saving state", () => {
    expect(source).toMatch(/!options\.saveToOrganization && !options\.saveToGlobalLibrary/);
    expect(source).toContain('aria-busy={isSaving}');
    expect(source).toContain('t("aiImport.saveSong", "Salvar música")');
  });
});
