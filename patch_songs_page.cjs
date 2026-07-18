const fs = require('fs');

let code = fs.readFileSync('pages/SongsPage.tsx', 'utf8');

// Add useLocation
code = code.replace(
  'const navigate = useNavigate();\n  const [searchParams, setSearchParams] = useSearchParams();',
  'const navigate = useNavigate();\n  const location = useLocation();\n  const [searchParams, setSearchParams] = useSearchParams();'
);

// Replace the original useEffect handling starterPack with a new logic block
const originalUseEffect = `  useEffect(() => {
    if (!loading && searchParams.get('starterPack') === '1' && canManageRepertoire) {
       setIsStarterModalOpen(true);
       setSearchParams(prev => {
          prev.delete('starterPack');
          return prev;
       }, { replace: true });
    }
  }, [loading, searchParams, canManageRepertoire, setSearchParams]);`;

const newLogicBlock = `  const openedFromFirstValueJourney = location.state?.starterRepertoireOrigin === 'first-value-journey';

  useEffect(() => {
    if (!loading && searchParams.get('starterPack') === '1' && canManageRepertoire) {
       setIsStarterModalOpen(true);
       // We DO NOT remove starterPack from URL immediately if it's from the journey,
       // otherwise we lose the URL context when closing (or we can rely purely on location.state).
       // Actually, it's safer to remove it but keep state.
       setSearchParams(prev => {
          prev.delete('starterPack');
          return prev;
       }, { replace: true, state: location.state });
    }
  }, [loading, searchParams, canManageRepertoire, setSearchParams, location.state]);

  const handleStarterRepertoireCancel = () => {
    setIsStarterModalOpen(false);
    if (openedFromFirstValueJourney) {
      navigate('/', { replace: true });
    } else {
      setSearchParams(prev => {
         prev.delete('starterPack');
         return prev;
      }, { replace: true, state: {} });
    }
  };

  const handleStarterRepertoireCompleted = () => {
    setIsStarterModalOpen(false);
    refreshData();
    if (openedFromFirstValueJourney) {
      navigate('/', { replace: true });
    } else {
      setSearchParams(prev => {
         prev.delete('starterPack');
         return prev;
      }, { replace: true, state: {} });
    }
  };`;

code = code.replace(originalUseEffect, newLogicBlock);

// Replace StarterRepertoireModal props
code = code.replace(
  /<StarterRepertoireModal\s+isOpen=\{isStarterModalOpen\}\s+onClose=\{\(\) => setIsStarterModalOpen\(false\)\}\s+onSuccess=\{\(\) => \{\s*setIsStarterModalOpen\(false\);\s*refreshData\(\);\s*\}\}\s*\/>/g,
  `<StarterRepertoireModal
          isOpen={isStarterModalOpen}
          onCancel={handleStarterRepertoireCancel}
          onCompleted={handleStarterRepertoireCompleted}
        />`
);

fs.writeFileSync('pages/SongsPage.tsx', code);
