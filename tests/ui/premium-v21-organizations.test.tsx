import React from 'react';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccountOrganizations } from '../../components/layout/AccountOrganizations';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: any) => `${key}${options?.count !== undefined ? ` ${options.count}` : ''}` }) }));
const organizations = Array.from({ length: 30 }, (_, i) => ({ id: `org-${i}`, name: `Organization ${i}`, slug: `org-${i}`, role: i === 0 ? 'owner' : 'member' }));

describe('Account organization disclosure', () => {
  it('limits the initial list, searches all organizations and preserves real roles and switching', async () => {
    const onSwitch = vi.fn().mockResolvedValue(true);
    render(<AccountOrganizations organizations={organizations} currentId="org-0" onSwitch={onSwitch} />);
    expect(within(screen.getByTestId('account-organizations-preview')).getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByText('Organization 29')).toBeNull();
    fireEvent.click(screen.getByText('refinement.allOrganizations 30'));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('searchbox'), { target: { value: 'Organization 29' } });
    expect(within(dialog).getByText('refinement.roles.member')).toBeTruthy();
    fireEvent.click(within(dialog).getByText('Organization 29'));
    await waitFor(() => expect(onSwitch).toHaveBeenCalledWith('org-29'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
  it('shows switch failure and keeps the complete list open', async () => {
    render(<AccountOrganizations organizations={organizations} currentId="org-0" onSwitch={async () => false} />);
    fireEvent.click(screen.getByText('refinement.allOrganizations 30'));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Organization 4'));
    expect(await screen.findByRole('alert')).toHaveTextContent('refinement.switchError');
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
