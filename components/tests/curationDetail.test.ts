// @ts-ignore
import { describe, it, expect } from 'vitest';
import { parseChordsAndLyrics } from '../songs/ChordsRenderer';

describe('ChordsRenderer utility: parseChordsAndLyrics', () => {
    it('deve formatar conteúdo com cifras e separar em seções', () => {
        const text = `[Intro]
C  G/B  Am  F

[Verso]
C
Aqui estou
G/B
Na tua presença`;

        const parsed = parseChordsAndLyrics(text);
        
        expect(parsed).toEqual(
            expect.arrayContaining([
                { type: 'section', content: '[Intro]' },
                { type: 'chord', content: 'C  G/B  Am  F' },
                { type: 'section', content: '[Verso]' },
                { type: 'chord', content: 'C' },
                { type: 'lyric', content: 'Aqui estou' },
                { type: 'chord', content: 'G/B' },
                { type: 'lyric', content: 'Na tua presença' }
            ])
        );
    });

    it('deve retornar array vazio se não houver conteúdo válido', () => {
        expect(parseChordsAndLyrics('')).toEqual([]);
        expect(parseChordsAndLyrics(null as any)).toEqual([]);
    });

    it('deve interpretar conteúdo longo sem falhar e categorizar cifras corretamente', () => {
        const longText = Array.from({ length: 100 }, (_, i) => `[Refrão]\nC G\nAleluia ${i}`).join('\n');
        const parsed = parseChordsAndLyrics(longText);

        expect(parsed.length).toBeGreaterThan(0);
        expect(parsed[0].type).toBe('section');
        expect(parsed[1].type).toBe('chord');
        expect(parsed[2].type).toBe('lyric');
    });
});

describe('Candidate Modal View Models', () => {
    it('tradução de reason', () => {
        const translateReason = (reason: string) => {
            const dictionary: Record<string, string> = {
                'exact_title_artist': 'Título e artista idênticos',
                'high_similarity': 'Alta similaridade pelo nome',
                'manual_link': 'Vinculado manualmente',
                'needs_review': 'Revisão necessária',
                'no_matches': 'Nenhuma correspondência'
            };
            return dictionary[reason] || reason;
        };

        expect(translateReason('exact_title_artist')).toBe('Título e artista idênticos');
        expect(translateReason('unknown_reason')).toBe('unknown_reason');
    });

    it('tradução de warning', () => {
        const translateWarning = (warning: string) => {
            const dictionary: Record<string, string> = {
                'MISSING_TITLE': 'Título ausente',
                'MISSING_ARTIST': 'Artista ausente',
                'TOO_MANY_MATCHES': 'Muitas correspondências'
            };
            return dictionary[warning] || warning;
        };

        expect(translateWarning('MISSING_TITLE')).toBe('Título ausente');
        expect(translateWarning('NEW_WARNING')).toBe('NEW_WARNING');
    });
});
