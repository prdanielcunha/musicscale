const fs = require('fs');

const path = './components/scales/ModernScaleForm.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add imports if needed
if (!content.includes('import { XIcon }')) {
  content = content.replace('import { ArrowRightIcon }', 'import { ArrowRightIcon, XIcon }');
  if (!content.includes('XIcon')) {
     content = content.replace('import { ArrowRight } from "lucide-react";', 'import { ArrowRight, X as XIcon } from "lucide-react";');
  }
}

// 2. Add state and ref
const stateToInsert = `
  const initialFormDataRef = useRef<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Helper to normalize and get relevant data for dirty check
  const getComparableData = (data: any) => {
    return {
      date: data.date || "",
      time: data.time || "",
      eventTypeId: data.eventTypeId || "",
      locationId: data.locationId || "",
      eventNameId: data.eventNameId || "",
      observations: data.observations || "",
      durationMinutes: data.durationMinutes ? String(data.durationMinutes) : "",
      songIds: data.songIds || [],
      assignments: (data.assignments || []).map((a: any) => ({ userId: a.userId, instrumentId: a.instrumentId })),
      bandScaleId: data.bandScaleId || "",
      musicScaleId: data.musicScaleId || ""
    };
  };

  const handleRequestClose = () => {
    if (isSubmitting || isSubmittingNested) {
      toast({ type: 'warning', message: t('scaleModal.submittingCannotClose', 'Aguarde o envio concluir.') });
      return;
    }
    
    if (initialFormDataRef.current) {
      const currentDataStr = JSON.stringify(getComparableData(formData));
      if (currentDataStr !== initialFormDataRef.current) {
        setShowCancelConfirm(true);
        return;
      }
    }
    onClose();
  };

  const handleDiscardChanges = () => {
    setShowCancelConfirm(false);
    onClose();
  };

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setShowCancelConfirm(false);
    } else {
      setCurrentStep(0);
      initialFormDataRef.current = null;
    }
  }, [isOpen]);
`;

if (!content.includes('const initialFormDataRef = useRef')) {
  content = content.replace('const [formData, setFormData] = useState<Partial<Scale & BandScale>>({});', 
    'const [formData, setFormData] = useState<Partial<Scale & BandScale>>({});\n' + stateToInsert);
}

// 3. Update the initialFormDataRef.current after the form data is initialized
// In the second useEffect, we have `setFormData(prev => { ... })`
// We need to capture it there.
const useEffect2Match = `setFormData(prev => {
      const next = { ...prev };

      if (!next.eventTypeId && eventTypes.length > 0) {
        next.eventTypeId =
          eventTypes.find(t => t.name.toLowerCase().includes('culto'))?.id ||
          eventTypes[0].id;
      }

      if (!next.locationId && locations.length > 0) {
        next.locationId =
          locations.find(l => 
            l.name.toLowerCase().includes('local principal') || 
            l.name.toLowerCase().includes('templo principal') || 
            l.name.toLowerCase().includes('main sanctuary')
          )?.id ||
          locations[0].id;
      }

      return next;
    });`;

const useEffect2Replace = useEffect2Match + `
    // Using a short timeout to let the state settle before capturing snapshot
    setTimeout(() => {
      setFormData(currentData => {
        initialFormDataRef.current = JSON.stringify(getComparableData(currentData));
        return currentData;
      });
    }, 0);
`;

if (!content.includes('initialFormDataRef.current = JSON.stringify(getComparableData(currentData))')) {
  content = content.replace(useEffect2Match, useEffect2Replace);
}

// 4. Modify modalTitle
const titleMatch = `const modalTitle = (
    <div className="flex flex-col gap-1.5 mb-2">`;
    
const titleReplace = `const modalTitle = (
    <div className="flex justify-between items-start gap-4 mb-2">
      <div className="flex flex-col gap-1.5">`;

const titleEndMatch = `        <span className="text-[11px] font-bold uppercase tracking-widest text-primary-dark/70 dark:text-primary-light/70 bg-primary/10 px-2 py-1 rounded-md">{getSubtitle()}</span>
      </div>
    </div>`;

const titleEndReplace = `        <span className="text-[11px] font-bold uppercase tracking-widest text-primary-dark/70 dark:text-primary-light/70 bg-primary/10 px-2 py-1 rounded-md">{getSubtitle()}</span>
      </div>
    </div>
    <button
      type="button"
      onClick={handleRequestClose}
      className="md:hidden flex items-center justify-center p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
      aria-label={t('scaleModal.cancel', 'Cancelar')}
    >
      <XIcon className="w-5 h-5" />
    </button>
  </div>`;

if (!content.includes('className="md:hidden flex items-center justify-center p-2 -mr-2')) {
  content = content.replace(titleMatch, titleReplace);
  content = content.replace(titleEndMatch, titleEndReplace);
}

// 5. Modify footer buttons
// Find the footer div gap-2.5 w-full sm:w-auto ml-auto sm:min-w-[280px]
const buttonsMatch = `<div className="flex gap-2.5 w-full sm:w-auto ml-auto sm:min-w-[280px]">
        <Button 
          type="button" 
          variant="secondary" 
          onClick={currentStep > 0 ? handleBack : onClose} 
          className="flex-1 sm:flex-none h-12 rounded-xl text-[14px]"
        >
          {currentStep > 0 ? t('scaleModal.back', 'Voltar') : t('scaleModal.cancel', 'Cancelar')}
        </Button>`;

const buttonsReplace = `<div className="flex gap-2.5 w-full sm:w-auto ml-auto sm:min-w-[280px]">
        <Button 
          type="button" 
          variant="secondary" 
          onClick={handleRequestClose} 
          className="hidden md:flex flex-1 sm:flex-none h-12 rounded-xl text-[14px]"
        >
          {t('scaleModal.cancel', 'Cancelar')}
        </Button>
        {currentStep > 0 && (
          <Button 
            type="button" 
            variant="secondary" 
            onClick={handleBack} 
            className="flex-1 sm:flex-none h-12 rounded-xl text-[14px]"
          >
            {t('scaleModal.back', 'Voltar')}
          </Button>
        )}`;

if (!content.includes('hidden md:flex flex-1 sm:flex-none h-12 rounded-xl text-[14px]')) {
  content = content.replace(buttonsMatch, buttonsReplace);
}

// 6. Modify PremiumSheetModal onClose
content = content.replace(/<PremiumSheetModal\s+isOpen={isOpen}\s+onClose={onClose}/g, '<PremiumSheetModal\n        isOpen={isOpen}\n        onClose={handleRequestClose}');

// 7. Add confirmation dialog
const discardDialog = `
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setShowCancelConfirm(false)}></div>
          <div className="relative z-10 w-full max-w-sm bg-white dark:bg-[#111318] rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 animate-scale-in">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('scaleModal.discardChangesTitle', 'Descartar alterações?')}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t('scaleModal.discardChangesDescription', 'Você fez alterações nesta escala que ainda não foram salvas.')}</p>
            <div className="flex flex-col gap-2.5">
              <Button type="button" variant="primary" onClick={() => setShowCancelConfirm(false)} className="w-full h-12 rounded-xl">
                {t('scaleModal.keepEditing', 'Continuar editando')}
              </Button>
              <Button type="button" variant="danger" onClick={handleDiscardChanges} className="w-full h-12 rounded-xl bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 border-none hover:bg-red-500/20 dark:hover:bg-red-500/30">
                {t('scaleModal.discardAndExit', 'Descartar e sair')}
              </Button>
            </div>
          </div>
        </div>
      )}
`;

if (!content.includes('Descartar alterações?')) {
  content = content.replace('</PremiumSheetModal>', '</PremiumSheetModal>' + discardDialog);
}

fs.writeFileSync(path, content);
console.log('ModernScaleForm patched');
