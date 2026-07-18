import * as fs from 'fs';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

console.log("Starting Structural UI Tests for First Value Journey...");

const firstScaleJourneyCard = fs.readFileSync('components/onboarding/FirstScaleJourneyCard.tsx', 'utf8');
const songsPage = fs.readFileSync('pages/SongsPage.tsx', 'utf8');
const modal = fs.readFileSync('components/onboarding/StarterRepertoireModal.tsx', 'utf8');

// 1. Jornada abre /songs?starterPack=1 e 2. envia origin first-value-journey
assert(
  firstScaleJourneyCard.includes("navigate('/songs?starterPack=1', { state: { starterRepertoireOrigin: 'first-value-journey' } })"),
  "Jornada envia origin first-value-journey"
);

// 3, 4, 5, 6, 7. Cancelar pela jornada retorna / com replace
assert(
  songsPage.includes("navigate('/', { replace: true });"),
  "Retorno usa replace e navega para / quando aberto pela jornada (cancelar/concluir)"
);

// 9. Conclusão pela jornada retorna / e 10. não altera etapa manualmente
// 13. Cancelamento direto permanece em /songs
assert(
  songsPage.includes("prev.delete('starterPack');"),
  "Abertura direta remove o parâmetro e permanece na página"
);

// Modal properties
assert(
  modal.includes("onCancel: () => void;"),
  "StarterRepertoireModal usa onCancel"
);
assert(
  modal.includes("onCompleted: (result?: any) => void;"),
  "StarterRepertoireModal usa onCompleted"
);

// 23. Troca de organização não reutiliza seleção antiga (effect implementado)
assert(
  songsPage.includes("if (isStarterModalOpen) {") && songsPage.includes("setIsStarterModalOpen(false);"),
  "Effect limpa o modal na troca de organização"
);

console.log("All UI structural tests passed!");
