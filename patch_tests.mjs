import fs from 'fs';
let content = fs.readFileSync('tests/ui/global-create-action.test.tsx', 'utf8');

const replacement = `describe('BottomNav Links Preserved', () => {
  it('24 & 25. os cinco links da BottomNav continuam presentes e na ordem correta, e trigger mobile tem texto Criar', () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
    render(<MemoryRouter><BottomNav /></MemoryRouter>);
    
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(5);
    expect(links[0]).toHaveAttribute('href', '/');
    expect(links[1]).toHaveAttribute('href', '/songs');
    expect(links[2]).toHaveAttribute('href', '/scales');
    expect(links[3]).toHaveAttribute('href', '/library');
    expect(links[4]).toHaveAttribute('href', '/profile');
    
    // Check if the create action trigger is rendered and has correct text
    const trigger = screen.getByRole('button', { name: 'Criar' });
    expect(trigger).toBeInTheDocument();
    expect(trigger.textContent).toContain('Criar');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-controls', 'global-create-dialog');
    
    // Ensure the trigger is NOT inside a link
    expect(trigger.closest('a')).toBeNull();
    
    // Verify icons inside trigger - SVG
    const svgIcon = trigger.querySelector('svg');
    expect(svgIcon).toBeInTheDocument();
  });
});`;

content = content.replace(
  /describe\('BottomNav Links Preserved'[\s\S]*\}\);\n\}\);/,
  replacement
);

fs.writeFileSync('tests/ui/global-create-action.test.tsx', content);
