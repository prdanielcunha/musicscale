const fs = require('fs');
let file = fs.readFileSync('contexts/EcosystemContext.tsx', 'utf8');

// Replace the interface
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

fs.writeFileSync('contexts/EcosystemContext.tsx', file);
