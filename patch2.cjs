const fs = require('fs');
let code = fs.readFileSync('contexts/ModalContext.tsx', 'utf8');

code = code.replace(`console.log("ModalProvider rendering. scaleType:", scaleType);\n\n  const closeAllModals = useCallback(() => {`, `const closeAllModals = useCallback(() => {`);

code = code.replace(`try {\n        console.log("Entering try block, scaleType:", scaleType);\n        if (scaleType === 'music') {`, `try {\n        if (scaleType === 'music') {`);

code = code.replace(`console.log("Calling api.scales.create");\n                    const newScaleId = await api.scales.create(musicScaleData);\n                    console.log("Created scale with id:", newScaleId);`, `const newScaleId = await api.scales.create(musicScaleData);`);

code = code.replace(`console.log("Calling api.musicScaleCommands.publish");\n                    const publishResult = await api.musicScaleCommands.publish(musicScaleId, publishPayload, idempotencyKey);\n                    console.log("Published scale");`, `const publishResult = await api.musicScaleCommands.publish(musicScaleId, publishPayload, idempotencyKey);`);

code = code.replace(`} catch (publishErr: unknown) {\n                    console.log("Caught publishErr:", publishErr);`, `} catch (publishErr: unknown) {`);

code = code.replace(`} catch(e: any) {\n        console.log("Caught OUTER error:", e);\n        logger.error("Failed to save scale", e);`, `} catch(e: any) {\n        logger.error("Failed to save scale", e);`);

code = code.replace(`console.log("handleSaveScale called with scaleType:", scaleType);\n    if (scaleSaveInFlightRef.current) return;`, `if (scaleSaveInFlightRef.current) return;`);

// Remove scaleType from exported value (I added it in edit_file earlier)
code = code.replace(`openFeedback,\n      closeFeedback,\n      handleSaveScale,\n      scaleType\n  }),`, `openFeedback,\n      closeFeedback,\n      handleSaveScale\n  }),`);
code = code.replace(`handleSaveScale, scaleType\n  ]);`, `handleSaveScale\n  ]);`);

fs.writeFileSync('contexts/ModalContext.tsx', code);
