const fs = require('fs');
let file = fs.readFileSync('contexts/EcosystemContext.tsx', 'utf8');

// 1. Interface
file = file.replace(/interface EcosystemContextValue \{[\s\S]*?\}/, `export type AccessContextStatus = 'resolved' | 'syncing' | 'access_denied' | 'infrastructure_unavailable' | 'invalid_response' | 'timeout' | 'offline' | 'unauthenticated';

interface EcosystemContextValue {
  isInitialized: boolean;
  isContextSyncing: boolean;
  accessContextStatus: AccessContextStatus;
  degradedReason?: string;
  safeErrorCode?: string;
  correlationId?: string;
  retryAccessContext: () => Promise<void>;
  context: EcosystemContextPayload | null;
  publishEvent: (event: EcosystemEvent) => void;
  navigateToEcosystem: (path?: string) => void;
  isStandalone: boolean;
  isDegraded: boolean;
}`);

file = file.replace(/const EcosystemContext = createContext<EcosystemContextValue>\(\{[\s\S]*?\}\);/, `const EcosystemContext = createContext<EcosystemContextValue>({
  isInitialized: false,
  isContextSyncing: false,
  accessContextStatus: 'syncing',
  retryAccessContext: async () => {},
  context: null,
  publishEvent: () => {},
  navigateToEcosystem: () => {},
  isStandalone: false,
  isDegraded: false,
});`);

// 2. States and retryAccessContext
file = file.replace(/export const EcosystemProvider: React\.FC<\{ children: React\.ReactNode \}> = \(\{ children \}\) => \{([\s\S]*?)const bootstrapModule = async \(\) => \{/, `export const EcosystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isContextSyncing, setIsContextSyncing] = useState(false);
  const [context, setContext] = useState<EcosystemContextPayload | null>(null);
  const [isDegraded, setIsDegraded] = useState(false);
  const [accessContextStatus, setAccessContextStatus] = useState<AccessContextStatus>('syncing');
  const [degradedReason, setDegradedReason] = useState<string>();
  const [safeErrorCode, setSafeErrorCode] = useState<string>();
  const [correlationId, setCorrelationId] = useState<string>();

  const retryAccessContext = async () => {
    if (!context || !context.isStandalone) return;
    setIsContextSyncing(true);
    setAccessContextStatus('syncing');
    setDegradedReason(undefined);
    setSafeErrorCode(undefined);
    
    // Attempt re-import if necessary or rely on existing session
    const { auth } = await import('../services/firebase');
    if (auth.currentUser) {
       await auth.currentUser.getIdToken(true);
       window.location.reload();
    }
  };

  useEffect(() => {
    let mounted = true;
    let unsubscribeAuth: any = null;
    let activeControllers: AbortController[] = [];
    let activeGeneration = 0;
    
    const bootstrapModule = async () => {`);

// 3. Fallback permissions assignment
const regex2 = /if \(mounted && currentGeneration === activeGeneration && auth\.currentUser\?\.uid === user\.uid\) \{\s*setContext\(\(prev: any\) => \(\{\s*\.\.\.payload,\s*\.\.\.offlineDefault,\s*isStandalone: true,\s*permissions: DENIED_PERMISSIONS\s*\}\)\);\s*setIsDegraded\(true\);\s*\}/g;

file = file.replace(regex2, `if (mounted && currentGeneration === activeGeneration && auth.currentUser?.uid === user.uid) {
                                 setContext((prev: any) => ({
                                     ...payload,
                                     ...offlineDefault,
                                     isStandalone: true,
                                     permissions: DENIED_PERMISSIONS
                                 }));
                                 setAccessContextStatus(prev => prev === 'syncing' ? 'infrastructure_unavailable' : prev);
                                 setIsDegraded(true);
                             }`);

// 4. Update the values in useMemo
file = file.replace(/const value = useMemo\(\(\) => \(\{/, `const value = useMemo(() => ({
      accessContextStatus,
      degradedReason,
      safeErrorCode,
      correlationId,
      retryAccessContext,`);

file = file.replace(/isStandalone: !!context\?.isStandalone,[\s]*isDegraded[\s]*\}\), \[isInitialized, isContextSyncing, context, isDegraded\]\);/, `isStandalone: !!context?.isStandalone,
      isDegraded
  }), [isInitialized, isContextSyncing, context, isDegraded, accessContextStatus, degradedReason, safeErrorCode, correlationId]);`);

// 5. We need to handle apiRes logic cleanly by string replacement.
file = file.replace(/if \(apiRes && apiRes\.ok\) \{\s*const resJson = await apiRes\.json\(\);\s*if \(isValidCanonicalResponse\(resJson, user\.uid, orgId\)\) \{\s*serverContext = resJson;\s*systemRole = resJson\.systemRole \|\| systemRole;\s*roleInOrg = resJson\.organizationRole \|\| roleInOrg;\s*earlySuccess = true;\s*console\.log\(`\[EcosystemContext\] Canonical server-resolved access \(early\):`, resJson\);\s*markStartupMetric\('ecosystem_access_context_completed_ms'\);\s*\} else \{\s*console\.warn\("\[EcosystemContext\] Early response was invalid canonical match\."\);\s*\}\s*\} else \{\s*console\.warn\("\[EcosystemContext\] Server-resolved access context HTTP error \(early\):", apiRes\?\.status\);\s*\}/,
`if (apiRes) {
    if (apiRes.ok) {
        const resJson = await apiRes.json();
        if (isValidCanonicalResponse(resJson, user.uid, orgId)) {
            serverContext = resJson;
            systemRole = resJson.systemRole || systemRole;
            roleInOrg = resJson.organizationRole || roleInOrg;
            earlySuccess = true;
            setAccessContextStatus('resolved');
            console.log(\`[EcosystemContext] Canonical server-resolved access (early):\`, resJson);
            markStartupMetric('ecosystem_access_context_completed_ms');
        } else {
            console.warn("[EcosystemContext] Early response was invalid canonical match.");
            setAccessContextStatus('invalid_response');
        }
    } else {
        const errJson = await apiRes.json().catch(() => ({}));
        setSafeErrorCode(errJson.safeErrorCode || 'HTTP_' + apiRes.status);
        setCorrelationId(errJson.correlationId);
        if (apiRes.status === 401 || apiRes.status === 403) setAccessContextStatus('access_denied');
        else if (apiRes.status === 503) setAccessContextStatus('infrastructure_unavailable');
        else if (apiRes.status === 404) setAccessContextStatus('access_denied');
        else setAccessContextStatus('invalid_response');
        console.warn("[EcosystemContext] Server-resolved access context HTTP error (early):", apiRes.status);
    }
} else {
    setAccessContextStatus('infrastructure_unavailable');
}`);


file = file.replace(/if \(apiRes && apiRes\.ok\) \{\s*const resJson = await apiRes\.json\(\);\s*if \(isValidCanonicalResponse\(resJson, user\.uid, orgId\)\) \{\s*serverContext = resJson;\s*systemRole = resJson\.systemRole \|\| systemRole;\s*roleInOrg = resJson\.organizationRole \|\| roleInOrg;\s*console\.log\(`\[EcosystemContext\] Canonical server-resolved access:`, resJson\);\s*markStartupMetric\('ecosystem_access_context_completed_ms'\);\s*\} else \{\s*console\.warn\("\[EcosystemContext\] Canonical response was invalid match\."\);\s*\}\s*\} else \{\s*console\.warn\("\[EcosystemContext\] Server-resolved access context HTTP error:", apiRes\?\.status\);\s*\}/,
`if (apiRes) {
    if (apiRes.ok) {
        const resJson = await apiRes.json();
        if (isValidCanonicalResponse(resJson, user.uid, orgId)) {
            serverContext = resJson;
            systemRole = resJson.systemRole || systemRole;
            roleInOrg = resJson.organizationRole || roleInOrg;
            setAccessContextStatus('resolved');
            console.log(\`[EcosystemContext] Canonical server-resolved access:\`, resJson);
            markStartupMetric('ecosystem_access_context_completed_ms');
        } else {
            console.warn("[EcosystemContext] Canonical response was invalid match.");
            setAccessContextStatus('invalid_response');
        }
    } else {
        const errJson = await apiRes.json().catch(() => ({}));
        setSafeErrorCode(errJson.safeErrorCode || 'HTTP_' + apiRes.status);
        setCorrelationId(errJson.correlationId);
        if (apiRes.status === 401 || apiRes.status === 403) setAccessContextStatus('access_denied');
        else if (apiRes.status === 503) setAccessContextStatus('infrastructure_unavailable');
        else if (apiRes.status === 404) setAccessContextStatus('access_denied');
        else setAccessContextStatus('invalid_response');
        console.warn("[EcosystemContext] Server-resolved access context HTTP error:", apiRes.status);
    }
} else {
    setAccessContextStatus('infrastructure_unavailable');
}`);

fs.writeFileSync('contexts/EcosystemContext.tsx', file);
