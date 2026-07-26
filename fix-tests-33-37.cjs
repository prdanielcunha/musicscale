const fs = require('fs');
let c = fs.readFileSync('tests/ui/users-existing-member-setup-integration.test.tsx', 'utf8');

c = c.replace(/it\('33\. alteração da política antes do salvamento impede users.update', async \(\) => \{.*?\}\);/s,
`it('33. alteração da política antes do salvamento impede users.update', async () => {
    mockUsers = [createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
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
  });`);

c = c.replace(/it\('35\. falha preserva o papel escolhido', async \(\) => \{.*?\}\);/s,
`it('35. falha preserva o papel escolhido', async () => {
    mockUsers = [createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
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
    expect(screen.getAllByText('Member').length).toBeGreaterThan(0);
  });`);

c = c.replace(/it\('36\. falha preserva as funções escolhidas', async \(\) => \{.*?\}\);/s,
`it('36. falha preserva as funções escolhidas', async () => {
    mockUsers = [createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
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
    expect(screen.getByText('Vocal')).toBeInTheDocument();
  });`);

c = c.replace(/it\('37\. sucesso mostra toast traduzido', async \(\) => \{.*?\}\);/s,
`it('37. sucesso mostra toast traduzido', async () => {
    mockUsers = [createProfile({ uid: 'u_target', displayName: 'Target', roleId: '', specialtyIds: [] })];
    await renderPage();
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    fireEvent.click(screen.getByText('Target'));
    fireEvent.click(screen.getByRole('radio', { name: /Member/i }));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByText('Salvar configuração'));
    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(pt.teamSetup.existingMember.completion.successToast, 'success');
    });
  });`);

fs.writeFileSync('tests/ui/users-existing-member-setup-integration.test.tsx', c);
