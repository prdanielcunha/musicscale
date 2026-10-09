import React, { lazy, useEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import StartupInteractionBoundary from './components/bootstrap/StartupInteractionBoundary';
import LoginPage from './pages/LoginPage';
import { getCanonicalInvitationJoinUrl } from './lib/canonicalInvitationRedirect';

const PrivateApp = lazy(() => import('./PrivateApp'));

const CanonicalInvitationHandoff: React.FC<{ destination: string }> = ({ destination }) => {
    useEffect(() => {
        window.location.replace(destination);
    }, [destination]);

    const language = navigator.language.toLowerCase();
    const isSpanish = language.startsWith('es');
    const isEnglish = language.startsWith('en');
    const message = isSpanish ? 'Abriendo tu invitación segura…'
        : isEnglish ? 'Opening your secure invitation…'
        : 'Abrindo seu convite seguro…';
    const continueLabel = isSpanish ? 'Continuar a MillionsNest'
        : isEnglish ? 'Continue to MillionsNest'
        : 'Continuar no MillionsNest';

    return (
        <main className="flex min-h-[100dvh] items-center justify-center bg-[#050505] p-6 text-center text-white">
            <div>
                <p role="status" aria-live="polite" className="mb-5 text-base">{message}</p>
                <a href={destination} className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white">
                    {continueLabel}
                </a>
            </div>
        </main>
    );
};

/**
 * The login page is a public authentication boundary. It must be reachable before
 * tenant, membership and entitlement hydration completes. Private paths cross a
 * dynamic import boundary before mounting the canonical provider stack.
 *
 * Release news is intentionally not prefetched here. Loading it in parallel
 * with PrivateApp would make a non-essential chunk compete with the critical
 * mobile bootstrap for network, parse and main-thread time.
 */
export const RootApp: React.FC = () => {
    const location = useLocation();
    const invitationDestination = getCanonicalInvitationJoinUrl(location.pathname, location.search);

    // Canonical tenant-bound invitations must be accepted at the Hub authority
    // before the satellite loads org-dependent providers or validates access.
    if (invitationDestination) {
        return <CanonicalInvitationHandoff destination={invitationDestination} />;
    }

    if (location.pathname === '/login') {
        return (
            <ThemeProvider>
                <ErrorBoundary>
                    <LoginPage />
                </ErrorBoundary>
            </ThemeProvider>
        );
    }

    return (
        <StartupInteractionBoundary>
            <PrivateApp />
        </StartupInteractionBoundary>
    );
};

const App: React.FC = () => (
    <BrowserRouter>
        <RootApp />
    </BrowserRouter>
);

export default App;
