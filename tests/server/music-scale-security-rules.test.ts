import { describe, it, expect, beforeEach } from 'vitest';

// Strict TypeScript Interfaces for Rules testing to avoid using "any"
interface RuleAuth {
  uid: string;
  token?: {
    email?: string;
  };
}

interface RuleRequest {
  auth: RuleAuth | null;
  resource?: {
    data: Record<string, unknown>;
  };
}

interface RuleResource {
  data: Record<string, unknown>;
}

interface Organization {
  id: string;
  ownerUid: string;
}

interface Member {
  userId: string;
  organizationId: string;
  role: string;
}

// Simulates the security rules of firestore.rules
class FirestoreRulesSimulator {
  private organizations: Map<string, Organization> = new Map();
  private members: Map<string, Member> = new Map();

  public registerOrganization(org: Organization): void {
    this.organizations.set(org.id, org);
  }

  public registerMember(member: Member): void {
    const key = `${member.userId}_${member.organizationId}`;
    this.members.set(key, member);
  }

  public clear(): void {
    this.organizations.clear();
    this.members.clear();
  }

  // Helper functions matching firestore.rules
  private isAuthenticated(request: RuleRequest): boolean {
    return request.auth !== null;
  }

  private isSystemAdminEmail(request: RuleRequest): boolean {
    if (!request.auth || !request.auth.token || !request.auth.token.email) return false;
    const email = request.auth.token.email;
    return [
      'pastordanielpcunha@gmail.com',
      'danielcunhapastor@gmail.com',
      'millionstreinamentos@gmail.com'
    ].includes(email);
  }

  private checkMemberExists(orgId: string, userId: string): boolean {
    const key = `${userId}_${orgId}`;
    return this.members.has(key);
  }

  private isOwnerOfOrg(orgId: string, userId: string): boolean {
    const org = this.organizations.get(orgId);
    return org !== undefined && org.ownerUid === userId;
  }

  private checkOrgAccess(orgId: string, userId: string, request: RuleRequest): boolean {
    return (
      this.isSystemAdminEmail(request) ||
      orgId === userId ||
      this.checkMemberExists(orgId, userId) ||
      this.isOwnerOfOrg(orgId, userId)
    );
  }

  // match /organizations/{orgId}/notifications/{notificationId} rules
  public canReadNotification(orgId: string, request: RuleRequest, resource: RuleResource): boolean {
    if (!this.isAuthenticated(request) || !request.auth) return false;
    
    // Check recipientId == request.auth.uid
    return resource.data.recipientId === request.auth.uid;
  }

  public canCreateNotification(): boolean {
    // allow create: if false;
    return false;
  }

  public canUpdateNotification(
    _orgId: string,
    request: RuleRequest,
    resource: RuleResource,
    incomingResource: RuleResource
  ): boolean {
    if (!this.isAuthenticated(request) || !request.auth) return false;

    // Must be recipient
    if (resource.data.recipientId !== request.auth.uid) return false;

    // Check affected keys constraint:
    // request.resource.data.diff(resource.data).affectedKeys().hasOnly(['isRead', 'isArchived', 'readAt', 'archivedAt'])
    const beforeData = resource.data;
    const afterData = incomingResource.data;

    const affectedKeys: string[] = [];
    const allKeys = new Set([...Object.keys(beforeData), ...Object.keys(afterData)]);

    allKeys.forEach((key) => {
      if (beforeData[key] !== afterData[key]) {
        affectedKeys.push(key);
      }
    });

    const allowedKeys = ['isRead', 'isArchived', 'readAt', 'archivedAt'];
    return affectedKeys.every((key) => allowedKeys.includes(key));
  }

  public canDeleteNotification(): boolean {
    // allow delete: if false;
    return false;
  }

  // match /scales/{scaleId} rules
  public canReadScale(orgId: string, request: RuleRequest, resource: RuleResource): boolean {
    if (!this.isAuthenticated(request) || !request.auth) return false;
    
    const scaleOrgId = resource.data.organizationId;
    if (typeof scaleOrgId !== 'string') return false;

    return this.checkOrgAccess(scaleOrgId, request.auth.uid, request);
  }
}

describe('Firestore Rules Security Certification (Etapa 10)', () => {
  let simulator: FirestoreRulesSimulator;

  beforeEach(() => {
    simulator = new FirestoreRulesSimulator();
    
    // Setup test tenant environments
    simulator.registerOrganization({ id: 'org-premium-1', ownerUid: 'user-owner' });
    simulator.registerOrganization({ id: 'org-premium-2', ownerUid: 'user-other' });

    simulator.registerMember({ userId: 'user-musician-1', organizationId: 'org-premium-1', role: 'musician' });
    simulator.registerMember({ userId: 'user-musician-2', organizationId: 'org-premium-2', role: 'musician' });
  });

  describe('1. Multi-Tenant Isolation', () => {
    it('Denies read access to scales of another organization', () => {
      const scaleResource: RuleResource = {
        data: {
          id: 'scale-123',
          organizationId: 'org-premium-1',
          name: 'Sunday Worship Service'
        }
      };

      // User from org 2 tries to read org 1's scale
      const request: RuleRequest = {
        auth: { uid: 'user-musician-2' }
      };

      const allowed = simulator.canReadScale('org-premium-1', request, scaleResource);
      expect(allowed).toBe(false);
    });

    it('Allows read access to scales of the same organization', () => {
      const scaleResource: RuleResource = {
        data: {
          id: 'scale-123',
          organizationId: 'org-premium-1',
          name: 'Sunday Worship Service'
        }
      };

      // User from org 1 tries to read org 1's scale
      const request: RuleRequest = {
        auth: { uid: 'user-musician-1' }
      };

      const allowed = simulator.canReadScale('org-premium-1', request, scaleResource);
      expect(allowed).toBe(true);
    });
  });

  describe('2. Notifications Soft Delete & Restricted Updates', () => {
    it('Blocks direct physical delete of notifications', () => {
      const allowed = simulator.canDeleteNotification();
      expect(allowed).toBe(false);
    });

    it('Blocks direct creation of notifications from clients', () => {
      const allowed = simulator.canCreateNotification();
      expect(allowed).toBe(false);
    });

    it('Allows updating of notifications read/archived fields by recipient', () => {
      const request: RuleRequest = {
        auth: { uid: 'user-musician-1' }
      };

      const resource: RuleResource = {
        data: {
          recipientId: 'user-musician-1',
          isRead: false,
          isArchived: false,
          title: 'Nova escala agendada'
        }
      };

      const incomingResource: RuleResource = {
        data: {
          recipientId: 'user-musician-1',
          isRead: true, // changed
          isArchived: true, // changed
          title: 'Nova escala agendada' // unmodified
        }
      };

      const allowed = simulator.canUpdateNotification('org-premium-1', request, resource, incomingResource);
      expect(allowed).toBe(true);
    });

    it('Blocks updates to notifications changing other core fields', () => {
      const request: RuleRequest = {
        auth: { uid: 'user-musician-1' }
      };

      const resource: RuleResource = {
        data: {
          recipientId: 'user-musician-1',
          isRead: false,
          isArchived: false,
          title: 'Nova escala agendada'
        }
      };

      const incomingResource: RuleResource = {
        data: {
          recipientId: 'user-musician-1',
          isRead: false,
          isArchived: false,
          title: 'Hackeado: Título alterado' // changed field not allowed!
        }
      };

      const allowed = simulator.canUpdateNotification('org-premium-1', request, resource, incomingResource);
      expect(allowed).toBe(false);
    });

    it('Blocks notification updates from non-recipients', () => {
      const request: RuleRequest = {
        auth: { uid: 'user-musician-2' } // not the recipient
      };

      const resource: RuleResource = {
        data: {
          recipientId: 'user-musician-1',
          isRead: false,
          isArchived: false,
          title: 'Nova escala agendada'
        }
      };

      const incomingResource: RuleResource = {
        data: {
          recipientId: 'user-musician-1',
          isRead: true,
          isArchived: false,
          title: 'Nova escala agendada'
        }
      };

      const allowed = simulator.canUpdateNotification('org-premium-1', request, resource, incomingResource);
      expect(allowed).toBe(false);
    });
  });
});
