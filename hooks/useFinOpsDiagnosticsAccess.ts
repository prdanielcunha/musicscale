import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAuth } from 'firebase/auth';

let globalCache: { allowed: boolean; canRun: boolean; reason?: string; safeCode?: string; diagnostic?: any } | null = null;
let globalPromise: Promise<{ allowed: boolean; canRun: boolean; reason?: string; safeCode?: string; diagnostic?: any }> | null = null;

export function useFinOpsDiagnosticsAccess() {
  const { userProfile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [canRun, setCanRun] = useState(false);
  const [reason, setReason] = useState<string | undefined>();
  const [safeCode, setSafeCode] = useState<string | undefined>();
  const [diagnostic, setDiagnostic] = useState<any>();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkAccess() {
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        if (isMounted) {
          setAllowed(false);
          setCanRun(false);
          setLoading(false);
          setChecked(true);
        }
        return;
      }

      if (globalCache) {
        if (isMounted) {
          setAllowed(globalCache.allowed);
          setCanRun(globalCache.canRun);
          setReason(globalCache.reason);
          setSafeCode(globalCache.safeCode);
          setDiagnostic(globalCache.diagnostic);
          setLoading(false);
          setChecked(true);
        }
        return;
      }

      if (!globalPromise) {
        globalPromise = (async () => {
          try {
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/admin/finops-diagnostics/preflight', {
              headers: {
                Authorization: `Bearer ${token}`
              }
            });

            if (response.status === 200) {
              const data = await response.json();
              const result = { allowed: true, canRun: data.canRun, reason: data.reason };
              globalCache = result;
              return result;
            } else {
              let safeCode;
              let diagnostic;
              try {
                const errorData = await response.json();
                safeCode = errorData.safeCode;
                diagnostic = errorData.diagnostic;
              } catch (e) {
                // Ignore parse errors
              }
              const result = { allowed: false, canRun: false, reason: `Status: ${response.status}`, safeCode, diagnostic };
              globalCache = result;
              return result;
            }
          } catch (e: any) {
            return { allowed: false, canRun: false, reason: 'Erro de conexão' };
          }
        })();
      }

      const result = await globalPromise;
      if (isMounted) {
        setAllowed(result.allowed);
        setCanRun(result.canRun);
        setReason(result.reason);
        setSafeCode(result.safeCode);
        setDiagnostic(result.diagnostic);
        setLoading(false);
        setChecked(true);
      }
    }

    if (!authLoading) {
      checkAccess();
    }

    return () => {
      isMounted = false;
    };
  }, [authLoading]);

  return { loading, allowed, canRun, checked, reason, safeCode, diagnostic };
}
