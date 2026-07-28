import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import UsersPage from '../../pages/UsersPage';
import { UserProfile, Role, Instrument } from '../../types';
import pt from '../../locales/pt.json';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as roleHierarchy from '../../utils/roleHierarchy';
import type { RoleChangeContext } from '../../utils/roleHierarchy';

vi.unmock('react-i18next');
i18n
  .use(initReactI18next)
  .init({
    resources: { pt: { translation: pt } },
    lng: 'pt',
    fallbackLng: 'pt',
    interpolation: { escapeValue: false }
  });

function createProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  const profile: UserProfile = {
    uid: "user-id",
    email: "user@example.com",
    displayName: "User Name",
    photoURL: null,
    roleId: "",
    specialtyIds: [],
    ...overrides
  };
  return profile;
}

const mockRoles: Role[] = [
  { id: "r_member", name: "Member", description: "", permissions: { canManageUsers: false, canManageRoles: false, canManageRepertoire: false, canManageScales: false, canViewContent: true, canManageChords: false } },
  { id: "r_admin", name: "Admin", description: "", permissions: { canManageUsers: true, canManageRoles: true, canManageRepertoire: true, canManageScales: true, canViewContent: true, canManageChords: true } },
  { id: "r_owner", name: "Owner", description: "", permissions: { canManageUsers: true, canManageRoles: true, canManageRepertoire: true, canManageScales: true, canViewContent: true, canManageChords: true } }
];

const mockInstruments: Instrument[] = [
  { id: "i_vox", name: "Vocal", category: 'Voz' },
  { id: "i_gtr", name: "Guitar", category: 'Instrumento' }
];

let mockUsers: UserProfile[] = [];
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual as typeof import('react-router-dom'),
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: {}, pathname: '/users' })
  };
});

const mockUsersList = vi.fn<() => Promise<UserProfile[]>>();
const mockUsersUpdate = vi.fn();
const mockUsersUpdateMany = vi.fn();

vi.mock('../../contexts/ApiContext', () => ({
  useApi: () => ({
    users: {
      list: mockUsersList,
      update: mockUsersUpdate,
      updateMany: mockUsersUpdateMany
    }
  })
}));

let mockHasCapability = vi.fn().mockReturnValue(true);
vi.mock('../../hooks/useCapability', () => ({
  useCapability: () => ({
    hasCapability: (cap: string) => mockHasCapability(cap)
  })
}));

let mockCurrentUser: UserProfile = createProfile({ uid: 'current-user-123', displayName: 'Current User' });
let mockOrgOwnerId = 'owner-123';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    userProfile: { organizationId: 'org-1' }, organization: { ownerUserId: mockOrgOwnerId },
    loading: false
  }),
  useLimits: () => ({ limits: {}, usage: {} })
}));

vi.mock('../../contexts/MusicDataContext', () => ({
  useMusic: () => ({
    roles: mockRoles,
    instruments: mockInstruments
  })
}));

vi.mock('firebase/firestore', () => ({
  getDocs: async () => ({ docs: [] }),
  query: () => ({}),
  where: () => ({}),
  collection: () => ({}),
  doc: () => ({}),
  updateDoc: async () => {},
  deleteDoc: async () => {},
  setDoc: async () => {},
  serverTimestamp: () => 'timestamp',
  writeBatch: () => ({ commit: async () => {} })
}));

vi.mock('../../services/firebase', () => ({ db: {} }));
vi.mock('../../services/authService', () => ({ sendResetEmail: async () => {} }));
vi.mock('../../hooks/useMusicScaleEntitlements', () => ({
  useMusicScaleUsage: () => ({ limits: {}, usage: {}, loading: false }),
  useMusicScalePlan: () => ({ plan: { id: "free" }, loading: false })
}));

const mockAddToast = vi.fn();
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ success: mockAddToast, error: vi.fn(), toast: vi.fn() })
}));

vi.mock('../../hooks/useEcosystemAdmin', () => ({
  isGlobalPrivilegedUser: () => false
}));

vi.mock("../../components/billing/UserUsageBanner", () => ({
  UserUsageBanner: () => <div data-testid="user-usage-banner">Usage banner</div>
}));

// We mock roleResolver to identify owner
vi.mock('../../utils/roleResolver', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/roleResolver')>();
  return {
    ...actual,
    getPrimaryDisplayRole: (user: UserProfile) => {
      if (user.uid === mockOrgOwnerId) return { name: "Owner", isSystemRole: true };
      if (user.roleId === "r_owner") return { name: "Owner", isSystemRole: false };
      return { name: "Member", isSystemRole: false };
    }
  };
});

describe('UsersPage Integration ExistingMemberSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsers = [
      createProfile({ uid: 'current-user-123', roleId: 'r_admin' })
    ];
    mockUsersList.mockImplementation(async () => mockUsers);
    mockUsersUpdate.mockResolvedValue(undefined);
    mockUsersUpdateMany.mockResolvedValue(undefined);
    mockHasCapability.mockImplementation(() => true);
    mockNavigate.mockClear();
    
    // Spies on roleHierarchy to preserve original contract
    vi.spyOn(roleHierarchy, 'canChangeOrganizationRole').mockReturnValue({ canChange: true });
    vi.spyOn(roleHierarchy, 'canAssignOrganizationRole').mockReturnValue({ canAssign: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderPage = async () => {
    render(<UsersPage />);
    await waitFor(() => expect(screen.getByText(/Equipe e Permissões/i)).toBeInTheDocument());
  };

  it('1. integrante incompleto mostra a ação Configurar pessoa', async () => {
    mockUsers = [createProfile({ uid: 'u_inc', displayName: 'Incomplete User', roleId: '', specialtyIds: [] })];
    await renderPage();
    expect(screen.getByText(pt.teamSetup.progress.configureAction)).toBeInTheDocument();
  });

  it('2. clicar na ação abre o guia real', async () => {
    mockUsers = [createProfile({ uid: 'u_inc', displayName: 'Incomplete User', roleId: '', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.existingMember.steps.choosePerson)).toBeInTheDocument();
    });
  });

  it('3. equipe vazia mantém Ver integrantes', async () => {
    mockUsers = [];
    await renderPage();
    // In progress card for empty
    expect(screen.getByText(pt.teamSetup.progress.reviewAction)).toBeInTheDocument();
  });

  it('4. equipe vazia não abre o guia', async () => {
    mockUsers = [];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.reviewAction));
    expect(screen.queryByText(pt.teamSetup.existingMember.steps.choosePerson)).not.toBeInTheDocument();
  });

  it('5. equipe completa mantém Revisar integrantes', async () => {
    mockUsers = [createProfile({ uid: 'u_comp', displayName: 'Complete User', roleId: 'r_member', specialtyIds: ['i_vox'] })];
    await renderPage();
    expect(screen.getByText(pt.teamSetup.progress.reviewCompletedAction)).toBeInTheDocument();
  });

  it('6. equipe completa não abre o guia', async () => {
    mockUsers = [createProfile({ uid: 'u_comp', displayName: 'Complete User', roleId: 'r_member', specialtyIds: ['i_vox'] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.reviewCompletedAction));
    expect(screen.queryByText(pt.teamSetup.existingMember.steps.choosePerson)).not.toBeInTheDocument();
  });

  it('7. usuário sem musicscale.members.manage não vê o cartão', async () => {
    mockHasCapability.mockImplementation(() => false);
    await renderPage();
    expect(screen.queryByText(pt.teamSetup.progress.emptyTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(pt.teamSetup.progress.completeTitle)).not.toBeInTheDocument();
  });

  it('8. capability é consultada exatamente com musicscale.members.manage', async () => {
    await renderPage();
    expect(mockHasCapability).toHaveBeenCalledWith('musicscale.members.manage');
  });

  it('9. usuário atual recebe acesso em modo somente leitura', async () => {
    mockUsers = [createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }), createProfile({ uid: 'other', displayName: 'Other', roleId: '', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Current'));
    // Read only means the roles are disabled or missing (handled in AccessProfileSelector)
    expect(screen.getByText(pt.teamSetup.existingMember.access.currentUserExplanation)).toBeInTheDocument();
  });

  it('10. usuário atual consegue avançar para funções', async () => {
    mockUsers = [createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }), createProfile({ uid: 'other', displayName: 'Other', roleId: '', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Current'));
    fireEvent.click(screen.getByText('Continuar'));
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.existingMember.steps.ministryFunctions)).toBeInTheDocument();
    });
  });

  it('11. owner identificado por ownerUserId recebe somente leitura', async () => {
    mockOrgOwnerId = 'owner-id';
    mockUsers = [
      createProfile({ uid: 'owner-id', displayName: 'Owner User', roleId: 'r_member', specialtyIds: [] }),
      createProfile({ uid: 'other', displayName: 'Other', roleId: '', specialtyIds: [] })
    ];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Owner User'));
    expect(screen.getByText(pt.teamSetup.existingMember.access.ownerExplanation)).toBeInTheDocument();
  });

  it('12. owner identificado pelo roleId resolvido recebe somente leitura', async () => {
    mockOrgOwnerId = 'another';
    mockUsers = [createProfile({ uid: 'u_owner2', displayName: 'Owner By Role', roleId: 'r_owner', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Owner By Role'));
    expect(screen.getByText(pt.teamSetup.existingMember.access.ownerExplanation)).toBeInTheDocument();
  });

  it('13. organizationRole: "owner" isolado não substitui o perfil de acesso do MusicScale, conforme contrato atual definido pela política', async () => {
    // This is tested by the policy resolution logic which doesn't check organizationRole: "owner" straight, but uses roleResolver.
    mockOrgOwnerId = 'another';
    // User has systemRole='owner' but no roleId, so it's not musicscale owner.
    mockUsers = [createProfile({ uid: 'u_sys', displayName: 'Sys', roleId: '', specialtyIds: [], systemRole: 'owner' })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Sys'));
    // Since it's not resolved as owner by the MusicScale resolver, it doesn't get owner lock
    expect(screen.queryByText(pt.teamSetup.existingMember.access.ownerExplanation)).not.toBeInTheDocument();
  });

  it('14. decisão canChange: false bloqueia edição', async () => {
    vi.spyOn(roleHierarchy, 'canChangeOrganizationRole').mockImplementation((actorRole: string, targetCurrentRole: string, newRole: string, context: RoleChangeContext) => {
      return { canChange: false, error: "Blocked by hierarchy" };
    });
    mockUsers = [createProfile({ uid: 'u_blocked', displayName: 'Blocked User', roleId: 'r_admin', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Blocked User'));
    expect(screen.getByText("Blocked by hierarchy")).toBeInTheDocument();
  });

  it('15. decisão canAssign: false remove o papel das opções', async () => {
    vi.spyOn(roleHierarchy, 'canAssignOrganizationRole').mockImplementation((actorRole: string, targetRole: string, context: RoleChangeContext) => {
      if (targetRole === 'admin') return { canAssign: false, error: "Cannot assign Admin" };
      return { canAssign: true };
    });
    mockUsers = [createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }), createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    expect(screen.queryByRole('radio', { name: /Admin/i })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Member/i })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Owner/i })).not.toBeInTheDocument();
  });
  it('16. papel resolvido como owner nunca aparece', async () => {
    mockUsers = [createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }), createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    expect(screen.queryByRole('radio', { name: /Owner/i })).not.toBeInTheDocument();
  });

  it('17. selecionar papel não chama API', async () => {
    mockUsers = [createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }), createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    fireEvent.click(screen.getByRole('radio', { name: /Member/i }));
    expect(mockUsersUpdate).not.toHaveBeenCalled();
  });

  it('18. selecionar função não chama API', async () => {
    mockUsers = [createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }), createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    fireEvent.click(screen.getByRole('radio', { name: /Member/i }));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Vocal'));
    expect(mockUsersUpdate).not.toHaveBeenCalled();
  });

  it('19. papel alterado chama users.update uma única vez', async () => {
    mockUsers = [createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }), createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    fireEvent.click(screen.getByRole('radio', { name: /Member/i }));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    await waitFor(() => {
      expect(mockUsersUpdate).toHaveBeenCalledTimes(1);
    });
  });

  it('20. papel alterado envia exatamente: { roleId, musicscaleRole, specialtyIds }', async () => {
    mockUsers = [createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }), createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    fireEvent.click(screen.getByRole('radio', { name: /Member/i }));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Vocal'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    await waitFor(() => {
      const [receivedUserId, receivedPayload] = mockUsersUpdate.mock.calls[0];
            expect(receivedUserId).toBe('u_target');
      expect(receivedPayload).toEqual({ roleId: 'r_member', musicscaleRole: 'viewer', specialtyIds: ['i_vox'] });
      expect(Object.keys(receivedPayload).sort()).toEqual(['musicscaleRole', 'roleId', 'specialtyIds']);
    });
  });

  it('21. papel inalterado envia exatamente: { specialtyIds }', async () => {
    mockUsers = [createProfile({ uid: 'u_target', displayName: 'Target', roleId: 'r_member', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    // Do not change role
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Vocal'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    await waitFor(() => {
      const [receivedUserId, receivedPayload] = mockUsersUpdate.mock.calls[0];
      expect(receivedUserId).toBe('u_target');
      expect(receivedPayload).toEqual({ specialtyIds: ['i_vox'] });
      expect(Object.keys(receivedPayload)).toEqual(['specialtyIds']);
    });
  });

  it('22. usuário atual envia somente specialtyIds', async () => {
    mockUsers = [
      createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }),
      createProfile({ uid: 'other', displayName: 'Other', roleId: '', specialtyIds: [] })
    ];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Current'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Vocal'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    await waitFor(() => {
      const [receivedUserId, receivedPayload] = mockUsersUpdate.mock.calls[0];
            expect(receivedUserId).toBe('current-user-123');
      expect(receivedPayload).toEqual({ specialtyIds: ['i_vox'] });
      expect(Object.keys(receivedPayload).sort()).toEqual(['specialtyIds']);
    });
  });

  it('23. owner envia somente specialtyIds', async () => {
    mockOrgOwnerId = 'owner-id';
    mockUsers = [
      createProfile({ uid: 'owner-id', displayName: 'Owner User', roleId: 'r_member', specialtyIds: [] }),
      createProfile({ uid: 'other', displayName: 'Other', roleId: '', specialtyIds: [] })
    ];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Owner User'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Vocal'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    await waitFor(() => {
      const [receivedUserId, receivedPayload] = mockUsersUpdate.mock.calls[0];
            expect(receivedUserId).toBe('owner-id');
      expect(receivedPayload).toEqual({ specialtyIds: ['i_vox'] });
      expect(Object.keys(receivedPayload).sort()).toEqual(['specialtyIds']);
    });
  });

  it('24. specialtyIds são normalizados', async () => {
    mockUsers = [createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [' i_vox ', '', 'i_gtr'] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    fireEvent.click(screen.getByRole('radio', { name: /Member/i })); // Change role so it becomes dirty
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    await waitFor(() => {
      const [receivedUserId, receivedPayload] = mockUsersUpdate.mock.calls[0];
            expect(receivedUserId).toBe('u_target');
      expect(receivedPayload).toEqual({ roleId: 'r_member', musicscaleRole: 'viewer', specialtyIds: ['i_vox', 'i_gtr'] });
      expect(Object.keys(receivedPayload).sort()).toEqual(['musicscaleRole', 'roleId', 'specialtyIds']);
    });
  });

  it('25. duplicidades são removidas', async () => {
    mockUsers = [createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: ['i_vox', 'i_vox'] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    fireEvent.click(screen.getByRole('radio', { name: /Member/i })); // Change role
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    await waitFor(() => {
      const [receivedUserId, receivedPayload] = mockUsersUpdate.mock.calls[0];
            expect(receivedUserId).toBe('u_target');
      expect(receivedPayload).toEqual({ roleId: 'r_member', musicscaleRole: 'viewer', specialtyIds: ['i_vox'] });
      expect(Object.keys(receivedPayload).sort()).toEqual(['musicscaleRole', 'roleId', 'specialtyIds']);
    });
  });

  it('26. espaços vazios são removidos', async () => {
    mockUsers = [createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [' '] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    fireEvent.click(screen.getByRole('radio', { name: /Member/i })); // Change role
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    await waitFor(() => {
      const [receivedUserId, receivedPayload] = mockUsersUpdate.mock.calls[0];
            expect(receivedUserId).toBe('u_target');
      expect(receivedPayload).toEqual({ roleId: 'r_member', musicscaleRole: 'viewer', specialtyIds: [] });
      expect(Object.keys(receivedPayload).sort()).toEqual(['musicscaleRole', 'roleId', 'specialtyIds']);
    });
  });

  it('27. payload não contém organizationRole', async () => {
    mockUsers = [createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }), createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    fireEvent.click(screen.getByRole('radio', { name: /Member/i }));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    await waitFor(() => {
      const [, receivedPayload] = mockUsersUpdate.mock.calls[0];
      expect(receivedPayload).not.toHaveProperty('organizationRole');
      expect(receivedPayload).not.toHaveProperty('membership');
      expect(receivedPayload).not.toHaveProperty('permissions');
    });
  });

  it('28. payload não contém systemRole', async () => {
    mockUsers = [createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }), createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    fireEvent.click(screen.getByRole('radio', { name: /Member/i }));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    await waitFor(() => {
      const [, receivedPayload] = mockUsersUpdate.mock.calls[0];
      expect(receivedPayload).not.toHaveProperty('systemRole');
    });
  });

  it('29. payload não contém organizationId', async () => {
    mockUsers = [createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }), createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    fireEvent.click(screen.getByRole('radio', { name: /Member/i }));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    await waitFor(() => {
      const [, receivedPayload] = mockUsersUpdate.mock.calls[0];
      expect(receivedPayload).not.toHaveProperty('organizationId');
    });
  });

  it('30. usa users.update', async () => {
    mockUsers = [createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }), createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    fireEvent.click(screen.getByRole('radio', { name: /Member/i }));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    await waitFor(() => {
      expect(mockUsersUpdate).toHaveBeenCalled();
    });
  });

  it('31. não usa users.updateMany', async () => {
    mockUsers = [createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }), createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    fireEvent.click(screen.getByRole('radio', { name: /Member/i }));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    await waitFor(() => {
      expect(mockUsersUpdateMany).not.toHaveBeenCalled();
    });
  });
  it('32. chama users.list novamente e atualiza o cartão', async () => {
    const initialUsers = [createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
    const updatedUsers = [createProfile({ uid: 'u_target', displayName: 'Target', roleId: 'r_member', specialtyIds: ['i_vox'] })];
    
    mockUsersList.mockReset();
    mockUsersList
      .mockResolvedValueOnce(initialUsers)
      .mockResolvedValueOnce(updatedUsers);
      
    await renderPage();
    
    expect(screen.getByText(pt.teamSetup.progress.incompleteTitle)).toBeInTheDocument();
    
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    fireEvent.click(screen.getByRole('radio', { name: /Member/i }));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    
    await waitFor(() => {
      expect(mockUsersList).toHaveBeenCalledTimes(2);
      const updateCallOrder = mockUsersUpdate.mock.invocationCallOrder[0];
      const secondListCallOrder = mockUsersList.mock.invocationCallOrder[1];
      expect(updateCallOrder).toBeLessThan(secondListCallOrder);
    });
    
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.progress.completeTitle)).toBeInTheDocument();
    });
  });
  it('33. alteração da política antes do salvamento impede users.update', async () => {
    mockUsers = [createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }), createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    fireEvent.click(screen.getByRole('radio', { name: /Member/i }));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Continuar'));
    
    vi.spyOn(roleHierarchy, 'canChangeOrganizationRole').mockReturnValue({ canChange: false, error: "Changed mind" });
    fireEvent.click(screen.getByText('Salvar configuração'));
    
    await waitFor(() => {
      expect(mockUsersUpdate).not.toHaveBeenCalled();
      expect(screen.getByText(pt.teamSetup.existingMember.errors.policyChanged)).toBeInTheDocument();
    });
  });

  it('34. falha de users.update mantém o guia aberto', async () => {
    mockUsers = [createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }), createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
    mockUsersUpdate.mockRejectedValue(new Error('Network error'));
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    fireEvent.click(screen.getByRole('radio', { name: /Member/i }));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.existingMember.errors.saveFailed)).toBeInTheDocument();
      expect(screen.queryByText(pt.teamSetup.existingMember.completion.title)).not.toBeInTheDocument(); // not success
    });
  });

  it('35. falha preserva o papel escolhido', async () => {
    mockUsers = [createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }), createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
    mockUsersUpdate.mockRejectedValue(new Error('Network error'));
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    fireEvent.click(screen.getByRole('radio', { name: /Member/i }));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.existingMember.errors.saveFailed)).toBeInTheDocument();
    });

    // 10. usar o botão visível “Voltar e corrigir” para retornar ao passo de funções;
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.review.backAction }));

    // 11. usar o controle de voltar visível (Voltar ao acesso) recém-adicionado ao passo de funções para retornar ao passo de acesso;
    const backBtn = screen.getByRole('button', { name: pt.teamSetup.existingMember.actions.backToAccess });
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /Member/i })).toBeChecked();
    });
  });

  it('36. falha preserva as funções escolhidas', async () => {
    mockUsers = [createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }), createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
    mockUsersUpdate.mockRejectedValue(new Error('Network error'));
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    fireEvent.click(screen.getByRole('radio', { name: /Member/i }));
    fireEvent.click(screen.getByText('Continuar'));
    
    fireEvent.click(screen.getByText('Vocal'));
    
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.existingMember.errors.saveFailed)).toBeInTheDocument();
    });

    // Clicar no botão Voltar para retornar ao passo de funções (Step 3)
    fireEvent.click(screen.getByText(pt.teamSetup.existingMember.review.backAction));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Vocal/i })).toHaveAttribute('aria-pressed', 'true');
    });

    // Clicar em "Voltar ao acesso"
    const backBtn = screen.getByRole('button', { name: pt.teamSetup.existingMember.actions.backToAccess });
    fireEvent.click(backBtn);

    // Avançar novamente para funções
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.access.continueAction }));

    // Confirmar que Vocal continua selecionado
    expect(screen.getByRole('button', { name: /Vocal/i })).toHaveAttribute('aria-pressed', 'true');
  });
  it('37. sucesso mostra toast traduzido', async () => {
    mockUsers = [createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }), createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    fireEvent.click(screen.getByRole('radio', { name: /Member/i }));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(pt.teamSetup.existingMember.successToast);
    });
  });

  it('38. fluxo não navega para outra rota', async () => {
    mockUsers = [createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }), createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    fireEvent.click(screen.getByRole('radio', { name: /Member/i }));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    await waitFor(() => {
      const otherPageCalls = mockNavigate.mock.calls.filter(call => {
        const dest = call[0];
        return typeof dest === 'string' && dest !== '/users';
      });
      expect(otherPageCalls).toHaveLength(0);
    });
  });

  it('39. fluxo não abre convite', async () => {
    mockUsers = [createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }), createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    expect(screen.queryByText(/Convidar pessoa/i)).not.toBeInTheDocument();
  });

  it('40. cartão atualiza após a resposta recarregada de users.list', async () => {
    mockUsers = [createProfile({ uid: 'current-user-123', displayName: 'Current', roleId: 'r_member', specialtyIds: [] }), createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
    await renderPage();
    expect(screen.getByText(pt.teamSetup.progress.configureAction)).toBeInTheDocument();
    
    // Simulate API update returning complete profile
    mockUsersList.mockImplementationOnce(async () => [
      createProfile({ uid: 'u_target', displayName: 'Target', roleId: 'r_member', specialtyIds: ['i_vox'] })
    ]);
    
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    fireEvent.click(screen.getByRole('radio', { name: /Member/i }));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    
    await waitFor(() => {
      // Progress card should update to "Revisar integrantes" since user is now complete
      expect(screen.getByText(pt.teamSetup.progress.reviewCompletedAction)).toBeInTheDocument();
    });
  });

});
