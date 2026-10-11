import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useMedleyStudioV2Pilot } from '../../hooks/useMedleyStudioV2Pilot';

const context = vi.hoisted(() => ({
  organizationId: 'org-a' as string | null,
  effectiveId: 'org-a' as string | null,
  userId: 'user-1' as string | null,
  featureFlag: undefined as boolean | undefined,
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({
  user: context.userId ? { uid: context.userId } : null,
  effectiveOrganizationId: context.effectiveId,
  organization: context.organizationId ? {
    id: context.organizationId,
    featureFlags: context.featureFlag === undefined ? {} : { 'musicscale.medleyStudioV2': context.featureFlag },
  } : null,
}) }));

function RouteState() {
  const { enabled } = useMedleyStudioV2Pilot();
  return <span data-testid="enabled">{String(enabled)}</span>;
}

beforeEach(() => {
  localStorage.clear();
  context.organizationId = 'org-a';
  context.effectiveId = 'org-a';
  context.userId = 'user-1';
  context.featureFlag = undefined;
});

describe('Medley Studio V2 standard route with safe tenant fallback', () => {
  it('opens V2 by default without public browser opt-in', () => {
    localStorage.setItem('musicscale:medleyStudioV2:pilot:user-1:org-a', 'disabled');
    render(<RouteState />);
    expect(screen.getByTestId('enabled')).toHaveTextContent('true');
  });

  it('preserves the legacy editor when an organization explicitly disables V2', () => {
    context.featureFlag = false;
    const { rerender } = render(<RouteState />);
    expect(screen.getByTestId('enabled')).toHaveTextContent('false');
    context.featureFlag = true;
    rerender(<RouteState />);
    expect(screen.getByTestId('enabled')).toHaveTextContent('true');
  });

  it('fails closed for an unresolved or cross-tenant organization', () => {
    const { rerender } = render(<RouteState />);
    expect(screen.getByTestId('enabled')).toHaveTextContent('true');
    context.effectiveId = 'org-b';
    rerender(<RouteState />);
    expect(screen.getByTestId('enabled')).toHaveTextContent('false');
    context.effectiveId = null;
    rerender(<RouteState />);
    expect(screen.getByTestId('enabled')).toHaveTextContent('false');
    context.effectiveId = 'org-a';
    context.userId = null;
    rerender(<RouteState />);
    expect(screen.getByTestId('enabled')).toHaveTextContent('false');
  });
});
