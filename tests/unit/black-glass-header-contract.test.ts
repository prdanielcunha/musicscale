import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const header = fs.readFileSync('components/layout/Header.tsx', 'utf8');
const chrome = fs.readFileSync('premium-v2-completion.css', 'utf8');
const dashboard = fs.readFileSync('components/dashboard/premium-music-dashboard.css', 'utf8');

describe('Subtle black glass header', () => {
  it('has one dark, translucent and softly blurred header on mobile', () => {
    expect(chrome).toMatch(/\.ms-v3-header\s*\{[^}]*background:\s*rgba\(6, 7, 10, 0\.76\)/s);
    expect(chrome).toMatch(/\.ms-v3-header\s*\{[^}]*-webkit-backdrop-filter:\s*blur\(14px\)/s);
    expect(chrome).toMatch(/\.ms-v3-header\s*\{[^}]*backdrop-filter:\s*blur\(14px\)/s);
    expect(chrome).toContain('.ms-v3-header.is-scrolled');
  });

  it('preserves the continuous canvas on Dashboard without color or glow rim', () => {
    expect(dashboard).toContain('.ms-app-shell:has(.ms-premium-dashboard) .ms-v3-header');
    expect(dashboard).toContain('background-color: rgba(6, 7, 10, 0.76)');
    expect(header).not.toContain('bg-gradient-to-r from-transparent via-white');
    expect(header).not.toContain('border-b border-white');
    expect(header).not.toContain('md:backdrop-blur-[32px]');
  });

  it('retains header navigation, organizations and notifications', () => {
    expect(header).toContain('<OrganizationSelector />');
    expect(header).toContain('<NotificationBell />');
    expect(header).toContain('onClick={onMenuClick}');
  });
});
