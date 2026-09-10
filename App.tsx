import React, { lazy } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import StartupInteractionBoundary from './components/bootstrap/StartupInteractionBoundary';
import LoginPage from './pages/LoginPage';

const PrivateApp = lazy(() => import('./PrivateApp'));
let welcomePreloadStarted = false;

const preloadFirstAccessWelcome = () => {
    if (welcomePreloadStarted || typeof window === 'undefined') return;
    welcomePreloadStarted = true;

    try {
        const dismissed =
            window.localStorage.getItem('musicscale_welcome_dismissed') === 'true' ||
            window.localStorage.getItem('hasSeenOnboarding_v1') === 'true';

        if (!dismissed) {
            void import('./components/WhatsNewModal');
        }
    } catch {
        // If storage is unavailable, preload defensively. The useNews hook remains
        // responsible for deciding whether the presentation should actually open.
        void import('./components/WhatsNewModal');
    }
};

/**
 * The login page is a public authentication boundary. It must be reachable before
 * tenant, membership and entitlement hydration completes. Private paths cross a
 * dynamic import boundary before mounting the canonical provider stack.
 */
export const RootApp: React.FC = () => {
    const location = useLocation();

    if (location.pathname === '/login') {
        return (
            <ThemeProvider>
                <ErrorBoundary>
                    <LoginPage />
                </ErrorBoundary>
            </ThemeProvider>
        );
    }

    // Start the optional welcome chunk in parallel with the private application
    // instead of serially waiting for AppLayout + a timer before requesting it.
    preloadFirstAccessWelcome();

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
