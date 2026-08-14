import { test, expect } from './helpers/base';
import { loginAsLeaderA } from './helpers/auth';

test.describe('AI Import - Paste normalization', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsLeaderA(page);
    await page.goto('/songs');

    await expect(page.getByRole('searchbox', { name: /Buscar por título ou artista/i })).toBeVisible({ timeout: 15000 });
  });

  test('should normalize pasted text in AiSongImportModal via textarea', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: 'Criar', exact: true }).first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    const aiAction = page.getByText('Importar com IA', { exact: true });
    await expect(aiAction).toBeVisible();
    await aiAction.click();

    const textarea = page.locator('textarea[name="rawText"]').first();
    await expect(textarea).toBeVisible();

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

    const expectedDecodedText = "tom: G\n\n[Intro] G C9 Em7 D";
    await expect(textarea).toHaveValue(expectedDecodedText);

    const submitBtn = page.getByRole('button', { name: /Continuar e Organizar/i });
    await expect(submitBtn).toBeEnabled();
  });
});
