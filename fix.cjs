const fs = require('fs');
const file = 'tests/server/music-scale-command-service.test.ts';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(/mockanyUpdate/g, 'mockTransactionUpdate');
code = code.replace(/mockanySet/g, 'mockTransactionSet');
code = code.replace(/runany/g, 'runTransaction');
code = code.replace(/mockany/g, 'mockTransaction');
code = code.replace(/writeReceiptInany/g, 'writeReceiptInTransaction');
fs.writeFileSync(file, code);
