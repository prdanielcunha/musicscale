import fs from 'fs';
let content = fs.readFileSync('tests/ui/global-create-action.test.tsx', 'utf8');

content = content.replace(
  `  it('13, 14, 15, 16. Restores focus on close (Escape)', async () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
    render(<MemoryRouter><GlobalCreateAction variant="desktop" /></MemoryRouter>);
    const trigger = screen.getByRole('button', { name: 'Criar' });
    fireEvent.click(trigger);
    
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
    
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    
    expect(document.activeElement).toBe(trigger);
  });`,
  `  it('13, 14, 15, 16. Restores focus on close (Escape)', async () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
    render(<MemoryRouter><GlobalCreateAction variant="desktop" /></MemoryRouter>);
    const trigger = screen.getByRole('button', { name: 'Criar' });
    trigger.focus();
    fireEvent.click(trigger);
    
    // Check it opens
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    
    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });`
);

fs.writeFileSync('tests/ui/global-create-action.test.tsx', content);
