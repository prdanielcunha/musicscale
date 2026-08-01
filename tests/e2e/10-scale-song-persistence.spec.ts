import { test, expect } from './helpers/base';
import { loginAsLeaderA } from './helpers/auth';

test.describe('Scale Song Persistence', () => {
  test('Líder ajusta tom e BPM na escala draft e verifica que não afeta o global', async ({ page }) => {
    // 1. loginAsLeaderA
    await loginAsLeaderA(page);
    
    // 2. abrir a escala draft conhecida ("Culto de Terça")
    await page.goto('/scales');
    await page.waitForURL('**/scales');
    const cultoTerca = page.getByText('Culto de Terça').first();
    await expect(cultoTerca).toBeVisible();
    await cultoTerca.click();
    await page.waitForURL('**/scales/*');
    
    // 3. clicar em Editar (Editar escala)
    const btnEditScale = page.getByRole('button', { name: /Editar/i }).first();
    await expect(btnEditScale).toBeVisible();
    await btnEditScale.click();

    // 4. localizar uma música por título
    const songItem = page.getByText('Outra Música').first();
    await expect(songItem).toBeVisible();

    // 5. alterar tom específico (clicar na música ou no botão de editar ajustes)
    // No formulário de edição de escala, podemos clicar em um ícone de "Opções" na música
    // Ou talvez abrir o modal de configurações de música (Gear icon)
    // Como a UI depende de ModernScaleForm, normalmente há um ícone de engrenagem ou clica-se na música
    const gearIcon = page.getByRole('button', { name: /Ajustes da música/i }).first();
    if (await gearIcon.isVisible()) {
      await gearIcon.click();
    } else {
      // Tenta clicar no botão genérico de engrenagem
      await page.locator('button').filter({ has: page.locator('svg.lucide-settings') }).first().click();
    }

    // 5 & 6 & 7: Selecionar tom, BPM e escopo
    // O modal deve ser "Ajustes na Escala"
    const selectKey = page.getByLabel(/Tom/i).first();
    await expect(selectKey).toBeVisible();
    await selectKey.selectOption('G');

    const inputBpm = page.getByLabel(/BPM/i).first();
    await expect(inputBpm).toBeVisible();
    await inputBpm.fill('105');

    // Escopo: "Apenas nesta escala" (Normalmente é o default se for "Ajuste local")
    // Vamos procurar um radio ou select.
    const scopeOption = page.getByLabel(/Apenas nesta escala/i).first();
    if (await scopeOption.isVisible()) {
      await scopeOption.check();
    }

    // 8. salvar os ajustes
    const saveSettingsBtn = page.getByRole('button', { name: /Aplicar/i }).first();
    await saveSettingsBtn.click();

    // 8b. Salvar a escala
    const saveScaleBtn = page.getByRole('button', { name: /Salvar/i }).first();
    await saveScaleBtn.click();

    // 9. aguardar resposta real da aplicação
    await page.waitForURL('**/scales/*');
    await expect(page.getByText('Culto de Terça').first()).toBeVisible();

    // 10. fechar (Voltar para escalas)
    await page.goto('/scales');

    // 11. reabrir a mesma escala
    await page.getByText('Culto de Terça').first().click();
    await page.waitForURL('**/scales/*');

    // 12 & 13. confirmar o tom e BPM persistidos na lista
    await expect(page.getByText('Tom G').first()).toBeVisible();
    await expect(page.getByText('105 BPM').first()).toBeVisible();

    // 14 & 15. abrir detalhes e confirmar indicação "Desta escala"
    // Clicar na música para ver detalhes
    await page.getByText('Outra Música').first().click();
    await expect(page.getByText('Ajuste desta escala').first()).toBeVisible();

    // 16 & 17. abrir cifra ou Performance e confirmar tom contextual
    // A cifra deve mostrar 'Tom: G'
    const viewChordsBtn = page.getByRole('button', { name: /Cifra/i }).first();
    await expect(viewChordsBtn).toBeVisible();
    await viewChordsBtn.click();
    // A interface de cifras (ChordsPage ou Performance) 
    await expect(page.getByText('Tom: G').first()).toBeVisible();
    
    // Fechar cifra ou voltar
    await page.goBack();
    await page.goBack();

    // 18. abrir a música fora da escala
    await page.goto('/songs');
    await page.waitForURL('**/songs');
    await page.getByText('Outra Música').first().click();

    // 19 & 20. confirmar que o tom global e BPM permaneceram inalterados 
    // Na base inicial: tom='D', bpm=90
    await expect(page.getByText('Tom D').first()).toBeVisible();
    await expect(page.getByText('90 BPM').first()).toBeVisible();
  });
});
