import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TeamSetupProgressCard } from '../../components/team/TeamSetupProgressCard';
import { TeamSetupSummary } from '../../utils/teamSetup';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import pt from '../../locales/pt.json';
import en from '../../locales/en.json';
import es from '../../locales/es.json';

vi.unmock('react-i18next');

i18n
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: pt },
      en: { translation: en },
      es: { translation: es }
    },
    lng: 'pt',
    fallbackLng: 'pt',
    interpolation: { escapeValue: false }
  });

function createSummary(overrides: Partial<TeamSetupSummary> = {}): TeamSetupSummary {
  return {
    totalMembers: 0,
    additionalMembers: 0,
    membersWithAccessProfile: 0,
    membersWithMinistryFunctions: 0,
    configuredMembers: 0,
    incompleteMemberIds: [],
    memberStatuses: [],
    isTeamConfigured: false,
    ...overrides
  };
}

describe('TeamSetupProgressCard', () => {
  beforeEach(() => {
    i18n.changeLanguage('pt');
  });

  it('1. estado sem integrantes', () => {
    const onReview = vi.fn();
    render(<TeamSetupProgressCard summary={createSummary()} onReview={onReview} />);
    expect(screen.getByText(pt.teamSetup.progress.emptyTitle)).toBeDefined();
    expect(screen.getByText(pt.teamSetup.progress.emptyDescription)).toBeDefined();
    expect(screen.getByText(pt.teamSetup.progress.noMembers)).toBeDefined();
  });

  it('2. estado incompleto', () => {
    const onReview = vi.fn();
    const summary = createSummary({
      additionalMembers: 2,
      configuredMembers: 1,
      membersWithAccessProfile: 1,
      membersWithMinistryFunctions: 2
    });
    render(<TeamSetupProgressCard summary={summary} onReview={onReview} />);
    expect(screen.getByText(pt.teamSetup.progress.incompleteTitle)).toBeDefined();
    
    // Test count interpolation
    const accessText = pt.teamSetup.progress.missingAccess_one;
    const resolvedText = accessText.replace('{{count}}', '1');
    expect(screen.getByText(new RegExp(resolvedText))).toBeDefined();
  });

  it('3. estado completamente configurado', () => {
    const onReview = vi.fn();
    const summary = createSummary({
      additionalMembers: 2,
      configuredMembers: 2,
      membersWithAccessProfile: 2,
      membersWithMinistryFunctions: 2
    });
    render(<TeamSetupProgressCard summary={summary} onReview={onReview} />);
    expect(screen.getByText(pt.teamSetup.progress.completeTitle)).toBeDefined();
    expect(screen.getByText(pt.teamSetup.progress.completeDescription)).toBeDefined();
  });

  it('4. contagem singular em português', () => {
    const onReview = vi.fn();
    const summary = createSummary({
      additionalMembers: 1,
      configuredMembers: 0,
      membersWithAccessProfile: 0,
      membersWithMinistryFunctions: 0
    });
    render(<TeamSetupProgressCard summary={summary} onReview={onReview} />);
    const expected = pt.teamSetup.progress.missingAccess_one.replace('{{count}}', '1');
    expect(screen.getByText(new RegExp(expected))).toBeDefined();
  });

  it('5. contagem plural em português', () => {
    const onReview = vi.fn();
    const summary = createSummary({
      additionalMembers: 2,
      configuredMembers: 0,
      membersWithAccessProfile: 0,
      membersWithMinistryFunctions: 0
    });
    render(<TeamSetupProgressCard summary={summary} onReview={onReview} />);
    const expected = pt.teamSetup.progress.missingAccess_other.replace('{{count}}', '2');
    expect(screen.getByText(new RegExp(expected))).toBeDefined();
  });

  it('6. pessoa sem acesso e sem função aparece nas duas métricas', () => {
    const onReview = vi.fn();
    const summary = createSummary({
      additionalMembers: 1,
      configuredMembers: 0,
      membersWithAccessProfile: 0,
      membersWithMinistryFunctions: 0
    });
    render(<TeamSetupProgressCard summary={summary} onReview={onReview} />);
    
    const missingAccessText = pt.teamSetup.progress.missingAccess_one.replace('{{count}}', '1');
    const missingFuncText = pt.teamSetup.progress.missingFunctions_one.replace('{{count}}', '1');
    
    expect(screen.getByText(new RegExp(missingAccessText))).toBeDefined();
    expect(screen.getByText(new RegExp(missingFuncText))).toBeDefined();
  });

  it('7. não aparece porcentagem', () => {
    const onReview = vi.fn();
    const summary = createSummary({ additionalMembers: 2, configuredMembers: 1 });
    const { container } = render(<TeamSetupProgressCard summary={summary} onReview={onReview} />);
    expect(container.textContent).not.toMatch(/%/);
  });

  it('8. não aparece progressbar', () => {
    const onReview = vi.fn();
    const summary = createSummary({ additionalMembers: 2, configuredMembers: 1 });
    render(<TeamSetupProgressCard summary={summary} onReview={onReview} />);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('9. botão chama onReview uma vez', () => {
    const onReview = vi.fn();
    render(<TeamSetupProgressCard summary={createSummary()} onReview={onReview} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it('10. botão é acessível por teclado', () => {
    const onReview = vi.fn();
    render(<TeamSetupProgressCard summary={createSummary()} onReview={onReview} />);
    const button = screen.getByRole('button');
    button.focus();
    expect(button).toHaveFocus();
  });

  it('11. PT resolve as chaves', () => {
    const onReview = vi.fn();
    render(<TeamSetupProgressCard summary={createSummary()} onReview={onReview} />);
    expect(screen.getByText(pt.teamSetup.progress.emptyTitle)).toBeDefined();
  });

  it('12. EN resolve as chaves', () => {
    i18n.changeLanguage('en');
    const onReview = vi.fn();
    render(<TeamSetupProgressCard summary={createSummary()} onReview={onReview} />);
    expect(screen.getByText(en.teamSetup.progress.emptyTitle)).toBeDefined();
  });

  it('13. ES resolve as chaves', () => {
    i18n.changeLanguage('es');
    const onReview = vi.fn();
    render(<TeamSetupProgressCard summary={createSummary()} onReview={onReview} />);
    expect(screen.getByText(es.teamSetup.progress.emptyTitle)).toBeDefined();
  });

  it('14. nenhuma chave retorna seu próprio caminho', () => {
    const onReview = vi.fn();
    const summary = createSummary({ additionalMembers: 1 });
    const { container } = render(<TeamSetupProgressCard summary={summary} onReview={onReview} />);
    expect(container.textContent).not.toMatch(/teamSetup\.progress\./);
  });

  it('15. estruturas de teamSetup.progress são idênticas nos três idiomas', () => {
    const ptKeys = Object.keys(pt.teamSetup.progress).sort();
    const enKeys = Object.keys(en.teamSetup.progress).sort();
    const esKeys = Object.keys(es.teamSetup.progress).sort();
    expect(ptKeys).toEqual(enKeys);
    expect(ptKeys).toEqual(esKeys);
  });

  it('16. título está ligado ao cartão por aria-labelledby', () => {
    const onReview = vi.fn();
    render(<TeamSetupProgressCard summary={createSummary()} onReview={onReview} />);
    const card = screen.getByLabelText(pt.teamSetup.progress.emptyTitle);
    expect(card).toBeDefined();
  });

  it('17. métricas são renderizadas em lista semântica', () => {
    const onReview = vi.fn();
    const summary = createSummary({ additionalMembers: 1 });
    render(<TeamSetupProgressCard summary={summary} onReview={onReview} />);
    expect(screen.getByRole('list')).toBeDefined();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
  });
});
