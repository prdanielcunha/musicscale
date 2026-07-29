const fs = require('fs');
const file = './services/server/scale/musicScaleCommandService.ts';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(
  '    const anyResult = result as any;\n    logger.info(`[MusicScalePublishCommand] Processed command ${commandId} in ${duration}ms`, {\n      musicScaleId,\n      orgId,\n      correlationId,\n      version: anyResult.version\n    });',
  '    logger.info(`[MusicScalePublishCommand] Processed command ${commandId} in ${duration}ms`, {\n      musicScaleId,\n      orgId,\n      correlationId,\n      version: (result as { version: number }).version\n    });'
);
code = code.replace(
  '      ...result,\n      fromCache: anyResult.fromCache || false',
  '      ...result,\n      fromCache: (result as { fromCache?: boolean }).fromCache || false'
);
fs.writeFileSync(file, code);
