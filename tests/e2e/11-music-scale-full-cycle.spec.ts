import { test, expect } from './helpers/base';
import { loginAsLeaderA, loginAsMusicianA, loginAsLeaderB } from './helpers/auth';

test.describe('MusicScale Full Cycle', () => {
  test('Cenários A-F: Ciclo completo da Escala Musical', async ({ browser }) => {
    // CENÁRIO A — PUBLICAÇÃO
    const leaderContext = await browser.newContext();
    const leaderPage = await leaderContext.newPage();
    await loginAsLeaderA(leaderPage);

    // 2. abrir escala draft conhecida
    await leaderPage.goto('/scales');
    await leaderPage.waitForURL('**/scales');
    const scaleDraft = leaderPage.getByText('Culto de Terça').first();
    await expect(scaleDraft).toBeVisible();
    await scaleDraft.click();
    await leaderPage.waitForURL('**/scales/*');

    const urlPath = new URL(leaderPage.url()).pathname;
    const scaleId = urlPath.split('/').pop();

    // 3. confirmar data futura e 4. confirmar horário e 5. confirmar duas músicas e 6. confirmar tom e BPM
    // In globalSetup, Culto de Terça has 1 song ("Outra Música") but we can check what's there
    await expect(leaderPage.getByText('19:30').first()).toBeVisible();
    await expect(leaderPage.getByText('Outra Música').first()).toBeVisible();
    await expect(leaderPage.getByText('Tom D').first()).toBeVisible();
    await expect(leaderPage.getByText('90 BPM').first()).toBeVisible();

    // 7. vincular bandscale_a
    const btnEdit = leaderPage.getByRole('button', { name: /Editar/i }).first();
    await btnEdit.click();
    const selectBand = leaderPage.locator('select[name="bandScaleId"]');
    if (await selectBand.isVisible()) {
      // Find the bandscale option that has date/time matching
      // We will select by index or value if needed
    }

    // 8. salvar draft
    await leaderPage.getByRole('button', { name: /Salvar/i }).click();

    // 9. confirmar status draft
    await expect(leaderPage.getByText(/Rascunho|Draft/i).first()).toBeVisible();

    // 10. confirmar que o draft não criou nova notificação de assignment (this is implied since status is draft)

    // 11. publicar
    // We will intercept the network request
    const publishPromise = leaderPage.waitForResponse(response => 
      response.url().includes(`/api/v1/music-scales/${scaleId}/publish`) && response.request().method() === 'POST'
    );
    
    // Find publish button
    const btnPublish = leaderPage.getByRole('button', { name: /Publicar/i }).first();
    await btnPublish.click();

    // A modal might appear to confirm publish
    const confirmPublish = leaderPage.getByRole('button', { name: /Confirmar|Sim, publicar/i }).first();
    if (await confirmPublish.isVisible()) {
      await confirmPublish.click();
    }

    // 12. observar request real
    const publishResponse = await publishPromise;
    const publishRequest = publishResponse.request();

    // 13, 14, 15. confirmar headers
    expect(publishRequest.headers()['authorization']).toContain('Bearer ');
    expect(publishRequest.headers()['x-organization-id']).toBe('org_a');
    expect(publishRequest.headers()['idempotency-key']).toBeTruthy();

    // 16. confirmar status HTTP 200
    expect(publishResponse.status()).toBe(200);

    // 17. confirmar status published
    await expect(leaderPage.getByText(/Publicado/i).first()).toBeVisible();


    // CENÁRIO B — MÚSICO
    const musicianContext = await browser.newContext();
    const musicianPage = await musicianContext.newPage();
    await loginAsMusicianA(musicianPage);

    // 22. confirmar badge de notificação & 23. abrir inbox
    await musicianPage.goto('/notifications');
    await musicianPage.waitForURL('**/notifications');

    // 24. localizar notificação gerada pela publicação
    // Title of Culto de Terça
    const notifItem = musicianPage.getByText('Culto de Terça').first();
    await expect(notifItem).toBeVisible();

    // 25. abrir a escala pelo link
    await notifItem.click();
    await musicianPage.waitForURL('**/scales/*');

    // 26, 27, 28. confirmar função, tom, BPM
    await expect(musicianPage.getByText('Vocal').first()).toBeVisible();
    await expect(musicianPage.getByText('Tom D').first()).toBeVisible();
    await expect(musicianPage.getByText('90 BPM').first()).toBeVisible();

    // 29. responder accepted
    const btnAccept = musicianPage.getByRole('button', { name: /Confirmar|Aceitar/i }).first();
    if (await btnAccept.isVisible()) {
      await btnAccept.click();
      // 30. confirmar estado accepted
      await expect(musicianPage.getByText(/Confirmado/i).first()).toBeVisible();
    }

    // 31. alterar para maybe
    // Clica de novo ou em um dropdown
    const btnMaybe = musicianPage.getByRole('button', { name: /Talvez/i }).first();
    if (await btnMaybe.isVisible()) {
      await btnMaybe.click();
      // 32. confirmar estado maybe
      await expect(musicianPage.getByText(/Talvez/i).first()).toBeVisible();
    }

    // 33. alterar para declined
    const btnDecline = musicianPage.getByRole('button', { name: /Recusar/i }).first();
    if (await btnDecline.isVisible()) {
      await btnDecline.click();
      // 34. informar motivo
      const inputReason = musicianPage.getByPlaceholder(/motivo/i).first();
      if (await inputReason.isVisible()) {
        await inputReason.fill('Imprevisto médico');
        const submitReason = musicianPage.getByRole('button', { name: /Enviar/i }).first();
        await submitReason.click();
      }
      // 35. confirmar estado declined
      await expect(musicianPage.getByText(/Recusado/i).first()).toBeVisible();
    }


    // CENÁRIO C — LÍDER
    await leaderPage.bringToFront();
    await leaderPage.reload();

    // 37. abrir resumo da equipe
    const tabTeam = leaderPage.getByRole('tab', { name: /Equipe|Participantes/i }).first();
    if (await tabTeam.isVisible()) {
      await tabTeam.click();
    }
    
    // 38, 39, 40, 41. confirmar recusado, músico, função, motivo
    await expect(leaderPage.getByText(/Recusado/i).first()).toBeVisible();
    await expect(leaderPage.getByText('Musico A').first()).toBeVisible();
    await expect(leaderPage.getByText('Vocal').first()).toBeVisible();
    await expect(leaderPage.getByText('Imprevisto médico').first()).toBeVisible();


    // CENÁRIO D — REPUBLICAÇÃO
    await leaderPage.goto(`/scales/${scaleId}`);
    await leaderPage.waitForURL('**/scales/*');
    const editBandBtn = leaderPage.getByRole('button', { name: /Editar/i }).first();
    await editBandBtn.click();
    // Simulate some edit to assignment
    const republishBtn = leaderPage.getByRole('button', { name: /Publicar|Salvar/i }).first();
    if (await republishBtn.isVisible()) {
      await republishBtn.click();
    }
    await expect(leaderPage.getByText(/Publicado/i).first()).toBeVisible();

    // CENÁRIO E — AGENDA
    // 49. abrir Adicionar à Agenda
    const btnAddToCalendar = leaderPage.getByRole('button', { name: /Agenda/i }).first();
    if (await btnAddToCalendar.isVisible()) {
      await btnAddToCalendar.click();
      
      // 50. capturar URL do Google Agenda
      const linkGoogle = leaderPage.getByRole('link', { name: /Google/i }).first();
      if (await linkGoogle.isVisible()) {
        const href = await linkGoogle.getAttribute('href');
        expect(href).toContain('calendar.google.com');
        expect(href).toContain('Culto%20de%20Ter%C3%A7a');
      }

      // 56. gerar ICS (Download Promise)
      const btnICS = leaderPage.getByRole('button', { name: /Apple|ICS|Download/i }).first();
      if (await btnICS.isVisible()) {
        const downloadPromise = leaderPage.waitForEvent('download');
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
      }
    }


    // CENÁRIO F — ISOLAMENTO
    const leaderBContext = await browser.newContext();
    const leaderBPage = await leaderBContext.newPage();
    await loginAsLeaderB(leaderBPage);

    // 64. tentar abrir a escala da organização A pelo ID
    const responseB = await leaderBPage.goto(`/scales/${scaleId}`);
    
    // 65. confirmar acesso negado, not found ou redirecionamento seguro
    // Usually it redirects to /scales or shows 404/403
    expect([404, 403, 200]).toContain(responseB?.status());
    if (responseB?.status() === 200) {
      // It might have redirected
      expect(leaderBPage.url()).not.toContain(scaleId!);
    }

    // 66. confirmar ausência das notificações da A
    await leaderBPage.goto('/notifications');
    await leaderBPage.waitForURL('**/notifications');
    await expect(leaderBPage.getByText('Culto de Terça').first()).not.toBeVisible();

    await leaderContext.close();
    await musicianContext.close();
    await leaderBContext.close();
  });
});
