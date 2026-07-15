import { useAuth } from "../contexts/AuthContext";

export function useFeatureFlag(flagName: string): boolean {
  const { organization } = useAuth();
  
  if (!organization) return false;

  const featureFlags = organization.featureFlags || {};
  const features = organization.features || {};

  return featureFlags[flagName] === true || features[flagName] === true;
}
