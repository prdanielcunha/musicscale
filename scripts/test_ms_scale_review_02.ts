import { normalizeScaleSongSettings, applyScaleSongSettings } from '../utils/scaleSongSettings';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
    if (condition) {
        console.log(`✅ [PASS] ${message}`);
        passed++;
    } else {
        console.error(`❌ [FAIL] ${message}`);
        failed++;
    }
}

async function runTests() {
    console.log("=== A. normalizeScaleSongSettings ===");
    
    const inputSettings = {
        "song1": { key: " C#m ", bpm: " 120 " as any },
        "song2": { key: "", bpm: NaN as any },
        "song3": { key: "D", bpm: "120abc" as any },
        "song4": { bpm: 15 },
        "song5": { bpm: 305 },
        "song6": { key: "E", bpm: 140 },
        "orphan": { key: "F" }
    };
    
    const activeIds = ["song1", "song2", "song3", "song4", "song5", "song6"];
    const normalized = normalizeScaleSongSettings(activeIds, inputSettings);
    
    assert(normalized["song1"]?.key === "C#m", "Trim da chave em song1");
    assert(normalized["song1"]?.bpm === 120, "Aceita string estritamente numérica em runtime");
    assert(normalized["song2"] === undefined, "Remove entradas vazias");
    assert(normalized["song3"]?.bpm === undefined, "Rejeita bpm string parcialmente numérico");
    assert(normalized["song4"] === undefined, "Rejeita bpm abaixo de 20");
    assert(normalized["song5"] === undefined, "Rejeita bpm acima de 300");
    assert(normalized["song6"]?.key === "E" && normalized["song6"]?.bpm === 140, "Mantém settings válidos");
    assert(normalized["orphan"] === undefined, "Remove IDs órfãos");
    assert(normalized !== inputSettings, "Não modifica o input original");

    console.log("\n=== B. applyScaleSongSettings ===");
    const globalSong = { id: "song1", key: "C", originalKey: "C", selectedKey: "C", chords: "C\n[C] Hello" } as any;
    const settingsLocal = { key: "D", bpm: 110 };
    const applied = applyScaleSongSettings(globalSong, settingsLocal);
    
    assert(globalSong.key === "C", "Não modifica música global");
    assert(applied.key === "D", "Aplica Tom local");
    assert(applied.bpm === 110, "Aplica BPM");
    assert(applied.originalKey === "C", "Mantém originalKey");
    assert(applied.selectedKey === "D", "selectedKey recebe o tom de override");
    assert(applied.chords.includes("[D]"), "Cifra transposta");

    // Without source
    const songNoSource = { id: "song2", chords: "C\n[C] Hello" } as any;
    const appliedNoSource = applyScaleSongSettings(songNoSource, { key: "D" });
    assert(appliedNoSource.chords.includes("[C]"), "Não transpõe sem tom base");

    console.log("\n=== C. Ampliados - Cenários de Origem e Normalização ===");

    // Cenário obrigatório: Ao aplicar override para “E”, a transposição deve partir de “D”, não de “C” nem de “B”.
    const mandatorySong = {
        id: "mandatory",
        selectedKey: "D",
        key: "C",
        originalKey: "B",
        chords: "[D]..."
    } as any;
    const appliedMandatory = applyScaleSongSettings(mandatorySong, { key: "E" });
    // D to E is +2 semitones. [D] becomes [E].
    // If it was transposing from C, +4 semitones would make [D] -> [F#].
    // If it was transposing from B, +5 semitones would make [D] -> [G].
    assert(appliedMandatory.chords === "[E]...", "Cenário Obrigatório: transposição deve partir de selectedKey 'D' (resultado '[E]...')");

    // 1. selectedKey presente tem prioridade.
    const songS1 = { id: "s1", selectedKey: "D", key: "C", originalKey: "B", chords: "[D]" } as any;
    const appliedS1 = applyScaleSongSettings(songS1, { key: "E" });
    assert(appliedS1.chords === "[E]", "Cenário 1: selectedKey presente tem prioridade");

    // 2. selectedKey ausente e key presente usa key.
    const songS2 = { id: "s2", key: "C", originalKey: "B", chords: "[C]" } as any;
    const appliedS2 = applyScaleSongSettings(songS2, { key: "D" });
    assert(appliedS2.chords === "[D]", "Cenário 2: selectedKey ausente e key presente usa key");

    // 3. selectedKey e key ausentes usa originalKey.
    const songS3 = { id: "s3", originalKey: "B", chords: "[B]" } as any;
    const appliedS3 = applyScaleSongSettings(songS3, { key: "C" });
    assert(appliedS3.chords === "[C]", "Cenário 3: selectedKey e key ausentes usa originalKey");

    // 4. nenhuma origem disponível não transpõe a cifra.
    const songS4 = { id: "s4", chords: "[C]" } as any;
    const appliedS4 = applyScaleSongSettings(songS4, { key: "D" });
    assert(appliedS4.chords === "[C]", "Cenário 4: nenhuma origem disponível não transpõe a cifra");

    // 5. a música original não é modificada.
    const songS5 = { id: "s5", selectedKey: "D", key: "C", originalKey: "B", chords: "[D]" } as any;
    applyScaleSongSettings(songS5, { key: "E" });
    assert(songS5.selectedKey === "D" && songS5.chords === "[D]", "Cenário 5: a música original não é modificada");

    // 6. selectedKey do resultado recebe o override.
    const songS6 = { id: "s6", selectedKey: "D", key: "C", originalKey: "B", chords: "[D]" } as any;
    const appliedS6 = applyScaleSongSettings(songS6, { key: "E" });
    assert(appliedS6.selectedKey === "E", "Cenário 6: selectedKey do resultado recebe o override");

    // 7. key do resultado recebe o override apenas conforme o comportamento atual já aprovado da função.
    const songS7 = { id: "s7", selectedKey: "D", key: "C", originalKey: "B", chords: "[D]" } as any;
    const appliedS7 = applyScaleSongSettings(songS7, { key: "E" });
    assert(appliedS7.key === "E", "Cenário 7: key do resultado recebe o override");

    // 8. originalKey permanece inalterado.
    const songS8 = { id: "s8", selectedKey: "D", key: "C", originalKey: "B", chords: "[D]" } as any;
    const appliedS8 = applyScaleSongSettings(songS8, { key: "E" });
    assert(appliedS8.originalKey === "B", "Cenário 8: originalKey permanece inalterado");

    // 9. BPM local válido é aplicado.
    const songS9 = { id: "s9", bpm: 100 } as any;
    const appliedS9 = applyScaleSongSettings(songS9, { bpm: 120 });
    assert(appliedS9.bpm === 120, "Cenário 9: BPM local válido é aplicado");

    // 10. ausência de override retorna o objeto conforme o contrato atual sem mutação indevida.
    const songS10 = { id: "s10", selectedKey: "D", key: "C", originalKey: "B", chords: "[D]" } as any;
    const appliedS10 = applyScaleSongSettings(songS10, undefined);
    assert(appliedS10 === songS10, "Cenário 10: ausência de override retorna o objeto conforme o contrato atual");

    // 11. entradas órfãs são removidas pela normalização.
    const activeIdsS11 = ["songA"];
    const inputSettingsS11 = { "songA": { key: "A" }, "orphan": { key: "B" } };
    const normalizedS11 = normalizeScaleSongSettings(activeIdsS11, inputSettingsS11);
    assert(normalizedS11["orphan"] === undefined, "Cenário 11: entradas órfãs são removidas pela normalização");

    // 12. BPM parcialmente numérico é rejeitado.
    const activeIdsS12 = ["songA"];
    const inputSettingsS12 = { "songA": { bpm: "120abc" as any } };
    const normalizedS12 = normalizeScaleSongSettings(activeIdsS12, inputSettingsS12);
    assert(normalizedS12["songA"] === undefined || normalizedS12["songA"].bpm === undefined, "Cenário 12: BPM parcialmente numérico é rejeitado");

    // 13. BPM abaixo de 20 é rejeitado.
    const activeIdsS13 = ["songA"];
    const inputSettingsS13 = { "songA": { bpm: 19 } };
    const normalizedS13 = normalizeScaleSongSettings(activeIdsS13, inputSettingsS13);
    assert(normalizedS13["songA"] === undefined || normalizedS13["songA"].bpm === undefined, "Cenário 13: BPM abaixo de 20 é rejeitado");

    // 14. BPM acima de 300 é rejeitado.
    const activeIdsS14 = ["songA"];
    const inputSettingsS14 = { "songA": { bpm: 301 } };
    const normalizedS14 = normalizeScaleSongSettings(activeIdsS14, inputSettingsS14);
    assert(normalizedS14["songA"] === undefined || normalizedS14["songA"].bpm === undefined, "Cenário 14: BPM acima de 300 é rejeitado");

    // 15. string numérica válida é normalizada.
    const activeIdsS15 = ["songA"];
    const inputSettingsS15 = { "songA": { bpm: "120" as any } };
    const normalizedS15 = normalizeScaleSongSettings(activeIdsS15, inputSettingsS15);
    assert(normalizedS15["songA"]?.bpm === 120, "Cenário 15: string numérica válida é normalizada");

    // 16. key recebe trim.
    const activeIdsS16 = ["songA"];
    const inputSettingsS16 = { "songA": { key: " C#  " } };
    const normalizedS16 = normalizeScaleSongSettings(activeIdsS16, inputSettingsS16);
    assert(normalizedS16["songA"]?.key === "C#", "Cenário 16: key recebe trim");

    // 17. entrada completamente vazia é removida.
    const activeIdsS17 = ["songA"];
    const inputSettingsS17 = { "songA": { key: "", bpm: undefined } };
    const normalizedS17 = normalizeScaleSongSettings(activeIdsS17, inputSettingsS17);
    assert(normalizedS17["songA"] === undefined, "Cenário 17: entrada completamente vazia é removida");

    console.log(`\n=== Resultados: ${passed} passaram, ${failed} falharam ===`);
    if (failed > 0) process.exit(1);
}

runTests();
