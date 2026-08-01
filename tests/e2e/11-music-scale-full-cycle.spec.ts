import { test, expect } from './helpers/base';
import { loginAsLeaderA, loginAsMusicianA, loginAsLeaderB } from './helpers/auth';
import {
  getScaleSnapshot,
  getScaleResponses,
  getOrganizationNotifications,
  countNotificationsForScale,
  countActiveResponses
} from './helpers/emulatorAssertions';

test.describe.serial('MusicScale full cycle', () => {
  test('A. líder publica a escala', async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    const scaleId = `scale_a_draft_${project}`;

    // ETAPA 6: Validação do rascunho via Firestore Emulator antes do fluxo
    const initialNotifs = await countNotificationsForScale('org_a', scaleId);
    const initialResponses = await countActiveResponses(scaleId);
    expect(initialNotifs).toBe(0);
    expect(initialResponses).toBe(0);

    await loginAsLeaderA(page);

    // Abrir escala draft conhecida
    await page.goto(`/scales/${scaleId}`);
    await page.waitForURL(`**/scales/${scaleId}`);

    await expect(page.getByRole('heading', { name: `Culto de Terça ${project}` })).toBeVisible();
    await expect(page.getByText('19:30')).toBeVisible();
    await expect(page.getByTestId('detail-song-card-song_a_2')).toBeVisible();

    // Editar e vincular bandscale
    const btnEdit = page.getByTestId('edit-scale-detail-button');
    await expect(btnEdit).toBeVisible();
    await btnEdit.click();
    await expect(page.getByRole('heading', { name: /Editar Escala/i })).toBeVisible();

    // Avançar para o Passo 1 (Banda)
    const btnNext = page.getByRole('button', { name: /Avançar/i });
    await expect(btnNext).toBeVisible();
    await btnNext.click();

    // Selecionar bandscale
    const cardBandScale = page.getByTestId(`link-band-scale-bandscale_a_${project}`);
    await expect(cardBandScale).toBeVisible();
    await cardBandScale.click();

    // Avançar para o Passo 2 (Repertório) e Passo 3 (Revisão)
    await btnNext.click();
    await btnNext.click();

    // Confirmar que o Rascunho não cria notificação/resposta no Firestore Emulator
    const btnDraft = page.getByTestId('save-scale-draft');
    await expect(btnDraft).toBeVisible();
    await btnDraft.click();
    await expect(page.getByRole('heading', { name: /Editar Escala/i })).toBeHidden();
    await expect(page.getByText(/Rascunho|Draft/i)).toBeVisible();

    // Validar via Emulator que o estado de rascunho não gerou notificações ou respostas
    const midNotifs = await countNotificationsForScale('org_a', scaleId);
    const midResponses = await countActiveResponses(scaleId);
    expect(midNotifs).toBe(0);
    expect(midResponses).toBe(0);

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

    // Confirmar status published na UI
    await expect(page.getByRole('heading', { name: /Editar Escala/i })).toBeHidden();
    await expect(page.getByText(/Publicado/i)).toBeVisible();

    // ETAPA 7: Asseveração do Banco via Firestore Emulator após publicação
    const scaleSnapshot = await getScaleSnapshot(scaleId);
    expect(scaleSnapshot).not.toBeNull();
    expect(scaleSnapshot!.publishRevision).toBe(1);
    expect(scaleSnapshot!.status).toBe('published');
    expect(scaleSnapshot!.eventAssignments).toHaveLength(2);

    // ETAPA 8: Verificação de notificações no Firestore Emulator após publicação
    const finalNotifs = await countNotificationsForScale('org_a', scaleId);
    expect(finalNotifs).toBeGreaterThan(0);

    const notifications = await getOrganizationNotifications('org_a');
    const musicianNotif = notifications.find((n: any) => n.recipientId === 'user_musician_a' && n.metadata?.musicScaleId === scaleId);
    expect(musicianNotif).toBeTruthy();
    expect(musicianNotif.publishRevision).toBe(1);
  });

  test('B. músico responde presença', async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    const scaleId = `scale_a_draft_${project}`;

    await loginAsMusicianA(page);

    // Confirmar badge de notificação & abrir inbox
    await page.goto('/notifications');
    await page.waitForURL('**/notifications');

    // Localizar notificação gerada pela publicação por seu test-id determinístico
    const targetNotifId = `notification-card-org_a_scale_a_draft_${project}_rev1_user_musician_a_music_scale_assignment`;
    const notifItem = page.getByTestId(targetNotifId);
    await expect(notifItem).toBeVisible();

    // Abrir o modal de detalhes clicando na notificação
    await notifItem.click();

    // Clicar em Ver Escala Completa
    const viewFullBtn = page.getByRole('button', { name: /Ver escala completa/i });
    await expect(viewFullBtn).toBeVisible();
    await viewFullBtn.click();
    
    await page.waitForURL(`**/scales/${scaleId}`);

    // Confirmar função atribuída
    await expect(page.getByText('Vocal')).toBeVisible();

    // 1. Responder accepted
    const btnAccept = page.getByTestId('response-accepted');
    await expect(btnAccept).toBeVisible();
    await btnAccept.click();
    await expect(page.getByText(/Confirmo/i)).toBeVisible();

    // 2. Alterar para maybe (usando botão refresh para reexibir opções)
    const btnChange = page.getByTestId('change-response');
    await expect(btnChange).toBeVisible();
    await btnChange.click();
    
    const btnMaybe = page.getByTestId('response-maybe');
    await expect(btnMaybe).toBeVisible();
    await btnMaybe.click();
    await expect(page.getByText(/Ainda não sei/i)).toBeVisible();

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

    // Confirmar estado declined e motivo na UI
    await expect(page.getByText(/Não poderei/i)).toBeVisible();
    await expect(page.getByText('Imprevisto médico')).toBeVisible();

    // ETAPA 9: Comprovar resposta persistida corretamente no Firestore Emulator
    const responses = await getScaleResponses(scaleId);
    const activeResponse = responses.find((r: any) => r.userId === 'user_musician_a' && r.active === true);
    expect(activeResponse).toBeTruthy();
    expect(activeResponse.status).toBe('declined');
    expect(activeResponse.reason).toBe('Imprevisto médico');
  });

  test('C. líder visualiza resumo', async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    const scaleId = `scale_a_draft_${project}`;

    await loginAsLeaderA(page);
    await page.goto(`/scales/${scaleId}`);
    await page.waitForURL(`**/scales/${scaleId}`);

    // ETAPA 10: Confirmar recusado, função, motivo diretamente na seção de Situação da Equipe
    await expect(page.getByText('Situação da Equipe')).toBeVisible();
    await expect(page.getByText('Vocal')).toBeVisible();
    await expect(page.getByText('Não poderá')).toBeVisible();
    await expect(page.getByText('Imprevisto médico')).toBeVisible();
  });

  test('D. líder republica e reconcilia', async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    const scaleId = `scale_a_draft_${project}`;

    await loginAsLeaderA(page);
    await page.goto(`/scales/${scaleId}`);
    await page.waitForURL(`**/scales/${scaleId}`);

    // Clicar em Editar
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

    // Republicar e asseverar incremento da revisão e reconciliação dos registros
    const publishPromise = page.waitForResponse(response => 
      response.url().includes(`/api/v1/music-scales/${scaleId}/publish`) && response.request().method() === 'POST'
    );
    const republishBtn = page.getByTestId('publish-scale');
    await expect(republishBtn).toBeVisible();
    await republishBtn.click();

    // Observar request real
    const publishResponse = await publishPromise;
    expect(publishResponse.status()).toBe(200);

    // Confirmar fechamento do editor
    await expect(page.getByRole('heading', { name: /Editar Escala/i })).toBeHidden();
    await expect(page.getByText(/Publicado/i)).toBeVisible();

    // ETAPA 11: Validar no Firestore que a revisão subiu, as antigas foram inativadas e novas foram criadas
    const scaleSnapshot = await getScaleSnapshot(scaleId);
    expect(scaleSnapshot).not.toBeNull();
    expect(scaleSnapshot!.publishRevision).toBe(2);

    const responses = await getScaleResponses(scaleId);
    const activeResponses = responses.filter((r: any) => r.active === true);
    const inactiveResponses = responses.filter((r: any) => r.active === false);

    // Deve haver exatamente 2 respostas ativas (para a nova revisão 2) e 2 inativas (antigas da revisão 1)
    expect(activeResponses).toHaveLength(2);
    expect(inactiveResponses).toHaveLength(2);
    expect(activeResponses.every((r: any) => r.assignmentRevision === 2)).toBe(true);
    expect(inactiveResponses.every((r: any) => r.assignmentRevision === 1)).toBe(true);
  });

  test('E. agenda exporta corretamente', async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    const scaleId = `scale_a_draft_${project}`;

    await loginAsLeaderA(page);
    await page.goto(`/scales/${scaleId}`);
    await page.waitForURL(`**/scales/${scaleId}`);

    // ETAPA 12: Abrir Adicionar à Agenda e validar link Google e download do ICS
    const btnAddToCalendar = page.getByRole('button', { name: /Agenda/i });
    await expect(btnAddToCalendar).toBeVisible();
    await btnAddToCalendar.click();
      
    // Capturar URL do Google Agenda
    const linkGoogle = page.getByRole('link', { name: /Google/i });
    await expect(linkGoogle).toBeVisible();
    const href = await linkGoogle.getAttribute('href');
    expect(href).toContain('calendar.google.com');
    // SUMMARY do Google Calendar link
    expect(href).toContain(encodeURIComponent(`Culto de Terça ${project}`));

    // Gerar ICS (Download Promise)
    const btnICS = page.getByRole('button', { name: /Apple|ICS|Download/i });
    await expect(btnICS).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await btnICS.click();
    const download = await downloadPromise;
    
    // Ler e verificar o arquivo ICS baixado
    const stream = await download.createReadStream();
    let content = '';
    if (stream) {
      for await (const chunk of stream) {
        content += chunk;
      }
    }
    expect(content).toContain('BEGIN:VCALENDAR');
    expect(content).toContain(`SUMMARY:Culto de Terça ${project}`);
    expect(content).toContain('END:VCALENDAR');
  });

  test('F. organização B permanece isolada', async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    const scaleId = `scale_a_draft_${project}`;

    await loginAsLeaderB(page);
    
    // ETAPA 13: Tentar abrir a escala da organização A e asseverar que o acesso foi negado/redirecionado com segurança
    await page.goto(`/scales/${scaleId}`);
    
    // O título "Culto de Terça <project>" não deve estar visível
    await expect(page.getByRole('heading', { name: `Culto de Terça ${project}` })).not.toBeVisible();

    // Se o status da página for 200, garantir que a URL mudou ou exibe mensagem de segurança/erro
    const pageUrl = page.url();
    if (pageUrl.includes(`/scales/${scaleId}`)) {
      await expect(
        page.getByText(/Escala não encontrada|Acesso negado|Sem permissão/i)
          .or(page.getByRole('heading', { name: /Não encontrado|Acesso negado/i }))
      ).toBeVisible();
    }

    // Confirmar ausência de notificações da Org A no inbox do líder B
    await page.goto('/notifications');
    await page.waitForURL('**/notifications');
    await expect(page.getByText(`Culto de Terça ${project}`)).not.toBeVisible();
  });
});
