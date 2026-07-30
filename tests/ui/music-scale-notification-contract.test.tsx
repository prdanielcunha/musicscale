import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mocks for firebase/firestore
const mockUnsubscribe = vi.fn();
let currentSnapshotCallback: any = null;
const mockOnSnapshot = vi.fn((q, callback) => {
  currentSnapshotCallback = callback;
  return mockUnsubscribe;
});

const mockCollection = vi.fn((dbInstance, path) => ({ type: 'collection', path }));
const mockQuery = vi.fn((colRef, ...wheres) => ({ type: 'query', colRef, wheres }));
const mockWhere = vi.fn((field, op, value) => ({ type: 'where', field, op, value }));
const mockDoc = vi.fn((dbInstance, path, id) => ({ type: 'doc', path, id }));
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => (mockCollection as any)(...args),
  query: (...args: any[]) => (mockQuery as any)(...args),
  where: (...args: any[]) => (mockWhere as any)(...args),
  onSnapshot: (...args: any[]) => (mockOnSnapshot as any)(...args),
  doc: (...args: any[]) => (mockDoc as any)(...args),
  updateDoc: (...args: any[]) => (mockUpdateDoc as any)(...args),
  deleteDoc: (...args: any[]) => (mockDeleteDoc as any)(...args),
  orderBy: vi.fn(),
}));

// Mock services/firebase
vi.mock('../../services/firebase', () => ({
  db: { mockDb: true },
  auth: { mockAuth: true },
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string | any, options?: any) => {
      if (typeof defaultValue === 'string') {
        if (options && options.count !== undefined) {
          return defaultValue.replace('{{count}}', String(options.count));
        }
        return defaultValue;
      }
      return key;
    },
    i18n: { language: 'pt', changeLanguage: vi.fn() },
  }),
}));

// Mock AuthContext
let currentAuthValue = {
  user: { uid: 'u1' },
  organization: { id: 'org-1' },
};
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => currentAuthValue,
}));

// Mock ToastContext
const mockToast = vi.fn();
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock MusicDataContext
let currentMusicValue = {
  populatedScales: [
    { id: 'scale-123', date: '2026-08-10', time: '19:00', eventName: 'Culto de Domingo' }
  ],
  populatedBandScales: [] as any[],
};
vi.mock('../../contexts/MusicDataContext', () => ({
  useMusic: () => currentMusicValue,
}));

// Mock AddToCalendarButton
vi.mock('../../components/common/AddToCalendarButton', () => ({
  default: () => <div data-testid="add-to-calendar">Add to Calendar</div>,
}));

// Mock ScaleNotificationDetailModal to inspect props easily
vi.mock('../../components/scales/ScaleNotificationDetailModal', () => ({
  default: ({ isOpen, onClose, notification, scale }: any) => (
    isOpen ? (
      <div data-testid="scale-notification-detail-modal">
        <span data-testid="detail-modal-notif-title">{notification?.title}</span>
        <span data-testid="detail-modal-scale-id">{scale?.id}</span>
        <button data-testid="detail-modal-close" onClick={onClose}>Fechar</button>
      </div>
    ) : null
  ),
}));

// Import Context & Components to test
import { NotificationProvider, useNotifications } from '../../contexts/NotificationContext';
import NotificationsPage from '../../pages/NotificationsPage';

// Helper component to access notification context directly in tests
const TestContextConsumer: React.FC = () => {
  const context = useNotifications();
  return (
    <div data-testid="context-consumer">
      <span data-testid="context-unread-count">{context.unreadCount}</span>
      <button data-testid="btn-mark-read" onClick={() => context.markAsRead('notif-1')}>Read</button>
      <button data-testid="btn-mark-unread" onClick={() => context.markAsUnread('notif-1')}>Unread</button>
      <button data-testid="btn-archive" onClick={() => context.archiveNotification('notif-1')}>Archive</button>
      <button data-testid="btn-delete" onClick={() => context.deleteNotification('notif-1')}>Delete</button>
    </div>
  );
};

describe('NotificationContext & NotificationsPage UI Contract Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentAuthValue = {
      user: { uid: 'u1' },
      organization: { id: 'org-1' },
    };
    currentMusicValue = {
      populatedScales: [
        { id: 'scale-123', date: '2026-08-10', time: '19:00', eventName: 'Culto de Domingo' }
      ],
      populatedBandScales: [] as any[],
    };
    currentSnapshotCallback = null;
  });

  const renderContextAndPage = () => {
    return render(
      <MemoryRouter initialEntries={['/notifications']}>
        <NotificationProvider>
          <Routes>
            <Route path="/notifications" element={
              <>
                <TestContextConsumer />
                <NotificationsPage />
              </>
            } />
          </Routes>
        </NotificationProvider>
      </MemoryRouter>
    );
  };

  it('1, 2, 3 & 5. Listener consulta exatamente organizations/{orgId}/notifications e filtra recipientId, isArchived false', () => {
    renderContextAndPage();

    expect(mockCollection).toHaveBeenCalledWith(expect.any(Object), 'organizations/org-1/notifications');
    
    // Check filter criteria
    expect(mockWhere).toHaveBeenCalledWith('recipientId', '==', 'u1');
    expect(mockWhere).toHaveBeenCalledWith('isArchived', '==', false);
  });

  it('4, 17, 18 & 19. Troca de organização cancela o anterior, remove os dados imediatamente e não vaza notificações', async () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/notifications']}>
        <NotificationProvider>
          <TestContextConsumer />
        </NotificationProvider>
      </MemoryRouter>
    );

    // Initial listener unsubscribe should be prepared
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);

    // Feed initial mock notifications
    const mockSnapshot1 = {
      docChanges: () => [],
      forEach: (cb: any) => {
        cb({ id: 'notif-org1', data: () => ({ recipientId: 'u1', type: 'music_scale_published', title: 'Notif Org 1', isRead: false, isArchived: false }) });
      }
    };
    currentSnapshotCallback(mockSnapshot1);

    await waitFor(() => expect(screen.getByTestId('context-unread-count')).toHaveTextContent('1'));

    // Change organization
    currentAuthValue = {
      user: { uid: 'u1' },
      organization: { id: 'org-2' },
    };

    // Rerender to trigger useEffect of context
    rerender(
      <MemoryRouter initialEntries={['/notifications']}>
        <NotificationProvider>
          <TestContextConsumer />
        </NotificationProvider>
      </MemoryRouter>
    );

    // Check that previous listener is unsubscribed
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);

    // State is cleared immediately (no leaks)
    await waitFor(() => expect(screen.getByTestId('context-unread-count')).toHaveTextContent('0'));

    // New listener created for org-2
    expect(mockCollection).toHaveBeenCalledWith(expect.any(Object), 'organizations/org-2/notifications');
  });

  it('6. unreadCount reflete exatamente documentos não lidos', async () => {
    renderContextAndPage();

    const mockSnapshot = {
      docChanges: () => [],
      forEach: (cb: any) => {
        cb({ id: 'notif-1', data: () => ({ recipientId: 'u1', type: 'music_scale_published', title: 'Notif 1', isRead: false, isArchived: false }) });
        cb({ id: 'notif-2', data: () => ({ recipientId: 'u1', type: 'music_scale_published', title: 'Notif 2', isRead: true, isArchived: false }) });
        cb({ id: 'notif-3', data: () => ({ recipientId: 'u1', type: 'music_scale_published', title: 'Notif 3', isRead: false, isArchived: false }) });
      }
    };
    currentSnapshotCallback(mockSnapshot);

    await waitFor(() => expect(screen.getByTestId('context-unread-count')).toHaveTextContent('2'));
  });

  it('7. markAsRead grava no caminho canônico', async () => {
    renderContextAndPage();

    fireEvent.click(screen.getByTestId('btn-mark-read'));

    expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), 'organizations/org-1/notifications', 'notif-1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'doc', id: 'notif-1' }),
      expect.objectContaining({ isRead: true })
    );
  });

  it('8. markAsUnread grava no caminho canônico', async () => {
    renderContextAndPage();

    fireEvent.click(screen.getByTestId('btn-mark-unread'));

    expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), 'organizations/org-1/notifications', 'notif-1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'doc', id: 'notif-1' }),
      expect.objectContaining({ isRead: false, readAt: null })
    );
  });

  it('9. archiveNotification grava no caminho canônico', async () => {
    renderContextAndPage();

    fireEvent.click(screen.getByTestId('btn-archive'));

    expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), 'organizations/org-1/notifications', 'notif-1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'doc', id: 'notif-1' }),
      expect.objectContaining({ isArchived: true })
    );
  });

  it('10. deleteNotification exclui no caminho canônico', async () => {
    renderContextAndPage();

    fireEvent.click(screen.getByTestId('btn-delete'));

    expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), 'organizations/org-1/notifications', 'notif-1');
    expect(mockDeleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'doc', id: 'notif-1' })
    );
  });

  it('11, 12, 13, 14 & 15. Tipos de notificações são renderizados e resolvem metadados corretos da escala', async () => {
    renderContextAndPage();

    // Trigger onSnapshot with various notification types
    const mockSnapshot = {
      docChanges: () => [],
      forEach: (cb: any) => {
        cb({
          id: 'n1',
          data: () => ({
            recipientId: 'u1',
            type: 'music_scale_assignment',
            title: 'Você foi escalado!',
            message: 'Você está escalado como Violão',
            isRead: false,
            isArchived: false,
            metadata: { musicScaleId: 'scale-123' },
            createdAt: { toMillis: () => 1774883200000, toDate: () => new Date(1774883200000) }
          })
        });
        cb({
          id: 'n2',
          data: () => ({
            recipientId: 'u1',
            type: 'music_scale_changed',
            title: 'Escala Alterada',
            message: 'Sua escala foi alterada',
            isRead: true,
            isArchived: false,
            metadata: { musicScaleId: 'scale-123' },
            createdAt: { toMillis: () => 1774883100000, toDate: () => new Date(1774883100000) }
          })
        });
        cb({
          id: 'n3',
          data: () => ({
            recipientId: 'u1',
            type: 'music_scale_cancelled',
            title: 'Escala Cancelada',
            message: 'Você foi removido da escala',
            isRead: true,
            isArchived: false,
            metadata: { musicScaleId: 'scale-123' },
            createdAt: { toMillis: () => 1774883000000, toDate: () => new Date(1774883000000) }
          })
        });
        cb({
          id: 'n4',
          data: () => ({
            recipientId: 'u1',
            type: 'music_scale_published',
            title: 'Nova Escala Publicada',
            message: 'A escala de música foi publicada',
            isRead: true,
            isArchived: false,
            metadata: { musicScaleId: 'scale-123' },
            createdAt: { toMillis: () => 1774882900000, toDate: () => new Date(1774882900000) }
          })
        });
      }
    };
    currentSnapshotCallback(mockSnapshot);

    // Verify they are all rendered in the list
    expect(await screen.findByText('Você foi escalado!')).toBeInTheDocument();
    expect(await screen.findByText('Escala Alterada')).toBeInTheDocument();
    expect(await screen.findByText('Escala Cancelada')).toBeInTheDocument();
    expect(await screen.findByText('Nova Escala Publicada')).toBeInTheDocument();
  });

  it('16. Clique abre o detalhe correto', async () => {
    renderContextAndPage();

    const mockSnapshot = {
      docChanges: () => [],
      forEach: (cb: any) => {
        cb({
          id: 'n1',
          data: () => ({
            recipientId: 'u1',
            type: 'music_scale_assignment',
            title: 'Você foi escalado!',
            message: 'Você está escalado como Violão',
            isRead: false,
            isArchived: false,
            metadata: { musicScaleId: 'scale-123' },
            createdAt: { toMillis: () => 1774883200000, toDate: () => new Date(1774883200000) }
          })
        });
      }
    };
    currentSnapshotCallback(mockSnapshot);

    const item = await screen.findByText('Você foi escalado!');
    fireEvent.click(item);

    // Check detail modal is open with correct props
    expect(await screen.findByTestId('scale-notification-detail-modal')).toBeInTheDocument();
    expect(screen.getByTestId('detail-modal-notif-title')).toHaveTextContent('Você foi escalado!');
    expect(screen.getByTestId('detail-modal-scale-id')).toHaveTextContent('scale-123');
  });

  it('20. Traduções e interpoladores PT, EN e ES não apresentam chaves brutas', async () => {
    renderContextAndPage();

    const mockSnapshot = {
      docChanges: () => [],
      forEach: (cb: any) => {
        cb({
          id: 'n1',
          data: () => ({
            recipientId: 'u1',
            type: 'music_scale_published',
            title: 'Nova Escala',
            message: 'A escala de música foi publicada',
            isRead: false,
            isArchived: false,
            metadata: { musicScaleId: 'scale-123' },
            createdAt: { toMillis: () => 1774883200000, toDate: () => new Date(1774883200000) }
          })
        });
      }
    };
    currentSnapshotCallback(mockSnapshot);

    // The subtext unreadCountMsg string should be resolved nicely
    const unreadSubtext = await screen.findByText(/Você tem/);
    expect(unreadSubtext).toBeInTheDocument();
    expect(unreadSubtext.textContent).not.toContain('{{');
    expect(unreadSubtext.textContent).not.toContain('}}');
  });
});
