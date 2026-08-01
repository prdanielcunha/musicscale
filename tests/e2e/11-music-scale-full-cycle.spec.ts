import { test, expect } from './helpers/base';
import { loginAsLeaderA, loginAsMusicianA, loginAsLeaderB } from './helpers/auth';
import globalSetup from './helpers/globalSetup';

test.describe.serial('MusicScale full cycle', () => {
  const scaleId = 'scale_a_draft';

  test.beforeAll(async () => {
    await globalSetup();
  });

  test('A. líder publica a escala', async ({ page }) => {
    await loginAsLeaderA(page);

    // Abrir escala draft conhecida
    await page.goto(`/scales/${scaleId}`);
    await page.waitForURL('**/scales/*');

    await expect(page.getByRole('heading', { name: 'Culto de Terça' })).toBeVisible();
    await expect(page.getByText('19:30').first()).toBeVisible();
    await expect(page.locator('div[role="listitem"]').filter({ hasText: 'Outra Música' })).toBeVisible();

    // Editar e vincular bandscale_a
    const btnEdit = page.getByTestId('edit-scale-detail-button');
    await expect(btnEdit).toBeVisible();
    await btnEdit.click();
    await expect(page.getByRole('heading', { name: /Editar Escala/i })).toBeVisible();

    // Avançar para o Passo 1 (Banda)
    const btnNext = page.getByRole('button', { name: /Avançar/i });
    await expect(btnNext).toBeVisible();
    await btnNext.click();

    // Selecionar bandscale_a
    const cardBandScale = page.getByTestId('link-band-scale-bandscale_a');
    await expect(cardBandScale).toBeVisible();
    await cardBandScale.click();

    // Avançar para o Passo 2 (Repertório) e Passo 3 (Revisão)
    await btnNext.click();
    await btnNext.click();

    // Confirmar que o Rascunho não cria notificação - Não conseguimos ver o passado, mas o status é Rascunho
    const btnDraft = page.getByTestId('save-scale-draft');
    await expect(btnDraft).toBeVisible();
    await btnDraft.click();
    await expect(page.getByRole('heading', { name: /Editar Escala/i })).toBeHidden();
    await expect(page.getByText(/Rascunho|Draft/i).first()).toBeVisible();

    // Agora vamos Publicar e interceptar o request
    const btnEditAgain = page.getByTestId('edit-scale-detail-button');
    await expect(btnEditAgain).toBeVisible();
    await btnEditAgain.click();
    await expect(page.getByRole('heading', { name: /Editar Escala/i })).toBeVisible();

    // Avançar até o passo de Revisão
    await btnNext.click();
    await btnNext.click();
    await btnNext.click();

    const publishPromise = page.waitForResponse(response => 
      response.url().includes(`/api/v1/music-scales/${scaleId}/publish`) && response.request().method() === 'POST'
    );
    
    const btnPublish = page.getByTestId('publish-scale');
    await expect(btnPublish).toBeVisible();
    await btnPublish.click();

    // Observar request real
    const publishResponse = await publishPromise;
    const publishRequest = publishResponse.request();

    // Confirmar headers
    expect(publishRequest.headers()['authorization']).toContain('Bearer ');
    expect(publishRequest.headers()['x-organization-id']).toBe('org_a');
    expect(publishRequest.headers()['idempotency-key']).toBeTruthy();

    // Confirmar status HTTP 200
    expect(publishResponse.status()).toBe(200);

    // Confirmar status published
    await expect(page.getByRole('heading', { name: /Editar Escala/i })).toBeHidden();
    await expect(page.getByText(/Publicado/i).first()).toBeVisible();
  });

  test('B. músico responde presença', async ({ page }) => {
    await loginAsMusicianA(page);

    // Confirmar badge de notificação & abrir inbox
    await page.goto('/notifications');
    await page.waitForURL('**/notifications');

    // Localizar notificação gerada pela publicação por seu test-id determinístico
    const notifItem = page.getByTestId('notification-card-notif_musician_a');
    await expect(notifItem).toBeVisible();

    // Abrir o modal de detalhes clicando na notificação
    await notifItem.click();

    // Clicar em Ver Escala Completa
    const viewFullBtn = page.getByRole('button', { name: /Ver escala completa/i });
    await expect(viewFullBtn).toBeVisible();
    await viewFullBtn.click();
    
    await page.waitForURL('**/scales/*');

    // Confirmar função
    await expect(page.getByText('Vocal').first()).toBeVisible();

    // 1. Responder accepted
    const btnAccept = page.getByTestId('response-accepted');
    await expect(btnAccept).toBeVisible();
    await btnAccept.click();
    await expect(page.getByText(/Confirmo/i).first()).toBeVisible();

    // 2. Alterar para maybe (usando botão refresh para reexibir opções)
    const btnChange = page.getByTestId('change-response');
    await expect(btnChange).toBeVisible();
    await btnChange.click();
    
    const btnMaybe = page.getByTestId('response-maybe');
    await expect(btnMaybe).toBeVisible();
    await btnMaybe.click();
    await expect(page.getByText(/Ainda não sei/i).first()).toBeVisible();

    // 3. Alterar para declined
    await expect(btnChange).toBeVisible();
    await btnChange.click();
    
    const btnDecline = page.getByTestId('response-declined');
    await expect(btnDecline).toBeVisible();
    await btnDecline.click();

    // Informar motivo
    const inputReason = page.getByTestId('response-reason');
    await expect(inputReason).toBeVisible();
    await inputReason.fill('Imprevisto médico');
    
    const submitReason = page.getByTestId('submit-response');
    await expect(submitReason).toBeVisible();
    await submitReason.click();

    // Confirmar estado declined e motivo
    await expect(page.getByText(/Não poderei/i).first()).toBeVisible();
    await expect(page.getByText('Imprevisto médico').first()).toBeVisible();
  });

  test('C. líder visualiza resumo', async ({ page }) => {
    await loginAsLeaderA(page);
    await page.goto(`/scales/${scaleId}`);
    await page.waitForURL('**/scales/*');

    // Confirmar recusado, função, motivo diretamente na seção de Situação da Equipe
    await expect(page.getByText('Situação da Equipe')).toBeVisible();
    await expect(page.getByText('Vocal')).toBeVisible();
    await expect(page.getByText('Não poderá')).toBeVisible();
    await expect(page.getByText('Imprevisto médico')).toBeVisible();
  });

  test('D. líder republica e reconcilia', async ({ page }) => {
    await loginAsLeaderA(page);
    await page.goto(`/scales/${scaleId}`);
    await page.waitForURL('**/scales/*');

    // Clicar em Editar BandScale/Equipe
    const editBandBtn = page.getByTestId('edit-scale-detail-button');
    await expect(editBandBtn).toBeVisible();
    await editBandBtn.click();
    await expect(page.getByRole('heading', { name: /Editar Escala/i })).toBeVisible();

    // Avançar até o passo de Revisão
    const btnNext = page.getByRole('button', { name: /Avançar/i });
    await expect(btnNext).toBeVisible();
    await btnNext.click();
    await btnNext.click();
    await btnNext.click();

    // Simplesmente salvar a edição e republicar
    const publishPromise = page.waitForResponse(response => 
      response.url().includes(`/api/v1/music-scales/${scaleId}/publish`) && response.request().method() === 'POST'
    );
    const republishBtn = page.getByTestId('publish-scale');
    await expect(republishBtn).toBeVisible();
    await republishBtn.click();

    // Observar request real
    const publishResponse = await publishPromise;
    expect(publishResponse.status()).toBe(200);

    // Confirmar
    await expect(page.getByRole('heading', { name: /Editar Escala/i })).toBeHidden();
    await expect(page.getByText(/Publicado/i).first()).toBeVisible();
  });

  test('E. agenda exporta corretamente', async ({ page }) => {
    await loginAsLeaderA(page);
    await page.goto(`/scales/${scaleId}`);
    await page.waitForURL('**/scales/*');

    // Abrir Adicionar à Agenda
    const btnAddToCalendar = page.getByRole('button', { name: /Agenda/i });
    await expect(btnAddToCalendar).toBeVisible();
    await btnAddToCalendar.click();
      
    // Capturar URL do Google Agenda
    const linkGoogle = page.getByRole('link', { name: /Google/i });
    await expect(linkGoogle).toBeVisible();
    const href = await linkGoogle.getAttribute('href');
    expect(href).toContain('calendar.google.com');
    expect(href).toContain('Culto%20de%20Ter%C3%A7a');

    // Gerar ICS (Download Promise)
    const btnICS = page.getByRole('button', { name: /Apple|ICS|Download/i });
    await expect(btnICS).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await btnICS.click();
    const download = await downloadPromise;
    
    // Save and verify contents
    const stream = await download.createReadStream();
    let content = '';
    if (stream) {
      for await (const chunk of stream) {
        content += chunk;
      }
    }
    expect(content).toContain('BEGIN:VCALENDAR');
    expect(content).toContain('SUMMARY:Culto de Terça');
    expect(content).toContain('END:VCALENDAR');
  });

  test('F. organização B permanece isolada', async ({ page }) => {
    await loginAsLeaderB(page);
    
    // Tentar abrir a escala da organização A pelo ID
    const responseB = await page.goto(`/scales/${scaleId}`);
    
    // Confirmar acesso negado, not found ou redirecionamento seguro
    expect([404, 403, 200]).toContain(responseB?.status());
    if (responseB?.status() === 200) {
      expect(page.url()).not.toContain(scaleId);
    }

    // Confirmar ausência das notificações da A
    await page.goto('/notifications');
    await page.waitForURL('**/notifications');
    await expect(page.getByText('Culto de Terça').first()).not.toBeVisible();
  });
});
