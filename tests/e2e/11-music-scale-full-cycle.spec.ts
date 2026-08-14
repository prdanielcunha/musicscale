import { test, expect } from './helpers/base';
import { loginAsLeaderA, loginAsMusicianA, loginAsLeaderB } from './helpers/auth';
import {
  getScaleSnapshot,
  getScaleResponses,
  getScaleResponseHistory,
  getOrganizationNotifications,
  countNotificationsForScale,
  countActiveResponses,
  getBandScaleSnapshot,
  findNotification
} from './helpers/emulatorAssertions';

test.describe('MusicScale full cycle', () => {
  test.describe.configure({
    mode: 'serial',
    retries: 0
  });

  test('A. líder publica a escala', async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    const scaleId = `scale_full_cycle_${project}`;

    // ETAPA 4: Validação do rascunho via Firestore Emulator antes do fluxo
    const initialScale = await getScaleSnapshot(scaleId);
    expect(initialScale).not.toBeNull();
    expect(initialScale!.status).toBe('draft');
    expect(initialScale!.publishRevision || 0).toBe(0);
    expect(initialScale!.songIds).toHaveLength(2);
    expect(initialScale!.eventAssignments || []).toHaveLength(0);

    const bandScaleSnapshot = await getBandScaleSnapshot(`bandscale_full_cycle_${project}`);
    expect(bandScaleSnapshot).not.toBeNull();
    expect(bandScaleSnapshot.assignments).toHaveLength(2);

    const initialNotifs = await countNotificationsForScale('org_a', scaleId);
    const initialResponses = await countActiveResponses(scaleId);
    expect(initialNotifs).toBe(0);
    expect(initialResponses).toBe(0);

    await loginAsLeaderA(page);

    // Abrir escala draft conhecida
    await page.goto(`/scales/${scaleId}`);
    await page.waitForURL(`**/scales/${scaleId}`);

    // The public scale title is canonically derived from eventType/eventName,
    // not from the legacy fixture `title` field. Verify the exact scale by
    // deterministic content and controls instead of presentation text.
    await expect(page.getByText('19:30')).toBeVisible();
    await expect(page.getByTestId('detail-song-card-song_a_2')).toBeVisible();
    await expect(page.getByTestId('edit-scale-detail-button')).toBeVisible();

    // Editar e vincular bandscale
    const btnEdit = page.getByTestId('edit-scale-detail-button');
    await btnEdit.click();
    await expect(page.getByRole('heading', { name: /Editar Escala/i })).toBeVisible();

    // Avançar para o Passo 1 (Banda)
    const btnNext = page.getByRole('button', { name: /Avançar/i });
    await expect(btnNext).toBeVisible();
    await btnNext.click();

    // Selecionar bandscale
    const cardBandScale = page.getByTestId(`link-band-scale-bandscale_full_cycle_${project}`);
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

    const musicianNotif = await findNotification('org_a', {
      sourceEventId: scaleId,
      recipientId: 'user_musician_a',
      publishRevision: 1
    });
    expect(musicianNotif).not.toBeNull();
    expect(musicianNotif!.link).toBe(`/scales/${scaleId}`);
    expect(musicianNotif!.type).toBe('music_scale_assignment');
  });

  test('B. músico responde presença', async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    const scaleId = `scale_full_cycle_${project}`;

    await loginAsMusicianA(page);

    // Confirmar badge de notificação & abrir inbox
    await page.goto('/notifications');
    await page.waitForURL('**/notifications');

    // Localizar notificação gerada pela publicação por seu test-id determinístico
    const targetNotifId = `notification-card-org_a_scale_full_cycle_${project}_rev1_user_musician_a_music_scale_assignment`;
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

    // Confirmar no Emulator após accepted (ETAPA 9)
    const responsesAccepted = await getScaleResponses(scaleId);
    const respAccepted = responsesAccepted.find(r => r.userId === 'user_musician_a' && r.active === true);
    expect(respAccepted).toBeTruthy();
    expect(respAccepted!.status).toBe('accepted');
    expect(respAccepted!.responseRevision).toBeGreaterThan(0);
    expect(respAccepted!.respondedAgainstRevision).toBe(1);

    const historyAccepted = await getScaleResponseHistory(scaleId);
    expect(historyAccepted.length).toBeGreaterThan(0);
    expect(historyAccepted[historyAccepted.length - 1].newStatus).toBe('accepted');

    // 2. Alterar para maybe (usando botão refresh para reexibir opções)
    const btnChange = page.getByTestId('change-response');
    await expect(btnChange).toBeVisible();
    await btnChange.click();

    const btnMaybe = page.getByTestId('response-maybe');
    await expect(btnMaybe).toBeVisible();
    await btnMaybe.click();
    await expect(page.getByText(/Ainda não sei/i)).toBeVisible();

    // Confirmar no Emulator após maybe (ETAPA 9)
    const responsesMaybe = await getScaleResponses(scaleId);
    const respMaybe = responsesMaybe.find(r => r.userId === 'user_musician_a' && r.active === true);
    expect(respMaybe).toBeTruthy();
    expect(respMaybe!.status).toBe('maybe');
    expect(respMaybe!.responseRevision).toBeGreaterThan(respAccepted!.responseRevision || 0);

    const historyMaybe = await getScaleResponseHistory(scaleId);
    expect(historyMaybe.length).toBeGreaterThan(historyAccepted.length);
    expect(historyMaybe[historyMaybe.length - 1].newStatus).toBe('maybe');

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

    // Confirmar no Emulator após declined (ETAPA 9)
    const responsesDeclined = await getScaleResponses(scaleId);
    const respDeclined = responsesDeclined.find(r => r.userId === 'user_musician_a' && r.active === true);
    expect(respDeclined).toBeTruthy();
    expect(respDeclined!.status).toBe('declined');
    expect(respDeclined!.reason).toBe('Imprevisto médico');
    expect(respDeclined!.responseRevision).toBeGreaterThan(respMaybe!.responseRevision || 0);

    const historyDeclined = await getScaleResponseHistory(scaleId);
    expect(historyDeclined.length).toBeGreaterThan(historyMaybe.length);
    const lastHist = historyDeclined[historyDeclined.length - 1];
    expect(lastHist.newStatus).toBe('declined');
    expect(lastHist.reasonProvided).toBe(true);
  });

  test('C. líder visualiza resumo', async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    const scaleId = `scale_full_cycle_${project}`;

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
    const scaleId = `scale_full_cycle_${project}`;

    // 0. Antes da republicação: ler e guardar os valores do Emulator
    const prevScale = await getScaleSnapshot(scaleId);
    expect(prevScale).not.toBeNull();
    const prevPublishRev = prevScale!.publishRevision || 1;

    await loginAsLeaderA(page);
    await page.goto(`/scales/${scaleId}`);
    await page.waitForURL(`**/scales/${scaleId}`);

    // Clicar em Editar
    const editBandBtn = page.getByTestId('edit-scale-detail-button');
    await expect(editBandBtn).toBeVisible();
    await editBandBtn.click();
    await expect(page.getByRole('heading', { name: /Editar Escala/i })).toBeVisible();

    // Estamos no Passo 1: "Banda".
    // Vamos remover 'user_musician_a2' de 'instrument_guitar'
    const removeBtn = page.getByTestId('remove-assignment-user_musician_a2-instrument_guitar');
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    // Vamos selecionar o instrumento teclado
    const selectKeyInst = page.getByTestId('select-instrument-instrument_keyboard');
    await expect(selectKeyInst).toBeVisible();
    await selectKeyInst.click();

    // Mostrar todos os integrantes se necessário
    const btnShowAll = page.getByRole('button', { name: /Mostrar todos/i });
    if (await btnShowAll.isVisible()) {
      await btnShowAll.click();
    }

    // Adicionar user_musician_a3 como instrument_keyboard
    const addBtn = page.getByTestId('add-assignment-user_musician_a3-instrument_keyboard');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Avançar até o passo de Revisão
    const btnNext = page.getByRole('button', { name: /Avançar/i });
    await expect(btnNext).toBeVisible();
    await btnNext.click(); // Avança para Passo 2 (Músicas)
    await btnNext.click(); // Avança para Passo 3 (Observações/Revisão)
    await btnNext.click(); // Avança para Passo 4 (Revisão final)

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

    // ETAPA 11: Validar no Firestore que a revisão subiu para 2, as antigas foram inativadas e novas foram criadas
    const scaleSnapshot = await getScaleSnapshot(scaleId);
    expect(scaleSnapshot).not.toBeNull();
    expect(scaleSnapshot!.publishRevision).toBe(prevPublishRev + 1);

    const responses = await getScaleResponses(scaleId);
    const activeResponses = responses.filter(r => r.active === true);
    const inactiveResponses = responses.filter(r => r.active === false);

    // Deve haver exatamente 2 respostas ativas (uma para user_musician_a no vocal e uma para user_musician_a3 no keyboard)
    expect(activeResponses).toHaveLength(2);
    expect(activeResponses.some(r => r.userId === 'user_musician_a')).toBe(true);
    expect(activeResponses.some(r => r.userId === 'user_musician_a3')).toBe(true);
    expect(activeResponses.every(r => r.assignmentRevision === prevPublishRev + 1)).toBe(true);

    // E as respostas inativas devem incluir as da revisão anterior (revisão 1)
    expect(inactiveResponses.length).toBeGreaterThan(0);
    expect(inactiveResponses.some(r => r.userId === 'user_musician_a' && r.assignmentRevision === 1)).toBe(true);
  });

  test('E. agenda exporta corretamente', async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    const scaleId = `scale_full_cycle_${project}`;

    await loginAsLeaderA(page);
    await page.goto(`/scales/${scaleId}`);
    await page.waitForURL(`**/scales/${scaleId}`);

    // ETAPA 12: Abrir Adicionar à Agenda e validar link Google e download do ICS
    const btnAddToCalendar = page.getByRole('button', { name: /Agenda/i });
    await expect(btnAddToCalendar).toBeVisible();
    await btnAddToCalendar.click();

    // Capturar URL do Google Agenda. Calendar exports use the canonical public
    // title derived from event type/name, matching the visible scale title.
    const linkGoogle = page.getByRole('link', { name: /Google/i });
    await expect(linkGoogle).toBeVisible();
    const href = await linkGoogle.getAttribute('href');
    expect(href).toContain('calendar.google.com');
    expect(href).toContain(encodeURIComponent('Culto Principal'));

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
    expect(content).toContain('SUMMARY:Culto Principal');
    expect(content).toContain('END:VCALENDAR');
  });

  test('F. organização B permanece isolada', async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    const scaleId = `scale_full_cycle_${project}`;

    await loginAsLeaderB(page);

    // ETAPA 13: Tentar abrir a escala da organização A e asseverar que o acesso foi negado/redirecionado com segurança
    await page.goto(`/scales/${scaleId}`);

    // Conteúdo tenant-específico da escala da organização A nunca pode aparecer para B.
    await expect(page.getByTestId('detail-song-card-song_a_2')).not.toBeVisible();

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
    await expect(page.getByText(`Ciclo Completo ${project}`)).not.toBeVisible();
  });
});