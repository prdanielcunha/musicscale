import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, content) => {
  const full = path.join(root, p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
};
const replaceOnce = (file, search, replacement, label) => {
  const source = read(file);
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly 1 match in ${file}, found ${count}`);
  write(file, source.replace(search, replacement));
};
const replaceRegexOnce = (file, regex, replacement, label) => {
  const source = read(file);
  const matches = source.match(regex);
  if (!matches) throw new Error(`${label}: pattern not found in ${file}`);
  const next = source.replace(regex, replacement);
  if (next === source) throw new Error(`${label}: replacement did not change ${file}`);
  write(file, next);
};

// 1) Canonical clone helpers: isolate populated -> writable mapping and make it unit-testable.
write('utils/scaleClone.ts', `import type { BandMember, PopulatedScale, ScaleSongSettings } from '../types';
import { normalizeScaleSongSettings } from './scaleSongSettings';

export class ScaleCloneError extends Error {
  readonly code: 'INVALID_BAND_ASSIGNMENT';
  readonly invalidAssignmentIndexes: number[];

  constructor(invalidAssignmentIndexes: number[]) {
    super('A equipe da escala original possui integrante ou função inválida. Revise a equipe antes de criar a cópia.');
    this.name = 'ScaleCloneError';
    this.code = 'INVALID_BAND_ASSIGNMENT';
    this.invalidAssignmentIndexes = invalidAssignmentIndexes;
  }
}

export interface ScaleCloneDraft {
  date: string;
  time: string;
  timeZone: string;
  eventTypeId: string;
  eventNameId: string | null;
  locationId: string;
  observations: string;
  bandObservations: string;
  durationMinutes?: number;
  songIds: string[];
  songSettings: Record<string, ScaleSongSettings>;
  assignments: BandMember[];
}

export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return \`${'${year}'}-${'${month}'}-${'${day}'}\`;
}

export function normalizeCloneBandAssignments(assignments: unknown): BandMember[] {
  if (!Array.isArray(assignments) || assignments.length === 0) return [];

  const normalized: BandMember[] = [];
  const invalidAssignmentIndexes: number[] = [];

  assignments.forEach((raw, index) => {
    const assignment = (raw || {}) as any;
    const userId = assignment.userId || assignment.user?.uid || assignment.user?.id || '';
    const instrumentId = assignment.instrumentId || assignment.instrument?.id || '';

    if (typeof userId !== 'string' || !userId.trim() || typeof instrumentId !== 'string' || !instrumentId.trim()) {
      invalidAssignmentIndexes.push(index);
      return;
    }

    normalized.push({ userId: userId.trim(), instrumentId: instrumentId.trim() });
  });

  if (invalidAssignmentIndexes.length > 0) {
    throw new ScaleCloneError(invalidAssignmentIndexes);
  }

  return normalized;
}

export function buildScaleCloneDraft(
  scale: PopulatedScale,
  newDate: string = getLocalDateKey()
): ScaleCloneDraft {
  const songIds = (scale.songs || []).map(song => song.id).filter(Boolean);
  const assignments = scale.bandScale
    ? normalizeCloneBandAssignments(scale.bandScale.assignments)
    : [];

  return {
    date: newDate,
    time: scale.time || '',
    timeZone: (scale as any).timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
    eventTypeId: scale.eventType?.id || (scale as any).eventTypeId || '',
    eventNameId: scale.eventName?.id || (scale as any).eventNameId || null,
    locationId: scale.location?.id || (scale as any).locationId || '',
    observations: scale.observations || '',
    bandObservations: scale.bandScale?.observations || '',
    durationMinutes: scale.durationMinutes,
    songIds,
    songSettings: normalizeScaleSongSettings(songIds, scale.songSettings || {}),
    assignments,
  };
}
`);

// 2) Upgrade clone UI and execution path.
replaceOnce(
  'pages/ScalesPage.tsx',
  'import type { PopulatedScale, Scale, BandScale } from "../types";',
  'import type { PopulatedScale, Scale, BandScale, Instrument, InstrumentCategory } from "../types";',
  'ScalesPage type imports'
);
replaceOnce(
  'pages/ScalesPage.tsx',
  'import { normalizeScaleSongSettings } from "../utils/scaleSongSettings";',
  `import { normalizeScaleSongSettings } from "../utils/scaleSongSettings";\nimport MusicBuilder from "../components/scales/MusicBuilder";\nimport BandBuilder from "../components/scales/BandBuilder";\nimport { buildScaleCloneDraft, type ScaleCloneDraft } from "../utils/scaleClone";`,
  'ScalesPage clone imports'
);

const newCloneModal = `const CloneScaleModal: React.FC<{
    isOpen: boolean;
    scaleToClone: PopulatedScale | null;
    onClose: () => void;
    onConfirm: (draft: ScaleCloneDraft) => Promise<void>;
}> = ({ isOpen, scaleToClone, onClose, onConfirm }) => {
    const { t } = useTranslation();
    const {
      songs,
      tags,
      eventTypes,
      locations,
      eventNames,
      instruments,
      allUsers,
      populatedBandScales,
      populatedScales,
    } = useMusic();
    const [formData, setFormData] = useState<ScaleCloneDraft | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !scaleToClone) {
          setFormData(null);
          setValidationError(null);
          setShowAdvanced(false);
          return;
        }

        setValidationError(null);
        setShowAdvanced(false);
        try {
          setFormData(buildScaleCloneDraft(scaleToClone));
        } catch (error: any) {
          logger.error('[ScaleClone] Failed to build clone draft', {
            scaleId: scaleToClone.id,
            code: error?.code,
            invalidAssignmentIndexes: error?.invalidAssignmentIndexes,
          });
          setValidationError(t('scaleModal.cloneInvalidAssignmentsDescription'));
          setFormData(null);
        }
    }, [isOpen, scaleToClone, t]);

    const instrumentsByCat = useMemo(() => {
      const categoryOrder: InstrumentCategory[] = ['Ministro', 'Voz', 'Instrumento'];
      const grouped: Record<InstrumentCategory, Instrument[]> = {
        Ministro: [],
        Voz: [],
        Instrumento: [],
      };
      const seen = new Set<string>();
      instruments.forEach(inst => {
        const key = \`${'${inst.category}'}-${'${inst.name.trim().toLowerCase()}'}\`;
        if (!seen.has(key)) {
          seen.add(key);
          grouped[inst.category]?.push(inst);
        }
      });
      return categoryOrder.map(category => ({
        name: category === 'Voz' ? t('scaleModal.voices', 'Vozes') : category,
        instruments: grouped[category].sort((a, b) => a.name.localeCompare(b.name)),
      }));
    }, [instruments, t]);

    const updateField = <K extends keyof ScaleCloneDraft>(field: K, value: ScaleCloneDraft[K]) => {
      setFormData(prev => prev ? { ...prev, [field]: value } : prev);
    };

    const handleLocalSongSettings = async (songId: string, key: string | null, bpm: number | null) => {
      setFormData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          songSettings: {
            ...(prev.songSettings || {}),
            [songId]: {
              ...(prev.songSettings?.[songId] || {}),
              key: key || null,
              bpm: bpm ?? null,
            },
          },
        };
      });
      return { status: 'success' as const };
    };

    if (!scaleToClone) return null;

    const sourceHasBand = Boolean(scaleToClone.bandScale);
    const hasRequiredFields = Boolean(formData?.date && formData?.eventTypeId && formData?.locationId && formData?.songIds?.length);
    const hasValidBand = !sourceHasBand || Boolean(formData?.assignments?.length);

    return (
        <Modal isOpen={isOpen} onClose={isLoading ? () => undefined : onClose} title={t('scaleModal.cloneTitle')} maxWidth="max-w-4xl">
            <div className="p-4 sm:p-6 text-slate-800 dark:text-white/90 max-h-[78vh] overflow-y-auto custom-scrollbar">
                <div className="mb-6">
                  <p className="font-medium text-[14px] leading-relaxed text-slate-500 dark:text-white/60">
                    {t('scaleModal.cloneUsingTemplate', { name: getScaleTitleHelper(scaleToClone) })}
                  </p>
                </div>

                {validationError && (
                  <div className="mb-5 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3">
                    <p className="text-sm font-bold text-red-600 dark:text-red-300">{t('scaleModal.cloneInvalidAssignments')}</p>
                    <p className="mt-1 text-xs leading-relaxed text-red-600/80 dark:text-red-200/75">{validationError}</p>
                  </div>
                )}

                {formData && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-black tracking-widest text-slate-400 uppercase mb-2">{t('scaleModal.eventType')}</label>
                        <select value={formData.eventTypeId} onChange={e => updateField('eventTypeId', e.target.value)} className="input-base">
                          <option value="">{t('scaleModal.selectEventType')}</option>
                          {eventTypes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-black tracking-widest text-slate-400 uppercase mb-2">{t('scaleModal.eventName')}</label>
                        <select value={formData.eventNameId || ''} onChange={e => updateField('eventNameId', e.target.value || null)} className="input-base">
                          <option value="">{t('scaleModal.noEventName', 'Sem nome específico')}</option>
                          {eventNames.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-black tracking-widest text-slate-400 uppercase mb-2">{t('scaleModal.date')}</label>
                          <input type="date" value={formData.date} onChange={e => updateField('date', e.target.value)} className="input-base" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-black tracking-widest text-slate-400 uppercase mb-2">{t('scaleModal.time')}</label>
                          <input type="time" value={formData.time} onChange={e => updateField('time', e.target.value)} className="input-base" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-black tracking-widest text-slate-400 uppercase mb-2">{t('scaleModal.location')}</label>
                        <select value={formData.locationId} onChange={e => updateField('locationId', e.target.value)} className="input-base">
                          <option value="">{t('scaleModal.selectLocation')}</option>
                          {locations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-200/70 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-3">{t('scaleModal.cloneWillCopy')}</p>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600 dark:text-white/70">
                        <span className="rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-1.5">{t('scaleModal.cloneSongs', { count: formData.songIds.length })}</span>
                        {sourceHasBand && <span className="rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-1.5">{t('scaleModal.cloneMembers', { count: formData.assignments.length })}</span>}
                        <span className="rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-1.5">{t('scaleModal.cloneSettings')}</span>
                        <span className="rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-1.5">{t('scaleModal.cloneObservations')}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAdvanced(value => !value)}
                      className="mt-5 w-full flex items-center justify-between rounded-2xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.025] px-4 py-3 text-left transition hover:border-primary/30 hover:bg-primary/[0.03]"
                    >
                      <div>
                        <span className="block text-sm font-bold text-slate-900 dark:text-white">{showAdvanced ? t('scaleModal.cloneHideAdvanced') : t('scaleModal.cloneEditAll')}</span>
                        <span className="block mt-0.5 text-xs text-slate-500 dark:text-white/45">{t('scaleModal.cloneAdvancedDescription')}</span>
                      </div>
                      <span className="text-primary text-lg leading-none">{showAdvanced ? '−' : '+'}</span>
                    </button>

                    {showAdvanced && (
                      <div className="mt-5 space-y-6 animate-fade-in">
                        <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 sm:p-5">
                          <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-white/50">{t('scaleModal.repertoire')}</h4>
                          <MusicBuilder
                            formData={formData}
                            setFormData={setFormData as any}
                            songs={songs}
                            tags={tags}
                            onUpdateSongSettings={handleLocalSongSettings}
                          />
                        </div>

                        {sourceHasBand && (
                          <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 sm:p-5">
                            <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-white/50">{t('scaleModal.team')}</h4>
                            <BandBuilder
                              formData={formData}
                              setFormData={setFormData as any}
                              instrumentsByCat={instrumentsByCat}
                              allUsers={allUsers}
                              populatedBandScales={populatedBandScales}
                              musicScales={populatedScales}
                            />
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[11px] font-black tracking-widest text-slate-400 uppercase mb-2">{t('scaleModal.cloneMusicNotes')}</label>
                            <textarea rows={3} value={formData.observations} onChange={e => updateField('observations', e.target.value)} className="input-base min-h-[88px]" />
                          </div>
                          {sourceHasBand && (
                            <div>
                              <label className="block text-[11px] font-black tracking-widest text-slate-400 uppercase mb-2">{t('scaleModal.cloneBandNotes')}</label>
                              <textarea rows={3} value={formData.bandObservations} onChange={e => updateField('bandObservations', e.target.value)} className="input-base min-h-[88px]" />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {!hasValidBand && (
                      <p className="mt-4 text-xs font-semibold text-red-500">{t('scaleModal.cloneBandRequired')}</p>
                    )}

                    <div className="flex flex-col sm:flex-row-reverse gap-3 mt-7">
                      <Button
                        onClick={async () => {
                          if (!formData || !hasRequiredFields || !hasValidBand) return;
                          setIsLoading(true);
                          setValidationError(null);
                          try {
                            await onConfirm(formData);
                            onClose();
                          } catch (error: any) {
                            setValidationError(error?.message || t('common.errorCloning', 'Erro ao clonar'));
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        disabled={isLoading || !hasRequiredFields || !hasValidBand}
                        className="h-12 w-full sm:flex-1 bg-primary hover:bg-primary/90 text-white font-bold tracking-wide rounded-xl shadow-md"
                      >
                        {isLoading ? t('scaleModal.cloneCreating') : t('scaleModal.cloneCreate')}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={isLoading}
                        className="h-12 w-full sm:flex-1 font-bold tracking-wide rounded-xl bg-transparent border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5"
                      >
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </>
                )}
            </div>
        </Modal>
    );
};`;

replaceRegexOnce(
  'pages/ScalesPage.tsx',
  /const CloneScaleModal: React\.FC<\{[\s\S]*?\n\};\n\nconst ScaleCard:/,
  `${newCloneModal}\n\nconst ScaleCard:`,
  'CloneScaleModal replacement'
);

const newExecuteClone = `    const executeClone = async (draft: ScaleCloneDraft) => {
        if (!scaleToClone || !api) return;

        let newMusicScaleId: string | null = null;
        let newBandScaleId: string | null = null;

        try {
            const cloneSongIds = [...draft.songIds];
            if (cloneSongIds.length === 0) {
              throw new Error(t('scaleModal.minimumOneSong', 'Adicione pelo menos uma música à escala.'));
            }
            if (!draft.eventTypeId || !draft.locationId || !draft.date) {
              throw new Error(t('scaleModal.cloneRequiredFields'));
            }
            if (scaleToClone.bandScale && draft.assignments.length === 0) {
              throw new Error(t('scaleModal.cloneBandRequired'));
            }

            const scalePayload: Partial<Scale> = {
                date: draft.date,
                time: draft.time || '',
                timeZone: draft.timeZone,
                observations: draft.observations || '',
                songIds: cloneSongIds,
                songSettings: normalizeScaleSongSettings(cloneSongIds, draft.songSettings || {}),
                eventTypeId: draft.eventTypeId,
                locationId: draft.locationId,
                eventNameId: draft.eventNameId || null,
                durationMinutes: draft.durationMinutes,
                status: 'draft',
                bandScaleId: null,
            };

            newMusicScaleId = await api.scales.create(scalePayload as any);

            if (scaleToClone.bandScale) {
                const canonicalAssignments = draft.assignments.map(assignment => ({
                  userId: assignment.userId,
                  instrumentId: assignment.instrumentId,
                }));

                if (canonicalAssignments.some(assignment => !assignment.userId || !assignment.instrumentId)) {
                  throw new Error(t('scaleModal.cloneInvalidAssignmentsDescription'));
                }

                const bandScalePayload: Partial<BandScale> = {
                    date: draft.date,
                    time: draft.time || '',
                    timeZone: draft.timeZone,
                    observations: draft.bandObservations || '',
                    assignments: canonicalAssignments,
                    eventTypeId: draft.eventTypeId,
                    locationId: draft.locationId,
                    eventNameId: draft.eventNameId || null,
                    musicScaleId: newMusicScaleId,
                };

                console.info('[BandScale Clone Save Path] => ' + JSON.stringify({
                    organizationId: api?.bandScales['orgId'] || 'unknown',
                    featureFlagEnabled: isCommandApiV1Enabled,
                    selectedWriter: isCommandApiV1Enabled ? 'command_api' : 'legacy_repository',
                    assignmentCount: canonicalAssignments.length,
                }));

                if (isCommandApiV1Enabled) {
                    const idempotencyKey = crypto.randomUUID();
                    const result = await api.bandScaleCommands.create(bandScalePayload, idempotencyKey);
                    newBandScaleId = result.scaleId;
                } else {
                    newBandScaleId = await api.bandScales.create(bandScalePayload as any);
                }

                await api.scales.update(newMusicScaleId, { bandScaleId: newBandScaleId });
            }

            setCloneModalOpen(false);
            setScaleToClone(null);
            await refreshData();
            setActiveTab(draft.date >= localToday ? 'upcoming' : 'past');
            toast({ title: t('scaleModal.cloneSuccess', 'Escala clonada com sucesso.') });
        } catch (error: any) {
            logger.error('Failed to clone scale', {
              scaleId: scaleToClone.id,
              code: error?.code,
              message: error?.message,
            });

            // Cloning is all-or-nothing from the user's point of view. If a later
            // step fails, best-effort rollback prevents an orphan draft from
            // appearing on the dashboard.
            if (newBandScaleId) {
              try { await api.bandScales.delete(newBandScaleId); } catch (rollbackError) {
                logger.error('[ScaleClone] Failed to rollback cloned band scale', rollbackError);
              }
            }
            if (newMusicScaleId) {
              try { await api.scales.delete(newMusicScaleId); } catch (rollbackError) {
                logger.error('[ScaleClone] Failed to rollback cloned music scale', rollbackError);
              }
            }
            await refreshData().catch(() => undefined);
            throw error;
        }
    };`;

replaceRegexOnce(
  'pages/ScalesPage.tsx',
  /    const executeClone = async \(newDate: string\) => \{[\s\S]*?\n    \};\n\n    const handleToggleSelect/,
  `${newExecuteClone}\n\n    const handleToggleSelect`,
  'executeClone replacement'
);

// 3) Publish compatibility: canonical members can legitimately carry PT-BR status "ativo".
replaceOnce(
  'services/server/scale/musicScaleCommandService.ts',
  'export class MusicScaleCommandService {',
  `export function isActiveMembershipStatus(status: unknown): boolean {\n  return ['active', 'ativo'].includes(String(status || '').trim().toLowerCase());\n}\n\nexport class MusicScaleCommandService {`,
  'publish active status helper'
);
replaceOnce(
  'services/server/scale/musicScaleCommandService.ts',
  `              if (!m || m.status !== 'active') {\n                throw new PublishCommandError(\`Usuário \${uid} não é membro ativo da organização.\`, 'USER_NOT_ACTIVE_MEMBER');\n              }`,
  `              if (!m || !isActiveMembershipStatus(m.status)) {\n                throw new PublishCommandError(\`Usuário \${uid} não é membro ativo da organização.\`, 'USER_NOT_ACTIVE_MEMBER');\n              }`,
  'publish active status validation'
);

// 4) Dashboard: linked band scales must not escape just because the linked music scale is a draft.
replaceOnce(
  'utils/homeExperience.ts',
  `  const activeMusicScales = musicScales.filter((s) => s.status !== 'cancelled' && s.status !== 'completed' && s.status !== 'draft');\n  const musicScaleIds = new Set(activeMusicScales.map((s) => s.id));`,
  `  const nonTerminalMusicScales = musicScales.filter((s) => s.status !== 'cancelled' && s.status !== 'completed');\n  const activeMusicScales = nonTerminalMusicScales.filter((s) => s.status !== 'draft');\n  // A linked BandScale is part of the same logical event even while the MusicScale\n  // is still a draft. Track every non-terminal music scale here so its band half\n  // cannot leak onto the dashboard as a second event.\n  const musicScaleIds = new Set(nonTerminalMusicScales.map((s) => s.id));`,
  'home linked draft dedupe'
);

// 5) Attention list: defensive cross-type logical dedupe without hiding same-type real events.
replaceOnce(
  'utils/teamAttention.ts',
  `  const deduped = new Map<string, HomeEventSummary>();\n  events.forEach(event => {\n    if (!event?.id) return;\n    if (!deduped.has(event.id)) deduped.set(event.id, event);\n  });\n\n  return Array.from(deduped.values())`,
  `  const deduped = new Map<string, HomeEventSummary>();\n  events.forEach(event => {\n    if (!event?.id) return;\n    if (!deduped.has(event.id)) deduped.set(event.id, event);\n  });\n\n  // If linkage metadata is temporarily stale, the music and band halves of the\n  // same event can arrive with different document IDs. Collapse only exact\n  // cross-type matches and prefer the MusicScale representation. Two same-type\n  // events are deliberately preserved so legitimate simultaneous events are not hidden.\n  const logicalEvents: HomeEventSummary[] = [];\n  const logicalIndex = new Map<string, number>();\n  for (const event of deduped.values()) {\n    const logicalKey = [\n      event.date,\n      event.time || '',\n      (event.locationName || '').trim().toLocaleLowerCase(),\n      (event.title || '').trim().toLocaleLowerCase(),\n    ].join('|');\n    const existingIndex = logicalIndex.get(logicalKey);\n    if (existingIndex === undefined) {\n      logicalIndex.set(logicalKey, logicalEvents.length);\n      logicalEvents.push(event);\n      continue;\n    }\n    const existing = logicalEvents[existingIndex];\n    if (existing.type !== event.type) {\n      logicalEvents[existingIndex] = existing.type === 'music' ? existing : event;\n    } else {\n      logicalEvents.push(event);\n    }\n  }\n\n  return logicalEvents`,
  'team attention logical dedupe'
);

// 6) Surface publish correlation ID in the preserved-draft toast for actionable support.
replaceOnce(
  'contexts/ModalContext.tsx',
  `                    const errorDescription = isPublishedPreserved \n                        ? t('scaleModal.publishedPreserved') \n                        : t('scaleModal.draftPreserved');\n\n                    toast({\n                        title: t('scaleModal.publishFailed'),\n                        description: errorDescription,`,
  `                    const errorDescription = isPublishedPreserved \n                        ? t('scaleModal.publishedPreserved') \n                        : t('scaleModal.draftPreserved');\n                    const supportReference = correlationId\n                        ? \` \${t('scaleModal.publishFailureReference', { id: correlationId })}\`\n                        : '';\n\n                    toast({\n                        title: t('scaleModal.publishFailed'),\n                        description: \`\${errorDescription}\${supportReference}\`,`,
  'publish correlation toast'
);

// 7) i18n keys in PT/EN/ES.
const localeValues = {
  pt: {
    cloneTitle: 'Clonar escala',
    cloneUsingTemplate: 'Usando “{{name}}” como modelo. Ajuste os dados abaixo antes de criar a cópia.',
    cloneWillCopy: 'Será copiado',
    cloneSongs_one: '{{count}} música',
    cloneSongs_other: '{{count}} músicas',
    cloneMembers_one: '{{count}} integrante',
    cloneMembers_other: '{{count}} integrantes',
    cloneSettings: 'tons, BPM e configurações',
    cloneObservations: 'observações',
    cloneEditAll: 'Editar tudo',
    cloneHideAdvanced: 'Ocultar opções avançadas',
    cloneAdvancedDescription: 'Edite repertório, equipe, funções e observações antes de criar.',
    cloneMusicNotes: 'Observações da escala',
    cloneBandNotes: 'Observações da banda',
    cloneCreate: 'Criar cópia',
    cloneCreating: 'Criando cópia...',
    cloneInvalidAssignments: 'A equipe original precisa de revisão',
    cloneInvalidAssignmentsDescription: 'Um ou mais integrantes da escala original não possuem usuário ou função válidos. Revise a equipe antes de clonar.',
    cloneBandRequired: 'A escala original possui banda. Mantenha pelo menos um integrante ou revise a equipe antes de criar a cópia.',
    cloneRequiredFields: 'Preencha data, tipo de evento e local antes de criar a cópia.',
    publishFailureReference: 'Referência de suporte: {{id}}.'
  },
  en: {
    cloneTitle: 'Clone schedule',
    cloneUsingTemplate: 'Using “{{name}}” as a template. Adjust the details below before creating the copy.',
    cloneWillCopy: 'Will be copied',
    cloneSongs_one: '{{count}} song',
    cloneSongs_other: '{{count}} songs',
    cloneMembers_one: '{{count}} member',
    cloneMembers_other: '{{count}} members',
    cloneSettings: 'keys, BPM and settings',
    cloneObservations: 'notes',
    cloneEditAll: 'Edit everything',
    cloneHideAdvanced: 'Hide advanced options',
    cloneAdvancedDescription: 'Edit repertoire, team, roles and notes before creating.',
    cloneMusicNotes: 'Schedule notes',
    cloneBandNotes: 'Band notes',
    cloneCreate: 'Create copy',
    cloneCreating: 'Creating copy...',
    cloneInvalidAssignments: 'The original team needs review',
    cloneInvalidAssignmentsDescription: 'One or more members in the original schedule do not have a valid user or role. Review the team before cloning.',
    cloneBandRequired: 'The original schedule has a band. Keep at least one member or review the team before creating the copy.',
    cloneRequiredFields: 'Fill in date, event type and location before creating the copy.',
    publishFailureReference: 'Support reference: {{id}}.'
  },
  es: {
    cloneTitle: 'Clonar escala',
    cloneUsingTemplate: 'Usando “{{name}}” como modelo. Ajusta los datos antes de crear la copia.',
    cloneWillCopy: 'Se copiará',
    cloneSongs_one: '{{count}} canción',
    cloneSongs_other: '{{count}} canciones',
    cloneMembers_one: '{{count}} integrante',
    cloneMembers_other: '{{count}} integrantes',
    cloneSettings: 'tonos, BPM y configuraciones',
    cloneObservations: 'observaciones',
    cloneEditAll: 'Editar todo',
    cloneHideAdvanced: 'Ocultar opciones avanzadas',
    cloneAdvancedDescription: 'Edita repertorio, equipo, funciones y observaciones antes de crear.',
    cloneMusicNotes: 'Observaciones de la escala',
    cloneBandNotes: 'Observaciones de la banda',
    cloneCreate: 'Crear copia',
    cloneCreating: 'Creando copia...',
    cloneInvalidAssignments: 'El equipo original necesita revisión',
    cloneInvalidAssignmentsDescription: 'Uno o más integrantes de la escala original no tienen un usuario o función válidos. Revisa el equipo antes de clonar.',
    cloneBandRequired: 'La escala original tiene banda. Mantén al menos un integrante o revisa el equipo antes de crear la copia.',
    cloneRequiredFields: 'Completa fecha, tipo de evento y lugar antes de crear la copia.',
    publishFailureReference: 'Referencia de soporte: {{id}}.'
  }
};
for (const lang of ['pt', 'en', 'es']) {
  const file = `locales/${lang}.json`;
  const data = JSON.parse(read(file));
  if (!data.scaleModal || typeof data.scaleModal !== 'object') throw new Error(`${file}: scaleModal namespace missing`);
  Object.assign(data.scaleModal, localeValues[lang]);
  write(file, JSON.stringify(data, null, 2) + '\n');
}

// 8) Focused regression tests.
write('tests/unit/scale-clone-hotfix.test.ts', `import { describe, expect, it } from 'vitest';
import { buildScaleCloneDraft, normalizeCloneBandAssignments, ScaleCloneError } from '../../utils/scaleClone';
import { buildHomeEventSummaries } from '../../utils/homeExperience';
import { buildTeamAttentionEntries } from '../../utils/teamAttention';
import { isActiveMembershipStatus } from '../../services/server/scale/musicScaleCommandService';

function sourceScale(overrides: any = {}) {
  return {
    id: 'music-old',
    date: '2026-09-01',
    time: '20:00',
    observations: 'Notas da música',
    songs: [
      { id: 'song-a', title: 'A', artist: 'X' },
      { id: 'song-b', title: 'B', artist: 'Y' },
    ],
    songSettings: {
      'song-a': { key: 'A', bpm: 72 },
      'song-b': { key: 'C', bpm: 80 },
    },
    eventType: { id: 'type-culto', name: 'Culto' },
    eventName: { id: 'name-milagres', name: 'Culto dos Milagres' },
    location: { id: 'loc-cambe', name: 'Cambé' },
    bandScaleId: 'band-old',
    bandScale: {
      id: 'band-old',
      date: '2026-09-01',
      time: '20:00',
      observations: 'Notas da banda',
      assignments: Array.from({ length: 7 }, (_, index) => ({
        user: { uid: `user-${index + 1}` },
        instrument: { id: `instrument-${index + 1}` },
      })),
      eventType: { id: 'type-culto', name: 'Culto' },
      location: { id: 'loc-cambe', name: 'Cambé' },
    },
    createdBy: { uid: 'owner' },
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  } as any;
}

describe('scale clone hotfix', () => {
  it('normalizes seven populated band assignments without losing members', () => {
    const draft = buildScaleCloneDraft(sourceScale(), '2026-09-20');
    expect(draft.assignments).toHaveLength(7);
    expect(draft.assignments[0]).toEqual({ userId: 'user-1', instrumentId: 'instrument-1' });
  });

  it('preserves repertoire order and local song settings', () => {
    const source = sourceScale();
    const snapshot = JSON.stringify(source);
    const draft = buildScaleCloneDraft(source, '2026-09-20');
    expect(draft.songIds).toEqual(['song-a', 'song-b']);
    expect(draft.songSettings['song-a']).toMatchObject({ key: 'A', bpm: 72 });
    expect(JSON.stringify(source)).toBe(snapshot);
  });

  it('supports music-only scales', () => {
    const draft = buildScaleCloneDraft(sourceScale({ bandScale: null, bandScaleId: null }), '2026-09-20');
    expect(draft.assignments).toEqual([]);
  });

  it('fails closed when any source band assignment cannot be normalized', () => {
    expect(() => normalizeCloneBandAssignments([
      { user: { uid: 'valid' }, instrument: { id: 'keyboard' } },
      { user: { uid: 'invalid' }, instrument: {} },
    ])).toThrow(ScaleCloneError);
  });
});

describe('publish membership compatibility', () => {
  it.each(['active', 'ativo', 'ACTIVE', 'Ativo'])('accepts active membership status %s', status => {
    expect(isActiveMembershipStatus(status)).toBe(true);
  });
  it.each(['inactive', 'pending', '', undefined])('rejects non-active membership status %s', status => {
    expect(isActiveMembershipStatus(status)).toBe(false);
  });
});

describe('dashboard logical event dedupe', () => {
  it('does not expose a linked band scale as standalone while its music scale is a draft', () => {
    const music = sourceScale({ status: 'draft', date: '2026-09-20' });
    const band = {
      ...music.bandScale,
      id: 'band-old',
      date: '2026-09-20',
      musicScaleId: 'music-old',
      status: 'published',
    } as any;
    const result = buildHomeEventSummaries([music], [band], 'user-1', '2026-09-11', new Date('2026-09-11T12:00:00').getTime());
    expect(result).toEqual([]);
  });

  it('collapses only exact cross-type attention duplicates and prefers music', () => {
    const base = {
      title: 'Santa Ceia', date: '2026-09-20', time: '19:00', locationName: 'Cambé',
      songCount: 1, teamCount: 0, status: 'published', userFunctionNames: [], isUserAssigned: false,
      startAtMillis: new Date('2026-09-20T19:00:00').getTime(), endAtMillis: new Date('2026-09-20T21:00:00').getTime(),
    } as any;
    const entries = buildTeamAttentionEntries([
      { ...base, id: 'music-1', type: 'music' },
      { ...base, id: 'band-1', type: 'band', songCount: 0 },
    ], true, new Date('2026-09-11T12:00:00').getTime());
    expect(entries).toHaveLength(1);
    expect(entries[0].event.type).toBe('music');
  });

  it('keeps two same-type simultaneous events visible', () => {
    const base = {
      title: 'Santa Ceia', type: 'music', date: '2026-09-20', time: '19:00', locationName: 'Cambé',
      songCount: 1, teamCount: 0, status: 'published', userFunctionNames: [], isUserAssigned: false,
      startAtMillis: new Date('2026-09-20T19:00:00').getTime(), endAtMillis: new Date('2026-09-20T21:00:00').getTime(),
    } as any;
    const entries = buildTeamAttentionEntries([
      { ...base, id: 'music-1' },
      { ...base, id: 'music-2' },
    ], true, new Date('2026-09-11T12:00:00').getTime());
    expect(entries).toHaveLength(2);
  });
});
`);

console.log('ChatGPT scale hotfix patch applied successfully.');
