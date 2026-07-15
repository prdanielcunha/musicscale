import fs from 'fs';

let code = fs.readFileSync('components/songs/AiSongImportModal.tsx', 'utf8');

code = code.replace(/>Salvar na Biblioteca</g, '>{t("songs.save_to_library", "Salvar na Biblioteca")}<');
code = code.replace(/>Cancelar</g, '>{t("common.cancel", "Cancelar")}<');
code = code.replace(/>Voltar e Editar Info</g, '>{t("songs.back_to_edit", "Voltar e Editar Info")}<');
code = code.replace(/>Salvar também na Biblioteca Viva MusicScale</g, '>{t("songs.save_to_global_library", "Salvar também na Biblioteca Viva MusicScale")}<');
code = code.replace(/>Letra Limpa</g, '>{t("songs.clean_lyrics", "Letra Limpa")}<');

fs.writeFileSync('components/songs/AiSongImportModal.tsx', code);
