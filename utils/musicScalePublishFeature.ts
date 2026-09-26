export const MUSIC_SCALE_PUBLISH_COMMAND_FLAG = 'musicscale.musicScalePublishCommandV1';

type FeatureCarrier = {
  featureFlags?: Record<string, unknown> | null;
  features?: Record<string, unknown> | null;
} | null | undefined;

/**
 * The publish command is a production capability, not an opt-in rollout anymore.
 * Legacy organizations created before the flag was introduced may not have the
 * key at all, so a missing value must fail open. An explicit boolean false
 * remains an operational kill switch.
 *
 * featureFlags is the canonical source when it contains a boolean. The legacy
 * features map is consulted only when the canonical map has no boolean value.
 */
export function isMusicScalePublishCommandEnabledForOrganization(
  organization: FeatureCarrier,
): boolean {
  const canonical = organization?.featureFlags?.[MUSIC_SCALE_PUBLISH_COMMAND_FLAG];
  if (typeof canonical === 'boolean') return canonical;

  const legacy = organization?.features?.[MUSIC_SCALE_PUBLISH_COMMAND_FLAG];
  if (typeof legacy === 'boolean') return legacy;

  return true;
}
