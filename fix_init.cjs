const fs = require('fs');
const path = './components/scales/ModernScaleForm.tsx';
let content = fs.readFileSync(path, 'utf8');

// We want to capture the initial value.
// Let's replace the first useEffect's setFormData to also capture initialFormDataRef
content = content.replace(`    if (scaleType === "music") {
      const musicScale = scaleToEdit as Scale;
      setFormData({
        ...baseData,
        songIds: musicScale?.songIds || preselectedSongIds || [],
        bandScaleId: musicScale?.bandScaleId || null,
        durationMinutes: resolveScaleDurationMinutes(musicScale?.durationMinutes),
      });
    } else {
      const bandScale = scaleToEdit as BandScale;
      setFormData({
        ...baseData,
        assignments: bandScale?.assignments || [],
        musicScaleId: bandScale?.musicScaleId || null,
      });
    }

    isInitializedRef.current = true;`, `    let initialData;
    if (scaleType === "music") {
      const musicScale = scaleToEdit as Scale;
      initialData = {
        ...baseData,
        songIds: musicScale?.songIds || preselectedSongIds || [],
        bandScaleId: musicScale?.bandScaleId || null,
        durationMinutes: resolveScaleDurationMinutes(musicScale?.durationMinutes),
      };
      setFormData(initialData);
    } else {
      const bandScale = scaleToEdit as BandScale;
      initialData = {
        ...baseData,
        assignments: bandScale?.assignments || [],
        musicScaleId: bandScale?.musicScaleId || null,
      };
      setFormData(initialData);
    }

    // Capture first snapshot
    initialFormDataRef.current = JSON.stringify(getComparableData(initialData));
    isInitializedRef.current = true;`);

// In the second useEffect:
content = content.replace(`      initialFormDataRef.current = JSON.stringify(getComparableData(next));
      return next;`, `      // Update snapshot after autofilling
      initialFormDataRef.current = JSON.stringify(getComparableData(next));
      return next;`);

fs.writeFileSync(path, content);
console.log('Fixed init');
