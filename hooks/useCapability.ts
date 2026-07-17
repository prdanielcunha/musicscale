import { useAuth } from '../contexts/AuthContext';

export type MusicScaleCapability = 
  | 'musicscale.songs.edit'
  | 'musicscale.scales.manage'
  | 'musicscale.members.manage'
  | 'musicscale.performance.use'
  | 'manageOrganization';

export function useCapability() {
  const { permissions } = useAuth();

  const hasCapability = (capability: MusicScaleCapability | string): boolean => {
    if (!permissions) return false;
    return !!permissions[capability as string];
  };

  return { hasCapability };
}
