import type { Organization } from '../types';

/**
 * The Medley Studio 2.0 is the standard editor for authenticated, resolved
 * organizations. A canonical organization flag explicitly set to false is the
 * emergency rollback to the preserved legacy MedleyComposer.
 *
 * No browser preference, authorization bypass, remote write or schema change.
 */
export const MEDLEY_STUDIO_V2_FLAG = 'musicscale.medleyStudioV2';

type OrgScope = Pick<Organization, 'id' | 'featureFlags' | 'features'>;

export function shouldUseMedleyStudioV2(
  userId: string | null | undefined,
  effectiveOrganizationId: string | null | undefined,
  organization: OrgScope | null | undefined,
): boolean {
  if (!userId || !effectiveOrganizationId || !organization || organization.id !== effectiveOrganizationId) {
    return false;
  }
  return organization.featureFlags?.[MEDLEY_STUDIO_V2_FLAG] !== false
    && organization.features?.[MEDLEY_STUDIO_V2_FLAG] !== false;
}
