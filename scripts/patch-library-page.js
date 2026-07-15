const fs = require('fs');

let file = fs.readFileSync('pages/LibraryPage.tsx', 'utf8');

file = file.replace(/"Biblioteca Viva disponível no Advanced"/g, 't("library.available_in_advanced", "Biblioteca Viva disponível no Advanced")');
file = file.replace(/"Nenhuma música nova para importar."/g, 't("library.no_new_songs", "Nenhuma música nova para importar.")');
file = file.replace(/"Limite excedido."/g, 't("library.limit_exceeded", "Limite excedido.")');
file = file.replace(/"Ocorreu um erro ao importar algumas músicas. Tente novamente."/g, 't("library.import_error", "Ocorreu um erro ao importar algumas músicas. Tente novamente.")');
file = file.replace(/"Ocorreu um erro ao buscar músicas. Tente novamente."/g, 't("library.error_loading", "Ocorreu um erro ao buscar músicas. Tente novamente.")');

// Metrics cards
file = file.replace(
  '>Músicas no acervo</p>',
  '>{t("library.songs_in_library", "Músicas no acervo")}</p>'
);
file = file.replace(
  '>Completas<',
  '>{t("library.complete", "Completas")}<'
);
file = file.replace(
  '>Com cifra<',
  '>{t("library.with_chords", "Com cifra")}<'
);
file = file.replace(
  '>Com letra<',
  '>{t("library.with_lyrics", "Com letra")}<'
);

file = file.replace(
  /placeholder="Buscar por música, artista, trecho da letra, tom ou BPM..."/g,
  `placeholder={t("library.search_placeholder", "Buscar por música, artista, trecho da letra, tom ou BPM...")}`
);

// Headers and subheaders
file = file.replace(/>Biblioteca Viva MusicScale</g, '>{t("library.title", "Biblioteca Viva MusicScale")}<');
file = file.replace(/>Um acervo premium e atualizado para sua equipe importar, ensaiar e\s*ministrar com excelência. Menos tempo procurando. Mais tempo adorando.</g, '>{t("library.description", "Um acervo premium e atualizado para sua equipe importar, ensaiar e ministrar com excelência. Menos tempo procurando. Mais tempo adorando.")}<');

// Buttons
file = file.replace(/>Importar Arquivo</g, '>{t("library.import_file", "Importar Arquivo")}<');
file = file.replace(/>Criar por IA</g, '>{t("library.create_ai", "Criar por IA")}<');
file = file.replace(/>Criar Música Global</g, '>{t("library.create_global", "Criar Música Global")}<');
file = file.replace(/>Sua biblioteca está em dia</g, '>{t("library.library_up_to_date", "Sua biblioteca está em dia")}<');

// Filters
file = file.replace(/label: "Todas" \}/g, 'label: t("library.filter_all", "Todas") }');
file = file.replace(/label: "Completas" \}/g, 'label: t("library.complete", "Completas") }');
file = file.replace(/label: "Com Cifra" \}/g, 'label: t("library.with_chords_label", "Com Cifra") }');
file = file.replace(/label: "Com Letra" \}/g, 'label: t("library.with_lyrics_label", "Com Letra") }');
file = file.replace(/label: "Já Importadas" \}/g, 'label: t("library.imported", "Já Importadas") }');
file = file.replace(/label: "Não Importadas" \}/g, 'label: t("library.not_imported", "Não Importadas") }');

file = file.replace(/>Importar Todas</g, '>{t("library.import_all", "Importar Todas")}<');
file = file.replace(/>Mais importadas</g, '>{t("library.most_imported", "Mais importadas")}<');
file = file.replace(/>Selecionar Todas</g, '>{t("library.select_all", "Selecionar Todas")}<');
file = file.replace(/>Importar Selecionadas</g, '>{t("library.import_selected", "Importar Selecionadas")}<');
file = file.replace(/Desmarcar as /g, '{t("library.deselect_all", "Desmarcar as {{count}} selecionadas", { count: selectedSongIds.size })} {/* ');

file = file.replace(/>A Biblioteca Viva está sendo preparada</g, '>{t("library.is_preparing", "A Biblioteca Viva está sendo preparada")}<');
file = file.replace(/>Em breve sua equipe terá acesso a um acervo poderoso de músicas prontas para importar.</g, '>{t("library.will_have_access", "Em breve sua equipe terá acesso a um acervo poderoso de músicas prontas para importar.")}<');

file = file.replace(/>Todas as músicas exibidas já fazem parte do repertório da sua organização.</g, '>{t("library.all_displayed_imported", "Todas as músicas exibidas já fazem parte do repertório da sua organização.")}<');

file = file.replace(/"Importar músicas da Biblioteca Viva\?\\n\\nVamos adicionar ao seu repertório as músicas visíveis que ainda não estão nele\. Músicas já adicionadas serão ignoradas automaticamente\."/g, '`${t("library.confirm_import_all_title", "Importar músicas da Biblioteca Viva?")}\\n\\n${t("library.confirm_import_all_desc", "Vamos adicionar ao seu repertório as músicas visíveis que ainda não estão nele. Músicas já adicionadas serão ignoradas automaticamente.")}`');

fs.writeFileSync('pages/LibraryPage.tsx', file);
