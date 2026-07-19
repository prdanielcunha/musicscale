const fs = require('fs');
let code = fs.readFileSync('hooks/useStarterPackAllowance.ts', 'utf8');

// Add GlobalSong import
if (!code.includes('import { GlobalSong }')) {
  code = "import { GlobalSong } from '../types';\n" + code;
}

// Update state type
code = code.replace(
  "const [starterPack, setStarterPack] = useState<any[]>([]);",
  "const [starterPack, setStarterPack] = useState<GlobalSong[]>([]);"
);

// Clear states on organization change inside fetchAllowance
code = code.replace(
  "      setAllowance(null);\n        setStarterPack([]);\n      setLoading(false);",
  "      setAllowance(null);\n      setStarterPack([]);\n      setError(null);\n      setLoading(false);"
);

// Clear states on organization change inside useEffect
code = code.replace(
  "    setAllowance(null);\n    setLoading(true);",
  "    setAllowance(null);\n    setStarterPack([]);\n    setError(null);\n    setLoading(true);"
);

// Update valid allowance check and starterPack array setting
const oldSuccessCheck = `      if (data.success && data.allowance) {
        setAllowance(data.allowance);
        if (data.starterPack) setStarterPack(data.starterPack);
        setError(null);
      } else if (!data.allowance) {`;

const newSuccessCheck = `      const isValidAllowance = data.allowance && 
        typeof data.allowance.limit === 'number' &&
        typeof data.allowance.used === 'number' &&
        typeof data.allowance.remaining === 'number' &&
        typeof data.allowance.completed === 'boolean' &&
        typeof data.allowance.started === 'boolean';

      if (data.success && isValidAllowance) {
        setAllowance(data.allowance);
        setStarterPack(Array.isArray(data.starterPack) ? data.starterPack : []);
        setError(null);
      } else if (!isValidAllowance) {`;

code = code.replace(oldSuccessCheck, newSuccessCheck);

fs.writeFileSync('hooks/useStarterPackAllowance.ts', code, 'utf8');
