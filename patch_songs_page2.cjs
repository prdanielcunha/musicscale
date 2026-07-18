const fs = require('fs');

let code = fs.readFileSync('pages/SongsPage.tsx', 'utf8');

const target = `  const openedFromFirstValueJourney = location.state?.starterRepertoireOrigin === 'first-value-journey';`;

const replacement = `  const openedFromFirstValueJourney = location.state?.starterRepertoireOrigin === 'first-value-journey';

  // Se a organização for trocada enquanto o modal estiver aberto:
  // fechar o modal e descartar a origem antiga
  useEffect(() => {
    if (isStarterModalOpen) {
      setIsStarterModalOpen(false);
      setSearchParams(prev => {
         prev.delete('starterPack');
         return prev;
      }, { replace: true, state: {} });
    }
  }, [userProfile?.organizationId]);`;

code = code.replace(target, replacement);

fs.writeFileSync('pages/SongsPage.tsx', code);
