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

    console.log(`\n=== Resultados: ${passed} passaram, ${failed} falharam ===`);
    if (failed > 0) process.exit(1);
}

runTests();
