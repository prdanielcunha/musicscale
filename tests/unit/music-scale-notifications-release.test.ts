import { describe, it, expect } from 'vitest';
import ptJson from '../../locales/pt.json';
import enJson from '../../locales/en.json';
import esJson from '../../locales/es.json';

const locales: Record<string, any> = {
  pt: ptJson,
  en: enJson,
  es: esJson,
};

describe('Notifications i18n Coverage (Matriz 4x3 - Etapa 7)', () => {
  const expectedMatrix = {
    pt: {
      scale_published: 'Nova escala de música publicada',
      scale_updated: 'A escala de música foi atualizada',
      assignment_added: 'Você foi escalado para um evento',
      role_changed: 'Sua função ministerial foi alterada',
    },
    en: {
      scale_published: 'New music scale published',
      scale_updated: 'The music scale has been updated',
      assignment_added: 'You have been scheduled for an event',
      role_changed: 'Your ministerial role has been changed',
    },
    es: {
      scale_published: 'Nueva escala de música publicada',
      scale_updated: 'La escala de música ha sido actualizada',
      assignment_added: 'Has sido programado para un evento',
      role_changed: 'Tu función ministerial ha sido modificada',
    },
  };

  Object.entries(expectedMatrix).forEach(([lang, keys]) => {
    describe(`Idioma: ${lang.toUpperCase()}`, () => {
      it('contém a seção de notificações', () => {
        expect(locales[lang]).toBeDefined();
        expect(locales[lang].notifications).toBeDefined();
        expect(typeof locales[lang].notifications).toBe('object');
      });

      Object.entries(keys).forEach(([key, expectedValue]) => {
        it(`contém a chave "${key}" com tradução exata`, () => {
          const actualValue = locales[lang].notifications[key];
          expect(actualValue).toBeDefined();
          expect(actualValue).toBe(expectedValue);
        });
      });
    });
  });
});
