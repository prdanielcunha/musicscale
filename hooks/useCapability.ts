import { useAuth } from '../contexts/AuthContext';

export type MusicScaleCapability = 
  | 'musicscale.songs.edit'
  | 'musicscale.scales.manage'
  | 'musicscale.members.manage'
  | 'musicscale.performance.use'
  | 'manageOrganization';

export function useCapability() {
  const { permissions, isOwner, isAdmin } = useAuth();

  const hasCapability = (capability: MusicScaleCapability | string): boolean => {
    if (!permissions) return false;
    // Owners/Admins have all capabilities by default unless specifically revoked
    // However, the permissions object from AuthContext already proxies to true for owners/admins.
    return !!permissions[capability as string];
  };

  return { hasCapability };
}
