import fs from 'node:fs';

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first === -1) throw new Error(`Missing anchor: ${label}`);
  if (source.indexOf(needle, first + needle.length) !== -1) throw new Error(`Anchor not unique: ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function patch(path, transforms) {
  let source = fs.readFileSync(path, 'utf8');
  for (const [needle, replacement, label] of transforms) source = replaceOnce(source, needle, replacement, label);
  fs.writeFileSync(path, source);
}

patch('components/dashboard/HomeFocusCard.tsx', [
  [
    `import { useOptionalApi } from '../../contexts/ApiContext';\nimport { useMusic } from '../../contexts/MusicDataContext';\nimport { useToast } from '../../contexts/ToastContext';\n`,
    '',
    'remove provider hooks'
  ],
  [
    `  onResolveAttention?: (event: HomeEventSummary, firstAttentionItem: HomeAttentionItem) => void;\n}`,
    `  onResolveAttention?: (event: HomeEventSummary, firstAttentionItem: HomeAttentionItem) => void;\n  onDeleteDraft?: (event: HomeEventSummary) => void | Promise<void>;\n}`,
    'add delete callback prop'
  ],
  [
    `  onChooseScaleToRepeat,\n  onResolveAttention,\n}) => {\n  const { t, i18n } = useTranslation();\n  const api = useOptionalApi();\n  const { populatedScales, populatedBandScales, refreshData } = useMusic();\n  const { toast } = useToast();`,
    `  onChooseScaleToRepeat,\n  onResolveAttention,\n  onDeleteDraft,\n}) => {\n  const { t, i18n } = useTranslation();`,
    'consume callback without contexts'
  ],
  [
    `  const handleDeleteDraft = async () => {\n    if (!draftToDelete || !api || isDeletingDraft) return;\n\n    setIsDeletingDraft(true);\n    try {\n      const musicIds = new Set<string>();\n      const bandIds = new Set<string>();\n\n      if (draftToDelete.type === 'music') {\n        musicIds.add(draftToDelete.id);\n        const musicScale = populatedScales.find(scale => scale.id === draftToDelete.id) as any;\n        const linkedBandId = musicScale?.bandScale?.id || musicScale?.bandScaleId;\n        if (linkedBandId) bandIds.add(linkedBandId);\n      } else {\n        bandIds.add(draftToDelete.id);\n        const bandScale = populatedBandScales.find(scale => scale.id === draftToDelete.id) as any;\n        if (bandScale?.musicScaleId) musicIds.add(bandScale.musicScaleId);\n      }\n\n      if (bandIds.size > 0) await api.bandScales.deleteMany(Array.from(bandIds));\n      if (musicIds.size > 0) await api.scales.deleteMany(Array.from(musicIds));\n\n      await refreshData();\n      setDraftToDelete(null);\n      toast({\n        type: 'success',\n        message: t('dashboard.focus.draftDeleted', 'Rascunho excluído com sucesso.'),\n      });\n    } catch (error) {\n      console.error('[HomeFocusCard] Failed to delete draft:', error);\n      await refreshData().catch(() => undefined);\n      setDraftToDelete(null);\n      toast({\n        type: 'error',\n        message: t('dashboard.focus.draftDeleteError', 'Não foi possível excluir o rascunho agora.'),\n      });\n    } finally {\n      setIsDeletingDraft(false);\n    }\n  };`,
    `  const handleDeleteDraft = async () => {\n    if (!draftToDelete || !onDeleteDraft || isDeletingDraft) return;\n\n    setIsDeletingDraft(true);\n    try {\n      await onDeleteDraft(draftToDelete);\n      setDraftToDelete(null);\n    } catch (error) {\n      // The owner page reports the failure. Keep the confirmation open so the user\n      // can retry instead of making the draft disappear from the UI optimistically.\n      console.error('[HomeFocusCard] Failed to delete draft:', error);\n    } finally {\n      setIsDeletingDraft(false);\n    }\n  };`,
    'delegate deletion to owner page'
  ],
  [
    `{draftToDelete && (`,
    `{draftToDelete && onDeleteDraft && (`,
    'guard delete confirmation with callback'
  ],
  [
    `                  <Button\n                    onClick={() => setDraftToDelete(targetEvent)}`,
    `                  {onDeleteDraft && <Button\n                    onClick={() => setDraftToDelete(targetEvent)}`,
    'start guarded dashboard delete button'
  ],
  [
    `                    {t('dashboard.focus.deleteDraft', 'Excluir rascunho')}\n                  </Button>\n                </>`,
    `                    {t('dashboard.focus.deleteDraft', 'Excluir rascunho')}\n                  </Button>}\n                </>`,
    'end guarded dashboard delete button'
  ]
]);

patch('pages/DashboardPage.tsx', [
  [
    `import { useToast } from '../contexts/ToastContext';`,
    `import { useToast } from '../contexts/ToastContext';\nimport { useOptionalApi } from '../contexts/ApiContext';`,
    'dashboard api import'
  ],
  [
    `  const { populatedScales, populatedBandScales, songs, loading: musicLoading, error: musicError } = useMusic();`,
    `  const { populatedScales, populatedBandScales, songs, loading: musicLoading, error: musicError, refreshData } = useMusic();`,
    'dashboard refresh data'
  ],
  [
    `  const { toast } = useToast();\n  const { hasCapability } = useCapability();`,
    `  const { toast } = useToast();\n  const api = useOptionalApi();\n  const { hasCapability } = useCapability();`,
    'dashboard api hook'
  ],
  [
    `  const getResponseActions = (eventSummary: HomeEventSummary | null) => {`,
    `  const handleDeleteDraft = async (eventSummary: HomeEventSummary) => {\n    if (!api || !canManageScales || eventSummary.status !== 'draft') {\n      toast({\n        type: 'error',\n        message: t('dashboard.focus.draftDeleteError', 'Não foi possível excluir o rascunho agora.'),\n      });\n      throw new Error('Draft deletion is not available for the current context.');\n    }\n\n    try {\n      const musicIds = new Set<string>();\n      const bandIds = new Set<string>();\n\n      if (eventSummary.type === 'music') {\n        musicIds.add(eventSummary.id);\n        const musicScale = populatedScales?.find(scale => scale.id === eventSummary.id) as any;\n        const linkedBandId = musicScale?.bandScale?.id || musicScale?.bandScaleId;\n        if (linkedBandId) bandIds.add(linkedBandId);\n      } else {\n        bandIds.add(eventSummary.id);\n        const bandScale = populatedBandScales?.find(scale => scale.id === eventSummary.id) as any;\n        if (bandScale?.musicScaleId) musicIds.add(bandScale.musicScaleId);\n      }\n\n      // Keep the logical event consistent: delete the linked band half first,\n      // matching the established dashboard permanent-delete flow.\n      if (bandIds.size > 0) await api.bandScales.deleteMany(Array.from(bandIds));\n      if (musicIds.size > 0) await api.scales.deleteMany(Array.from(musicIds));\n\n      await refreshData();\n      toast({\n        type: 'success',\n        message: t('dashboard.focus.draftDeleted', 'Rascunho excluído com sucesso.'),\n      });\n    } catch (error) {\n      console.error('[DashboardPage] Failed to delete draft:', error);\n      await refreshData().catch(() => undefined);\n      toast({\n        type: 'error',\n        message: t('dashboard.focus.draftDeleteError', 'Não foi possível excluir o rascunho agora.'),\n      });\n      throw error;\n    }\n  };\n\n  const getResponseActions = (eventSummary: HomeEventSummary | null) => {`,
    'dashboard deletion owner handler'
  ],
  [
    `          onChooseScaleToRepeat={() => navigate('/scales')}\n          onResolveAttention={handleResolveAttention}`,
    `          onChooseScaleToRepeat={() => navigate('/scales')}\n          onResolveAttention={handleResolveAttention}\n          onDeleteDraft={handleDeleteDraft}`,
    'pass dashboard delete callback'
  ]
]);

console.log('HomeFocusCard deletion is now provider-independent and owned by DashboardPage.');
