export function getFirebaseRuntimeConfig({
  prodConfig,
  isDev,
  viteE2eMode,
  viteE2eProjectId,
  hostname
}: {
  prodConfig: Record<string, any>;
  isDev: boolean;
  viteE2eMode: string | undefined;
  viteE2eProjectId: string | undefined;
  hostname: string;
}) {
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isE2EModeActivated = viteE2eMode === 'true';

  if (isE2EModeActivated) {
    if (!isLocalhost) {
      throw new Error("E2E mode can only be activated on localhost");
    }
    if (!isDev) {
      throw new Error("E2E mode can only be activated in DEV mode");
    }
    if (!viteE2eProjectId) {
      throw new Error("E2E mode requires VITE_E2E_FIREBASE_PROJECT_ID");
    }
    if (viteE2eProjectId !== 'demo-musicscale') {
      throw new Error("E2E mode requires VITE_E2E_FIREBASE_PROJECT_ID to be 'demo-musicscale'");
    }

    return {
      firebaseConfig: { 
        ...prodConfig, 
        projectId: viteE2eProjectId,
        authDomain: `${viteE2eProjectId}.firebaseapp.com`
      },
      useEmulators: true,
      projectId: viteE2eProjectId
    };
  }

  return {
    firebaseConfig: prodConfig,
    useEmulators: false,
    projectId: prodConfig.projectId
  };
}
