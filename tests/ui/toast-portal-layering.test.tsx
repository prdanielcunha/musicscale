import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToastProvider, useToast } from '../../contexts/ToastContext';
import PremiumSheetModal from '../../components/common/PremiumSheetModal';

const Trigger = () => {
  const { error } = useToast();
  return <button onClick={() => error('Erro ao salvar', 'permission-denied')}>emit</button>;
};

describe('Toast portal over PremiumSheetModal', () => {
  it('renders the alert viewport at body level with accessible close action', async () => {
    render(
      <ToastProvider>
        <div data-testid="provider-tree">
          <Trigger />
          <PremiumSheetModal isOpen onClose={() => undefined} dataTestId="premium-modal">
            modal content
          </PremiumSheetModal>
        </div>
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('emit'));
    const viewport = screen.getByTestId('toast-alert-viewport');
    expect(viewport.parentElement).toBe(document.body);
    await waitFor(() => expect(screen.getByText('Erro ao salvar')).toBeVisible());
    expect(screen.getByText('permission-denied')).toBeVisible();
    expect(screen.getByTestId('provider-tree')).not.toContainElement(viewport);

    const closeButton = viewport.querySelector('button');
    expect(closeButton).not.toBeNull();
    fireEvent.click(closeButton!);
    await waitFor(() => expect(screen.queryByText('Erro ao salvar')).not.toBeInTheDocument());
  });
});
