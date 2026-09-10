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

export const useEcosystemAdmin = () => {
  const { userProfile } = useAuth();
  const isEcosystemAdmin = isGlobalPrivilegedUser(undefined, userProfile);
  return { isEcosystemAdmin };
};
