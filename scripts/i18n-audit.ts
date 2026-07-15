import fs from 'fs';
import path from 'path';

function walkDir(dir: string, callback: (file: string) => void) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let suspiciousFiles: string[] = [];

walkDir('pages', (file) => {
  if (file.endsWith('.tsx') || file.endsWith('.ts')) {
     const text = fs.readFileSync(file, 'utf8');
     if (text.match(/>[A-Z][a-záãâéêíóôõúç]* [a-zA-Záãâéêíóôõúç ]*</i)) {
         suspiciousFiles.push(file);
     }
  }
});
walkDir('components', (file) => {
  if (file.endsWith('.tsx') || file.endsWith('.ts')) {
     const text = fs.readFileSync(file, 'utf8');
     // Not rigorous but gives idea
  }
});

console.log("Pages containing text between tags:", suspiciousFiles.length);
