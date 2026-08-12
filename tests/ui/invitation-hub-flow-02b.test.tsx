import React from 'react';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const authState: any = { user: null, loading: false };
const acceptInvite = vi.fn();
const showToast = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../../contexts/ToastContext', () => ({ useToast: () => ({ showToast }) }));
vi.mock('../../services/inviteService', () => ({ acceptInvite: (...args: any[]) => acceptInvite(...args) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));

import JoinPage from '../../pages/JoinPage';

const LoginProbe = () => { const location = useLocation(); return <div>LOGIN:{location.search}</div>; };
const renderJoin = (path: string, route = '*') => render(<MemoryRouter initialEntries={[path]}><Routes>
  <Route path={route} element={<JoinPage />} /><Route path="/login" element={<LoginProbe />} />
</Routes></MemoryRouter>);

describe('UsersPage invitation compatibility UI (A-D)', () => {
  const source = readFileSync('pages/UsersPage.tsx', 'utf8');
  it('A-B sends organizationId/email/roleId and consumes data.link', () => {
    expect(source).toContain('fetch("/api/orgs/invite"');
    expect(source).toContain('organizationId: activeOrgId'); expect(source).toContain('email: email'); expect(source).toContain('roleId: role.id');
    expect(source).toContain('`${window.location.origin}${data.link}`');
  });
  it('C-D has no invitation Firestore write and preserves Administrador as MusicScale roleId', () => {
    const handler = source.slice(source.indexOf('const handleInvite = async'), source.indexOf('useEffect(() =>', source.indexOf('const handleInvite = async')));
    expect(handler).not.toMatch(/(?:setDoc|addDoc|updateDoc)\s*\(/); expect(handler).not.toContain('role: role.name');
    expect(handler).toContain('roleId: role.id');
  });
});

describe('ProfilePage secure invitation CTA (E-G)', () => {
  const source = readFileSync('pages/ProfilePage.tsx', 'utf8');
  it('E-F contains no generateInvite or nested invitation write', () => {
    expect(source).not.toContain('generateInvite'); expect(source).not.toMatch(/collection\([^\n]*['"]invites['"]/);
  });
  it('G navigates to secure Users intent', () => expect(source).toContain("window.location.href = '/users?intent=add-member'"));
});

describe('JoinPage invitation routes (H-R)', () => {
  beforeEach(() => { authState.user = null; authState.loading = false; acceptInvite.mockReset(); showToast.mockReset(); sessionStorage.clear(); localStorage.clear(); });
  it.each([['/join/org-1?token=abc', '/join/:organizationId'], ['/join?invite=legacy', '/join'], ['/invite?token=legacy-root', '/invite']])
  ('H-J recognizes %s and K-L preserves full local redirect', (path, route) => {
    renderJoin(path, route); expect(screen.getByText(/LOGIN:/).textContent).toContain(encodeURIComponent(path).replace(/%2F/g, '%2F'));
  });
  it('M-O accepts only through API wrapper with ID token and performs no storage/Firestore writes', async () => {
    authState.user = { getIdToken: vi.fn(async () => 'id-token') }; acceptInvite.mockResolvedValue({ success: false, message: 'safe-error' });
    renderJoin('/join/org-1?token=raw', '/join/:organizationId'); fireEvent.click(screen.getByText('Aceitar convite'));
    await waitFor(() => expect(acceptInvite).toHaveBeenCalledWith('id-token', 'raw'));
    expect(localStorage.length).toBe(0);
    const source = readFileSync('pages/JoinPage.tsx', 'utf8'); expect(source).not.toMatch(/(?:setDoc|updateDoc|addDoc|getDoc)\s*\(/);
  });
  it('P-Q canonical success including roleProjectionApplied=false remains success', async () => {
    authState.user = { getIdToken: vi.fn(async () => 'id-token') }; acceptInvite.mockResolvedValue({ success: true, roleProjectionApplied: false });
    const original = window.location.href;
    renderJoin('/join?invite=legacy', '/join'); fireEvent.click(screen.getByText('Aceitar convite'));
    await waitFor(() => expect(showToast).toHaveBeenCalled()); expect(screen.queryByText('false')).toBeNull();
    window.history.replaceState({}, '', original);
  });
  it('R displays a safe backend reason', async () => {
    authState.user = { getIdToken: vi.fn(async () => 'id-token') }; acceptInvite.mockResolvedValue({ success: false, message: 'EMAIL_MISMATCH' });
    renderJoin('/join?invite=legacy', '/join'); fireEvent.click(screen.getByText('Aceitar convite'));
    expect(await screen.findByText('EMAIL_MISMATCH')).toBeTruthy();
  });
});

describe('Login redirect security contract (S-AA)', () => {
  const source = readFileSync('pages/LoginPage.tsx', 'utf8');
  it('S contains no invite acceptance import/call', () => { expect(source).not.toContain("import('../services/inviteService')"); expect(source).not.toContain('acceptInvite('); });
  it('T-U both authentication methods only navigate to safe redirect', () => {
    expect(source).toContain('await signInWithGoogle()'); expect(source).toContain('await signInWithEmail(email, password, rememberMe)');
    expect(source.match(/navigate\(redirectPath, \{ replace: true \}\)/g)).toHaveLength(2);
  });
  it.each(['/join/org?token=x', '/invite?token=x', '/ordinary'])('V,W,AA accepts local path %s by predicate', path => {
    expect(path.startsWith('/') && !path.startsWith('//')).toBe(true);
  });
  it.each(['//evil.example', 'https://evil.example', 'javascript:alert(1)'])('X-Z rejects unsafe redirect %s by exact predicate', path => {
    expect(path.startsWith('/') && !path.startsWith('//')).toBe(false);
  });
  it('source uses the exact local-only predicate', () => expect(source).toContain("candidate.startsWith('/') && !candidate.startsWith('//')"));
});
