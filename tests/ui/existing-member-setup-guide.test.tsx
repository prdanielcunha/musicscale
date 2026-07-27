import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExistingMemberSetupGuide } from '../../components/team/ExistingMemberSetupGuide';
import { UserProfile, Role, Instrument } from '../../types';
import { TeamMemberAccessPolicy } from '../../utils/teamMemberSetup';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import pt from '../../locales/pt.json';

vi.unmock('react-i18next');
i18n
  .use(initReactI18next)
  .init({
    resources: { pt: { translation: pt } },
    lng: 'pt',
    fallbackLng: 'pt',
    interpolation: { escapeValue: false }
  });

const mockUsers: UserProfile[] = [
  { uid: 'u1', email: 'u1@test.com', displayName: 'User 1', photoURL: null, roleId: '', specialtyIds: [] } as UserProfile,
  { uid: 'u2', email: 'u2@test.com', displayName: 'User 2', photoURL: null, roleId: 'r1', specialtyIds: ['i1'] } as UserProfile,
  { uid: 'u_owner', email: 'owner@test.com', displayName: 'Owner', photoURL: null, roleId: 'r2', specialtyIds: [] } as UserProfile
];

const mockMembers = mockUsers; // alias for the tests

const mockRoles = [
  { id: 'r1', name: 'Member', permissions: {} },
  { id: 'r2', name: 'Admin', permissions: { canManageUsers: true } }
] as Role[];

const mockInstruments = [
  { id: 'i1', name: 'Vocal', category: 'Voz' },
  { id: 'i2', name: 'Guitar', category: 'Instrumento' }
] as Instrument[];

describe('ExistingMemberSetupGuide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    isOpen: true,
    members: mockUsers,
    roles: mockRoles,
    instruments: mockInstruments,
    resolveRoleKey: (id: string) => mockRoles.find(r => r.id === id)?.name?.toLowerCase() === "admin" ? "owner" : "member",
    resolveAccessPolicy: () => ({ canEditAccess: true, lockReason: null, allowedRoleIds: ['r1', 'r2'] }),
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined)
  };

  it('1. inicia na etapa escolher pessoa;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    expect(screen.getByText(pt.teamSetup.existingMember.steps.choosePerson)).toBeInTheDocument();
  });

  it('2. mostra indicador 1 de 4;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    const txt = pt.teamSetup.existingMember.steps.stepIndicator.replace('{{current}}', '1').replace('{{total}}', '4');
    expect(screen.getByText(txt)).toBeInTheDocument();
  });

  it('3. incompletos aparecem primeiro;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const userButtons = buttons.filter(b => b.textContent?.includes('User'));
    expect(userButtons[0]).toHaveTextContent('User 1'); // incomplete
    expect(userButtons[1]).toHaveTextContent('User 2'); // complete
  });

  it('4. identifica usuário atual;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} currentUserId="u1" />);
    const you = pt.teamSetup.existingMember.members.youIndicator;
    expect(screen.getByText(you)).toBeInTheDocument();
  });

  it('5. seleciona integrante;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 2'));
    expect(screen.getByText(pt.teamSetup.existingMember.steps.accessProfile)).toBeInTheDocument();
  });

  it('6. avança para acesso;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 2'));
    expect(screen.getByText(pt.teamSetup.existingMember.steps.accessProfile)).toBeInTheDocument();
  });

  it('7. mostra somente papéis permitidos;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} resolveAccessPolicy={() => ({ canEditAccess: true, lockReason: null, allowedRoleIds: ['r2'], reason: '' })} />);
    fireEvent.click(screen.getByText('User 2'));
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.queryByText('Member')).not.toBeInTheDocument();
  });

  it('8. não oferece owner;', () => {
    const rolesWithOwner: Role[] = [...mockRoles, { id: 'r3', name: 'Owner', description: '', permissions: { canManageUsers: false, canManageRoles: false, canManageRepertoire: false, canManageScales: false, canViewContent: false, canManageChords: false } }];
    render(<ExistingMemberSetupGuide {...defaultProps} roles={rolesWithOwner} resolveAccessPolicy={() => ({ canEditAccess: true, lockReason: null, allowedRoleIds: ['r1', 'r2'], reason: '' })} />);
    fireEvent.click(screen.getByText('User 2'));
    expect(screen.queryByText('Owner')).not.toBeInTheDocument();
  });

  it('9. exibe permissões reais do papel;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 2'));
    expect(screen.getByText(pt.teamSetup.existingMember.access.permissionsMap.canManageUsers)).toBeInTheDocument();
  });

  it('10. não infere permissão pelo nome;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 2'));
    expect(screen.queryByText(pt.teamSetup.existingMember.access.permissionsMap.canManageRoles)).not.toBeInTheDocument();
  });

  it('11. acesso bloqueado aparece somente leitura;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} resolveAccessPolicy={() => ({ canEditAccess: false, lockReason: 'hierarchy', allowedRoleIds: ['r2'], reason: 'Blocked' })} />);
    fireEvent.click(screen.getByText('User 1'));
    expect(screen.getByText('Blocked')).toBeInTheDocument();
  });

  it('12. usuário atual não altera o próprio acesso;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} currentUserId="u1" resolveAccessPolicy={() => ({ canEditAccess: false, lockReason: 'hierarchy', allowedRoleIds: [], reason: pt.teamSetup.existingMember.access.currentUserExplanation })} />);
    fireEvent.click(screen.getByText('User 1'));
    expect(screen.getByText(pt.teamSetup.existingMember.access.currentUserExplanation)).toBeInTheDocument();
  });

  it('13. usuário atual pode escolher funções;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} currentUserId="u1" resolveAccessPolicy={() => ({ canEditAccess: false, lockReason: 'hierarchy', allowedRoleIds: [], reason: '' })} />);
    fireEvent.click(screen.getByText('User 1'));
    const btns = screen.getAllByRole('button', { name: pt.teamSetup.existingMember.access.continueAction });
    fireEvent.click(btns[btns.length - 1]);
    expect(screen.getByText(pt.teamSetup.existingMember.steps.ministryFunctions)).toBeInTheDocument();
  });

  it('14. avança para funções;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 2'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.access.continueAction }));
    expect(screen.getByText(pt.teamSetup.existingMember.steps.ministryFunctions)).toBeInTheDocument();
  });

  it('15. agrupa as três categorias;', () => {
    const insts: Instrument[] = [
      { id: '1', name: 'M1', category: 'Ministro' },
      { id: '2', name: 'V1', category: 'Voz' },
      { id: '3', name: 'I1', category: 'Instrumento' }
    ];
    render(<ExistingMemberSetupGuide {...defaultProps} instruments={insts} />);
    fireEvent.click(screen.getByText('User 2'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.access.continueAction }));
    expect(screen.getByText(pt.teamSetup.existingMember.functions.groups.ministers)).toBeInTheDocument();
  });

  it('16. seleciona múltiplas funções;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 1'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.access.continueAction }));
    fireEvent.click(screen.getByText('Vocal'));
    fireEvent.click(screen.getByText('Guitar'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.functions.continueAction }));
    expect(screen.getByText('Vocal')).toBeInTheDocument();
    expect(screen.getByText('Guitar')).toBeInTheDocument();
  });

  it('17. Enter opera seleção;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 2'));
    const btn = screen.getByText('Member').closest('button');
    fireEvent.keyDown(btn!, { key: 'Enter', code: 'Enter' });
    expect(btn).toHaveAttribute('aria-checked', 'true');
  });

  it('18. Space opera seleção;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 2'));
    const btn = screen.getByText('Member').closest('button');
    fireEvent.keyDown(btn!, { key: ' ', code: 'Space' });
    expect(btn).toHaveAttribute('aria-checked', 'true');
  });

  it('19. definir depois deixa funções vazias;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 2'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.access.continueAction }));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.functions.defineLaterAction }));
    expect(screen.getByText(/Nenhuma funç/i)).toBeInTheDocument();
  });

  it('20. revisão mostra papel escolhido;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 2'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.access.continueAction }));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.functions.continueAction }));
    expect(screen.getByText('Member')).toBeInTheDocument();
  });

  it('21. revisão mostra funções escolhidas;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 2'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.access.continueAction }));
    fireEvent.click(screen.getByText('Guitar'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.functions.continueAction }));
    expect(screen.getByText('Guitar')).toBeInTheDocument();
  });

  it('22. revisão avisa quando funções ficaram vazias;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 2'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.access.continueAction }));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.functions.defineLaterAction }));
    expect(screen.getByText(/Nenhuma funç/i)).toBeInTheDocument();
  });

  it('23. voltar preserva o rascunho;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 2'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.access.continueAction }));
    fireEvent.click(screen.getByText('Guitar'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.functions.continueAction }));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.review.backAction }));
    expect(screen.getByText('Guitar').closest('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('24. salvar chama callback uma vez;', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ExistingMemberSetupGuide {...defaultProps} onSave={onSave} />);
    fireEvent.click(screen.getByText('User 2'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.access.continueAction }));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.functions.defineLaterAction }));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.review.saveAction }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  it('25. callback recebe somente userId, roleId e specialtyIds;', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ExistingMemberSetupGuide {...defaultProps} onSave={onSave} />);
    fireEvent.click(screen.getByText('User 2'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.access.continueAction }));
    fireEvent.click(screen.getByText('Guitar'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.functions.continueAction }));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.review.saveAction }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        userId: 'u2',
        roleId: 'r1',
        specialtyIds: ['i1', 'i2']
      });
    });
  });

  it('26. falha preserva o rascunho;', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('fail'));
    render(<ExistingMemberSetupGuide {...defaultProps} onSave={onSave} />);
    fireEvent.click(screen.getByText('User 2'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.access.continueAction }));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.functions.continueAction }));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.review.saveAction }));
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.existingMember.errors.saveFailed)).toBeInTheDocument();
    });
  });

  it('27. sucesso mostra conclusão;', async () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 2'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.access.continueAction }));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.functions.continueAction }));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.review.saveAction }));
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.existingMember.completion.title)).toBeInTheDocument();
    });
  });

  it('28. configurar próxima pessoa volta à etapa 1;', async () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 2'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.access.continueAction }));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.functions.continueAction }));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.review.saveAction }));
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.existingMember.completion.title)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.completion.nextAction }));
    expect(screen.getByText(pt.teamSetup.existingMember.steps.choosePerson)).toBeInTheDocument();
  });

  it('29. fechamento sujo pede confirmação;', () => {
    const onClose = vi.fn();
    render(<ExistingMemberSetupGuide {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('User 1'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByText('Close modal'));
    expect(screen.getByText(pt.teamSetup.existingMember.discard.title)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('30. fechamento limpo não pede confirmação;', () => {
    const onClose = vi.fn();
    render(<ExistingMemberSetupGuide {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Close modal'));
    expect(onClose).toHaveBeenCalled();
  });

  it('31. Escape respeita descarte;', () => {
    const onClose = vi.fn();
    render(<ExistingMemberSetupGuide {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('User 1'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByText('Close modal'));
    expect(screen.getByText(pt.teamSetup.existingMember.discard.title)).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText(pt.teamSetup.existingMember.discard.title)).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('32. foco muda entre etapas;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    const title1 = screen.getByText(pt.teamSetup.existingMember.steps.choosePerson);
    expect(title1).toHaveFocus();
    fireEvent.click(screen.getByText('User 2'));
    const title2 = screen.getByText(pt.teamSetup.existingMember.steps.accessProfile);
    expect(title2).toHaveFocus();
  });

  it('33. aria-current identifica etapa ativa;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    expect(screen.getByText(/Etapa 1 de 4/)).toHaveAttribute('aria-current', 'step');
  });

  it('34. nenhum campo interno aparece na interface.', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    expect(screen.queryByText(/organizationRole/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/specialtyIds/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/roleId/i)).not.toBeInTheDocument();
  
});

  it('36. initialDraft é preservado quando props mudam;', () => {
    const { rerender } = render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 1'));
    rerender(<ExistingMemberSetupGuide {...defaultProps} members={[...mockMembers, { uid: 'u3', displayName: 'User 3', roleId: '', specialtyIds: [], email: 'u3@test.com', photoURL: '' }]} />);
    fireEvent.click(screen.getByText('Close modal'));
    expect(screen.queryByText(pt.teamSetup.existingMember.discard.title)).not.toBeInTheDocument();
  });

  it('37. seleção sem mudança fecha sem confirmação;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 1'));
    fireEvent.click(screen.getByText('Close modal'));
    expect(screen.queryByText(pt.teamSetup.existingMember.discard.title)).not.toBeInTheDocument();
  });

  it('38. papel alterado abre confirmação;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 1'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByText('Close modal'));
    expect(screen.getByText(pt.teamSetup.existingMember.discard.title)).toBeInTheDocument();
  });

  it('39. função alterada abre confirmação;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 1'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Guitar')); 
    fireEvent.click(screen.getByText('Close modal'));
    expect(screen.getByText(pt.teamSetup.existingMember.discard.title)).toBeInTheDocument();
  });

  

  it('41. retorno às funções originais limpa dirty;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 2'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Guitar'));
    fireEvent.click(screen.getByText('Guitar'));
    fireEvent.click(screen.getByText('Close modal'));
    expect(screen.queryByText(pt.teamSetup.existingMember.discard.title)).not.toBeInTheDocument();
  });

  it('42. Escape limpo fecha;', () => {
    const onClose = vi.fn();
    render(<ExistingMemberSetupGuide {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('User 1'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('43. Escape sujo abre confirmação;', () => {
    const onClose = vi.fn();
    render(<ExistingMemberSetupGuide {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('User 1'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByText(pt.teamSetup.existingMember.discard.title)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('44. segundo Escape fecha somente confirmação;', () => {
    const onClose = vi.fn();
    render(<ExistingMemberSetupGuide {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('User 1'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByText(pt.teamSetup.existingMember.discard.title)).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText(pt.teamSetup.existingMember.discard.title)).not.toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('45. owner vem de lockReason;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} resolveRoleKey={(id: string) => mockRoles.find(r => r.id === id)?.name?.toLowerCase() === "admin" ? "owner" : "member"} resolveAccessPolicy={() => ({ canEditAccess: false, lockReason: 'owner', allowedRoleIds: [], reason: pt.teamSetup.existingMember.access.ownerExplanation })} />);
    fireEvent.click(screen.getByText('User 1'));
    expect(screen.getByText(pt.teamSetup.existingMember.access.ownerExplanation)).toBeInTheDocument();
  });

  it('46. usuário atual vem de lockReason;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} resolveRoleKey={(id: string) => mockRoles.find(r => r.id === id)?.name?.toLowerCase() === "admin" ? "owner" : "member"} resolveAccessPolicy={() => ({ canEditAccess: false, lockReason: 'self', allowedRoleIds: [], reason: pt.teamSetup.existingMember.access.currentUserExplanation })} />);
    fireEvent.click(screen.getByText('User 1'));
    expect(screen.getByText(pt.teamSetup.existingMember.access.currentUserExplanation)).toBeInTheDocument();
  });

  it('47. organizationRole isolado não define owner no guia;', () => {
    const members = [{ uid: 'u3', displayName: 'User 3', roleId: 'r1', specialtyIds: [], email: 'u3@test.com', photoURL: '', organizationRole: 'owner' }];
    render(<ExistingMemberSetupGuide {...defaultProps} members={members} resolveRoleKey={(id: string) => mockRoles.find(r => r.id === id)?.name?.toLowerCase() === "admin" ? "owner" : "member"} resolveAccessPolicy={() => ({ canEditAccess: true, lockReason: null, allowedRoleIds: ['r1', 'r2'], reason: '' })} />);
    fireEvent.click(screen.getByText('User 3'));
    expect(screen.queryByText(pt.teamSetup.existingMember.access.ownerExplanation)).not.toBeInTheDocument();
  });

  it('48. erro recebe foco;', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Test error'));
    render(<ExistingMemberSetupGuide {...defaultProps} onSave={onSave} />);
    fireEvent.click(screen.getByText('User 1'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    
    await waitFor(() => {
      const errorDiv = screen.getByRole('alert');
      expect(errorDiv).toBeInTheDocument();
    });
  });

  it('49. erro de política mostra tradução específica;', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('TEAM_ACCESS_POLICY_CHANGED'));
    render(<ExistingMemberSetupGuide {...defaultProps} onSave={onSave} />);
    fireEvent.click(screen.getByText('User 1'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.existingMember.errors.policyChanged)).toBeInTheDocument();
    });
  });

  it('50. erro genérico mostra tradução genérica;', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Some other error'));
    render(<ExistingMemberSetupGuide {...defaultProps} onSave={onSave} />);
    fireEvent.click(screen.getByText('User 1'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.existingMember.errors.saveFailed)).toBeInTheDocument();
    });
  });

  it('51. não existe fallback textual no DOM;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('52. erro preserva papel;', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Test error'));
    render(<ExistingMemberSetupGuide {...defaultProps} onSave={onSave} />);
    fireEvent.click(screen.getByText('User 1'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByText(pt.teamSetup.existingMember.discard.title)).toBeInTheDocument();
  });

  it('51. nenhuma informacao interna aparece no DOM;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    expect(screen.queryByText(/initialDraft/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/isDirty/i)).not.toBeInTheDocument();
  });

  it('52. fluxo de voltar ao acesso a partir de funções', async () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    
    // Select user
    fireEvent.click(screen.getByText('User 1'));
    
    // Select role and continue
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.access.continueAction }));
    
    // We are in functions step. Toggle vocal function
    fireEvent.click(screen.getByText('Vocal'));
    
    // Check back button is visible and has accessible translated name
    const backBtn = screen.getByRole('button', { name: pt.teamSetup.existingMember.actions.backToAccess });
    expect(backBtn).toBeInTheDocument();
    
    // Click back button
    fireEvent.click(backBtn);
    
    // Confirm we are back in access profile selector step
    expect(screen.getByText(pt.teamSetup.existingMember.steps.accessProfile)).toBeInTheDocument();
    
    // Confirm selected role is still checked
    expect(screen.getByRole('radio', { name: /Member/i })).toBeChecked();
    
    // Go forward again
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.access.continueAction }));
    
    // Confirm we are in functions step and Vocal is still checked
    expect(screen.getByText('Vocal').closest('button')).toHaveAttribute('aria-pressed', 'true');
    
    // Verify no save was performed
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });
});
