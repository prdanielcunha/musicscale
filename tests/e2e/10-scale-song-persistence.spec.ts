import { test, expect } from './helpers/base';
import { loginAsLeaderA, loginAsMusicianA } from './helpers/auth';

test.describe('Scale Song Persistence', () => {
  test('Líder ajusta tom e músico visualiza (Persistência Scale-Specific)', async ({ page, browser }) => {
    // 1. Líder A acessa, edita uma escala existente, e salva um ajuste local
    await loginAsLeaderA(page);
    
    // Navegar para as escalas
    await page.goto('/scales');
    await page.waitForURL('**/scales');
    
    // Abrir a escala "Culto de Domingo"
    const cultoDomingo = page.getByText('Culto de Domingo').first();
    await expect(cultoDomingo).toBeVisible();
    await cultoDomingo.click();
    
    // Esperar carregar a tela de detalhes da escala com a música sintética
    await expect(page.getByText('Música Sintética').first()).toBeVisible();
    
    // Clicar no botão para editar tom e BPM
    const editBtn = page.getByRole('button', { name: /Editar tom e BPM|Editar ajustes/i }).first();
    await expect(editBtn).toBeVisible();
    await editBtn.click();
    
    // Selecionar o tom "D"
    const selectKey = page.locator('select').first();
    await expect(selectKey).toBeVisible();
    await selectKey.selectOption('D');
    
    // Clicar em "Aplicar"
    const applyBtn = page.getByRole('button', { name: 'Aplicar' }).first();
    await expect(applyBtn).toBeVisible();
    await applyBtn.click();
    
    // Verificar que a indicação do tom D e do ajuste de escala estão visíveis
    await expect(page.getByText('Tom D').first()).toBeVisible();
    await expect(page.getByText('Ajuste desta escala').first()).toBeVisible();
    
    // Deslogar líder
    await page.goto('/');
    
    // 2. Músico A acessa para visualizar o tom ajustado
    const musicianPage = await browser.newPage();
    await loginAsMusicianA(musicianPage);
    
    await musicianPage.goto('/scales');
    await musicianPage.waitForURL('**/scales');
    
    // Abrir a mesma escala "Culto de Domingo"
    const cultoDomingoMusician = musicianPage.getByText('Culto de Domingo').first();
    await expect(cultoDomingoMusician).toBeVisible();
    await cultoDomingoMusician.click();
    
    // Verificar que o músico vê a música sintética com o tom ajustado "D"
    await expect(musicianPage.getByText('Tom D').first()).toBeVisible();
    await expect(musicianPage.getByText('Ajuste desta escala').first()).toBeVisible();
    
    // 3. Garantir que o tom padrão na biblioteca global NÃO foi alterado (permanece G)
    await musicianPage.goto('/songs');
    await musicianPage.waitForURL('**/songs');
    
    const songItem = musicianPage.getByText('Música Sintética').first();
    await expect(songItem).toBeVisible();
    await songItem.click();
    
    // Na tela de visualização ou cifra, o tom padrão continua sendo G
    await expect(musicianPage.getByText('Tom G').first()).toBeVisible();
    
    await musicianPage.close();
  });
});
