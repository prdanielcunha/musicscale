import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import UsersPage from '../../pages/UsersPage';
import { UserProfile, Role } from '../../types';

// Real JSONs for translation
import pt from '../../locales/pt.json';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

vi.unmock('react-i18next');
i18n
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: pt },
    },
    lng: 'pt',
    fallbackLng: 'pt',
    interpolation: { escapeValue: false }
  });

interface JoinRequestFixture {
  id: string;
  status: "pending";
  uid: string;
  organizationId: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
}

let mockJoinRequests: JoinRequestFixture[] = [];

function createProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    uid: "user-id",
    email: "user@example.com",
    displayName: "User Name",
    photoURL: null,
    roleId: "",
    ...overrides
  };
}

const adminRole: Role = {
  id: "admin",
  name: "Admin",
  description: "Admin role",
  permissions: {
    canManageUsers: true,
    canManageRoles: true,
    canManageRepertoire: true,
    canManageScales: true,
    canViewContent: true,
    canManageChords: true
  }
};

let mockUsers: UserProfile[] = [];

// Setup Mocks
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}));

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
    hasCapability: (cap: string) => {
      return mockHasCapability(cap);
    }
  })
}));

const mockCurrentUser: Partial<UserProfile> = {
  uid: 'current-user-123',
  displayName: 'Current User'
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    userProfile: { organizationId: 'org-1' },
    loading: false
  }),
  useLimits: () => ({ limits: {}, usage: {} })
}));

vi.mock('../../contexts/MusicDataContext', () => ({
  useMusic: () => ({
    roles: [adminRole],
    instruments: []
  })
}));

vi.mock('firebase/firestore', () => ({
  getDocs: async () => ({ docs: mockJoinRequests.map(r => ({ id: r.id, data: () => r })) }),
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

vi.mock('../../services/firebase', () => ({
  db: {}
}));

vi.mock('../../services/authService', () => ({
  sendResetEmail: async () => {}
}));

vi.mock('../../hooks/useMusicScaleEntitlements', () => ({
  useMusicScaleUsage: () => ({ limits: {}, usage: {}, loading: false }),
  useMusicScalePlan: () => ({ plan: { id: "free" }, loading: false })
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() })
}));

vi.mock('../../hooks/useEcosystemAdmin', () => ({
  isGlobalPrivilegedUser: () => false
}));

vi.mock("../../components/billing/UserUsageBanner", () => ({
  UserUsageBanner: () => (
    <div data-testid="user-usage-banner">
      Usage banner
    </div>
  )
}));

describe('UsersPage Team Setup Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJoinRequests = [];
    mockUsers = [
      createProfile({ uid: 'current-user-123' })
    ];
    mockUsersList.mockImplementation(async () => mockUsers);
    mockUsersUpdate.mockResolvedValue(undefined);
    mockUsersUpdateMany.mockResolvedValue(undefined);
    mockHasCapability.mockImplementation((cap: string) => cap === 'musicscale.members.manage');
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. usuário com musicscale.members.manage vê o cartão', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.progress.emptyTitle)).toBeInTheDocument();
    });
  });

  it('2. usuário sem musicscale.members.manage não vê o cartão', async () => {
    mockHasCapability.mockReturnValue(false);
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.queryByText(pt.teamSetup.progress.emptyTitle)).not.toBeInTheDocument();
    });
  });

  it('3. cartão aparece depois do UserUsageBanner', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.progress.emptyTitle)).toBeInTheDocument();
    });
    const banner = screen.getByTestId("user-usage-banner");
    const card = screen.getByLabelText(pt.teamSetup.progress.emptyTitle);
    
    expect(
      banner.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('4. cartão aparece antes das solicitações pendentes quando elas existem', async () => {
    mockJoinRequests = [{
      id: "req-1",
      status: "pending",
      uid: "invited-user",
      organizationId: "org-1",
      displayName: "John",
      email: "john@example.com",
      photoURL: null
    }];
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText('Solicitações Pendentes')).toBeInTheDocument();
      expect(screen.getByText(pt.teamSetup.progress.emptyTitle)).toBeInTheDocument();
    });
    const card = screen.getByLabelText(pt.teamSetup.progress.emptyTitle);
    const pending = screen.getByText('Solicitações Pendentes');
    expect(
      card.compareDocumentPosition(pending) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('5. usuário atual não aparece na contagem de integrantes adicionais', async () => {
    mockUsers = [
      createProfile({ uid: 'current-user-123' }),
      createProfile({ uid: 'other', roleId: 'admin', specialtyIds: ['vocals'] })
    ];
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.progress.completeTitle)).toBeInTheDocument();
    });
  });

  it('6. integrante sem acesso e sem função produz estado incompleto', async () => {
    mockUsers = [
      createProfile({ uid: 'current-user-123' }),
      createProfile({ uid: 'other' })
    ];
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.progress.incompleteTitle)).toBeInTheDocument();
    });
  });

  it('7. integrante com roleId e specialtyIds produz estado completo', async () => {
    mockUsers = [
      createProfile({ uid: 'current-user-123' }),
      createProfile({ uid: 'other', roleId: 'admin', specialtyIds: ['vocals'] })
    ];
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.progress.completeTitle)).toBeInTheDocument();
    });
  });

  it('8. clique em "Ver integrantes" chama scrollIntoView', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: () => undefined
    });
    const scrollSpy = vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => undefined);
    
    try {
      render(<UsersPage />);
      await waitFor(() => {
        expect(screen.getByText(pt.teamSetup.progress.emptyTitle)).toBeInTheDocument();
      });
      
      const btn = screen.getByRole('button', { name: pt.teamSetup.progress.reviewAction });
      fireEvent.click(btn);
      
      expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    } finally {
      scrollSpy.mockRestore();
      if (originalDescriptor) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalDescriptor);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
      }
    }
  });

  it('9. clique em "Ver integrantes" move foco para a seção', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.progress.emptyTitle)).toBeInTheDocument();
    });
    
    const btn = screen.getByRole('button', { name: pt.teamSetup.progress.reviewAction });
    fireEvent.click(btn);
    
    const section = screen.getByLabelText(pt.teamSetup.progress.sectionLabel);
    expect(section).toHaveFocus();
  });

  it('10. a seção focada contém o subtítulo de gestão', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.progress.emptyTitle)).toBeInTheDocument();
    });
    const section = screen.getByLabelText(pt.teamSetup.progress.sectionLabel);
    expect(within(section).getByText(/Clique em uma função para gerenciar/i)).toBeInTheDocument();
  });

  it('11. a mesma seção contém a grade de papéis', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.progress.emptyTitle)).toBeInTheDocument();
    });
    const section = screen.getByLabelText(pt.teamSetup.progress.sectionLabel);
    expect(within(section).getByText('Admin')).toBeInTheDocument();
  });

  it('12. o clique não navega', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.progress.emptyTitle)).toBeInTheDocument();
    });
    const btn = screen.getByRole('button', { name: pt.teamSetup.progress.reviewAction });
    fireEvent.click(btn);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('13. o clique não abre modal', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.progress.emptyTitle)).toBeInTheDocument();
    });
    
    const dialogsBefore = screen.queryAllByRole("dialog").length;
    
    const btn = screen.getByRole('button', { name: pt.teamSetup.progress.reviewAction });
    fireEvent.click(btn);
    
    expect(screen.queryAllByRole("dialog")).toHaveLength(dialogsBefore);
  });

  it('14. o clique não chama API de atualização', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.progress.emptyTitle)).toBeInTheDocument();
    });
    
    mockUsersUpdate.mockClear();
    mockUsersUpdateMany.mockClear();

    const btn = screen.getByRole('button', { name: pt.teamSetup.progress.reviewAction });
    fireEvent.click(btn);
    
    expect(mockUsersList).toHaveBeenCalled();
    expect(mockUsersUpdate).not.toHaveBeenCalled();
    expect(mockUsersUpdateMany).not.toHaveBeenCalled();
  });

  it('15. "Revisar integrantes" usa a mesma ação quando todos estão completos', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: () => undefined
    });
    const scrollSpy = vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => undefined);
    
    try {
      mockUsers = [
        createProfile({ uid: 'current-user-123' }),
        createProfile({ uid: 'other', roleId: 'admin', specialtyIds: ['vocals'] })
      ];
      render(<UsersPage />);
      await waitFor(() => {
        expect(screen.getByText(pt.teamSetup.progress.completeTitle)).toBeInTheDocument();
      });
      
      const btn = screen.getByRole('button', { name: pt.teamSetup.progress.reviewCompletedAction });
      fireEvent.click(btn);
      
      expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    } finally {
      scrollSpy.mockRestore();
      if (originalDescriptor) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalDescriptor);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
      }
    }
  });

  it('16. a capacidade é consultada com exatamente: musicscale.members.manage', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.progress.emptyTitle)).toBeInTheDocument();
    });
    expect(mockHasCapability).toHaveBeenCalledWith('musicscale.members.manage');
  });
});
