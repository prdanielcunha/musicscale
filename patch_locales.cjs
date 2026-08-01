const fs = require('fs');

const ptPath = './locales/pt.json';
const enPath = './locales/en.json';
const esPath = './locales/es.json';

function updateFile(path, additions) {
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  data.aiImport = { ...data.aiImport, ...additions };
  fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

updateFile(ptPath, {
  "decodedTitle": "Conteúdo normalizado",
  "decodedMessage": "O conteúdo colado estava codificado e foi convertido para texto normal.",
  "clipboardEmpty": "A área de transferência está vazia.",
  "clipboardError": "Não foi possível acessar a área de transferência. Cole manualmente no campo abaixo."
});

updateFile(enPath, {
  "decodedTitle": "Content normalized",
  "decodedMessage": "The pasted content was percent-encoded and has been converted to plain text.",
  "clipboardEmpty": "The clipboard is empty.",
  "clipboardError": "Could not access the clipboard. Please paste manually below."
});

updateFile(esPath, {
  "decodedTitle": "Contenido normalizado",
  "decodedMessage": "El contenido pegado estaba codificado y se ha convertido a texto normal.",
  "clipboardEmpty": "El portapapeles está vacío.",
  "clipboardError": "No se pudo acceder al portapapeles. Pegue manualmente a continuación."
});
console.log('Locales updated successfully');
