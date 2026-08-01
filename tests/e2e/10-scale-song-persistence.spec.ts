import { test, expect } from './helpers/base';
import { loginAsLeaderA } from './helpers/auth';

test.describe('Scale Song Persistence', () => {
  test.describe.configure({
    mode: 'serial',
    retries: 0
  });

  test('Líder ajusta tom e BPM na escala draft e verifica que não afeta o global', async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    const scaleId = `scale_song_persistence_${project}`;

    // 0. Confirmar os valores globais originais primeiro
    await loginAsLeaderA(page);
    await page.goto('/songs');
    await page.waitForURL('**/songs');
    const songItemBefore = page.getByTestId('song-card-song_a_2');
    await expect(songItemBefore).toBeVisible();
    await expect(songItemBefore.getByText('D', { exact: true })).toBeVisible();
    await expect(songItemBefore.getByText('90 BPM')).toBeVisible();

    // 1 & 2. abrir a escala draft conhecida ("Culto de Terça") e modo de edição
    await page.goto(`/scales/${scaleId}`);
    await page.waitForURL(`**/scales/${scaleId}`);
    await expect(page.getByRole('heading', { name: `Persistência de Tom ${project}` })).toBeVisible();

    // 3. Clicar no botão "Editar Escala" da barra do cabeçalho de título para entrar no modo edição
    const btnEditScale = page.getByTestId('edit-scale-detail-button');
    await expect(btnEditScale).toBeVisible();
    await btnEditScale.click();

    // Esperar abrir modal/drawer de edição de escala
    await expect(page.getByRole('heading', { name: /Editar Escala/i })).toBeVisible();

    // 4. localizar música e o card respectivo. 'song_a_2' é "Outra Música".
    const songCard = page.getByTestId('scale-song-card-song_a_2');
    await expect(songCard).toBeVisible();
    
    // 5. editor de settings aberto (Ajustes da música)
    const gearBtn = songCard.getByTestId('edit-scale-song-settings-song_a_2');
    await expect(gearBtn).toBeVisible();
    await gearBtn.click();

    // 5 & 6. tom alterado para G, BPM alterado para 105
    const selectKey = songCard.getByTestId('scale-song-key-song_a_2');
    await expect(selectKey).toBeVisible();
    await selectKey.selectOption('G');

    const inputBpm = songCard.getByTestId('scale-song-bpm-song_a_2');
    await expect(inputBpm).toBeVisible();
    await inputBpm.fill('105');

    // 7. escopo local selecionado
    const scopeLocal = songCard.getByTestId('scale-song-scope-local-song_a_2');
    await expect(scopeLocal).toBeVisible();
    await scopeLocal.check();

    // 8. settings aplicados
    const applyBtn = songCard.getByTestId('save-scale-song-settings-song_a_2');
    await expect(applyBtn).toBeVisible();
    await applyBtn.click();
    
    // 9. escala salva
    const saveScaleBtn = page.getByTestId('save-scale-draft');
    await expect(saveScaleBtn).toBeVisible();
    await saveScaleBtn.click();

    // 10. confirmação real de salvamento (espera modal/drawer fechar)
    await expect(page.getByRole('heading', { name: /Editar Escala/i })).toBeHidden();

    // 11 & 12. escala reaberta (ou seja, nós voltamos pra Scale View e vemos os dados).
    await page.waitForURL(`**/scales/${scaleId}`);
    await expect(page.getByRole('heading', { name: `Persistência de Tom ${project}` })).toBeVisible();

    // 13 & 14 & 15. tom G exibido e BPM 105 exibido com o badge "Desta escala"
    const detailSongCard = page.getByTestId('detail-song-card-song_a_2');
    await expect(detailSongCard).toBeVisible();
    await expect(detailSongCard.getByText('G', { exact: true })).toBeVisible();
    await expect(detailSongCard.getByText('105', { exact: true })).toBeVisible();
    
    const localBadges = detailSongCard.getByText('Desta escala');
    await expect(localBadges).toHaveCount(2);

    // 16. abrir cifra contextual utilizando o botão play (Modo Performance) específico da música
    const viewChordsBtn = detailSongCard.getByTestId('performance-mode-button-song_a_2');
    await expect(viewChordsBtn).toBeVisible();
    await viewChordsBtn.click();

    // 17. tom G confirmado na cifra (indicador de tom na barra de controle)
    const tomLabel = page.getByText('Tom', { exact: true });
    await expect(tomLabel).toBeVisible();
    
    const transposedKey = page.getByTestId('chords-viewer-transposed-key');
    await expect(transposedKey).toBeVisible();
    await expect(transposedKey).toHaveText('G');
    
    // Fechar cifra usando o botão de fechar determinístico
    const closeBtn = page.getByTestId('close-chords-viewer');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // 18. música global aberta
    await page.goto('/songs');
    await page.waitForURL('**/songs');
    
    // 19 & 20. tom global D confirmado; BPM global 90 confirmado
    const songItemAfter = page.getByTestId('song-card-song_a_2');
    await expect(songItemAfter).toBeVisible();
    await expect(songItemAfter.getByText('D', { exact: true })).toBeVisible();
    await expect(songItemAfter.getByText('90 BPM')).toBeVisible();
  });
});
