import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultText: string, options?: any) => {
      if (!options) return defaultText;
      let text = defaultText;
      for (const k in options) {
        text = text.replace(new RegExp(`{{${k}}}`, "g"), options[k]);
      }
      return text;
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

// Mock ToastContext globally to prevent "useToast must be used within ToastProvider" errors in various UI tests
vi.mock('../contexts/ToastContext', () => ({
  ToastProvider: ({ children }: any) => children,
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  ToastProvider: ({ children }: any) => children,
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  ToastProvider: ({ children }: any) => children,
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

