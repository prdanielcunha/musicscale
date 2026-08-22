import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const privateMount = vi.fn();
vi.mock('../../PrivateApp', () => ({
  default: () => {
    privateMount();
    return <div>private-workspace</div>;
  },
}));
vi.mock('../../pages/LoginPage', () => ({ default: () => <div>public-login</div> }));
vi.mock('../../contexts/ThemeContext', () => ({ ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../components/ErrorBoundary', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import App from '../../App';

describe('public/private application shell boundary', () => {
  beforeEach(() => {
    privateMount.mockClear();
  });

  it('renders /login without loading or mounting the private workspace', () => {
    window.history.replaceState({}, '', '/login');
    render(<App />);
    expect(screen.getByText('public-login')).toBeInTheDocument();
    expect(privateMount).not.toHaveBeenCalled();
  });

  it.each(['/start', '/'])('loads one private workspace for %s', async path => {
    window.history.replaceState({}, '', path);
    render(<App />);
    await screen.findByText('private-workspace');
    await waitFor(() => expect(privateMount).toHaveBeenCalledTimes(1));
  });
});
