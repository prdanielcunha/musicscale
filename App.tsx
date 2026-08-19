import React, { lazy } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';

const PrivateApp = lazy(() => import('./PrivateApp'));

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

    return <PrivateApp />;
};

const App: React.FC = () => (
    <BrowserRouter>
        <RootApp />
    </BrowserRouter>
);

export default App;
