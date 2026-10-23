import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ConnectSupportButton from '../../components/help/ConnectSupportButton';
let language = 'pt-BR';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language } }) }));
afterEach(() => { cleanup(); language = 'pt-BR'; vi.unstubAllGlobals(); });
describe('official public support without session, API or plan dependencies', () => {
  it('opens a fixed central contact boundary without fetching or reading identity', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    render(<ConnectSupportButton />);
    const link = screen.getByRole('link'); const url = new URL(link.getAttribute('href')!);
    expect(url.origin).toBe('https://connect.millionsnest.com');
    expect(url.pathname).toBe('/api/core/support/contact');
    expect(Object.fromEntries(url.searchParams)).toEqual({ product: 'musicscale', source: 'app', topic: 'help', locale: 'pt-BR', open: '1' });
    expect(link.getAttribute('rel')).toContain('noreferrer'); expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['help', 'error', 'access', 'billing', 'sales', 'other'])('identifies the %s subject', topic => {
    render(<ConnectSupportButton />); fireEvent.change(screen.getByRole('combobox'), { target: { value: topic } });
    expect(new URL(screen.getByRole('link').getAttribute('href')!).searchParams.get('topic')).toBe(topic);
  });
  it.each([['en-US', 'Chat on official WhatsApp'], ['es-ES', 'Hablar por WhatsApp oficial'], ['pt-BR', 'Conversar no WhatsApp oficial']])('supports %s', (locale, action) => {
    language = locale; render(<ConnectSupportButton />);
    expect(new URL(screen.getByRole('link', { name: action }).getAttribute('href')!).searchParams.get('locale')).toBe(locale);
  });
});
