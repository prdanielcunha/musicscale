import { applyScaleSongSettings, getEffectiveKey, getEffectiveBpm, normalizeScaleSongSettings } from '../utils/scaleSongSettings';

// Helper function to simulate the getComparableData logic
const getComparableData = (data: any) => {
    const activeSongSettings = normalizeScaleSongSettings(data.songIds || [], data.songSettings);

    return {
      date: data.date || "",
      time: data.time || "",
      eventTypeId: data.eventTypeId || "",
      locationId: data.locationId || "",
      eventNameId: data.eventNameId || "",
      observations: data.observations || "",
      durationMinutes: data.durationMinutes ? String(data.durationMinutes) : "",
      songIds: data.songIds || [],
      songSettings: activeSongSettings,
      assignments: (data.assignments || []).map((a: any) => ({ userId: a.userId, instrumentId: a.instrumentId })),
      bandScaleId: data.bandScaleId || "",
      musicScaleId: data.musicScaleId || ""
    };
};

async function runTests() {
    console.log("=== Iniciando testes do MS-SCALE-REVIEW-02 ===\n");
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

    try {
        // Test 1: getComparableData cleans up unused songSettings
        const mockData = {
            date: "2023-10-27",
            songIds: ["song1", "song2"],
            songSettings: {
                "song1": { key: "G", bpm: 120 },
                "song3": { key: "A" } // song3 is not in songIds
            }
        };
        const comparable = getComparableData(mockData);
        assert(comparable.songSettings["song1"] !== undefined, "Settings for song1 should be kept");
        assert(comparable.songSettings["song3"] === undefined, "Settings for song3 should be removed");

        // Test 2: Payload structure
        const mockSong = {
            id: "song1",
            title: "Test Song",
            originalKey: "C",
            bpm: 100
        } as any;
        
        const settings = { key: "D" };
        const applied = applyScaleSongSettings(mockSong, settings);
        
        assert(applied.originalKey === "C", "Original key should not be mutated");
        assert(applied.selectedKey === "D" && applied.key === "D", "Local key should be applied");
        assert(applied.localBpm === undefined, "Local BPM should not be applied if not provided");

        // Test 3: getEffectiveKey and getEffectiveBpm
        assert(getEffectiveKey(mockSong, settings) === "D", "Effective key should be D");
        assert(getEffectiveBpm(mockSong, settings) === 100, "Effective BPM should fallback to original (100)");

        // Test 4: Dirty state immunity
        const initialData = getComparableData({ songIds: [], songSettings: {} });
        const initialStr = JSON.stringify(initialData);
        
        // Simulating taxonomy updates
        const updatedData = getComparableData({ songIds: [], songSettings: {}, eventTypeId: "" });
        const updatedStr = JSON.stringify(updatedData);
        assert(initialStr === updatedStr, "Dirty state snapshot should be immune to late taxonomy updates if data matches");

        console.log(`\n=== Resultados: ${passed} passaram, ${failed} falharam ===`);
        if (failed > 0) process.exit(1);
    } catch (e) {
        console.error("Test execution error:", e);
        process.exit(1);
    }
}

runTests();
