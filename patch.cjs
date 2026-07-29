const fs = require('fs');
let code = fs.readFileSync('contexts/ModalContext.tsx', 'utf8');

code = code.replace(
  `try {\n        if (scaleType === 'music') {`,
  `try {\n        console.log("Entering try block, scaleType:", scaleType);\n        if (scaleType === 'music') {`
);

code = code.replace(
  `const newScaleId = await api.scales.create(musicScaleData);`,
  `console.log("Calling api.scales.create");\n                    const newScaleId = await api.scales.create(musicScaleData);\n                    console.log("Created scale with id:", newScaleId);`
);

code = code.replace(
  `const publishResult = await api.musicScaleCommands.publish(musicScaleId, publishPayload, idempotencyKey);`,
  `console.log("Calling api.musicScaleCommands.publish");\n                    const publishResult = await api.musicScaleCommands.publish(musicScaleId, publishPayload, idempotencyKey);\n                    console.log("Published scale");`
);

code = code.replace(
  `} catch (publishErr: unknown) {`,
  `} catch (publishErr: unknown) {\n                    console.log("Caught publishErr:", publishErr);`
);

code = code.replace(
  `} catch(e: any) {\n        logger.error("Failed to save scale", e);`,
  `} catch(e: any) {\n        console.log("Caught OUTER error:", e);\n        logger.error("Failed to save scale", e);`
);

fs.writeFileSync('contexts/ModalContext.tsx', code);
