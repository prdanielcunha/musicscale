const fs = require('fs');
let file = fs.readFileSync('contexts/EcosystemContext.tsx', 'utf8');

const regex2 = /if \(mounted && currentGeneration === activeGeneration && auth\.currentUser\?\.uid === user\.uid\) \{\s*setContext\(\(prev: any\) => \(\{\s*\.\.\.payload,\s*\.\.\.offlineDefault,\s*isStandalone: true,\s*permissions: DENIED_PERMISSIONS\s*\}\)\);\s*setIsDegraded\(true\);\s*\}/g;

file = file.replace(regex2, `if (mounted && currentGeneration === activeGeneration && auth.currentUser?.uid === user.uid) {
                                 setContext((prev: any) => ({
                                     ...payload,
                                     ...offlineDefault,
                                     isStandalone: true,
                                     permissions: DENIED_PERMISSIONS // Fallback permissions only
                                 }));
                                 if (accessContextStatus === 'syncing') {
                                    setAccessContextStatus('infrastructure_unavailable');
                                 }
                                 setIsDegraded(true);
                             }`);

file = file.replace(/const value = useMemo\(\(\) => \(\{/, `const value = useMemo(() => ({
      accessContextStatus,
      degradedReason,
      safeErrorCode,
      correlationId,
      retryAccessContext,`);

file = file.replace(/isStandalone: !!context\?.isStandalone,[\s]*isDegraded[\s]*\}\), \[isInitialized, isContextSyncing, context, isDegraded\]\);/, `isStandalone: !!context?.isStandalone,
      isDegraded
  }), [isInitialized, isContextSyncing, context, isDegraded, accessContextStatus, degradedReason, safeErrorCode, correlationId]);`);

fs.writeFileSync('contexts/EcosystemContext.tsx', file);
