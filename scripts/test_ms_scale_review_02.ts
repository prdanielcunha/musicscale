import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = dom.window as any;
global.document = dom.window.document;
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true });

import { normalizeScaleSongSettings, applyScaleSongSettings } from '../utils/scaleSongSettings';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
    const globalSong = { id: "song1", key: "C", bpm: 100, originalKey: "C" } as any;
    const settingsLocal = { key: "D", bpm: 110 };
    const applied = applyScaleSongSettings(globalSong, settingsLocal);
    
    assert(globalSong.key === "C", "Não modifica música global");
    assert(applied.key === "D", "Aplica Tom local");

    console.log("\n=== C. Verificações de Código (Fluxos Reais) ===");
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    
    // ScaleSongCard.tsx
    const cardCode = fs.readFileSync(path.join(__dirname, '../components/scales/ScaleSongCard.tsx'), 'utf8');
    assert(!cardCode.includes('draggable={mode === \'setlist\'}'), "ScaleSongCard não é mais draggable por inteiro");
    assert(cardCode.includes('min-w-[44px]') && cardCode.includes('min-h-[44px]'), "ScaleSongCard contém botões com área de toque mínima de 44x44px");
    assert(cardCode.includes('showGlobalConfirm'), "ScaleSongCard possui estado para confirmação global (sem window.confirm)");
    assert(!cardCode.includes('window.confirm'), "ScaleSongCard não usa window.confirm");

    // ModernScaleForm.tsx
    const formCode = fs.readFileSync(path.join(__dirname, '../components/scales/ModernScaleForm.tsx'), 'utf8');
    assert(formCode.includes('normalizeScaleSongSettings'), "ModernScaleForm usa normalizeScaleSongSettings");
    assert(formCode.includes('handleUpdateSongSettings'), "ModernScaleForm centraliza a atualização (handleUpdateSongSettings)");

    // SongDetailModal.tsx
    const detailCode = fs.readFileSync(path.join(__dirname, '../components/songs/SongDetailModal.tsx'), 'utf8');
    assert(detailCode.includes('scaleContext ? initialSong :'), "SongDetailModal preserva initialSong quando scaleContext está presente");

    // ScalesPage.tsx
    const scalesPageCode = fs.readFileSync(path.join(__dirname, '../pages/ScalesPage.tsx'), 'utf8');
    assert(scalesPageCode.includes('normalizeScaleSongSettings(cloneSongIds, scaleToClone.songSettings'), "ScalesPage clona songSettings normalizando-os");

    console.log("\n=== G. i18n ===");
    const ptPath = path.join(__dirname, '../locales/pt.json');
    const pt = JSON.parse(fs.readFileSync(ptPath, 'utf8'));
    assert(!!pt["scaleModal"]?.["confirmationTitle"], "Traduções PT existem para a confirmação");

    console.log(`\n=== Resultados: ${passed} passaram, ${failed} falharam ===`);
    if (failed > 0) process.exit(1);
}
runTests();
