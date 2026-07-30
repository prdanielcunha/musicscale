const fs = require('fs');
const file = 'tests/ui/music-scale-notification-contract.test.tsx';
let content = fs.readFileSync(file, 'utf8');

// replace the end of the file with the translation tests
content = content.replace(
`      expect(screen.getByText('Você está escalado como Violão')).toBeInTheDocument();
      expect(screen.getByText('Sua escala foi alterada')).toBeInTheDocument();
      expect(screen.getByText('Você foi removido da escala')).toBeInTheDocument();
    });
  });
});`,
`      expect(screen.getByText('Você está escalado como Violão')).toBeInTheDocument();
      expect(screen.getByText('Sua escala foi alterada')).toBeInTheDocument();
      expect(screen.getByText('Você foi removido da escala')).toBeInTheDocument();
    });
  });

  describe('Localization', () => {
    it('17. music_scale_assignment, music_scale_changed, music_scale_cancelled e music_scale_published são renderizados em: Português, English, Español', async () => {
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
              title: '',
              message: '',
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
              title: '',
              message: '',
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
              title: '',
              message: '',
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
              title: '',
              message: '',
              isRead: true,
              isArchived: false,
              metadata: { musicScaleId: 'scale-123' },
              createdAt: { toMillis: () => 1774882900000, toDate: () => new Date(1774882900000) }
            })
          });
        }
      };

      await (vi.mocked(onSnapshot).mock.calls[0][1] as any)(mockSnapshot);

      // Verify PT
      expect(screen.getByText('Você foi escalado!')).toBeInTheDocument();
      expect(screen.getByText('Escala Alterada')).toBeInTheDocument();
      expect(screen.getByText('Escala Cancelada')).toBeInTheDocument();
      expect(screen.getByText('Escala Publicada')).toBeInTheDocument();

      // Switch to EN
      import('i18next').then((m) => m.default.changeLanguage('en-US'));

      await waitFor(() => {
        expect(screen.getByText('You have been scheduled!')).toBeInTheDocument();
      });
      expect(screen.getByText('Music Scale Updated')).toBeInTheDocument();
      expect(screen.getByText('Music Scale Cancelled')).toBeInTheDocument();
      expect(screen.getByText('Music Scale Published')).toBeInTheDocument();

      // Switch to ES
      import('i18next').then((m) => m.default.changeLanguage('es-ES'));

      await waitFor(() => {
        expect(screen.getByText('¡Has sido programado!')).toBeInTheDocument();
      });
      expect(screen.getByText('Escala Musical Actualizada')).toBeInTheDocument();
      expect(screen.getByText('Escala Musical Cancelada')).toBeInTheDocument();
      expect(screen.getByText('Escala Musical Publicada')).toBeInTheDocument();
    });
  });
});`
);
fs.writeFileSync(file, content);
