const fs = require('fs');
fs.copyFileSync('firestore.rules.backup', 'firestore.rules');
console.log('Copied backup to firestore.rules');
