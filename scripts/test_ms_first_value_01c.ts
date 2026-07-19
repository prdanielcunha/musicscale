import fs from 'fs';
import path from 'path';

function runTests() {
  console.log("Starting MS-FIRST-VALUE-01C tests...");
  const formPath = path.join(process.cwd(), 'components/scales/ModernScaleForm.tsx');
  const builderPath = path.join(process.cwd(), 'components/scales/MusicBuilder.tsx');
  
  const formCode = fs.readFileSync(formPath, 'utf8');
  const builderCode = fs.readFileSync(builderPath, 'utf8');

  const handleSongToggleBlock = builderCode.substring(
    builderCode.indexOf('const handleSongToggle'),
    builderCode.indexOf('const moveSong')
  );

  const assertions = [
    {
      name: "1. ModernScaleForm possui uma função única de request close protegida",
      test: () => formCode.includes('handleRequestClose = () =>')
    },
    {
      name: "2. Não há onClose direto no footer do formulário",
      test: () => !formCode.includes('onClick={currentStep > 0 ? handleBack : onClose}')
    },
    {
      name: "3. PremiumSheetModal recebe a função protegida",
      test: () => formCode.includes('onClose={handleRequestClose}')
    },
    {
      name: "4. Existe ação Cancelar em todas as etapas",
      test: () => formCode.includes('onClick={handleRequestClose}')
    },
    {
      name: "5. Voltar permanece separado de Cancelar",
      test: () => formCode.includes('onClick={handleBack}')
    },
    {
      name: "6. isSubmitting impede fechamento",
      test: () => formCode.includes('if (isSubmitting || isSubmittingNested)')
    },
    {
      name: "7. confirmação de descarte existe",
      test: () => formCode.includes('showCancelConfirm')
    },
    {
      name: "8. não usa window.confirm",
      test: () => !formCode.includes('window.confirm')
    },
    {
      name: "9. não usa alert",
      test: () => !formCode.includes('alert(')
    },
    {
      name: "10. dirty state possui snapshot-base",
      test: () => formCode.includes('initialFormDataRef.current =')
    },
    {
      name: "11. currentStep é resetado em nova abertura",
      test: () => formCode.includes('setCurrentStep(0)')
    },
    {
      name: "12. confirmação é resetada em nova abertura",
      test: () => formCode.includes('setShowCancelConfirm(false)')
    },
    {
      name: "13. MusicBuilder possui resumo mobile de selecionadas",
      test: () => builderCode.includes('Mobile Summary Banner')
    },
    {
      name: "14. resumo mostra contador",
      test: () => builderCode.includes('scaleModal.selectedSongsCount')
    },
    {
      name: "15. resumo possui ação para abrir repertório",
      test: () => builderCode.includes('onClick={() => setMobileTab(\'setlist\')}')
    },
    {
      name: "16. badge mobile mostra count zero e count positivo",
      test: () => builderCode.includes('bg-transparent text-slate-400') && builderCode.includes('selectedSongsList.length > 0')
    },
    {
      name: "17. adicionar música não força troca automática de aba",
      test: () => handleSongToggleBlock.includes('songIds:') && !handleSongToggleBlock.includes('setMobileTab')
    },
  ];

  let passed = 0;
  for (const assertion of assertions) {
    if (assertion.test()) {
      console.log(`✅ PASS: ${assertion.name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${assertion.name}`);
    }
  }

  if (passed === assertions.length) {
    console.log(`All ${assertions.length} MS-FIRST-VALUE-01C tests passed!`);
    process.exit(0);
  } else {
    console.error(`Only ${passed}/${assertions.length} tests passed.`);
    process.exit(1);
  }
}

runTests();
