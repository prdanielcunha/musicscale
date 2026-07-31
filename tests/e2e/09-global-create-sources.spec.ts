import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';
import { loginAsLeaderA, loginAsMusicianA } from './helpers/auth';

test.describe('Global Create Sources (Paleta)', () => {
  test('Líder deve ver a paleta completa e interagir com fontes de criação', async ({ page, isMobile }, testInfo) => {
    await loginAsLeaderA(page);
    
    // Abrir Criar
    const createBtn = page.getByRole('button', { name: 'Criar' }).first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    
    // Título "Criar ou importar"
    const surfaceTitle = page.getByText('Criar ou importar').or(page.getByRole('heading', { name: /Criar ou importar/i })).first();
    await expect(surfaceTitle).toBeVisible();
    
    // Verificar se Músicas aparece antes de Escalas
    await expect(page.getByText('Músicas')).toBeVisible();
    await expect(page.getByText('Escalas')).toBeVisible();
    
    // Verificar IA
    const aiAction = page.getByText('Importar com IA');
    await expect(aiAction).toBeVisible();
    
    // Verificar Biblioteca
    const libraryAction = page.getByText('Buscar na Biblioteca Viva');
    await expect(libraryAction).toBeVisible();
    
    // Verificar Manual
    const manualAction = page.getByText('Adicionar manualmente');
    await expect(manualAction).toBeVisible();
    
    // Selecionar IA
    await aiAction.click();
    
    // Confirmar modal real (AiSongImportModal)
    await expect(page.getByText('Importar Música').or(page.getByRole('dialog', { name: /Importar/i }))).toBeVisible();
    
    // Fechar modal sem salvar
    await page.getByRole('button', { name: /Cancelar|Fechar/i }).first().click();
    
    // Abrir Criar novamente
    await createBtn.click();
    await expect(surfaceTitle).toBeVisible();
    
    // Selecionar Biblioteca
    await libraryAction.click();
    
    // Confirmar rota e busca focada
    await expect(page).toHaveURL(/.*\/library/);
    await expect(page.getByPlaceholder(/Buscar por música/i)).toBeFocused();
    
    // Voltar para Home
    await page.goto('/');
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    await expect(surfaceTitle).toBeVisible();
    
    // Selecionar Manual
    await manualAction.click();
    
    // Confirmar formulário real
    await expect(page.getByText('Nova Música').or(page.getByRole('dialog', { name: /Nova Música/i }))).toBeVisible();
    await page.getByRole('button', { name: /Cancelar|Fechar/i }).first().click();
    
    if (isMobile) {
      await createBtn.click();
      await expect(surfaceTitle).toBeVisible();
      
      // Fechar pelo backdrop (o container com bg-black/40)
      await page.mouse.click(10, 10);
      await expect(surfaceTitle).toBeHidden();
      
      // No horizontal overflow
      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflowX).toBeFalsy();
    }
  });

  test('Usuário sem capability não vê a paleta', async ({ page, ignoreErrorPattern }) => {
    ignoreErrorPattern(/missing or insufficient permissions/);
    await loginAsMusicianA(page);
    
    const createBtn = page.getByRole('button', { name: 'Criar' }).first();
    await expect(createBtn).toBeHidden();
  });
});
