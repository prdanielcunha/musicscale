import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultTextOrOptions?: string | Record<string, any>, maybeOptions?: any) => {
      const defaultText = typeof defaultTextOrOptions === 'string' ? defaultTextOrOptions : key;
      const options = typeof defaultTextOrOptions === 'object' ? defaultTextOrOptions : maybeOptions;
      if (!options) return defaultText;
      let text = defaultText;
      for (const k in options) {
        text = text.replace(new RegExp(`{{${k}}}`, "g"), options[k]);
      }
      return text;
    },
    i18n: {
      language: 'pt-BR',
      resolvedLanguage: 'pt-BR',
    },
  }),
}));

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

Object.defineProperty(global, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

vi.mock('./hooks/useCapability', () => ({
  useCapability: vi.fn(() => ({ hasCapability: vi.fn(() => true) })),
}));

vi.mock('../hooks/useCapability', () => ({
  useCapability: vi.fn(() => ({ hasCapability: vi.fn(() => true) })),
}));

vi.mock('../../hooks/useCapability', () => ({
  useCapability: vi.fn(() => ({ hasCapability: vi.fn(() => true) })),
}));



