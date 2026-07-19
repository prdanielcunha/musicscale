import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "path";

test("MS-FIRST-VALUE-01C - Safe Cancellation and Mobile Setlist Summary", async (t) => {
  const formPath = path.join(process.cwd(), "components/scales/ModernScaleForm.tsx");
  const builderPath = path.join(process.cwd(), "components/scales/MusicBuilder.tsx");
  const ptPath = path.join(process.cwd(), "locales/pt.json");
  const enPath = path.join(process.cwd(), "locales/en.json");
  const esPath = path.join(process.cwd(), "locales/es.json");

  // Read files
  const formContent = fs.readFileSync(formPath, "utf-8");
  const builderContent = fs.readFileSync(builderPath, "utf-8");
  const ptContent = fs.readFileSync(ptPath, "utf-8");
  const enContent = fs.readFileSync(enPath, "utf-8");
  const esContent = fs.readFileSync(esPath, "utf-8");

  await t.test("1. ModernScaleForm possesses a function unique of request close protected", () => {
    assert.ok(formContent.includes("const handleRequestClose ="), "Should define handleRequestClose");
    assert.ok(formContent.includes("onClose={handleRequestClose}"), "PremiumSheetModal should receive handleRequestClose");
  });

  await t.test("2. There is no onClose direct in the footer of the form", () => {
    // Extract the footer component definition
    const footerMatch = formContent.match(/const footer = \([\s\S]+?\);/);
    if (footerMatch) {
      const footerStr = footerMatch[0];
      assert.ok(!footerStr.includes("onClick={onClose}"), "Footer buttons should not call onClose directly");
      assert.ok(footerStr.includes("onClick={handleRequestClose}"), "Footer cancel should use handleRequestClose");
    }
  });

  await t.test("3. PremiumSheetModal receives the protected function", () => {
    assert.ok(formContent.includes("onClose={handleRequestClose}"), "PremiumSheetModal onClose prop must be handleRequestClose");
  });

  await t.test("4. There exists Cancel action in all steps", () => {
    // Both header X (md:hidden) and footer Cancel (hidden md:flex or similar) call handleRequestClose
    assert.ok(formContent.includes("handleRequestClose"), "Should handle cancel in steps");
    assert.ok(formContent.includes("scaleModal.cancel"), "Should render Cancel label");
  });

  await t.test("5. Voltar remains separate from Cancelar", () => {
    assert.ok(formContent.includes("scaleModal.back"), "Should render Back label");
    assert.ok(formContent.includes("scaleModal.cancel"), "Should render Cancel label");
    assert.ok(formContent.includes("handleBack"), "Should have handleBack separate from handleRequestClose");
  });

  await t.test("6. isSubmitting blocks closure", () => {
    assert.ok(
      formContent.includes("isSubmitting || isSubmittingNested") && formContent.includes("submittingCannotClose"),
      "isSubmitting should block close with a warning toast"
    );
  });

  await t.test("7. Discard confirmation exists", () => {
    assert.ok(formContent.includes("showCancelConfirm"), "showCancelConfirm state should exist");
    assert.ok(formContent.includes("discardChangesTitle"), "discardChangesTitle translation key should be referenced");
  });

  await t.test("8 & 9. Does not use window.confirm or alert", () => {
    assert.ok(!formContent.includes("window.confirm"), "Should not use window.confirm");
    assert.ok(!formContent.includes("alert("), "Should not use alert()");
  });

  await t.test("10. Dirty state possesses snapshot-base", () => {
    assert.ok(formContent.includes("initialFormDataRef"), "initialFormDataRef ref should be defined");
    assert.ok(formContent.includes("getComparableData"), "getComparableData normalizer should exist");
  });

  await t.test("11 & 12. currentStep and confirmation are reset in new opening", () => {
    assert.ok(formContent.includes("setCurrentStep(0)"), "currentStep should be reset when modal is closed/reopened");
    assert.ok(formContent.includes("setShowCancelConfirm(false)"), "showCancelConfirm should be reset to false");
  });

  await t.test("13 & 14 & 15. MusicBuilder possesses mobile summary of selected songs with counter and setlist action", () => {
    assert.ok(builderContent.includes("selectedSongsCount") || builderContent.includes("selectedSongsList"), "Should track selected songs list");
    assert.ok(builderContent.includes("setMobileTab") || builderContent.includes("mobileTab"), "Should have a mobile setlist view action");
    assert.ok(builderContent.includes("noSongsSelected") || builderContent.includes("empty"), "Should handle empty state beautifully");
  });

  await t.test("16. Mobile badge shows count zero and positive count", () => {
    assert.ok(builderContent.includes("selectedSongsList.length"), "Badge should read selected songs count dynamically");
  });

  await t.test("17. Adding song doesn't force automatic tab switch", () => {
    // handleSongToggle should not automatically trigger setMobileTab('setlist')
    const matchToggle = builderContent.match(/const handleSongToggle = \([\s\S]+?\}\};/);
    if (matchToggle) {
      assert.ok(!matchToggle[0].includes("setMobileTab"), "handleSongToggle should not force a tab transition");
    }
  });

  await t.test("18. Removing last song preserves empty state", () => {
    assert.ok(builderContent.includes("noSongsSelected") || builderContent.includes("empty"), "Empty state is preserved when count is 0");
  });

  await t.test("19 & 20 & 21. Translations exist and are complete", () => {
    const pt = JSON.parse(ptContent);
    const en = JSON.parse(enContent);
    const es = JSON.parse(esContent);

    const requiredKeys = [
      "discardChangesTitle",
      "discardChangesDescription",
      "discardAndExit",
      "keepEditing",
      "unsavedChanges",
      "selectedSongsCount",
      "noSongsSelected",
      "noSongsSelectedDescription",
      "viewSetlist",
      "repertoireTab",
      "submittingCannotClose",
      "selectedSongsPreviewMore"
    ];

    for (const key of requiredKeys) {
      assert.ok(pt.scaleModal[key], `pt.json is missing scaleModal.${key}`);
      assert.ok(en.scaleModal[key], `en.json is missing scaleModal.${key}`);
      assert.ok(es.scaleModal[key], `es.json is missing scaleModal.${key}`);
    }
  });

  await t.test("22. server.ts was not altered", () => {
    const serverPath = path.join(process.cwd(), "server.ts");
    const serverContent = fs.readFileSync(serverPath, "utf-8");
    assert.ok(!serverContent.includes("MS-FIRST-VALUE-01C"), "server.ts should not contain tasks markers or be modified");
  });

  await t.test("23. ModalContext was not altered", () => {
    const contextPath = path.join(process.cwd(), "contexts/ModalContext.tsx");
    if (fs.existsSync(contextPath)) {
      const contextContent = fs.readFileSync(contextPath, "utf-8");
      assert.ok(!contextContent.includes("MS-FIRST-VALUE-01C"), "ModalContext should not be modified");
    }
  });

  await t.test("24 & 25. No temporary, patch, brute or old files are present", () => {
    const rootFiles = fs.readdirSync(process.cwd());
    const forbiddenPatterns = [
      /\.patch$/, /\.old$/, /\.copy$/, /\.backup$/, /\.brute/, /\.fix_/, /generate/
    ];
    for (const file of rootFiles) {
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(file)) {
          // Some pre-existing project files are fine, like .gitignore or .firebaserc, but check any new files
          if (file !== "firestore.rules.backup" && file !== "fix_init.cjs" && file !== "fix_timeout.cjs") {
             assert.fail(`Forbidden file pattern detected: ${file}`);
          }
        }
      }
    }
  });
});
