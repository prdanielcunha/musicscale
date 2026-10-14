import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BandMember, Instrument, UserProfile } from '../../types';
import BandBuilder from '../../components/scales/BandBuilder';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

const instrument = {
  id: 'inst-vocal', name: 'Vocal', category: 'Voz', organizationId: 'org-a',
} as Instrument;
const keyboard = {
  id: 'inst-keyboard', name: 'Teclado', category: 'Instrumento', organizationId: 'org-a',
} as Instrument;
const minister = {
  id: 'inst-minister', name: 'Ministro', category: 'Ministro', organizationId: 'org-a',
} as Instrument;
const person = {
  id: 'member-a', uid: 'member-a', organizationId: 'org-a',
  displayName: 'Integrante da Equipe', specialtyIds: ['inst-vocal'],
} as unknown as UserProfile;

function Subject({
  users = [person], status = 'ready', onRetry,
}: {
  users?: UserProfile[];
  status?: 'idle' | 'loading' | 'ready' | 'error';
  onRetry?: () => void;
}) {
  const [formData, setFormData] = useState<{name:string; assignments:BandMember[]}>({
    name: 'Banda Principal', assignments: [],
  });

  return (
    <div>
      <output data-testid="assignment-count">{formData.assignments.length}</output>
      <output data-testid="assignment-pairs">{formData.assignments.map(a => `${a.userId}:${a.instrumentId}`).sort().join('|')}</output>
      <BandBuilder
        compactDesktopLayout
        memberDirectoryState={status}
        onRetryMemberDirectory={onRetry}
        formData={formData}
        setFormData={setFormData}
        instrumentsByCat={[
          {name: 'Vozes', instruments: [instrument]},
          {name: 'Instrumento', instruments: [keyboard]},
          {name: 'Ministro', instruments: [minister]},
        ]}
        allUsers={users}
        populatedBandScales={[]}
        musicScales={[]}
      />
    </div>
  );
}

describe('fixed scale owner can pick an actual member', () => {
  it('exposes the people panel at the tablet breakpoint and accepts an assignment', () => {
    render(<Subject />);
    const functions = screen.getByText('Vozes').parentElement?.parentElement;
    expect(functions?.className).toContain('md:w-[36%]');
    const roster = screen.getByText('Vozes').closest('div.flex-col')?.parentElement?.children[1] as HTMLElement;
    expect(roster.className).toContain('md:w-[64%]');
    expect(roster.className.split(/\s+/)).toContain('flex');
    fireEvent.click(screen.getByTestId('select-instrument-inst-vocal'));
    expect(screen.getByText('Integrante da Equipe')).toBeVisible();
    fireEvent.click(screen.getByTestId('add-assignment-member-a-inst-vocal'));
    expect(screen.getByTestId('assignment-count')).toHaveTextContent('1');
  });

  it('assigns keyboard, vocal and minister to one member without duplicate pairs, then removes only the chosen function', () => {
    render(<Subject />);
    fireEvent.click(screen.getByTestId('select-instrument-inst-vocal'));
    fireEvent.click(screen.getByTestId('add-assignment-member-a-inst-vocal'));
    expect(screen.getByTestId('assignment-count')).toHaveTextContent('1');
    expect(screen.getByTestId('add-assignment-member-a-inst-vocal')).toBeDisabled();

    fireEvent.click(screen.getByTestId('select-instrument-inst-keyboard'));
    expect(screen.getByTestId('add-assignment-member-a-inst-keyboard')).toBeEnabled();
    fireEvent.click(screen.getByTestId('add-assignment-member-a-inst-keyboard'));
    fireEvent.click(screen.getByTestId('select-instrument-inst-minister'));
    fireEvent.click(screen.getByTestId('add-assignment-member-a-inst-minister'));

    expect(screen.getByTestId('assignment-count')).toHaveTextContent('3');
    expect(screen.getByTestId('assignment-pairs')).toHaveTextContent(
      'member-a:inst-keyboard|member-a:inst-minister|member-a:inst-vocal'
    );
    expect(screen.getByTestId('add-assignment-member-a-inst-keyboard')).toBeDisabled();
    expect(screen.getByTestId('add-assignment-member-a-inst-minister')).toBeDisabled();
    expect(screen.getByText(/Funções na escala/)).toHaveTextContent('Teclado');
    expect(screen.getByText(/Funções na escala/)).toHaveTextContent('Ministro');

    // Return to the formation summary, where each function is removable independently.
    fireEvent.click(screen.getByTestId('select-instrument-inst-vocal'));
    fireEvent.click(screen.getByTestId('select-instrument-inst-keyboard'));
    fireEvent.click(screen.getByTestId('select-instrument-inst-minister'));
    fireEvent.click(screen.getByTestId('remove-assignment-member-a-inst-vocal'));
    expect(screen.getByTestId('assignment-count')).toHaveTextContent('2');
    expect(screen.getByTestId('assignment-pairs')).toHaveTextContent(
      'member-a:inst-keyboard|member-a:inst-minister'
    );

    fireEvent.click(screen.getByTestId('select-instrument-inst-vocal'));
    expect(screen.getByTestId('add-assignment-member-a-inst-vocal')).toBeEnabled();
    fireEvent.click(screen.getByTestId('add-assignment-member-a-inst-vocal'));
    expect(screen.getByTestId('assignment-count')).toHaveTextContent('3');
  });

  it('automatically moves from function choice to member picker on phones', () => {
    const before = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    try {
      render(<Subject />);
      fireEvent.click(screen.getByTestId('select-instrument-inst-vocal'));
      const card = screen.getByText('Integrante da Equipe').closest('div.flex-col');
      expect(card).not.toBeNull();
      const roster = screen.getByTestId('add-assignment-member-a-inst-vocal').closest('div.flex-col')?.parentElement?.parentElement?.parentElement;
      // The roster must no longer be hidden as mobileTab is now formation.
      expect(screen.getByTestId('add-assignment-member-a-inst-vocal')).toBeVisible();
      fireEvent.click(screen.getByTestId('add-assignment-member-a-inst-vocal'));
      expect(screen.getByTestId('assignment-count')).toHaveTextContent('1');
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: before });
    }
  });

  it('keeps the picker visible and lets the owner assign a teammate without a recorded specialty', () => {
    const generic = { ...person, specialtyIds: [] } as UserProfile;
    render(<Subject users={[generic]} />);
    expect(screen.getByTestId('fixed-band-member-roster')).toBeVisible();
    fireEvent.click(screen.getByTestId('select-instrument-inst-vocal'));
    expect(screen.getByText('Integrante da Equipe')).toBeVisible();
    fireEvent.click(screen.getByTestId('add-assignment-member-a-inst-vocal'));
    expect(screen.getByTestId('assignment-count')).toHaveTextContent('1');
  });

  it('shows the people panel before an instrument is selected without a hidden mobile tab', () => {
    const before = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    try {
      render(<Subject />);
      expect(screen.getByTestId('fixed-band-member-roster')).toBeVisible();
      fireEvent.click(screen.getByTestId('select-instrument-inst-vocal'));
      expect(screen.getByTestId('add-assignment-member-a-inst-vocal')).toBeVisible();
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: before });
    }
  });

  it('makes a failed member directory actionable without creating fake assignments', () => {
    const retry = vi.fn();
    render(<Subject users={[]} status="error" onRetry={retry} />);
    fireEvent.click(screen.getByTestId('select-instrument-inst-vocal'));
    expect(screen.getByTestId('fixed-band-member-directory-empty')).toBeVisible();
    fireEvent.click(screen.getByText('Tentar novamente'));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('assignment-count')).toHaveTextContent('0');
  });
});
