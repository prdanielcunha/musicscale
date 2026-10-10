import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useMedleyStudioV2Pilot } from '../../hooks/useMedleyStudioV2Pilot';

const context = vi.hoisted(() => ({ org: 'org-a', user: 'user-1', orgEnabled: false }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({
  user: { uid: context.user }, effectiveOrganizationId: context.org,
  organization: { featureFlags: { 'musicscale.medleyStudioV2': context.orgEnabled } },
}) }));
function Pilot() {
  const { enabled, optedIn, setPilotEnabled } = useMedleyStudioV2Pilot();
  return <div>
    <span data-testid="enabled">{String(enabled)}</span>
    <span data-testid="opted">{String(optedIn)}</span>
    <button onClick={() => setPilotEnabled(true)}>optin</button>
    <button onClick={() => setPilotEnabled(false)}>optout</button>
  </div>;
}
beforeEach(() => { localStorage.clear(); context.org = 'org-a'; context.user = 'user-1'; context.orgEnabled = false; });
describe('medley pilot is explicitly opt-in and scoped by tenant/user', () => {
  it('preserves the default classic editor and allows explicit opt-in/out', () => {
    render(<Pilot />);
    expect(screen.getByTestId('enabled')).toHaveTextContent('false');
    fireEvent.click(screen.getByText('optin'));
    expect(screen.getByTestId('enabled')).toHaveTextContent('true');
    fireEvent.click(screen.getByText('optout'));
    expect(screen.getByTestId('enabled')).toHaveTextContent('false');
  });
  it('never enables a separate tenant or different user based on another session', () => {
    const { unmount } = render(<Pilot />);
    fireEvent.click(screen.getByText('optin'));
    unmount();
    context.org = 'org-b';
    render(<Pilot />);
    expect(screen.getByTestId('enabled')).toHaveTextContent('false');
  });
  it('accepts official tenant rollout without requiring a local pilot opt-in', () => {
    context.orgEnabled = true;
    render(<Pilot />);
    expect(screen.getByTestId('enabled')).toHaveTextContent('true');
    expect(screen.getByTestId('opted')).toHaveTextContent('false');
  });
});
