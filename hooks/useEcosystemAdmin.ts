import { useAuth } from '../contexts/AuthContext';
import type { User, UserProfile } from '../types';

export const isGlobalPrivilegedUserStr = (systemRole?: string, email?: string) => {
  const role = systemRole?.toLowerCase();
  return role === 'ceo' || 
         role === 'admin' || 
         role === 'global_admin' || 
         role === 'owner' ||
         role === 'ecosystem_owner' ||
         role === 'founder' ||
         email === "pastordanielpcunha@gmail.com" || 
         email === "danielcunhapastor@gmail.com";
};

export const isGlobalPrivilegedUser = (user?: User | null, userProfile?: UserProfile | null) => {
  const anyProfile = userProfile as any;
  return isGlobalPrivilegedUserStr(userProfile?.systemRole, user?.email || undefined) || 
         anyProfile?.capabilities?.canBypassBilling === true || 
         anyProfile?.capabilities?.canUseAllFeatures === true || 
         anyProfile?.lifetimeAccess === true;
};

export const useEcosystemAdmin = () => {
  const { user, userProfile, organization } = useAuth();
  
  // Checking user profile roles OR if they are ceo/admin of "Millionsnest" organization.
  const isMillionsnestAdmin = 
    (organization?.name?.toLowerCase().includes('millionsnest') || organization?.id === 'millionsnest') && 
    (userProfile?.role === 'admin' || userProfile?.role === 'owner');

  const isEcosystemAdmin = isGlobalPrivilegedUser(user, userProfile) || !!isMillionsnestAdmin;
  
  return { isEcosystemAdmin };
};
