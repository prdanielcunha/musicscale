import { test, expect } from './helpers/base';
import { loginAsLeaderA } from './helpers/auth';

test.describe('AI Import - Paste normalization', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsLeaderA(page);
    await page.goto('/songs');

    // Wait for the current repertoire surface rather than a removed container test-id.
    await expect(page.getByRole('searchbox', { name: /Buscar por título ou artista/i })).toBeVisible({ timeout: 15000 });
  });

  test('should normalize pasted text in AiSongImportModal via textarea', async ({ page }) => {
    // Open Global Create then select "Importar com IA"
    await page.click('[data-testid="global-create-fab"]');
    await page.waitForSelector('[data-testid="global-create-menu"]', { state: 'visible' });

    await page.click('button:has-text("Importar com IA")');

    // Wait for the modal to be visible
    const modal = page.locator('text="Importar Música com Inteligência Artificial"');
    await expect(modal).toBeVisible();

    const textarea = page.locator('textarea[name="rawText"]').first();
    await expect(textarea).toBeVisible();

    // Emulate a paste event using Playwright's page.evaluate since clipboard APIs might be blocked or tricky
    const encodedText = "tom:%20G%0A%0A%5BIntro%5D%20G%20C9%20Em7%20D";

    await textarea.evaluate((node, pastedData) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', pastedData);
      const event = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });
      node.dispatchEvent(event);
    }, encodedText);

    // After paste, the text should be decoded
    const expectedDecodedText = "tom: G\n\n[Intro] G C9 Em7 D";
    await expect(textarea).toHaveValue(expectedDecodedText);

    const submitBtn = page.locator('button:has-text("Continuar e Organizar")');
    await expect(submitBtn).toBeEnabled();
  });
});
