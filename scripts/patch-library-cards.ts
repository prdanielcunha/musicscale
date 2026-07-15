import fs from 'fs';

const files = [
  'components/library/LibrarySongCard.tsx',
  'components/library/LibrarySongListRow.tsx',
  'components/library/LibraryPreviewDrawer.tsx'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let code = fs.readFileSync(file, 'utf8');

    code = code.replace(/'No Repertório' \: 'B\. Viva'/g, 't("library.in_repertoire", "No repertório") : t("library.b_viva", "B. Viva")');
    code = code.replace(/>No Repertório</g, '>{t("library.in_repertoire", "No repertório")}<');
    code = code.replace(/"No Repertório"/g, 't("library.in_repertoire", "No repertório")');
    code = code.replace(/title=\{\`Idioma: \$\{song\.language\.toUpperCase\(\)\}\`\}/g, 'title={`${t("library.language_prefix", "Idioma:")} ${song.language.toUpperCase()}`}');
    code = code.replace(/>Importar</g, '>{t("library.import_verb", "Importar")}<');

    fs.writeFileSync(file, code);
  }
}
