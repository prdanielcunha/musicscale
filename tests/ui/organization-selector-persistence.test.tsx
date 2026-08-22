import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  switchOrganization: vi.fn(async () => true),
  update: vi.fn(async () => undefined),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    effectiveOrganizationId: 'org-a',
    effectiveOrganizationName: 'Organization A',
    user: { uid: 'user-1' },
  }),
}));
vi.mock('../../contexts/EcosystemContext', () => ({
  useEcosystem: () => ({
    context: { organizationsAvailable: [
      { id: 'org-a', name: 'Organization A', role: 'admin' },
      { id: 'org-b', name: 'Organization B', role: 'member' },
    ] },
    isStandalone: true,
    switchOrganization: mocks.switchOrganization,
  }),
}));
vi.mock('../../contexts/ApiContext', () => ({
  useApi: () => ({ users: { update: mocks.update } }),
}));
vi.mock('../../services/ecosystem/EcosystemBridge', () => ({
  ecosystemBridge: { publishEvent: vi.fn() },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

import { OrganizationSelector } from '../../components/layout/OrganizationSelector';

beforeEach(() => {
  mocks.switchOrganization.mockClear();
  mocks.update.mockClear();
});

describe('OrganizationSelector preference persistence', () => {
  it('continues to remote preference persistence after canonical in-memory success', async () => {
    render(<OrganizationSelector />);
    fireEvent.click(screen.getByRole('button', { name: 'Alternar Organização' }));
    fireEvent.click(screen.getByText('Organization B').closest('button')!);

    await waitFor(() => expect(mocks.switchOrganization).toHaveBeenCalledWith('org-b'));
    expect(mocks.update).toHaveBeenCalledWith('user-1', { activeOrganizationId: 'org-b' });
  });
});
