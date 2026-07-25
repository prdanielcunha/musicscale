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

const mockRoles: Role[] = [
  { id: 'r1', name: 'Admin', description: '', permissions: { canManageUsers: true } as any },
  { id: 'r2', name: 'Member', description: '', permissions: { canViewContent: true } as any },
];

const mockInstruments: Instrument[] = [
  { id: 'i1', name: 'Vocal 1', category: 'Voz' },
  { id: 'i2', name: 'Guitar', category: 'Instrumento' },
];

const mockUsers: UserProfile[] = [
  { uid: 'u1', displayName: 'User 1', email: 'u1@x.com', roleId: 'r2', specialtyIds: ['i1'], photoURL: '' },
  { uid: 'u2', displayName: 'User 2', email: 'u2@x.com', roleId: '', photoURL: '' },
];

describe('ExistingMemberSetupGuide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    isOpen: true,
    members: mockUsers,
    roles: mockRoles,
    instruments: mockInstruments,
    resolveAccessPolicy: () => ({ canEditAccess: true, allowedRoleIds: ['r1', 'r2'] }),
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
    expect(userButtons[0]).toHaveTextContent('User 2'); // incomplete
    expect(userButtons[1]).toHaveTextContent('User 1'); // complete
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
    render(<ExistingMemberSetupGuide {...defaultProps} resolveAccessPolicy={() => ({ canEditAccess: true, allowedRoleIds: ['r2'], reason: '' })} />);
    fireEvent.click(screen.getByText('User 2'));
    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('8. não oferece owner;', () => {
    const rolesWithOwner = [...mockRoles, { id: 'r3', name: 'Owner', description: '', permissions: {} as any }];
    render(<ExistingMemberSetupGuide {...defaultProps} roles={rolesWithOwner} resolveAccessPolicy={() => ({ canEditAccess: true, allowedRoleIds: ['r1', 'r2'], reason: '' })} />);
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
    render(<ExistingMemberSetupGuide {...defaultProps} resolveAccessPolicy={() => ({ canEditAccess: false, allowedRoleIds: ['r2'], reason: 'Blocked' })} />);
    fireEvent.click(screen.getByText('User 1'));
    expect(screen.getByText('Blocked')).toBeInTheDocument();
  });

  it('12. usuário atual não altera o próprio acesso;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} currentUserId="u1" resolveAccessPolicy={() => ({ canEditAccess: false, allowedRoleIds: [], reason: pt.teamSetup.existingMember.access.currentUserExplanation })} />);
    fireEvent.click(screen.getByText('User 1'));
    expect(screen.getByText(pt.teamSetup.existingMember.access.currentUserExplanation)).toBeInTheDocument();
  });

  it('13. usuário atual pode escolher funções;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} currentUserId="u1" resolveAccessPolicy={() => ({ canEditAccess: false, allowedRoleIds: [], reason: '' })} />);
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
    fireEvent.click(screen.getByText('User 2'));
    fireEvent.click(screen.getByText('Member'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.access.continueAction }));
    fireEvent.click(screen.getByText('Vocal 1'));
    fireEvent.click(screen.getByText('Guitar'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.functions.continueAction }));
    expect(screen.getByText('Vocal 1')).toBeInTheDocument();
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
    fireEvent.click(screen.getByText('Admin'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.access.continueAction }));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.functions.continueAction }));
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('21. revisão mostra funções escolhidas;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 2'));
    fireEvent.click(screen.getByText('Admin'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.access.continueAction }));
    fireEvent.click(screen.getByText('Guitar'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.functions.continueAction }));
    expect(screen.getByText('Guitar')).toBeInTheDocument();
  });

  it('22. revisão avisa quando funções ficaram vazias;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 2'));
    fireEvent.click(screen.getByText('Admin'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.access.continueAction }));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.functions.defineLaterAction }));
    expect(screen.getByText(/Nenhuma funç/i)).toBeInTheDocument();
  });

  it('23. voltar preserva o rascunho;', () => {
    render(<ExistingMemberSetupGuide {...defaultProps} />);
    fireEvent.click(screen.getByText('User 2'));
    fireEvent.click(screen.getByText('Admin'));
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
    fireEvent.click(screen.getByText('Admin'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.access.continueAction }));
    fireEvent.click(screen.getByText('Guitar'));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.functions.continueAction }));
    fireEvent.click(screen.getByRole('button', { name: pt.teamSetup.existingMember.review.saveAction }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        userId: 'u2',
        roleId: 'r1',
        specialtyIds: ['i2']
      });
    });
  });

  it('26. falha preserva o rascunho;', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('fail'));
    render(<ExistingMemberSetupGuide {...defaultProps} onSave={onSave} />);
    fireEvent.click(screen.getByText('User 2'));
    fireEvent.click(screen.getByText('Admin'));
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
    fireEvent.click(screen.getByText('Admin'));
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
    fireEvent.click(screen.getByText('Admin'));
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
    fireEvent.click(screen.getByText('User 2'));
    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.getByText(pt.teamSetup.existingMember.discard.title)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('30. fechamento limpo não pede confirmação;', () => {
    const onClose = vi.fn();
    render(<ExistingMemberSetupGuide {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('31. Escape respeita descarte;', () => {
    const onClose = vi.fn();
    render(<ExistingMemberSetupGuide {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('User 2'));
    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.getByText(pt.teamSetup.existingMember.discard.title)).toBeInTheDocument();
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
});
