import fs from 'node:fs';

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first === -1) throw new Error(`Missing anchor: ${label}`);
  if (source.indexOf(needle, first + needle.length) !== -1) {
    throw new Error(`Anchor is not unique: ${label}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function patch(path, transforms) {
  let source = fs.readFileSync(path, 'utf8');
  for (const [needle, replacement, label] of transforms) {
    source = replaceOnce(source, needle, replacement, label);
  }
  fs.writeFileSync(path, source);
}

patch('components/scales/ModernScaleForm.tsx', [
  [
    'import { Loader2, X as XIcon } from "lucide-react";',
    'import { Loader2, Trash2, X as XIcon } from "lucide-react";',
    'ModernScaleForm lucide import'
  ],
  [
    '  const [showCancelConfirm, setShowCancelConfirm] = useState(false);',
    `  const [showCancelConfirm, setShowCancelConfirm] = useState(false);\n  const [showDeleteDraftConfirm, setShowDeleteDraftConfirm] = useState(false);\n  const [isDeletingDraft, setIsDeletingDraft] = useState(false);\n\n  const existingDraftScaleId =\n    scaleType === "music" &&\n    scaleToEdit &&\n    "id" in scaleToEdit &&\n    scaleToEdit.id &&\n    scaleToEdit.id !== "CLONE" &&\n    (scaleToEdit as Scale).status === "draft"\n      ? String(scaleToEdit.id)\n      : null;`,
    'ModernScaleForm delete state'
  ],
  [
    `  const handleDiscardChanges = () => {\n    setShowCancelConfirm(false);\n    onClose();\n  };`,
    `  const handleDiscardChanges = () => {\n    setShowCancelConfirm(false);\n    onClose();\n  };\n\n  const handleDeleteDraft = async () => {\n    if (!existingDraftScaleId || !api || isDeletingDraft) return;\n\n    setIsDeletingDraft(true);\n    try {\n      const editedScale = scaleToEdit as Scale;\n      const linkedBandScaleId = editedScale.bandScaleId || formData.bandScaleId || null;\n\n      // Keep the logical event consistent: linked BandScale must not be orphaned.\n      if (linkedBandScaleId) {\n        await api.bandScales.deleteMany([linkedBandScaleId]);\n      }\n      await api.scales.deleteMany([existingDraftScaleId]);\n      await refreshData();\n\n      setShowDeleteDraftConfirm(false);\n      toast({\n        type: 'success',\n        message: t('scaleModal.draftDeleted', 'Rascunho excluído com sucesso.'),\n      });\n      onClose();\n    } catch (error) {\n      console.error('[ModernScaleForm] Failed to delete draft:', error);\n      await refreshData().catch(() => undefined);\n      toast({\n        type: 'error',\n        message: t('scaleModal.draftDeleteError', 'Não foi possível excluir o rascunho agora.'),\n        description: t('scaleModal.draftDeleteErrorDescription', 'Atualizamos os dados para evitar inconsistências. Tente novamente.'),\n      });\n    } finally {\n      setIsDeletingDraft(false);\n    }\n  };`,
    'ModernScaleForm delete handler'
  ],
  [
    `            <Button \n              type="button" \n              variant="secondary" \n              onClick={handleRequestClose} \n              className="w-full lg:w-auto h-12 rounded-xl text-[14px] min-w-0"\n            >\n              {t('scaleModal.cancel', 'Cancelar')}\n            </Button>`,
    `            <Button \n              type="button" \n              variant="secondary" \n              onClick={handleRequestClose} \n              className="w-full lg:w-auto h-12 rounded-xl text-[14px] min-w-0"\n            >\n              {t('scaleModal.cancel', 'Cancelar')}\n            </Button>\n            {existingDraftScaleId && (\n              <Button\n                type="button"\n                variant="danger"\n                onClick={() => setShowDeleteDraftConfirm(true)}\n                disabled={isSubmitting || isDeletingDraft}\n                className="w-full lg:w-auto h-12 rounded-xl text-[13px] min-w-0 bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-300 border-red-500/15 hover:bg-red-500/15 dark:hover:bg-red-500/20"\n                data-testid="delete-scale-draft"\n              >\n                <Trash2 className="w-4 h-4 mr-2" />\n                {t('scaleModal.deleteDraft', 'Excluir rascunho')}\n              </Button>\n            )}`,
    'ModernScaleForm footer delete action'
  ],
  [
    `      {showCancelConfirm && (\n        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">`,
    `      {showDeleteDraftConfirm && existingDraftScaleId && (\n        <div className="fixed inset-0 z-[10020] flex items-end sm:items-center justify-center p-4">\n          <div\n            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"\n            onClick={() => !isDeletingDraft && setShowDeleteDraftConfirm(false)}\n          ></div>\n          <div className="relative z-10 w-full max-w-md rounded-[24px] border border-red-500/15 bg-white p-6 shadow-2xl dark:bg-[#101116] sm:p-7 animate-scale-in">\n            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:text-red-300">\n              <Trash2 className="h-5 w-5" />\n            </div>\n            <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">\n              {t('scaleModal.deleteDraftTitle', 'Excluir este rascunho?')}\n            </h3>\n            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">\n              {t('scaleModal.deleteDraftDescription', 'O rascunho será excluído permanentemente. Se houver uma escala de banda vinculada, ela também será removida para não deixar dados órfãos.')}\n            </p>\n            <p className="mt-3 text-xs font-semibold text-red-600/90 dark:text-red-300/90">\n              {t('scaleModal.deleteDraftPermanent', 'Esta ação não pode ser desfeita.')}\n            </p>\n            <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">\n              <Button\n                type="button"\n                variant="secondary"\n                onClick={() => setShowDeleteDraftConfirm(false)}\n                disabled={isDeletingDraft}\n                className="h-12 rounded-xl"\n              >\n                {t('common.cancel', 'Cancelar')}\n              </Button>\n              <Button\n                type="button"\n                variant="danger"\n                onClick={() => void handleDeleteDraft()}\n                disabled={isDeletingDraft}\n                className="h-12 rounded-xl bg-red-600 text-white hover:bg-red-500 border-none"\n                data-testid="confirm-delete-scale-draft"\n              >\n                {isDeletingDraft ? <Spinner size="sm" /> : <Trash2 className="h-4 w-4 mr-2" />}\n                {isDeletingDraft\n                  ? t('scaleModal.deletingDraft', 'Excluindo...')\n                  : t('scaleModal.confirmDeleteDraft', 'Excluir rascunho')}\n              </Button>\n            </div>\n          </div>\n        </div>\n      )}\n\n      {showCancelConfirm && (\n        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">`,
    'ModernScaleForm delete confirmation'
  ]
]);

patch('components/dashboard/HomeFocusCard.tsx', [
  [
    `import { Play, AlertCircle, CheckCircle2, BookOpenCheck, RefreshCcw } from 'lucide-react';`,
    `import { Play, AlertCircle, CheckCircle2, BookOpenCheck, RefreshCcw, Trash2 } from 'lucide-react';\nimport { useOptionalApi } from '../../contexts/ApiContext';\nimport { useMusic } from '../../contexts/MusicDataContext';\nimport { useToast } from '../../contexts/ToastContext';`,
    'HomeFocusCard imports'
  ],
  [
    `  const { t, i18n } = useTranslation();\n  \n  const locale = i18n.resolvedLanguage || i18n.language || 'pt-BR';`,
    `  const { t, i18n } = useTranslation();\n  const api = useOptionalApi();\n  const { populatedScales, populatedBandScales, refreshData } = useMusic();\n  const { toast } = useToast();\n  const [draftToDelete, setDraftToDelete] = React.useState<HomeEventSummary | null>(null);\n  const [isDeletingDraft, setIsDeletingDraft] = React.useState(false);\n  \n  const locale = i18n.resolvedLanguage || i18n.language || 'pt-BR';`,
    'HomeFocusCard delete state'
  ],
  [
    `  const getEffectiveKey = (song: HomeEventSongSummary) => {\n    return song.localKey || song.key || song.selectedKey || song.originalKey || '';\n  };`,
    `  const getEffectiveKey = (song: HomeEventSongSummary) => {\n    return song.localKey || song.key || song.selectedKey || song.originalKey || '';\n  };\n\n  const handleDeleteDraft = async () => {\n    if (!draftToDelete || !api || isDeletingDraft) return;\n\n    setIsDeletingDraft(true);\n    try {\n      const musicIds = new Set<string>();\n      const bandIds = new Set<string>();\n\n      if (draftToDelete.type === 'music') {\n        musicIds.add(draftToDelete.id);\n        const musicScale = populatedScales.find(scale => scale.id === draftToDelete.id) as any;\n        const linkedBandId = musicScale?.bandScale?.id || musicScale?.bandScaleId;\n        if (linkedBandId) bandIds.add(linkedBandId);\n      } else {\n        bandIds.add(draftToDelete.id);\n        const bandScale = populatedBandScales.find(scale => scale.id === draftToDelete.id) as any;\n        if (bandScale?.musicScaleId) musicIds.add(bandScale.musicScaleId);\n      }\n\n      if (bandIds.size > 0) await api.bandScales.deleteMany(Array.from(bandIds));\n      if (musicIds.size > 0) await api.scales.deleteMany(Array.from(musicIds));\n\n      await refreshData();\n      setDraftToDelete(null);\n      toast({\n        type: 'success',\n        message: t('dashboard.focus.draftDeleted', 'Rascunho excluído com sucesso.'),\n      });\n    } catch (error) {\n      console.error('[HomeFocusCard] Failed to delete draft:', error);\n      await refreshData().catch(() => undefined);\n      setDraftToDelete(null);\n      toast({\n        type: 'error',\n        message: t('dashboard.focus.draftDeleteError', 'Não foi possível excluir o rascunho agora.'),\n      });\n    } finally {\n      setIsDeletingDraft(false);\n    }\n  };`,
    'HomeFocusCard delete handler'
  ],
  [
    `              return (\n                <Button \n                  onClick={() => {\n                    if (onResolveAttention) {\n                      onResolveAttention(targetEvent, firstAttention as any);\n                    } else {\n                      onOpenEvent(targetEvent);\n                    }\n                  }} \n                  className="w-full sm:w-auto rounded-2xl sm:rounded-[16px] h-12 sm:h-[50px] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 ease-out shadow-lg shadow-indigo-500/25 px-8" \n                  size="lg" \n                  variant="primary"\n                >\n                  {t('dashboard.focus.continuePreparing', 'Continuar preparando')}\n                </Button>\n              );`,
    `              return (\n                <>\n                  <Button \n                    onClick={() => {\n                      if (onResolveAttention) {\n                        onResolveAttention(targetEvent, firstAttention as any);\n                      } else {\n                        onOpenEvent(targetEvent);\n                      }\n                    }} \n                    className="w-full sm:w-auto rounded-2xl sm:rounded-[16px] h-12 sm:h-[50px] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 ease-out shadow-lg shadow-indigo-500/25 px-8" \n                    size="lg" \n                    variant="primary"\n                  >\n                    {t('dashboard.focus.continuePreparing', 'Continuar preparando')}\n                  </Button>\n                  <Button\n                    onClick={() => setDraftToDelete(targetEvent)}\n                    disabled={isDeletingDraft}\n                    className="w-full sm:w-auto rounded-2xl sm:rounded-[16px] h-12 sm:h-[50px] px-6 bg-red-500/[0.06] text-red-600 dark:text-red-300 border border-red-500/15 hover:bg-red-500/[0.1] shadow-none"\n                    size="lg"\n                    variant="ghost"\n                  >\n                    <Trash2 className="w-4 h-4 mr-2" />\n                    {t('dashboard.focus.deleteDraft', 'Excluir rascunho')}\n                  </Button>\n                </>\n              );`,
    'HomeFocusCard continue draft actions'
  ],
  [
    `  return (\n    <Card className="p-4 sm:p-6 bg-gradient-to-b from-white to-slate-50/50 dark:from-[#13131A] dark:to-[#0D0D12] border-none shadow-2xl shadow-black/5 dark:shadow-black/40 relative overflow-hidden rounded-3xl">\n      {/* Decorative subtle top gradient line */}\n      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500/0 via-indigo-500/20 to-indigo-500/0"></div>\n      {content}\n    </Card>\n  );`,
    `  return (\n    <>\n      <Card className="p-4 sm:p-6 bg-gradient-to-b from-white to-slate-50/50 dark:from-[#13131A] dark:to-[#0D0D12] border-none shadow-2xl shadow-black/5 dark:shadow-black/40 relative overflow-hidden rounded-3xl">\n        {/* Decorative subtle top gradient line */}\n        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500/0 via-indigo-500/20 to-indigo-500/0"></div>\n        {content}\n      </Card>\n\n      {draftToDelete && (\n        <div className="fixed inset-0 z-[10020] flex items-end sm:items-center justify-center p-4">\n          <div\n            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"\n            onClick={() => !isDeletingDraft && setDraftToDelete(null)}\n          ></div>\n          <div className="relative z-10 w-full max-w-md rounded-[24px] border border-red-500/15 bg-white p-6 shadow-2xl dark:bg-[#101116] sm:p-7">\n            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:text-red-300">\n              <Trash2 className="h-5 w-5" />\n            </div>\n            <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">\n              {t('dashboard.focus.deleteDraftTitle', 'Excluir este rascunho?')}\n            </h3>\n            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">\n              {t('dashboard.focus.deleteDraftDescription', 'A escala em rascunho será excluída permanentemente. Vínculos relacionados também serão removidos para não deixar dados órfãos.')}\n            </p>\n            <p className="mt-3 text-xs font-semibold text-red-600/90 dark:text-red-300/90">\n              {t('dashboard.focus.deleteDraftPermanent', 'Esta ação não pode ser desfeita.')}\n            </p>\n            <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">\n              <Button\n                onClick={() => setDraftToDelete(null)}\n                disabled={isDeletingDraft}\n                className="h-12 rounded-xl"\n                variant="secondary"\n              >\n                {t('common.cancel', 'Cancelar')}\n              </Button>\n              <Button\n                onClick={() => void handleDeleteDraft()}\n                disabled={isDeletingDraft}\n                className="h-12 rounded-xl bg-red-600 text-white hover:bg-red-500 border-none"\n                variant="danger"\n              >\n                <Trash2 className="h-4 w-4 mr-2" />\n                {isDeletingDraft\n                  ? t('dashboard.focus.deletingDraft', 'Excluindo...')\n                  : t('dashboard.focus.confirmDeleteDraft', 'Excluir rascunho')}\n              </Button>\n            </div>\n          </div>\n        </div>\n      )}\n    </>\n  );`,
    'HomeFocusCard delete confirmation'
  ]
]);

patch('services/MusicRepository.ts', [
  [
    `                (err as any).correlationId = errData.correlationId;\n                (err as any).status = res.status;\n                throw err;\n            }\n\n            return await res.json();\n        }\n    };\n\n    public musicScaleResponses`,
    `                (err as any).correlationId = errData.correlationId;\n                (err as any).status = res.status;\n                (err as any).code = errData.code;\n                (err as any).stage = errData.stage;\n                throw err;\n            }\n\n            return await res.json();\n        }\n    };\n\n    public musicScaleResponses`,
    'MusicRepository publish diagnostics'
  ]
]);

patch('services/server/scale/musicScaleCommandService.ts', [
  [
    `        const activeMembersRef = db.collection('organizations').doc(orgId).collection('members').where('status', '==', 'active');`,
    `        const activeMembersRef = db.collection('organizations').doc(orgId).collection('members').where('status', 'in', ['active', 'ativo']);`,
    'publish no-band active/ativo members'
  ]
]);

patch('contexts/ModalContext.tsx', [
  [
    `    if (scaleData.time !== undefined) scalePatch.time = scaleData.time;\n    if (scaleData.eventTypeId !== undefined) scalePatch.eventTypeId = scaleData.eventTypeId;`,
    `    if (scaleData.time !== undefined) scalePatch.time = scaleData.time;\n    if (scaleData.timeZone !== undefined) scalePatch.timeZone = scaleData.timeZone;\n    if (scaleData.eventTypeId !== undefined) scalePatch.eventTypeId = scaleData.eventTypeId;`,
    'publish payload timezone'
  ],
  [
    `                        const errDetails = extractErrorDetails(publishError);\n                        const correlationId = errDetails.correlationId || crypto.randomUUID();\n                        logger.error("Failed to publish preserved MusicScale draft", publishError);`,
    `                        const errDetails = extractErrorDetails(publishError);\n                        const correlationId = errDetails.correlationId || crypto.randomUUID();\n                        logger.error("Failed to publish preserved MusicScale draft", publishError);`,
    'publish error diagnostics anchor'
  ]
]);

console.log('Draft lifecycle hotfix transformations applied successfully.');
