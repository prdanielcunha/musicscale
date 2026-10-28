import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const boot = vi.hoisted(() => {
  let resolve!: (value: { default: () => React.ReactNode }) => void;
  const app = new Promise<{ default: () => React.ReactNode }>(done => { resolve = done; });
  return { app, resolve, tree: null as React.ReactNode };
});

vi.mock('react-dom/client', () => ({ default: {
  createRoot: () => ({ render: (tree: React.ReactNode) => { boot.tree = tree; } }),
} }));
vi.mock('../../App', () => boot.app);
vi.mock('../../lib/i18n', () => ({ i18nReady: Promise.resolve() }));

afterEach(() => { cleanup(); vi.useRealTimers(); });

it('finishes opening when a module arrives after 12 seconds without forcing a reload', async () => {
  vi.useFakeTimers();
  localStorage.setItem('millionsnest_i18n_lng', 'pt');
  const root = document.createElement('div');
  root.id = 'root';
  document.body.append(root);
  await import('../../index');
  render(boot.tree);

  await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
  expect(screen.getByRole('status')).toHaveTextContent('Continuamos carregando');
  expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  expect(screen.queryByText('Não foi possível abrir o MusicScale')).not.toBeInTheDocument();

  await act(async () => {
    boot.resolve({ default: () => <div>Application ready</div> });
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(screen.getByText('Application ready')).toBeVisible();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  root.remove();
});
