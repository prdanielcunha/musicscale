import fs from 'fs';

let code = fs.readFileSync('components/library/LibrarySongCard.tsx', 'utf8');

if (!code.includes('useTranslation')) {
    code = code.replace(/import \{ motion \} from 'motion\/react';/, "import { motion } from 'motion/react';\nimport { useTranslation } from 'react-i18next';");
}
code = code.replace(/const getStatusBadge = \(song: GlobalSong\) => \{/g, 'const getStatusBadge = (song: GlobalSong, t: any) => {');
code = code.replace(/label: 'Completa',/g, "label: t('library.complete_badge', 'Completa'),");
code = code.replace(/label: 'Só Cifra',/g, "label: t('library.only_chords', 'Só Cifra'),");
code = code.replace(/label: 'Só Letra',/g, "label: t('library.only_lyrics', 'Só Letra'),");
code = code.replace(/label: 'Incompleta',/g, "label: t('library.incomplete', 'Incompleta'),");
code = code.replace(/const status = getStatusBadge\(song\);/g, 'const { t } = useTranslation();\n  const status = getStatusBadge(song, t);');
code = code.replace(/'No Repertório' : 'B\. Viva'/g, 't("library.in_repertoire", "No Repertório") : t("library.b_viva", "B. Viva")');
code = code.replace(/>No Repertório</g, '>{t("library.in_repertoire", "No repertório")}<');
code = code.replace(/"No Repertório"/g, 't("library.in_repertoire", "No repertório")');
code = code.replace(/title=\{\`Idioma: \$\{song\.language\.toUpperCase\(\)\}\`\}/g, 'title={`${t("library.language_prefix", "Idioma:")} ${song.language.toUpperCase()}`}');
code = code.replace(/>Importar</g, '>{t("library.import_verb", "Importar")}<');

fs.writeFileSync('components/library/LibrarySongCard.tsx', code);
