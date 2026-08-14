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

    await page.goto(`/scales/${scaleId}`);
    await page.waitForURL(`**/scales/${scaleId}`);

    // Confirm the exact deep-linked scale through deterministic content rather
    // than a time string repeated by every seeded scale card.
    await expect(page.getByTestId('detail-song-card-song_a_2')).toBeVisible();
    const btnEdit = page.getByTestId('edit-scale-detail-button');
    await expect(btnEdit).toBeVisible();

    await btnEdit.click();
    const scaleEditor = page.getByTestId('music-scale-modal');
    await expect(scaleEditor).toBeVisible();

    const btnNext = scaleEditor.getByRole('button', { name: /Avançar/i });
    await expect(btnNext).toBeVisible();
    await btnNext.click();

    const cardBandScale = scaleEditor.getByTestId(`link-band-scale-bandscale_full_cycle_${project}`);
    await expect(cardBandScale).toBeVisible();
    await cardBandScale.click();

    await btnNext.click();
    await btnNext.click();

    const btnDraft = scaleEditor.getByTestId('save-scale-draft');
    await expect(btnDraft).toBeVisible();
    await btnDraft.click();
    await expect(scaleEditor).toBeHidden();
    await expect(page.getByText(/Rascunho|Draft/i).first()).toBeVisible();

    const midNotifs = await countNotificationsForScale('org_a', scaleId);
    const midResponses = await countActiveResponses(scaleId);
    expect(midNotifs).toBe(0);
    expect(midResponses).toBe(0);

    const btnEditAgain = page.getByTestId('edit-scale-detail-button');
    await expect(btnEditAgain).toBeVisible();
    await btnEditAgain.click();
    await expect(scaleEditor).toBeVisible();

    const btnNextAgain = scaleEditor.getByRole('button', { name: /Avançar/i });
    await btnNextAgain.click();
    await btnNextAgain.click();
    await btnNextAgain.click();

    const publishPromise = page.waitForResponse(response =>
      response.url().includes(`/api/v1/music-scales/${scaleId}/publish`) && response.request().method() === 'POST'
    );

    const btnPublish = scaleEditor.getByTestId('publish-scale');
    await expect(btnPublish).toBeVisible();
    await btnPublish.click();

    const publishResponse = await publishPromise;
    const publishRequest = publishResponse.request();

    expect(publishRequest.headers()['authorization']).toContain('Bearer ');
    expect(publishRequest.headers()['x-organization-id']).toBe('org_a');
    expect(publishRequest.headers()['idempotency-key']).toBeTruthy();
    expect(publishResponse.status()).toBe(200);

    await expect(scaleEditor).toBeHidden();
    await expect(page.getByText(/Publicado/i).first()).toBeVisible();

    const scaleSnapshot = await getScaleSnapshot(scaleId);
    expect(scaleSnapshot).not.toBeNull();
    expect(scaleSnapshot!.publishRevision).toBe(1);
    expect(scaleSnapshot!.status).toBe('published');
    expect(scaleSnapshot!.eventAssignments).toHaveLength(2);

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

    await page.goto('/notifications');
    await page.waitForURL('**/notifications');

    const targetNotifId = `notification-card-org_a_scale_full_cycle_${project}_rev1_user_musician_a_music_scale_assignment`;
    const notifItem = page.getByTestId(targetNotifId);
    await expect(notifItem).toBeVisible();
    await notifItem.click();

    const viewFullBtn = page.getByRole('button', { name: /Ver escala completa/i });
    await expect(viewFullBtn).toBeVisible();
    await viewFullBtn.click();

    await page.waitForURL(`**/scales/${scaleId}`);
    await expect(page.getByText('Vocal', { exact: true }).first()).toBeVisible();

    const btnAccept = page.getByTestId('response-accepted');
    await expect(btnAccept).toBeVisible();
    await btnAccept.click();
    await expect(page.getByText(/Confirmo/i).first()).toBeVisible();

    const responsesAccepted = await getScaleResponses(scaleId);
    const respAccepted = responsesAccepted.find(r => r.userId === 'user_musician_a' && r.active === true);
    expect(respAccepted).toBeTruthy();
    expect(respAccepted!.status).toBe('accepted');
    expect(respAccepted!.responseRevision).toBeGreaterThan(0);
    expect(respAccepted!.respondedAgainstRevision).toBe(1);

    const historyAccepted = await getScaleResponseHistory(scaleId);
    expect(historyAccepted.length).toBeGreaterThan(0);
    expect(historyAccepted[historyAccepted.length - 1].newStatus).toBe('accepted');

    const btnChange = page.getByTestId('change-response');
    await expect(btnChange).toBeVisible();
    await btnChange.click();

    const btnMaybe = page.getByTestId('response-maybe');
    await expect(btnMaybe).toBeVisible();
    await btnMaybe.click();
    await expect(page.getByText(/Ainda não sei/i).first()).toBeVisible();

    const responsesMaybe = await getScaleResponses(scaleId);
    const respMaybe = responsesMaybe.find(r => r.userId === 'user_musician_a' && r.active === true);
    expect(respMaybe).toBeTruthy();
    expect(respMaybe!.status).toBe('maybe');
    expect(respMaybe!.responseRevision).toBeGreaterThan(respAccepted!.responseRevision || 0);

    const historyMaybe = await getScaleResponseHistory(scaleId);
    expect(historyMaybe.length).toBeGreaterThan(historyAccepted.length);
    expect(historyMaybe[historyMaybe.length - 1].newStatus).toBe('maybe');

    await expect(btnChange).toBeVisible();
    await btnChange.click();

    const btnDecline = page.getByTestId('response-declined');
    await expect(btnDecline).toBeVisible();
    await btnDecline.click();

    const inputReason = page.getByTestId('response-reason');
    await expect(inputReason).toBeVisible();
    await inputReason.fill('Imprevisto médico');

    const submitReason = page.getByTestId('submit-response');
    await expect(submitReason).toBeVisible();
    await submitReason.click();

    await expect(page.getByText(/Não poderei/i).first()).toBeVisible();
    await expect(page.getByText('Imprevisto médico', { exact: true }).first()).toBeVisible();

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

    await expect(page.getByText('Situação da Equipe', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Vocal', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Não poderá', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Imprevisto médico', { exact: true }).first()).toBeVisible();
  });

  test('D. líder republica e reconcilia', async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    const scaleId = `scale_full_cycle_${project}`;

    const prevScale = await getScaleSnapshot(scaleId);
    expect(prevScale).not.toBeNull();
    const prevPublishRev = prevScale!.publishRevision || 1;

    await loginAsLeaderA(page);
    await page.goto(`/scales/${scaleId}`);
    await page.waitForURL(`**/scales/${scaleId}`);

    const editBandBtn = page.getByTestId('edit-scale-detail-button');
    await expect(editBandBtn).toBeVisible();
    await editBandBtn.click();

    const scaleEditor = page.getByTestId('music-scale-modal');
    await expect(scaleEditor).toBeVisible();

    const removeBtn = scaleEditor.getByTestId('remove-assignment-user_musician_a2-instrument_guitar');
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    const selectKeyInst = scaleEditor.getByTestId('select-instrument-instrument_keyboard');
    await expect(selectKeyInst).toBeVisible();
    await selectKeyInst.click();

    const btnShowAll = scaleEditor.getByRole('button', { name: /Mostrar todos/i });
    if (await btnShowAll.isVisible().catch(() => false)) {
      await btnShowAll.click();
    }

    const addBtn = scaleEditor.getByTestId('add-assignment-user_musician_a3-instrument_keyboard');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const btnNext = scaleEditor.getByRole('button', { name: /Avançar/i });
    await expect(btnNext).toBeVisible();
    await btnNext.click();
    await btnNext.click();
    await btnNext.click();

    const publishPromise = page.waitForResponse(response =>
      response.url().includes(`/api/v1/music-scales/${scaleId}/publish`) && response.request().method() === 'POST'
    );
    const republishBtn = scaleEditor.getByTestId('publish-scale');
    await expect(republishBtn).toBeVisible();
    await republishBtn.click();

    const publishResponse = await publishPromise;
    expect(publishResponse.status()).toBe(200);

    await expect(scaleEditor).toBeHidden();
    await expect(page.getByText(/Publicado/i).first()).toBeVisible();

    const scaleSnapshot = await getScaleSnapshot(scaleId);
    expect(scaleSnapshot).not.toBeNull();
    expect(scaleSnapshot!.publishRevision).toBe(prevPublishRev + 1);

    const responses = await getScaleResponses(scaleId);
    const activeResponses = responses.filter(r => r.active === true);
    const inactiveResponses = responses.filter(r => r.active === false);

    expect(activeResponses).toHaveLength(2);
    expect(activeResponses.some(r => r.userId === 'user_musician_a')).toBe(true);
    expect(activeResponses.some(r => r.userId === 'user_musician_a3')).toBe(true);
    expect(activeResponses.every(r => r.assignmentRevision === prevPublishRev + 1)).toBe(true);

    expect(inactiveResponses.length).toBeGreaterThan(0);
    expect(inactiveResponses.some(r => r.userId === 'user_musician_a' && r.assignmentRevision === 1)).toBe(true);
  });

  test('E. agenda exporta corretamente', async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    const scaleId = `scale_full_cycle_${project}`;

    await loginAsLeaderA(page);
    await page.goto(`/scales/${scaleId}`);
    await page.waitForURL(`**/scales/${scaleId}`);

    const btnAddToCalendar = page.getByRole('button', { name: /Agenda/i });
    await expect(btnAddToCalendar).toBeVisible();
    await btnAddToCalendar.click();

    const linkGoogle = page.getByRole('link', { name: /Google/i });
    await expect(linkGoogle).toBeVisible();
    const href = await linkGoogle.getAttribute('href');
    expect(href).toContain('calendar.google.com');
    expect(href).toContain(encodeURIComponent('Culto Principal'));

    const btnICS = page.getByRole('button', { name: /Apple|ICS|Download/i });
    await expect(btnICS).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await btnICS.click();
    const download = await downloadPromise;

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
    await page.goto(`/scales/${scaleId}`);

    await expect(page.getByTestId('detail-song-card-song_a_2')).not.toBeVisible();

    const pageUrl = page.url();
    if (pageUrl.includes(`/scales/${scaleId}`)) {
      await expect(
        page.getByText(/Escala não encontrada|Acesso negado|Sem permissão/i)
          .or(page.getByRole('heading', { name: /Não encontrado|Acesso negado/i }))
      ).toBeVisible();
    }

    await page.goto('/notifications');
    await page.waitForURL('**/notifications');
    await expect(page.getByText(`Ciclo Completo ${project}`)).not.toBeVisible();
  });
});
