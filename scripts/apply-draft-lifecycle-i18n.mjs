import fs from 'node:fs';

const translations = {
  pt: {
    scaleModal: {
      draftDeleted: 'Rascunho excluído com sucesso.',
      draftDeleteError: 'Não foi possível excluir o rascunho agora.',
      draftDeleteErrorDescription: 'Atualizamos os dados para evitar inconsistências. Tente novamente.',
      deleteDraft: 'Excluir rascunho',
      deleteDraftTitle: 'Excluir este rascunho?',
      deleteDraftDescription: 'O rascunho será excluído permanentemente. Se houver uma escala de banda vinculada, ela também será removida para não deixar dados órfãos.',
      deleteDraftPermanent: 'Esta ação não pode ser desfeita.',
      deletingDraft: 'Excluindo...',
      confirmDeleteDraft: 'Excluir rascunho',
    },
    focus: {
      draftDeleted: 'Rascunho excluído com sucesso.',
      draftDeleteError: 'Não foi possível excluir o rascunho agora.',
      deleteDraft: 'Excluir rascunho',
      deleteDraftTitle: 'Excluir este rascunho?',
      deleteDraftDescription: 'A escala em rascunho será excluída permanentemente. Vínculos relacionados também serão removidos para não deixar dados órfãos.',
      deleteDraftPermanent: 'Esta ação não pode ser desfeita.',
      deletingDraft: 'Excluindo...',
      confirmDeleteDraft: 'Excluir rascunho',
    },
  },
  en: {
    scaleModal: {
      draftDeleted: 'Draft deleted successfully.',
      draftDeleteError: 'Couldn’t delete the draft right now.',
      draftDeleteErrorDescription: 'We refreshed the data to avoid inconsistencies. Please try again.',
      deleteDraft: 'Delete draft',
      deleteDraftTitle: 'Delete this draft?',
      deleteDraftDescription: 'The draft will be permanently deleted. If there is a linked band schedule, it will also be removed so no orphaned data is left.',
      deleteDraftPermanent: 'This action can’t be undone.',
      deletingDraft: 'Deleting...',
      confirmDeleteDraft: 'Delete draft',
    },
    focus: {
      draftDeleted: 'Draft deleted successfully.',
      draftDeleteError: 'Couldn’t delete the draft right now.',
      deleteDraft: 'Delete draft',
      deleteDraftTitle: 'Delete this draft?',
      deleteDraftDescription: 'The draft schedule will be permanently deleted. Related links will also be removed so no orphaned data is left.',
      deleteDraftPermanent: 'This action can’t be undone.',
      deletingDraft: 'Deleting...',
      confirmDeleteDraft: 'Delete draft',
    },
  },
  es: {
    scaleModal: {
      draftDeleted: 'Borrador eliminado correctamente.',
      draftDeleteError: 'No se pudo eliminar el borrador en este momento.',
      draftDeleteErrorDescription: 'Actualizamos los datos para evitar inconsistencias. Inténtalo de nuevo.',
      deleteDraft: 'Eliminar borrador',
      deleteDraftTitle: '¿Eliminar este borrador?',
      deleteDraftDescription: 'El borrador se eliminará permanentemente. Si hay una escala de banda vinculada, también se eliminará para no dejar datos huérfanos.',
      deleteDraftPermanent: 'Esta acción no se puede deshacer.',
      deletingDraft: 'Eliminando...',
      confirmDeleteDraft: 'Eliminar borrador',
    },
    focus: {
      draftDeleted: 'Borrador eliminado correctamente.',
      draftDeleteError: 'No se pudo eliminar el borrador en este momento.',
      deleteDraft: 'Eliminar borrador',
      deleteDraftTitle: '¿Eliminar este borrador?',
      deleteDraftDescription: 'La escala en borrador se eliminará permanentemente. Los vínculos relacionados también se eliminarán para no dejar datos huérfanos.',
      deleteDraftPermanent: 'Esta acción no se puede deshacer.',
      deletingDraft: 'Eliminando...',
      confirmDeleteDraft: 'Eliminar borrador',
    },
  },
};

for (const [locale, values] of Object.entries(translations)) {
  const path = `locales/${locale}.json`;
  const json = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (!json.scaleModal || !json.dashboard?.focus) {
    throw new Error(`Expected scaleModal and dashboard.focus in ${path}`);
  }
  Object.assign(json.scaleModal, values.scaleModal);
  Object.assign(json.dashboard.focus, values.focus);
  fs.writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
}

console.log('PT/EN/ES draft lifecycle translations applied.');
