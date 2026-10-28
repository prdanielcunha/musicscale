import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('PWA startup bandwidth priority', () => {
  const register = vi.fn().mockResolvedValue({});
  let DeferredPwaRegistration: typeof import('../../components/bootstrap/DeferredPwaRegistration').default;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubEnv('PROD', true);
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register } });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    register.mockClear();
    DeferredPwaRegistration = (await import('../../components/bootstrap/DeferredPwaRegistration')).default;
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllEnvs(); });

  const mount = (path = '/') => render(<MemoryRouter initialEntries={[path]}><DeferredPwaRegistration /></MemoryRouter>);
  const ready = () => window.dispatchEvent(new CustomEvent('musicscale:startup-telemetry', {
    detail: { metric: 'first_operational_screen_ms' },
  }));

  it('does not download the offline bundle while the private screen is still loading', async () => {
    mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(register).not.toHaveBeenCalled();
    act(ready);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(register).toHaveBeenCalledExactlyOnceWith('/sw.js', { scope: '/' });
    act(ready);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('keeps offline caching available after public login opens', async () => {
    mount('/login');
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('waits for reconnection and cancels pending work on unmount', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const view = mount();
    act(ready);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(register).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    act(() => { window.dispatchEvent(new Event('online')); });
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(register).not.toHaveBeenCalled();
  });
});
