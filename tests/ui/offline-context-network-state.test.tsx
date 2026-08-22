import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OfflineProvider, useOffline } from '../../contexts/OfflineContext';

type Listener = () => void;

function createConnection(initialEffectiveType = '4g') {
  let effectiveType = initialEffectiveType;
  const listeners = new Set<Listener>();

  return {
    get effectiveType() {
      return effectiveType;
    },
    setEffectiveType(value: string) {
      effectiveType = value;
    },
    addEventListener(type: string, listener: Listener) {
      if (type === 'change') listeners.add(listener);
    },
    removeEventListener(type: string, listener: Listener) {
      if (type === 'change') listeners.delete(listener);
    },
    emitChange() {
      listeners.forEach((listener) => listener());
    },
    listenerCount() {
      return listeners.size;
    },
  };
}

describe('OfflineProvider network-state behavior after P3.2 quarantine', () => {
  let online = true;
  let connection = createConnection();
  const originalOnLine = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');
  const originalConnection = Object.getOwnPropertyDescriptor(window.navigator, 'connection');

  beforeEach(() => {
    online = true;
    connection = createConnection('4g');
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => online,
    });
    Object.defineProperty(window.navigator, 'connection', {
      configurable: true,
      get: () => connection,
    });
  });

  afterEach(() => {
    if (originalOnLine) {
      Object.defineProperty(window.navigator, 'onLine', originalOnLine);
    } else {
      delete (window.navigator as any).onLine;
    }
    if (originalConnection) {
      Object.defineProperty(window.navigator, 'connection', originalConnection);
    } else {
      delete (window.navigator as any).connection;
    }
  });

  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <OfflineProvider>{children}</OfflineProvider>
  );

  it('preserves online/offline state and keeps legacy syncPending inert', () => {
    const { result, unmount } = renderHook(() => useOffline(), { wrapper });

    expect(result.current).toEqual({
      isOffline: false,
      syncPending: false,
      isSlowConnection: false,
    });

    act(() => {
      online = false;
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOffline).toBe(true);
    expect(result.current.syncPending).toBe(false);

    act(() => {
      online = true;
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.isOffline).toBe(false);
    expect(result.current.syncPending).toBe(false);

    expect(connection.listenerCount()).toBe(1);
    unmount();
    expect(connection.listenerCount()).toBe(0);
  });

  it('preserves slow-connection detection without invoking custom replay', () => {
    const { result } = renderHook(() => useOffline(), { wrapper });

    act(() => {
      connection.setEffectiveType('slow-2g');
      connection.emitChange();
    });
    expect(result.current.isSlowConnection).toBe(true);

    act(() => {
      connection.setEffectiveType('4g');
      connection.emitChange();
    });
    expect(result.current.isSlowConnection).toBe(false);

    act(() => {
      connection.setEffectiveType('2g');
      connection.emitChange();
    });
    expect(result.current.isSlowConnection).toBe(true);

    act(() => {
      online = false;
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isSlowConnection).toBe(false);
  });
});
