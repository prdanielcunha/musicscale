import { describe, expect, it } from 'vitest';
import type { HomeEventSummary } from '../../utils/homeExperience';
import {
  buildPreparationView,
  createPreparationSnapshot,
  diffPreparationSnapshots,
  getPersonalPreparationEvents,
  getPersonalPreparationMode,
  requiresRepertoirePreparation,
} from '../../utils/preparationIntelligence';

const baseEvent = (overrides: Partial<HomeEventSummary> = {}): HomeEventSummary => ({
  id: 'scale-1',
  type: 'music',
  title: 'Culto',
  date: '2026-09-13',
  time: '19:00',
  locationName: 'Templo',
  songCount: 2,
  teamCount: 4,
  status: 'published',
  userFunctionNames: ['Teclado'],
  isUserAssigned: true,
  startAtMillis: new Date('2026-09-13T19:00:00').getTime(),
  songs: [
    {
      id: 'song-1',
      title: 'Bondade de Deus',
      order: 1,
      localKey: 'A',
      selectedKey: null,
      key: 'G',
      originalKey: 'G',
    },
    {
      id: 'song-2',
      title: 'Gratidão',
      order: 2,
      localKey: null,
      selectedKey: 'D',
      key: 'C',
      originalKey: 'C',
    },
  ],
  ...overrides,
});

describe('Preparation Intelligence', () => {
  it('keeps only personal commitments inside the next seven days', () => {
    const now = new Date('2026-09-08T12:00:00').getTime();
    const inside = baseEvent();
    const outside = baseEvent({
      id: 'scale-outside',
      date: '2026-09-20',
      startAtMillis: new Date('2026-09-20T19:00:00').getTime(),
    });
    const observer = baseEvent({
      id: 'scale-observer',
      isUserAssigned: false,
    });

    expect(getPersonalPreparationEvents([outside, observer, inside], now).map(event => event.id))
      .toEqual(['scale-1']);
  });

  it('creates a stable fingerprint from preparation-relevant facts', () => {
    const first = createPreparationSnapshot(baseEvent());
    const second = createPreparationSnapshot(baseEvent());

    expect(first.fingerprint).toBe(second.fingerprint);
  });

  it('detects added, removed, reordered and key-changed songs plus event context', () => {
    const previous = createPreparationSnapshot(baseEvent());

    const current = createPreparationSnapshot(baseEvent({
      time: '20:00',
      locationName: 'Auditório',
      userFunctionNames: ['Vocal'],
      songs: [
        {
          id: 'song-2',
          title: 'Gratidão',
          order: 1,
          localKey: 'E',
          selectedKey: 'D',
          key: 'C',
          originalKey: 'C',
        },
        {
          id: 'song-3',
          title: 'Te Adorar',
          order: 2,
          localKey: 'B',
          selectedKey: null,
          key: 'B',
          originalKey: 'B',
        },
      ],
    }));

    const codes = diffPreparationSnapshots(previous, current).map(change => change.code);

    expect(codes).toContain('song-added');
    expect(codes).toContain('song-removed');
    expect(codes).toContain('song-key-changed');
    expect(codes).toContain('song-order-changed');
    expect(codes).toContain('time-changed');
    expect(codes).toContain('location-changed');
    expect(codes).toContain('role-changed');
  });

  it('marks an unchanged prepared scale as prepared', () => {
    const event = baseEvent();
    const snapshot = createPreparationSnapshot(event);

    const view = buildPreparationView(event, {
      organizationId: 'org-1',
      scaleId: event.id,
      acknowledgedFingerprint: snapshot.fingerprint,
      acknowledgedSnapshot: snapshot,
      preparedFingerprint: snapshot.fingerprint,
    });

    expect(view.status).toBe('prepared');
    expect(view.changes).toEqual([]);
  });

  it('requires preparation review after the scale changes', () => {
    const previousEvent = baseEvent();
    const previous = createPreparationSnapshot(previousEvent);

    const changedEvent = baseEvent({
      songs: [
        {
          id: 'song-1',
          title: 'Bondade de Deus',
          order: 1,
          localKey: 'B',
          selectedKey: null,
          key: 'G',
          originalKey: 'G',
        },
        {
          id: 'song-2',
          title: 'Gratidão',
          order: 2,
          localKey: null,
          selectedKey: 'D',
          key: 'C',
          originalKey: 'C',
        },
      ],
    });

    const view = buildPreparationView(changedEvent, {
      organizationId: 'org-1',
      scaleId: changedEvent.id,
      acknowledgedFingerprint: previous.fingerprint,
      acknowledgedSnapshot: previous,
      preparedFingerprint: previous.fingerprint,
    });

    expect(view.status).toBe('needs-review');
    expect(view.changes.some(change => change.code === 'song-key-changed')).toBe(true);
  });

  it('adapts preparation mode to the user role without surveillance heuristics', () => {
    expect(getPersonalPreparationMode(baseEvent({
      userFunctionCategories: ['musical_instrument'],
    }))).toBe('chords');

    expect(getPersonalPreparationMode(baseEvent({
      userFunctionCategories: ['vocal'],
    }))).toBe('lyrics');

    expect(getPersonalPreparationMode(baseEvent({
      userFunctionCategories: ['technical'],
    }))).toBe('detail');

    expect(requiresRepertoirePreparation(baseEvent({
      userFunctionCategories: ['technical'],
    }))).toBe(false);

    expect(requiresRepertoirePreparation(baseEvent({
      userFunctionCategories: ['vocal'],
    }))).toBe(true);
  });
});
