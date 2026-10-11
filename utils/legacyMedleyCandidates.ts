import type { MedleyTemplate, Scale, ScaleMedley } from '../types';

export interface LegacyMedleyCandidate {
  arrangement: ScaleMedley;
  name: string;
  origin: 'template' | 'scale';
}

const medleyTitle = (arrangement: ScaleMedley): string =>
  arrangement.steps.map(step => step.title.trim()).filter(Boolean).join(' → ').slice(0, 120) || 'Medley';

/**
 * Legacy arrangements may live inside scales rather than in medleyTemplates.
 * Only consider records explicitly belonging to the active organization.
 * A missing tenant identifier is NOT proof that the item belongs to this tenant.
 */
export function collectLegacyMedleyCandidates(
  organizationId: string,
  templates: readonly MedleyTemplate[],
  scales: readonly Scale[],
): LegacyMedleyCandidate[] {
  if (!organizationId) return [];
  const found = new Map<string, LegacyMedleyCandidate>();
  const add = (arrangement: ScaleMedley, name: string, origin: LegacyMedleyCandidate['origin']) => {
    if (!arrangement?.id || !Array.isArray(arrangement.steps) || !arrangement.steps.length) return;
    const saved = found.get(arrangement.id);
    if (!saved || arrangement.revision > saved.arrangement.revision) {
      found.set(arrangement.id, { arrangement, name: name.slice(0, 120), origin });
    }
  };
  for (const template of templates) {
    if (template.organizationId !== organizationId) continue;
    add(template.arrangement, template.name?.trim() || medleyTitle(template.arrangement), 'template');
  }
  for (const scale of scales) {
    if (scale.organizationId !== organizationId) continue;
    for (const arrangement of scale.medleys || []) {
      add(arrangement, medleyTitle(arrangement), 'scale');
    }
  }
  return [...found.values()];
}
