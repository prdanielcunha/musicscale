import { logger } from './lib/logger';

import React, { useEffect, useState, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { MusicDataProvider } from './contexts/MusicDataContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ApiProvider } from './contexts/ApiContext';
import { ModalProvider } from './contexts/ModalContext';
import { SuggestionProvider } from './contexts/SuggestionContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import Spinner from './components/common/Spinner';
import ProtectedRoute from './components/auth/ProtectedRoute';
import GlobalCurationProtectedRoute from './components/auth/GlobalCurationProtectedRoute';
import FinOpsDiagnosticsProtectedRoute from './components/auth/FinOpsDiagnosticsProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

// Early load Start and Login flows
import StartGateway from './pages/StartGateway';

// Lazy Load Admin/App routes
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SongsPage = lazy(() => import('./pages/SongsPage'));
const ScalesPage = lazy(() => import('./pages/ScalesPage'));
const DatabasePage = lazy(() => import('./pages/DatabasePage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PlansPage = lazy(() => import('./pages/PlansPage'));
const PlanUsagePage = lazy(() => import('./pages/PlanUsagePage'));
const ChordsPage = lazy(() => import('./pages/ChordsPage'));
const LyricsPage = lazy(() => import('./pages/LyricsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const CurationPage = lazy(() => import('./pages/CurationPage'));
const RolesPage = lazy(() => import('./pages/RolesPage'));
const BandPage = lazy(() => import('./pages/BandPage'));
const BandScalesPage = lazy(() => import('./pages/BandScalesPage'));
const SuggestionsPage = lazy(() => import('./pages/SuggestionsPage'));
const BackupPage = lazy(() => import('./pages/BackupPage'));
const TenantOnboarding = lazy(() => import('./pages/TenantOnboarding'));
const JoinPage = lazy(() => import('./pages/JoinPage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const UpdatesPage = lazy(() => import('./pages/UpdatesPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const DebugSessionPage = lazy(() => import('./pages/DebugSessionPage'));
const FinOpsDiagnosticsPage = lazy(() => import('./pages/FinOpsDiagnosticsPage'));

import { PerformanceRecovery } from './components/common/PerformanceRecovery';
import { SyncConfidenceLayer } from './components/common/SyncConfidenceLayer';
import { useEcosystemTelemetry } from './hooks/useEcosystemTelemetry';
import { useEcosystem } from './contexts/EcosystemContext';
import { MissingSubscriptionScreen } from './components/premium/MissingSubscriptionScreen';
import { RepairNeededScreen } from './components/premium/RepairNeededScreen';
import { getSubscriptionBlockReason } from './utils/subscriptionValidator';
import { resolveSubscriptionAccess } from './utils/subscriptionAccessResolver';

import { useModals } from './contexts/ModalContext';
import { useNews } from './hooks/useNews';

const AppLayout: React.FC = () => {
    const { user, userProfile, userRole, organization, subscription, isAdmin, isOwner, isGlobalAdmin, entitlements, isSupportMode, effectiveOrganizationName, loading: isAuthLoading, supportTargetType, isSubscriptionLoaded, isEntitlementsLoaded } = useAuth();
    const { isDegraded, publishEvent } = useEcosystem();
    const [isSidebarCollapsed, setSidebarCollapsed] = React.useState(true);
    const location = useLocation();
    
    // Novidades Auto-open
    const { hasUnseen } = useNews();
    const { openWhatsNew } = useModals();
    const autoOpenAttempted = React.useRef(false);

    useEffect(() => {
        // Run only once and only if we have unseen news
        if (hasUnseen && !autoOpenAttempted.current) {
            autoOpenAttempted.current = true;
            // Add a small delay to avoid fighting with other modals/initializations
            setTimeout(() => {
                openWhatsNew();
            }, 500);
        }
    }, [hasUnseen, openWhatsNew]);

    const isAllowedRouteDuringSuspension = location.pathname === '/plans' || location.pathname === '/profile' || location.pathname.startsWith('/debug');
    const contextValidation = React.useMemo(() => ({
        entitlements,
        organization,
        subscription
    }), [entitlements, organization, subscription]);
    
    const { valid: isSubscriptionValid, reason: blockReason, banner: subscriptionBanner } = getSubscriptionBlockReason(contextValidation);

    const resolution = resolveSubscriptionAccess(isAuthLoading, isSubscriptionLoaded, isEntitlementsLoaded, contextValidation, isGlobalAdmin);
    const isSuspended = resolution.loaded && !resolution.valid && organization;

    useEffect(() => {
        if (!isAuthLoading && organization) {
            logger.info(`[MusicScale] Subscription Access Resolution`, {
                organizationId: organization.id,
                isSubscriptionLoaded,
                isEntitlementsLoaded,
                status: resolution.status,
                technicalError: resolution.technicalError,
                valid: resolution.valid,
                reason: resolution.reason
            });
        }
    }, [isAuthLoading, organization, isSubscriptionLoaded, isEntitlementsLoaded, resolution.status, resolution.technicalError, resolution.valid, resolution.reason]);

    // Publish telemetry to Ecosystem OS
    useEcosystemTelemetry();

    // Close sidebar on mobile when location changes
    useEffect(() => {
        if (window.innerWidth < 768) {
            setSidebarCollapsed(true);
        }
    }, [location.pathname, location.hash]);

    // Handle crash telemetry
    useEffect(() => {
        const handleError = (e: ErrorEvent) => {
            publishEvent({
                type: 'error',
                payload: { type: 'global_error', message: e.message },
                timestamp: Date.now()
            });
        };
        window.addEventListener('error', handleError);
        return () => window.removeEventListener('error', handleError);
    }, [publishEvent]);

    const handleSidebarToggle = () => {
        setSidebarCollapsed(prev => !prev);
    };

    logger.debug("[AppLayout] Banner Status:", {
        subscriptionStatus: subscription?.status,
        isAdmin,
        isOwner,
        userId: user?.uid,
        userRole: userProfile?.role,
        ownerId: organization?.ownerUserId || (organization as any)?.owner_user_id
    });

    if (isSuspended && !isAllowedRouteDuringSuspension) {
        return (
            <div className="flex h-screen w-screen bg-[#0a0a0b] justify-center items-center">
                <MissingSubscriptionScreen resolution={resolution} />
            </div>
        );
    }

    return (
        <div className="flex h-screen font-sans bg-[var(--color-background)] overflow-hidden relative">
            <PerformanceRecovery />
            <SyncConfidenceLayer />
            
            {/* Premium Dashboard Background */}
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[#0a0a0b] dark:bg-[#050505] overflow-hidden" aria-hidden="true">
                <div className="absolute top-[-10%] opacity-30 right-[-5%] h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-[120px] md:h-[600px] md:w-[600px] md:bg-blue-500/10 md:blur-[140px]" />
                <div className="absolute top-[20%] opacity-20 left-[-10%] h-[600px] w-[600px] rounded-full bg-violet-500/5 blur-[140px] md:h-[800px] md:w-[800px] md:bg-violet-500/10 md:blur-[160px]" />
            </div>
            
            {/* Subtle Premium Noise */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 opacity-[0.015] mix-blend-overlay [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.4)_1px,transparent_0)] [background-size:24px_24px]"
            />

            {/* Mobile Sidebar Overlay */}
            {!isSidebarCollapsed && (
                <div 
                    className="md:hidden fixed inset-0 z-[90] bg-black/60 backdrop-blur-md transition-opacity duration-300"
                    onClick={() => setSidebarCollapsed(true)}
                />
            )}

            {/* Sidebar Container */}
            <div className={`fixed inset-y-0 left-0 z-[100] transform md:relative md:transform-none md:block py-4 pl-4 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isSidebarCollapsed ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
                <Sidebar 
                    isCollapsed={isSidebarCollapsed}
                    onToggle={handleSidebarToggle}
                    onLinkClick={() => setSidebarCollapsed(true)}
                />
                
                {/* Mobile close button inside sidebar container area */}
                <button 
                    className="md:hidden absolute top-8 -right-12 w-10 h-10 flex items-center justify-center bg-white/10 text-white rounded-full backdrop-blur-md"
                    onClick={() => setSidebarCollapsed(true)}
                    style={{ display: isSidebarCollapsed ? 'none' : 'flex' }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>

            {/* Main Content */}
            <div className={`relative flex-1 flex flex-col overflow-hidden z-10 transition-all duration-300 md:pb-0`}>
                
                {subscriptionBanner && (
                    <div className="bg-indigo-500/10 border-b border-indigo-500/20 px-4 py-2.5 flex items-center justify-between gap-3 w-full shrink-0 shadow-sm backdrop-blur-md">
                        <span className="text-indigo-700 dark:text-indigo-300 text-xs font-medium truncate flex-1 flex items-center gap-2">
                           <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                           </svg>
                           {subscriptionBanner}
                        </span>
                        <a href="https://www.millionsnest.com/dashboard/musicscale/plans" target="_blank" rel="noopener noreferrer" className="shrink-0 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1 rounded transition-colors whitespace-nowrap">
                            Gerenciar plano
                        </a>
                    </div>
                )}
                
                <Header onMenuClick={() => setSidebarCollapsed(false)} />
                
                <main className="flex-1 overflow-y-auto overflow-x-hidden relative isolate p-4 pb-[calc(140px+env(safe-area-inset-bottom))] md:pb-8 md:p-8 scroll-smooth touch-manipulation">
                    <div className="max-w-7xl mx-auto space-y-8">
                       <Suspense fallback={<div className="flex h-64 w-full items-center justify-center"><Spinner size="lg" /></div>}>
                           <Routes>
                                <Route path="/" element={
                                    <ProtectedRoute requiredPermission="musicscale.performance.use">
                                        <DashboardPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/dashboard" element={<Navigate to="/" replace />} />
                                <Route path="/songs" element={
                                    <ProtectedRoute requiredPermission="musicscale.performance.use">
                                        <SongsPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/band" element={
                                    <ProtectedRoute requiredPermission="musicscale.members.manage">
                                        <BandPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/scales" element={
                                    <ProtectedRoute requiredPermission="musicscale.performance.use">
                                        <ScalesPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/scales/:scaleId" element={
                                    <ProtectedRoute requiredPermission="musicscale.performance.use">
                                        <ScalesPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/band-scales" element={
                                    <ProtectedRoute requiredPermission="musicscale.performance.use">
                                        <BandScalesPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/band-scales/:scaleId" element={
                                    <ProtectedRoute requiredPermission="musicscale.performance.use">
                                        <BandScalesPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/chords" element={
                                    <ProtectedRoute requiredPermission="musicscale.performance.use">
                                        <ChordsPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/lyrics" element={
                                    <ProtectedRoute requiredPermission="musicscale.performance.use">
                                        <LyricsPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/database" element={
                                    <ProtectedRoute requiredPermission="manageOrganization">
                                        <DatabasePage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/profile" element={<ProfilePage />} />
                                <Route path="/plans" element={
                                    <ProtectedRoute requiredPermission="manageOrganization">
                                        <PlansPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/plan-usage" element={
                                    <ProtectedRoute requiredPermission="manageOrganization">
                                        <PlanUsagePage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/library" element={
                                    <ProtectedRoute requiredPermission="musicscale.performance.use">
                                        <LibraryPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/curation/:candidateId" element={
                                    <GlobalCurationProtectedRoute>
                                        <CurationPage />
                                    </GlobalCurationProtectedRoute>
                                } />
                                <Route path="/curation" element={
                                    <GlobalCurationProtectedRoute>
                                        <CurationPage />
                                    </GlobalCurationProtectedRoute>
                                } />
                                <Route path="/updates" element={
                                    <ProtectedRoute requiredPermission="musicscale.performance.use">
                                        <UpdatesPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/notifications" element={
                                    <ProtectedRoute requiredPermission="musicscale.performance.use">
                                        <NotificationsPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/suggestions" element={
                                    <ProtectedRoute requiredPermission="musicscale.songs.edit">
                                        <SuggestionsPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/users" element={
                                    <ProtectedRoute requiredPermission="manageMembers">
                                        <UsersPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/roles" element={
                                    <ProtectedRoute requiredPermission="manageMembers">
                                        <RolesPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/backup" element={
                                    <ProtectedRoute requiredPermission="manageOrganization">
                                        <BackupPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/debug/session" element={
                                    <ProtectedRoute requiredPermission="manageOrganization">
                                        <DebugSessionPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/admin/finops-diagnostics" element={
                                    <FinOpsDiagnosticsProtectedRoute>
                                        <FinOpsDiagnosticsPage />
                                    </FinOpsDiagnosticsProtectedRoute>
                                } />
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </Suspense>
                    </div>
                </main>
                <BottomNav onMenuClick={() => setSidebarCollapsed(false)} />
            </div>
        </div>
    );
};

function Gatekeeper({ children }: { children: React.ReactNode }) {
    const { user, userProfile, loading, organization, subscription, needsRepair } = useAuth();
    const [bootstrapTimedOut, setBootstrapTimedOut] = useState(false);
    const isBootstrapping = loading || !!(user && !userProfile);

    useEffect(() => {
        if (!isBootstrapping) {
            setBootstrapTimedOut(false);
            return;
        }

        const timer = window.setTimeout(() => {
            setBootstrapTimedOut(true);
            logger.warn('[Gatekeeper] Bootstrap exceeded 15s; keeping fail-closed recovery screen instead of crashing.');
        }, 15000);

        return () => window.clearTimeout(timer);
    }, [isBootstrapping]);

    if (bootstrapTimedOut && isBootstrapping) {
        return (
            <div className="flex min-h-[100dvh] w-full items-center justify-center bg-[#070709] px-6 py-10 text-center">
                <div className="w-full max-w-md rounded-[28px] border border-white/[0.08] bg-[#111113] p-7 sm:p-9 shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
                    <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-300">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M20 6v5h-5" />
                            <path d="M4 18v-5h5" />
                            <path d="M18.5 9A7 7 0 0 0 6 6.5L4 9" />
                            <path d="M5.5 15A7 7 0 0 0 18 17.5l2-2.5" />
                        </svg>
                    </div>
                    <h1 className="mb-2 text-2xl font-black tracking-tight text-white">
                        O MusicScale está demorando mais que o normal
                    </h1>
                    <p className="mb-6 text-sm leading-relaxed text-white/55 sm:text-base">
                        Não liberamos uma tela parcial enquanto sua sessão está sendo validada. Seus dados continuam protegidos; tente recarregar para concluir o acesso.
                    </p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="w-full rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-black transition hover:bg-white/90 active:scale-[0.99]"
                    >
                        Tentar novamente
                    </button>
                </div>
            </div>
        );
    }

    if (isBootstrapping) {
        return (
            <div className="flex bg-[#0a0a0b] dark:bg-[#050505] h-[100dvh] w-[100dvw] justify-center items-center flex-col relative overflow-hidden isolate">
                {/* Immersive ambient noise for splash */}
                <div 
                    className="fixed inset-0 z-0 pointer-events-none opacity-[0.03] mix-blend-screen hidden md:block" 
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
                ></div>
                {/* Pulsing deep light */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 active:scale-110 blur-[100px] rounded-full animate-pulse z-0 hidden md:block"></div>
                
                <div className="relative z-10 flex flex-col items-center gap-6">
                   <Spinner size="lg" />
                   <p className="text-white/40 font-mono text-[11px] uppercase tracking-[0.3em] font-medium animate-pulse">
                      Preparando Ambiente Operacional...
                   </p>
                </div>
            </div>
        );
    }

    if (needsRepair) {
        return <RepairNeededScreen />;
    }

    const hasProduct = userProfile?.products?.includes('musicscale') || (userProfile as any)?.isNew || !!userProfile?.apps?.musicscale;

    logger.debug("[Gatekeeper] Status:", { 
      appName: "MusicScale",
      uid: user?.uid,
      products: userProfile?.products,
      hasProduct, 
      hasOrg: !!organization, 
      subscriptionStatus: subscription?.status 
    });

    if (!user || !organization) {
        logger.debug("Gatekeeper negou acesso, roteando para /start...", { 
           reason: !user ? 'No user' : 'No organization',
           user: !!user, 
           hasOrg: !!organization 
        });
        return <Navigate to="/start" replace />;
    }

    return <>{children}</>;
}

const AppContent: React.FC = () => {
    return (
        <Routes>
            <Route path="/join" element={<JoinPage />} />
            <Route path="/join/:organizationId" element={<JoinPage />} />
            <Route path="/invite" element={<JoinPage />} />
            <Route path="/start" element={<StartGateway />} />
            <Route path="/*" element={
                <Gatekeeper>
                    <MusicDataProvider>
                        <SuggestionProvider>
                            <ModalProvider>
                                <AppLayout />
                            </ModalProvider>
                        </SuggestionProvider>
                    </MusicDataProvider>
                </Gatekeeper>
            } />
        </Routes>
    );
};

import { ToastProvider } from './contexts/ToastContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { EcosystemProvider } from './contexts/EcosystemContext';

const PrivateAppProviders: React.FC = () => (
    <EcosystemProvider>
        <ThemeProvider>
            <AuthProvider>
                <ToastProvider>
                    <OfflineProvider>
                        <ApiProvider>
                            <NotificationProvider>
                                <ErrorBoundary>
                                    <AppContent />
                                </ErrorBoundary>
                            </NotificationProvider>
                        </ApiProvider>
                    </OfflineProvider>
                </ToastProvider>
            </AuthProvider>
        </ThemeProvider>
    </EcosystemProvider>
);

export default PrivateAppProviders;