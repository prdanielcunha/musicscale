import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { parseChordsAndLyrics, buildSongSectionNavigatorItems, TechnicalPassage } from '../../components/songs/ChordsRenderer';

const tab = 'E|--0--2--4--|\nB|--0--2--4--|';

describe('optional solo passages', () => {
  it('keeps intro accompaniment and vocals while grouping multipart tablature', () => {
    const parsed = parseChordsAndLyrics(`[Intro]\nE A9 C#m7\nParte 1 de 2\nE\n${tab}\n\nParte 2 de 2\n${tab}\n[Primeira Parte]\nA9\nMe escutas quando clamo`);
    expect(parsed.filter(line => line.type === 'technical')).toHaveLength(1);
    expect(parsed.find(line => line.content === 'E A9 C#m7')?.type).toBe('chord');
    expect(parsed.find(line => line.content === 'Me escutas quando clamo')?.type).toBe('lyric');
    expect(buildSongSectionNavigatorItems(parsed).map(section => section.label)).toEqual(['Intro', 'Primeira Parte']);
  });
  it('collapses explicit solos, but retains instrumental accompaniment', () => {
    const parsed = parseChordsAndLyrics('[Solo]\nAm G F E\n[Instrumental]\nC G Am F\n[Refrão]\nC\nSanto');
    expect(parsed[0]).toEqual({ type: 'technical', content: '[Solo]\nAm G F E' });
    expect(buildSongSectionNavigatorItems(parsed).map(section => section.label)).toEqual(['Instrumental', 'Refrão']);
  });
  it('makes extracted legacy tabs accessible without orphan part labels', () => {
    const parsed = parseChordsAndLyrics('[Intro]\nE A9\nParte 1 de 2\nE\n[Primeira Parte]\nA9\nCantamos', [{ section: 'Intro', content: tab }]);
    expect(parsed.some(line => line.content === 'Parte 1 de 2')).toBe(false);
    expect(parsed.some(line => line.type === 'technical' && line.content.includes(tab))).toBe(true);
    expect(parsed.some(line => line.type === 'technical' && line.content.includes('Parte 1 de 2'))).toBe(true);
    expect(parsed.some(line => line.content === 'E A9')).toBe(true);
  });
  it('never removes numbered vocal sections because the song also has tabs', () => {
    const parsed = parseChordsAndLyrics('[Parte 1]\nC G\nCantamos juntos', [{ section: 'Solo', content: tab }]);
    expect(parsed[0]).toEqual({ type: 'section', content: '[Parte 1]' });
    expect(parsed.some(line => line.content === 'Cantamos juntos')).toBe(true);
  });
  it('collapses legacy duplicate chord helpers but retains the sung verse', () => {
    const parsed = parseChordsAndLyrics('[Primeira Parte]\nA9\n[Primeira Parte]\nE\nMe escutas', [{ section: 'Intro', content: tab }]);
    expect(buildSongSectionNavigatorItems(parsed).map(section => section.label)).toEqual(['Primeira Parte']);
    expect(parsed.some(line => line.type === 'technical' && line.content.includes('A9'))).toBe(true);
    expect(parsed.some(line => line.content === 'Me escutas')).toBe(true);
  });
  it('starts closed and supports opening and closing via the native control', () => {
    const { container } = render(<TechnicalPassage content={tab} color="#60a5fa" />);
    const details = container.querySelector('details')!;
    expect(details.open).toBe(false);
    fireEvent.click(screen.getByText('technicalParts.view_solo'));
    expect(details.open).toBe(true);
    fireEvent.click(screen.getByText('technicalParts.view_solo'));
    expect(details.open).toBe(false);
  });
});
