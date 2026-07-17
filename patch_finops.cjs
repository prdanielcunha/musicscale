const fs = require('fs');
let file = fs.readFileSync('components/auth/FinOpsDiagnosticsProtectedRoute.tsx', 'utf8');

file = file.replace(/import \{ Link \} from 'react-router-dom';/,
`import { Link } from 'react-router-dom';
import { useEcosystem } from '../../contexts/EcosystemContext';
import { CanonicalAccessUnavailableScreen } from './CanonicalAccessUnavailableScreen';`);

file = file.replace(/const \{ loading, allowed, checked, safeCode, diagnostic \} = useFinOpsDiagnosticsAccess\(\);/,
`const { loading, allowed, checked, safeCode, diagnostic } = useFinOpsDiagnosticsAccess();
  const { accessContextStatus } = useEcosystem();`);

fs.writeFileSync('components/auth/FinOpsDiagnosticsProtectedRoute.tsx', file);
