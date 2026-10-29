import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.useRealTimers();
  document.getElementById('splash-loader')?.remove();
  localStorage.removeItem('millionsnest_i18n_lng');
});

it.each([
  ['pt-BR', 'O MusicScale continua carregando', 'Tentar novamente'],
  ['en-US', 'MusicScale is still loading', 'Try again'],
  ['es-ES', 'MusicScale sigue cargando', 'Intentar de nuevo'],
])('shows localized progress before DOMContentLoaded when the entry script stalls (%s)', async (language, title, retry) => {
  vi.useFakeTimers();
  localStorage.setItem('millionsnest_i18n_lng', language);
  const splash = document.createElement('div');
  splash.id = 'splash-loader';
  document.body.append(splash);
  const html = readFileSync('index.html', 'utf8');
  const watchdog = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .find(match => match[1].includes('Boot Resilience Watchdog'))![1];
  // No DOMContentLoaded event is dispatched: module loading can block it.
  new Function(watchdog)();
  await vi.advanceTimersByTimeAsync(12000);
  expect(splash.querySelector('h2')).toHaveTextContent(title);
  expect(splash.querySelector('button')).toHaveTextContent(retry);
  expect(splash).not.toHaveTextContent('Não foi possível iniciar');
});
