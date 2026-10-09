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
      <BandBuilder
        compactDesktopLayout
        memberDirectoryState={status}
        onRetryMemberDirectory={onRetry}
        formData={formData}
        setFormData={setFormData}
        instrumentsByCat={[{name: 'Vozes', instruments: [instrument]}]}
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
    expect(roster.className).toContain('md:flex');
    fireEvent.click(screen.getByTestId('select-instrument-inst-vocal'));
    expect(screen.getByText('Integrante da Equipe')).toBeVisible();
    fireEvent.click(screen.getByTestId('add-assignment-member-a-inst-vocal'));
    expect(screen.getByTestId('assignment-count')).toHaveTextContent('1');
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
