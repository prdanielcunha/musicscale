import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssignmentResponseActions from '../../components/scales/AssignmentResponseActions';
import type { EventAssignment } from '../../types';

const mocks = vi.hoisted(() => ({
  respondOwn: vi.fn(),
  toast: vi.fn(),
  onSnapshot: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'member-1' },
    effectiveOrganizationId: 'org-1',
  }),
}));

vi.mock('../../contexts/ApiContext', () => ({
  useApi: () => ({
    musicScaleResponses: {
      respondOwn: mocks.respondOwn,
    },
  }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('../../hooks/useFeatureFlag', () => ({
  useFeatureFlag: () => true,
}));

vi.mock('../../services/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  onSnapshot: (...args: any[]) => mocks.onSnapshot(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { language: 'pt-BR' },
  }),
}));

describe('AssignmentResponseActions acknowledged response freshness', () => {
  const assignments: EventAssignment[] = [{
    eventAssignmentId: 'assignment-1',
    sourceBandScaleId: 'band-1',
    sourceAssignmentId: 'source-1',
    userId: 'member-1',
    functionId: 'keyboard',
    functionName: 'Teclado',
    functionCategory: 'musical_instrument',
    active: true,
    assignmentRevision: 1,
  }];

  beforeEach(() => {
    vi.clearAllMocks();

    // Simulate the exact production failure mode: the initial listener has no
    // response and does not emit again after the command succeeds.
    mocks.onSnapshot.mockImplementation((_query: unknown, next: (snapshot: any) => void) => {
      next({ forEach: () => undefined });
      return vi.fn();
    });

    mocks.respondOwn.mockResolvedValue({
      success: true,
      musicScaleId: 'scale-1',
      userId: 'member-1',
      status: 'accepted',
      reason: null,
      updatedAssignmentIds: ['assignment-1'],
      updatedResponseCount: 1,
      responseRevision: 1,
      fromCache: false,
      correlationId: 'corr-1',
    });
  });

  it('shows the acknowledged status immediately without waiting for another Firestore snapshot', async () => {
    render(
      <AssignmentResponseActions
        musicScaleId="scale-1"
        assignments={assignments}
        eventStart={new Date(Date.now() + 60 * 60 * 1000)}
      />
    );

    const confirm = await screen.findByRole('button', { name: 'Confirmo' });
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(mocks.respondOwn).toHaveBeenCalledWith(
        'scale-1',
        { status: 'accepted', reason: null },
        expect.any(String),
      );
      expect(screen.getByText('Presença confirmada')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Confirmo' })).not.toBeInTheDocument();
  });

  it('does not let an older listener revision overwrite a newer acknowledged response', async () => {
    let listener: ((snapshot: any) => void) | undefined;
    mocks.onSnapshot.mockImplementation((_query: unknown, next: (snapshot: any) => void) => {
      listener = next;
      next({ forEach: () => undefined });
      return vi.fn();
    });

    render(
      <AssignmentResponseActions
        musicScaleId="scale-1"
        assignments={assignments}
        eventStart={new Date(Date.now() + 60 * 60 * 1000)}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Confirmo' }));
    await screen.findByText('Presença confirmada');

    listener?.({
      forEach: (visit: (doc: { data: () => any }) => void) => {
        visit({
          data: () => ({
            organizationId: 'org-1',
            musicScaleId: 'scale-1',
            eventAssignmentId: 'assignment-1',
            userId: 'member-1',
            functionId: 'keyboard',
            functionName: 'Teclado',
            status: 'pending',
            reason: null,
            respondedAt: null,
            respondedBy: null,
            active: true,
            assignmentRevision: 1,
            respondedAgainstRevision: null,
            responseRevision: 0,
            createdAt: '2026-09-22T00:00:00.000Z',
            updatedAt: '2026-09-22T00:00:00.000Z',
            override: null,
          }),
        });
      },
    });

    expect(screen.getByText('Presença confirmada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmo' })).not.toBeInTheDocument();
  });
});
