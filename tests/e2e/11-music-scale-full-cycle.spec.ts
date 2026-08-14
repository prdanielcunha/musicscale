import { test, expect } from './helpers/base';
import type { Locator, Page } from '@playwright/test';
import { loginAsLeaderA, loginAsMusicianA, loginAsLeaderB } from './helpers/auth';
import {
  getScaleSnapshot,
  getScaleResponses,
  getScaleResponseHistory,
  countNotificationsForScale,
  countActiveResponses,
  getBandScaleSnapshot,
  findNotification
} from './helpers/emulatorAssertions';

const activateTab = async (locator: Locator) => {
  await expect(locator).toBeVisible();
  // The wizard lives in animated bottom sheets on WebKit. Once visible, dispatch
  // the semantic click instead of waiting indefinitely for transform stability.
  await locator.dispatchEvent('click');
};

const openScaleFromList = async (page: Page, scaleId: string) => {
  const card = page.getByTestId(`scale-card-${scaleId}`);
  await expect(card).toBeVisible();
  await card.getByRole('heading', { level: 3 }).click();
  await expect(page.getByTestId('edit-scale-detail-button')).toBeVisible();
};

test.describe('MusicScale full cycle', () => {
  test.describe.configure({
    mode: 'serial',
    retries: 0
  });

  test('A. líder publica a escala', async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    const scaleId = `scale_full_cycle_${project}`;
    const bandScaleId = `bandscale_full_cycle_${project}`;

    const initialScale = await getScaleSnapshot(scaleId);
    expect(initialScale).not.toBeNull();
    expect(initialScale!.status).toBe('draft');
    expect(initialScale!.publishRevision || 0).toBe(0);
    expect(initialScale!.songIds).toHaveLength(2);
    expect(initialScale!.eventAssignments || []).toHaveLength(0);

    const bandScaleSnapshot = await getBandScaleSnapshot(bandScaleId);
    expect(bandScaleSnapshot).not.toBeNull();
    expect(bandScaleSnapshot!.assignments).toHaveLength(2);

    expect(await countNotificationsForScale('org_a', scaleId)).toBe(0);
    expect(await countActiveResponses(scaleId)).toBe(0);

    await loginAsLeaderA(page);
    await page.goto(`/scales/${scaleId}`);
    await page.waitForURL(`**/scales/${scaleId}`);
    await expect(page.getByTestId('detail-song-card-song_a_2')).toBeVisible();

    const btnEdit = page.getByTestId('edit-scale-detail-button');
    await expect(btnEdit).toBeVisible();
    await btnEdit.click();

    const scaleEditor = page.getByTestId('music-scale-modal');
    await expect(scaleEditor).toBeVisible();

    const btnNext = scaleEditor.getByRole('button', { name: /Avançar/i });
    await expect(btnNext).toBeVisible();
    await btnNext.click();

    const cardBandScale = scaleEditor.getByTestId(`link-band-scale-${bandScaleId}`);
    await expect(cardBandScale).toBeVisible();
    await cardBandScale.click();

    await btnNext.click();
    await btnNext.click();

    const btnDraft = scaleEditor.getByTestId('save-scale-draft');
    await expect(btnDraft).toBeVisible();
    await btnDraft.click();
    await expect(scaleEditor).toBeHidden();
    await expect(page.getByText(/Rascunho|Draft/i).first()).toBeVisible();

    expect(await countNotificationsForScale('org_a', scaleId)).toBe(0);
    expect(await countActiveResponses(scaleId)).toBe(0);

    // The draft contract is Firestore, not localStorage. WebKit can delay the
    // local cache write even after the durable document is already correct.
    await expect.poll(async () => {
      const snapshot = await getScaleSnapshot(scaleId);
      return snapshot?.bandScaleId || null;
    }, { timeout: 15_000 }).toBe(bandScaleId);

    // Then wait for the live React list to consume the refreshed snapshot before
    // reopening the scale through the same card a user would click.
    const refreshedCard = page.getByTestId(`scale-card-${scaleId}`);
    await expect(refreshedCard).toBeVisible();
    await expect(refreshedCard).toContainText(/2\s+escalados/i, { timeout: 15_000 });
    await refreshedCard.getByRole('heading', { level: 3 }).click();
    await expect(page.getByTestId('detail-song-card-song_a_2')).toBeVisible();

    const btnEditAgain = page.getByTestId('edit-scale-detail-button');
    await expect(btnEditAgain).toBeVisible();
    await btnEditAgain.click();
    await expect(scaleEditor).toBeVisible();

    const reviewStep = scaleEditor.getByRole('button', { name: 'Revisão', exact: true }).first();
    await expect(reviewStep).toBeVisible();
    await activateTab(reviewStep);

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

    const scaleSnapshot = await getScaleSnapshot(scaleId);
    expect(scaleSnapshot).not.toBeNull();
    expect(scaleSnapshot!.publishRevision).toBe(1);
    expect(scaleSnapshot!.status).toBe('published');
    expect(scaleSnapshot!.eventAssignments).toHaveLength(2);

    expect(await countNotificationsForScale('org_a', scaleId)).toBeGreaterThan(0);
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
    const acceptPromise = page.waitForResponse(response =>
      response.url().includes(`/api/v1/music-scales/${scaleId}/my-response`) && response.request().method() === 'POST'
    );
    await btnAccept.click();
    expect((await acceptPromise).status()).toBe(200);
    await expect(page.getByText(/Presença confirmada/i).first()).toBeVisible();

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
    const maybePromise = page.waitForResponse(response =>
      response.url().includes(`/api/v1/music-scales/${scaleId}/my-response`) && response.request().method() === 'POST'
    );
    await btnMaybe.click();
    expect((await maybePromise).status()).toBe(200);
    await expect(page.getByText(/Você ainda não confirmou|Ainda não confirmada/i).first()).toBeVisible();

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
    const declinePromise = page.waitForResponse(response =>
      response.url().includes(`/api/v1/music-scales/${scaleId}/my-response`) && response.request().method() === 'POST'
    );
    await submitReason.click();
    expect((await declinePromise).status()).toBe(200);
    await expect(page.getByText(/Você informou que não poderá/i).first()).toBeVisible();

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
    const bandScaleId = `bandscale_full_cycle_${project}`;

    const prevScale = await getScaleSnapshot(scaleId);
    expect(prevScale).not.toBeNull();
    const prevPublishRev = prevScale!.publishRevision || 1;

    await loginAsLeaderA(page);
    await page.goto(`/band-scales/${bandScaleId}`);
    await page.waitForURL(`**/band-scales/${bandScaleId}`);

    const editBandBtn = page.getByTestId('edit-scale-detail-button');
    await expect(editBandBtn).toBeVisible();
    await editBandBtn.click();

    const bandEditor = page.getByTestId('band-scale-modal');
    await expect(bandEditor).toBeVisible();

    const formationStep = bandEditor.getByRole('button', { name: 'Formação', exact: true }).first();
    await expect(formationStep).toBeVisible();
    await activateTab(formationStep);

    const viewport = page.viewportSize();
    const compactBandBuilder = !!viewport && viewport.width < 1024;
    const bandBuilderTabs = bandEditor.locator('div.lg\\:hidden').filter({ hasText: /Formação/ }).first();
    if (compactBandBuilder) {
      await expect(bandBuilderTabs).toBeVisible();
      await activateTab(bandBuilderTabs.locator('button').nth(1));
    }

    const removeBtn = bandEditor.getByTestId('remove-assignment-user_musician_a2-instrument_guitar');
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    if (compactBandBuilder) await activateTab(bandBuilderTabs.locator('button').nth(0));
    const selectKeyInst = bandEditor.getByTestId('select-instrument-instrument_keyboard');
    await expect(selectKeyInst).toBeVisible();
    await selectKeyInst.click();
    if (compactBandBuilder) await activateTab(bandBuilderTabs.locator('button').nth(1));

    const btnShowAll = bandEditor.getByRole('button', { name: /Mostrar todos/i });
    if (await btnShowAll.isVisible().catch(() => false)) await btnShowAll.click();

    const addBtn = bandEditor.getByTestId('add-assignment-user_musician_a3-instrument_keyboard');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const bandReviewStep = bandEditor.getByRole('button', { name: 'Revisão', exact: true }).first();
    await activateTab(bandReviewStep);
    const saveBandBtn = bandEditor.getByRole('button', { name: /Salvar Escala/i }).first();
    await expect(saveBandBtn).toBeVisible();
    await saveBandBtn.click();
    await expect(bandEditor).toBeHidden();

    const updatedBand = await getBandScaleSnapshot(bandScaleId);
    expect(updatedBand).not.toBeNull();
    expect(updatedBand!.assignments.some((a: any) => a.userId === 'user_musician_a2' && a.instrumentId === 'instrument_guitar')).toBe(false);
    expect(updatedBand!.assignments.some((a: any) => a.userId === 'user_musician_a3' && a.instrumentId === 'instrument_keyboard')).toBe(true);

    // Cross back to the real list and open the current card instead of forcing a
    // deep-link while the BandScale refresh is still settling.
    await page.goto('/scales');
    await expect(page.getByRole('heading', { name: 'Escalas Musicais' })).toBeVisible();
    await openScaleFromList(page, scaleId);
    await expect(page.getByTestId('detail-song-card-song_a_2')).toBeVisible();

    const editMusicBtn = page.getByTestId('edit-scale-detail-button');
    await editMusicBtn.click();
    const scaleEditor = page.getByTestId('music-scale-modal');
    await expect(scaleEditor).toBeVisible();
    const musicReviewStep = scaleEditor.getByRole('button', { name: 'Revisão', exact: true }).first();
    await activateTab(musicReviewStep);

    const publishPromise = page.waitForResponse(response =>
      response.url().includes(`/api/v1/music-scales/${scaleId}/publish`) && response.request().method() === 'POST'
    );
    const republishBtn = scaleEditor.getByTestId('publish-scale');
    await republishBtn.click();
    expect((await publishPromise).status()).toBe(200);
    await expect(scaleEditor).toBeHidden();

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
      for await (const chunk of stream) content += chunk;
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
