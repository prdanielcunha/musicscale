export interface EcosystemProtocolOptions {
  protocolVersion: string;
  sdkVersion: string;
  capabilities: ('routing' | 'telemetry' | 'session_sync' | 'theme_sync' | 'i18n_sync')[];
}

export interface EcosystemUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

export interface EcosystemOrganization {
  id: string;
  name: string;
  slug: string;
}

export type EcosystemRoleType = 'owner' | 'admin' | 'worship_leader' | 'member' | 'visitor';

export interface EcosystemPermissions {
  role: EcosystemRoleType;
  canManageOrganization: boolean;
  canManageMembers: boolean;
  canManageScales: boolean;
  canManageRepertoire: boolean;
  capabilities?: string[];
}

export interface EcosystemOrganizationAvailable {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface EcosystemContextPayload {
  token: string;
  uid: string;
  userDisplayName: string;
  userEmail: string;
  userPhotoURL?: string;
  ecosystemRole: string;
  currentOrganizationId: string;
  currentOrganizationName: string;
  currentOrganizationSlug: string;
  organizationsAvailable: EcosystemOrganizationAvailable[];
  roleInCurrentOrganization: string;
  plan: string;
  subscriptionStatus: string;
  entitlements: any;
  capabilities: string[];
  permissions: {
    canManageOrganization: boolean;
    canManageMembers: boolean;
    canManageScales: boolean;
    canManageRepertoire: boolean;
    [key: string]: boolean;
  };
  needsRepair: boolean;
  repairReasons: string[];
  locale?: string;
  appId?: string;
  protocol?: EcosystemProtocolOptions;
  isStandalone?: boolean;
}


export interface EcosystemEvent {
  type: 'navigation' | 'activity' | 'telemetry' | 'error';
  payload: any;
  timestamp: number;
}
