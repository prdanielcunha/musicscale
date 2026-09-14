import { useAuth } from '../contexts/AuthContext';
import type { User, UserProfile } from '../types';

export const isGlobalPrivilegedUserStr = (systemRole?: string, _email?: string) => {
  const role = systemRole?.toLowerCase().trim();
  return role === 'ceo' ||
         role === 'founder' ||
         role === 'ecosystem_owner' ||
         role === 'global_admin' ||
         role === 'admin';
};

export const isGlobalPrivilegedUser = (_user?: User | null, userProfile?: UserProfile | null) => {
  return isGlobalPrivilegedUserStr(userProfile?.systemRole);
};

/**
 * Runtime consumers must use AuthContext's canonical reconciliation instead of
 * the local MusicScale profile alone. Hub handoff can carry a fresher ecosystem
 * role than users/{uid}; AuthContext already resolves both without changing
 * organization ownership or tenant membership.
 */
export const useEcosystemAdmin = () => {
  const { isGlobalAdmin } = useAuth();
  return { isEcosystemAdmin: isGlobalAdmin };
};
