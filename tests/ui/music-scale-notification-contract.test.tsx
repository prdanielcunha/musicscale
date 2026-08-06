import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ptJson from '../../locales/pt.json';
import enJson from '../../locales/en.json';
import esJson from '../../locales/es.json';

const locales: Record<string, Record<string, unknown>> = {
  pt: ptJson as Record<string, unknown>,
  en: enJson as Record<string, unknown>,
  es: esJson as Record<string, unknown>,
};

let currentLanguage = 'pt';
let currentMockSnapshot: unknown = null;

// Mocks for firebase/firestore
const mockUnsubscribe = vi.fn();
let currentSnapshotCallback: ((snapshot: unknown) => void) | null = null;
const mockOnSnapshot = vi.fn((_q: unknown, callback: (snapshot: unknown) => void) => {
  currentSnapshotCallback = callback;
  if (currentMockSnapshot) {
    callback(currentMockSnapshot);
  }
  return mockUnsubscribe;
});

const mockCollection = vi.fn((_dbInstance: unknown, path: string) => ({ type: 'collection', path }));
const mockQuery = vi.fn((colRef: unknown, ...wheres: unknown[]) => ({ type: 'query', colRef, wheres }));
const mockWhere = vi.fn((field: string, op: string, value: unknown) => ({ type: 'where', field, op, value }));
const mockDoc = vi.fn((_dbInstance: unknown, path: string, id: string) => ({ type: 'doc', path, id }));
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => (mockCollection as (...args: unknown[]) => unknown)(...args),
  query: (...args: unknown[]) => (mockQuery as (...args: unknown[]) => unknown)(...args),
  where: (...args: unknown[]) => (mockWhere as (...args: unknown[]) => unknown)(...args),
  onSnapshot: (...args: unknown[]) => (mockOnSnapshot as (...args: unknown[]) => unknown)(...args),
  doc: (...args: unknown[]) => (mockDoc as (...args: unknown[]) => unknown)(...args),
  updateDoc: (...args: unknown[]) => (mockUpdateDoc as (...args: unknown[]) => unknown)(...args),
  deleteDoc: (...args: unknown[]) => (mockDeleteDoc as (...args: unknown[]) => unknown)(...args),
  orderBy: vi.fn(),
}));

// Mock services/firebase
vi.mock('../../services/firebase', () => ({
  db: { mockDb: true },
  auth: { mockAuth: true },
}));

// Mock react-i18next with actual translations
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string, options?: { count?: number }) => {
      const keys = key.split('.');
      let val: unknown = locales[currentLanguage];
      for (const k of keys) {
        if (val && typeof val === 'object') {
          val = (val as Record<string, unknown>)[k];
        } else {
          val = undefined;
          break;
        }
      }
      if (typeof val === 'string') {
        if (options && options.count !== undefined) {
          // simple interpolation
          if (options.count === 1) {
            return val.replace('{{count}}', String(options.count));
          } else {
            // Check for plural key if available
            const pluralKey = keys[keys.length - 1] + '_plural';
            let pVal: unknown = locales[currentLanguage];
            for (let i = 0; i < keys.length - 1; i++) {
              pVal = (pVal as Record<string, unknown>)[keys[i]];
            }
            const pValString = pVal && typeof pVal === 'object' ? (pVal as Record<string, unknown>)[pluralKey] : undefined;
            if (typeof pValString === 'string') {
              return pValString.replace('{{count}}', String(options.count));
            }
            return val.replace('{{count}}', String(options.count));
          }
        }
        return val;
      }
      return defaultValue || key;
    },
    i18n: {
      language: currentLanguage,
      changeLanguage: vi.fn((lng: string) => {
        currentLanguage = lng;
        return Promise.resolve();
      }),
    },
  }),
}));

interface AuthContextValue {
  user: { uid: string } | null;
  organization: { id: string } | null;
}

// Mock AuthContext
let currentAuthValue: AuthContextValue = {
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

interface MusicContextValue {
  populatedScales: Array<{ id: string; date: string; time: string; eventName: string }>;
  populatedBandScales: Array<{ id: string; musicScaleId?: string }>;
}

// Mock MusicDataContext
let currentMusicValue: MusicContextValue = {
  populatedScales: [
    { id: 'scale-123', date: '2026-08-10', time: '19:00', eventName: 'Culto de Domingo' }
  ],
  populatedBandScales: [],
};
vi.mock('../../contexts/MusicDataContext', () => ({
  useMusic: () => currentMusicValue,
}));

// Mock AddToCalendarButton
vi.mock('../../components/common/AddToCalendarButton', () => ({
  default: () => <div data-testid="add-to-calendar">Add to Calendar</div>,
}));

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  notification: { title: string } | null;
  scale: { id: string } | null;
}

// Mock ScaleNotificationDetailModal to inspect props easily
vi.mock('../../components/scales/ScaleNotificationDetailModal', () => ({
  default: ({ isOpen, onClose, notification, scale }: DetailModalProps) => (
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
      <button data-testid="btn-mark-read" onClick={() => { context.markAsRead('notif-1').catch(() => {}); }}>Read</button>
      <button data-testid="btn-mark-unread" onClick={() => { context.markAsUnread('notif-1').catch(() => {}); }}>Unread</button>
      <button data-testid="btn-archive" onClick={() => { context.archiveNotification('notif-1').catch(() => {}); }}>Archive</button>
      <button data-testid="btn-delete" onClick={() => { context.deleteNotification('notif-1').catch(() => {}); }}>Delete</button>
    </div>
  );
};

interface DocSnapshotData {
  id: string;
  data: () => {
    recipientId: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    isArchived: boolean;
    metadata?: { musicScaleId?: string };
    createdAt?: { toMillis: () => number; toDate: () => Date };
  };
}

interface MockSnapshot {
  docChanges: () => unknown[];
  forEach: (cb: (doc: DocSnapshotData) => void) => void;
}

describe('NotificationContext & NotificationsPage UI Contract Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentLanguage = 'pt';
    currentMockSnapshot = null;
    currentAuthValue = {
      user: { uid: 'u1' },
      organization: { id: 'org-1' },
    };
    currentMusicValue = {
      populatedScales: [
        { id: 'scale-123', date: '2026-08-10', time: '19:00', eventName: 'Culto de Domingo' }
      ],
      populatedBandScales: [],
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
    const mockSnapshot1: MockSnapshot = {
      docChanges: () => [],
      forEach: (cb) => {
        cb({
          id: 'notif-org1',
          data: () => ({ recipientId: 'u1', type: 'music_scale_published', title: 'Notif Org 1', message: 'Message', isRead: false, isArchived: false })
        });
      }
    };
    if (currentSnapshotCallback) {
      currentSnapshotCallback(mockSnapshot1);
    }

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

    const mockSnapshot: MockSnapshot = {
      docChanges: () => [],
      forEach: (cb) => {
        cb({ id: 'notif-1', data: () => ({ recipientId: 'u1', type: 'music_scale_published', title: 'Notif 1', message: 'M', isRead: false, isArchived: false }) });
        cb({ id: 'notif-2', data: () => ({ recipientId: 'u1', type: 'music_scale_published', title: 'Notif 2', message: 'M', isRead: true, isArchived: false }) });
        cb({ id: 'notif-3', data: () => ({ recipientId: 'u1', type: 'music_scale_published', title: 'Notif 3', message: 'M', isRead: false, isArchived: false }) });
      }
    };
    if (currentSnapshotCallback) {
      currentSnapshotCallback(mockSnapshot);
    }

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
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'doc', id: 'notif-1' }),
      expect.objectContaining({ isArchived: true, archivedAt: expect.any(String) })
    );
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('deleteNotification preserves notification in state on Firestore error', async () => {
    mockUpdateDoc.mockRejectedValueOnce(new Error('Firestore update failed'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderContextAndPage();

    fireEvent.click(screen.getByTestId('btn-delete'));

    await waitFor(() => {
      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting notification', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it('11, 12, 13, 14 & 15. Tipos de notificações são renderizados e resolvem metadados corretos da escala', async () => {
    renderContextAndPage();

    // Trigger onSnapshot with various notification types
    const mockSnapshot: MockSnapshot = {
      docChanges: () => [],
      forEach: (cb) => {
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
    if (currentSnapshotCallback) {
      currentSnapshotCallback(mockSnapshot);
    }

    // Verify they are all rendered in the list
    expect(await screen.findByText('Você foi escalado!')).toBeInTheDocument();
    expect(await screen.findByText('Escala Alterada')).toBeInTheDocument();
    expect(await screen.findByText('Escala Cancelada')).toBeInTheDocument();
    expect(await screen.findByText('Nova Escala Publicada')).toBeInTheDocument();
  });

  it('16. Clique abre o detalhe correto', async () => {
    renderContextAndPage();

    const mockSnapshot: MockSnapshot = {
      docChanges: () => [],
      forEach: (cb) => {
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
    if (currentSnapshotCallback) {
      currentSnapshotCallback(mockSnapshot);
    }

    const item = await screen.findByText('Você foi escalado!');
    fireEvent.click(item);

    // Check detail modal is open with correct props
    expect(await screen.findByTestId('scale-notification-detail-modal')).toBeInTheDocument();
    expect(screen.getByTestId('detail-modal-notif-title')).toHaveTextContent('Você foi escalado!');
    expect(screen.getByTestId('detail-modal-scale-id')).toHaveTextContent('scale-123');
  });

  it('20. Traduções e interpoladores PT, EN e ES não apresentam chaves brutas', async () => {
    const mockSnapshot: MockSnapshot = {
      docChanges: () => [],
      forEach: (cb) => {
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

    currentMockSnapshot = mockSnapshot;

    // List of languages to cycle through
    const languages = ['pt', 'en', 'es'];

    for (const lang of languages) {
      // Set the current language
      currentLanguage = lang;

      // Render/Rerender component to reflect translation change
      const { rerender } = render(
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

      // Fetch the unread count msg element or text using robust matcher
      const matches = screen.getAllByText((content) => {
        const lower = content.toLowerCase();
        return lower.includes('notific') || lower.includes('unread') || lower.includes('lida') || lower.includes('leída');
      });
      expect(matches.length).toBeGreaterThan(0);
      for (const match of matches) {
        expect(match.textContent).not.toContain('{{');
        expect(match.textContent).not.toContain('}}');
      }
    }
  });
});
