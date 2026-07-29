const fs = require('fs');
const file = 'tests/ui/modal-context-publish.test.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'const { openSaveScaleModal, saveMusicScale } = useModals();',
  'const { handleSaveScale } = useModals();'
);

code = code.replace(
  'const res = await saveMusicScale({',
  'const res = await handleSaveScale({'
);

code = code.replace(
  'const res = await saveMusicScale({',
  'const res = await handleSaveScale({'
);

fs.writeFileSync(file, code);
