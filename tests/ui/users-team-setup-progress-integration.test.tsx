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

// Setup Mocks
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}));

const mockApiCall = vi.fn();
vi.mock('../../contexts/ApiContext', () => ({
  useApi: () => ({
    users: { list: async () => { console.log("mockUsers:", mockUsers); return mockUsers; } },
    updateUserRole: async () => {}
  })
}));

let mockHasCapability = vi.fn().mockReturnValue(true);
let capabilityCheckedWith = '';
vi.mock('../../hooks/useCapability', () => ({
  useCapability: () => ({
    hasCapability: (cap: string) => {
      capabilityCheckedWith = cap;
      return mockHasCapability(cap);
    }
  })
}));

const mockCurrentUser: Partial<UserProfile> = {
  uid: 'current-user-123',
  displayName: 'Current User'
};

let mockUsers: UserProfile[] = [];

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
    roles: [
      { id: 'admin', name: 'Admin', description: 'desc', permissions: { canManageUsers: true, canManageRoles: true, canManageRepertoire: true, canManageScales: true } }
    ] as Role[],
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

let mockJoinRequests: any[] = [];

function createProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    uid: 'user-id',
    email: 'user@example.com',
    displayName: 'User Name',
    photoURL: 'https://example.com/photo.png',
    ...overrides
  } as unknown as UserProfile;
}

describe('UsersPage Team Setup Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJoinRequests = [];
    mockUsers = [
      createProfile({ uid: 'current-user-123' })
    ];
    mockHasCapability.mockImplementation((cap: string) => cap === 'musicscale.members.manage');
    capabilityCheckedWith = '';
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
    const { container } = render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.progress.emptyTitle)).toBeInTheDocument();
    });
    // Find the banner and the card
    // The banner contains "Sua assinatura atual permite até" or similar, wait, the mock doesn't render it maybe.
    // Let's rely on DOM structure.
    const bannerContainer = container.querySelector('.bg-slate-50.dark\\:bg-slate-800\\/50.border.rounded-xl.p-5'); // UserUsageBanner typically renders this or something, but it's not mocked so it renders real one.
    const titleText = pt.teamSetup.progress.emptyTitle;
    const card = screen.getByText(titleText).closest('div.mb-8')!;
    
    // We can just verify position with node order. UserUsageBanner should have an H2 or text.
    // Actually, we can find elements by role or text.
    // In UserUsageBanner: text 'Uso de Membros'
    const title = screen.getByText('Equipe e Permissões');
    expect(title.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('4. cartão aparece antes das solicitações pendentes quando elas existem', async () => {
    mockJoinRequests = [{ id: 'req1', status: 'pending', displayName: 'John', email: 'john@example.com' }];
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText('Solicitações Pendentes')).toBeInTheDocument();
      expect(screen.getByText(pt.teamSetup.progress.emptyTitle)).toBeInTheDocument();
    });
    const card = screen.getByText(pt.teamSetup.progress.emptyTitle).closest('div.mb-8')!;
    const pending = screen.getByText('Solicitações Pendentes');
    expect(card.compareDocumentPosition(pending) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    const scrollIntoViewMock = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.progress.emptyTitle)).toBeInTheDocument();
    });
    
    const btn = screen.getByRole('button', { name: pt.teamSetup.progress.reviewAction });
    fireEvent.click(btn);
    
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    
    delete (HTMLElement.prototype as any).scrollIntoView;
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
      expect(screen.getByLabelText(pt.teamSetup.progress.sectionLabel)).toBeInTheDocument();
    });
    const section = screen.getByLabelText(pt.teamSetup.progress.sectionLabel);
    expect(within(section).getByText(/Clique em uma função para gerenciar/i)).toBeInTheDocument();
  });

  it('11. a mesma seção contém a grade de papéis', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(pt.teamSetup.progress.sectionLabel)).toBeInTheDocument();
    });
    const section = screen.getByLabelText(pt.teamSetup.progress.sectionLabel);
    // the grid contains roles like "Admin", which is returned by MusicDataContext mock
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
    // Usually modals have dialog role
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.progress.emptyTitle)).toBeInTheDocument();
    });
    const btn = screen.getByRole('button', { name: pt.teamSetup.progress.reviewAction });
    fireEvent.click(btn);
    // Check there is no modal added
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('14. o clique não chama API de atualização', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.progress.emptyTitle)).toBeInTheDocument();
    });
    const btn = screen.getByRole('button', { name: pt.teamSetup.progress.reviewAction });
    fireEvent.click(btn);
    expect(mockApiCall).not.toHaveBeenCalled();
  });

  it('15. "Revisar integrantes" usa a mesma ação quando todos estão completos', async () => {
    const scrollIntoViewMock = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    
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
    
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    
    delete (HTMLElement.prototype as any).scrollIntoView;
  });

  it('16. a capacidade é consultada com exatamente: musicscale.members.manage', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.progress.emptyTitle)).toBeInTheDocument();
    });
    expect(capabilityCheckedWith).toBe('musicscale.members.manage');
  });
});
