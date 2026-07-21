const crypto = require('crypto');
const docId = crypto.createHash('sha256').update(`org-already-exists|suggestion|e-1|already_exists_user|`).digest('hex');
console.log(`organizations/org-already-exists/notifications/${docId}`);
