const fs = require('fs');

function patchRoute(filePath) {
    if (!fs.existsSync(filePath)) return;
    let file = fs.readFileSync(filePath, 'utf8');

    file = file.replace(/import \{ useAuth(.*?) \} from "\.\.\/\.\.\/contexts\/AuthContext";/, 
    `import { useAuth$1 } from "../../contexts/AuthContext";\nimport { useEcosystem } from "../../contexts/EcosystemContext";\nimport { CanonicalAccessUnavailableScreen } from "./CanonicalAccessUnavailableScreen";`);

    // The destructuring could be different, so let's match just useEcosystem invocation.
    file = file.replace(/(const \{.*?\} = useAuth\(\);)/, 
    `$1\n  const { accessContextStatus } = useEcosystem();`);

    file = file.replace(/if \(loading/g, 
    `if (accessContextStatus === 'infrastructure_unavailable') {\n    return <CanonicalAccessUnavailableScreen />;\n  }\n\n  if (loading`);

    fs.writeFileSync(filePath, file);
}

patchRoute('components/auth/GlobalCurationProtectedRoute.tsx');
patchRoute('components/auth/FinOpsDiagnosticsProtectedRoute.tsx');
