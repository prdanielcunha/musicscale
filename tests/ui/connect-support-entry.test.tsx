import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConnectSupportButton from '../../components/help/ConnectSupportButton';
import { createConnectSupportDraftProxy } from '../../services/server/connect/supportDraftProxy';

const state = vi.hoisted(() => ({ user: null as any, org: 'synthetic-org', language: 'pt-BR' }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: state.user, effectiveOrganizationId: state.org }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: state.language } }) }));

const token = 'synthetic-user-token';
let popup: { opener: unknown; closed: boolean; close: ReturnType<typeof vi.fn>; location: { href: string } };
let remoteStatus: number, remotePayload: any, calls: any[];
const draft = () => ({ product: 'musicscale', automaticSend: false, expiresAt: Date.now() + 600000, draftUrl: 'https://wa.me/16505550100?text=synthetic-support-origin' });

function mountRelay() {
  const proxy = createConnectSupportDraftProxy(async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(remotePayload), { status: remoteStatus });
  });
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    expect(url).toBe('/api/v1/connect/support-draft');
    const request = { headers: Object.fromEntries(Object.entries(init.headers).map(([k, v]) => [k.toLowerCase(), v])), body: JSON.parse(init.body) };
    let status = 200, payload: any;
    const response = { setHeader() {}, status(n: number) { status = n; return this; }, json(v: unknown) { payload = v; return this; } };
    await proxy(request, response);
    return new Response(JSON.stringify(payload), { status });
  }));
}
function click() { fireEvent.click(screen.getByRole('button')); }
async function failure() { await waitFor(() => expect(screen.getByRole('status')).toBeVisible()); expect(popup.close).toHaveBeenCalled(); expect(popup.location.href).toBe('about:blank'); }

describe('explicit manual Connect entry with the real relay and synthetic Core transport', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_CONNECT_SUPPORT_ENABLED', 'true');
    state.user = { uid: 'synthetic-actor', getIdToken: vi.fn().mockResolvedValue(token) }; state.org = 'synthetic-org'; state.language = 'pt-BR';
    popup = { opener: 'synthetic-opener', closed: false, close: vi.fn(), location: { href: 'about:blank' } };
    vi.spyOn(window, 'open').mockReturnValue(popup as any);
    remoteStatus = 200; remotePayload = draft(); calls = []; mountRelay();
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('does nothing before a click, relays fresh identity/scope and opens only a manual draft', async () => {
    render(<ConnectSupportButton />);
    expect(fetch).not.toHaveBeenCalled(); expect(state.user.getIdToken).not.toHaveBeenCalled();
    click();
    await waitFor(() => expect(popup.location.href).toBe(remotePayload.draftUrl));
    expect(popup.opener).toBeNull(); expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://connect.millionsnest.com/api/core/support/draft');
    expect(calls[0].init.redirect).toBe('error');
    expect(calls[0].init.headers.Authorization).toBe(`Bearer ${token}`);
    expect(calls[0].init.headers['X-Connect-User-Authorization']).toBe(`Bearer ${token}`);
    expect(JSON.parse(calls[0].init.body)).toEqual({ product: 'musicscale', organizationId: state.org, locale: 'pt-BR' });
    expect(popup.location.href).not.toContain(token);
  });
  it.each(['organization', 'account', 'logout', 'unmount'])('invalidates a pending draft on %s', async kind => {
    let finish!: (r: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
    const view = render(<ConnectSupportButton />); click(); await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    if (kind === 'organization') state.org = 'other-synthetic-org';
    if (kind === 'account') state.user = { ...state.user, uid: 'other-synthetic-actor' };
    if (kind === 'logout') state.user = null;
    if (kind === 'unmount') view.unmount(); else view.rerender(<ConnectSupportButton />);
    await act(async () => finish(new Response(JSON.stringify(draft()))));
    expect(popup.location.href).toBe('about:blank'); expect(popup.close).toHaveBeenCalled();
  });
  it('does not navigate a popup the user closed', async () => {
    popup.closed = true; render(<ConnectSupportButton />); click();
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
    expect(calls).toHaveLength(1); expect(popup.location.href).toBe('about:blank');
  });
  it.each([401, 403, 409, 503])('shows safe fallback after canonical/provider status %i', async status => {
    remoteStatus = status; remotePayload = { private: 'synthetic-private-upstream' }; render(<ConnectSupportButton />); click(); await failure();
    expect(screen.getByRole('status').textContent).not.toContain('synthetic-private');
  });
  it.each([
    { draftUrl: 'https://wa.me.evil.test/16505550100?text=x' },
    { draftUrl: 'https://wa.me/16505550100?text=x#private' },
    { draftUrl: 'https://wa.me/16505550100?text=x&token=private' },
    { expiresAt: 0 }, { automaticSend: true }, { product: 'nestfinance' },
  ])('refuses an unsafe or expired upstream draft: %j', async changed => {
    remotePayload = { ...draft(), ...changed }; render(<ConnectSupportButton />); click(); await failure();
  });
  it.each([['en-US', 'Chat on official WhatsApp'], ['es-ES', 'Hablar por WhatsApp oficial'], ['pt-BR', 'Conversar no WhatsApp oficial']])('uses %s copy and locale', async (language, label) => {
    state.language = language; render(<ConnectSupportButton />); fireEvent.click(screen.getByRole('button', { name: label }));
    await waitFor(() => expect(calls).toHaveLength(1)); expect(JSON.parse(calls[0].init.body).locale).toBe(language);
  });
  it('requires an authenticated user and active organization', () => {
    state.user = null; const view = render(<ConnectSupportButton />); expect(screen.getByRole('button')).toBeDisabled();
    state.user = { uid: 'synthetic-actor' }; state.org = ''; view.rerender(<ConnectSupportButton />); expect(screen.getByRole('button')).toBeDisabled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps an ordinary build opt-in', () => { vi.stubEnv('VITE_CONNECT_SUPPORT_ENABLED', 'false'); render(<ConnectSupportButton />); expect(screen.queryByRole('button')).toBeNull(); expect(fetch).not.toHaveBeenCalled(); });
});
