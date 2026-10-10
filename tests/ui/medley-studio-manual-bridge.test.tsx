import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ManualMedleyBridgeEditor } from '../../components/scales/ManualMedleyBridgeEditor';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (value: string) => value }) }));

describe('Manual Medley Studio bridge editor', () => {
  it('preserves an existing free cue until an explicit Apply, then writes the readable bridge', () => {
    const onApply = vi.fn();
    render(<ManualMedleyBridgeEditor cue="Esperar a bateria" onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: /medleyStudioV2.manualBridge/ }));
    expect(screen.getByText('medleyStudioV2.replacesCueOnlyOnApply')).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('medleyStudioV2.chord 1'), { target: { value: 'G7/B' } });
    fireEvent.change(screen.getByLabelText('medleyStudioV2.bars'), { target: { value: '2' } });
    fireEvent.click(screen.getByText('medleyStudioV2.applyManualBridge'));
    expect(onApply).toHaveBeenCalledWith('Ponte manual [4/4]: G7/B × 2');
  });
  it('never publishes invalid chord sequences from free text', () => {
    const onApply = vi.fn();
    render(<ManualMedleyBridgeEditor cue="" onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: /medleyStudioV2.manualBridge/ }));
    fireEvent.change(screen.getByLabelText('medleyStudioV2.chord 1'), { target: { value: 'música linda' } });
    fireEvent.click(screen.getByText('medleyStudioV2.applyManualBridge'));
    expect(screen.getByRole('alert')).toHaveTextContent('medleyStudioV2.invalidBridge');
    expect(onApply).not.toHaveBeenCalled();
  });
});
