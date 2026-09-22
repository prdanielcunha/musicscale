import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('fixed band scale domain contract', () => {
  it('keeps reusable formations free of event context', () => {
    const types = read('types.ts');
    const start = types.indexOf('export interface FixedBandScale');
    const end = types.indexOf('export interface PopulatedBandScale', start);
    const fixedBandScale = types.slice(start, end);

    expect(fixedBandScale).toContain('name: string');
    expect(fixedBandScale).toContain('assignments: BandMember[]');
    expect(fixedBandScale).not.toContain('date:');
    expect(fixedBandScale).not.toContain('time:');
    expect(fixedBandScale).not.toContain('eventTypeId');
    expect(fixedBandScale).not.toContain('locationId');
  });

  it('does not expose event fields in the fixed formation editor', () => {
    const form = read('components/database/FixedBandScaleFormModal.tsx');

    expect(form).toContain('fixedScaleName');
    expect(form).toContain('<BandBuilder');
    expect(form).not.toContain('type="date"');
    expect(form).not.toContain('type="time"');
    expect(form).not.toContain('eventTypeId');
    expect(form).not.toContain('locationId');
  });

  it('routes every new band creation to the fixed formation workspace', () => {
    const modalContext = read('contexts/ModalContext.tsx');

    expect(modalContext).toContain("const isExistingLegacyEventScale = Boolean(scale?.id && scale.id !== 'CLONE')");
    expect(modalContext).toContain("navigate('/band-scales?intent=create')");
    expect(modalContext).toContain('Existing event-specific BandScales remain editable only for backward');
  });
});
