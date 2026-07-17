const fs = require('fs');
let file = fs.readFileSync('components/auth/ProtectedRoute.tsx', 'utf8');

file = file.replace(/import \{ useAuth, AppPermissions \} from "\.\.\/\.\.\/contexts\/AuthContext";/, 
`import { useAuth, AppPermissions } from "../../contexts/AuthContext";
import { useEcosystem } from "../../contexts/EcosystemContext";
import { CanonicalAccessUnavailableScreen } from "./CanonicalAccessUnavailableScreen";`);

file = file.replace(/const \{ permissions, loading, isGlobalAdmin, entitlements, organization, subscription \} = useAuth\(\);/,
`const { permissions, loading, isGlobalAdmin, entitlements, organization, subscription } = useAuth();
  const { accessContextStatus } = useEcosystem();`);

file = file.replace(/if \(loading \|\| permissions === null\) \{/,
`if (accessContextStatus === 'infrastructure_unavailable') {
    return <CanonicalAccessUnavailableScreen />;
  }

  if (loading || permissions === null) {`);

fs.writeFileSync('components/auth/ProtectedRoute.tsx', file);
