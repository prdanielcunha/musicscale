const fs = require('fs');
let content = fs.readFileSync('pages/LibraryPage.tsx', 'utf8');

content = content.replace(
  /const documents = searchIndex\.filter\(doc => list\.some\(ps => ps\.id === doc\.song\.id\)\);/g,
  `const allowedIds = new Set(list.map(song => song.id));\n      const documents = searchIndex.filter(doc => allowedIds.has(doc.song.id));`
);

fs.writeFileSync('pages/LibraryPage.tsx', content);
console.log("Patched pages/LibraryPage.tsx");
