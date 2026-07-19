const fs = require('fs');
let code = fs.readFileSync('components/onboarding/StarterRepertoireModal.tsx', 'utf8');

// 1. Clear selectedIds and importError on close or org change
code = code.replace(
  "  useEffect(() => {\n    if (isOpen && hookStarterPack.length > 0 && allowance) {",
  `  useEffect(() => {
    if (!isOpen) {
      setSelectedIds(new Set());
      setImportError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIds(new Set());
    setImportError(null);
  }, [organization?.id]);

  useEffect(() => {
    if (isOpen && hookStarterPack.length > 0 && allowance) {`
);

// 2. Remove fallback allowance?.remaining ?? 10
code = code.replace(
  "const maxSelectable = allowance?.remaining ?? 10;",
  "const maxSelectable = allowance.remaining;"
);

// 3. Prevent auto-selection if completed
code = code.replace(
  "      let count = 0;",
  "      let count = 0;\n      if (allowance.completed || allowance.remaining === 0) return;\n"
);

// 4. In handleImport, wait for refreshAllowance
code = code.replace(
  "      await refreshData();\n      publishEvent({",
  "      await refreshData();\n      await refreshAllowance();\n      publishEvent({"
);

fs.writeFileSync('components/onboarding/StarterRepertoireModal.tsx', code, 'utf8');
