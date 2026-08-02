const fs = require('fs');
let content = fs.readFileSync('pages/SongsPage.tsx', 'utf8');

content = content.replace(
  /const documents = searchIndex\.filter\(doc => processedSongs\.some\(ps => ps\.id === doc\.song\.id\)\);/g,
  `const allowedIds = new Set(processedSongs.map(song => song.id));\n      const documents = searchIndex.filter(doc => allowedIds.has(doc.song.id));`
);

fs.writeFileSync('pages/SongsPage.tsx', content);
console.log("Patched pages/SongsPage.tsx");
