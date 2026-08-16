import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server';
import { areKeysEnharmonicallyEquivalent } from '../../utils/chordEngine';

vi.hoisted(() => {
  process.env.VERCEL = 'true';
  process.env.GEMINI_API_KEY = 'test-gemini-key';
});

// Create a state object that we can mutate in tests
const geminiMockState = vi.hoisted(() => ({
  text: JSON.stringify({
    capitalizedTitle: "Test Song",
    capitalizedArtist: "Test Artist",
    originalKey: "F#",
    cleanChords: "[Intro] F#  C#/E#  D#m  B",
    cleanLyrics: "Hello world\nAnother line",
    sections: ["Intro"]
  })
}));

// Mock dependencies
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: vi.fn().mockImplementation(() => {
          return Promise.resolve({ text: geminiMockState.text });
        })
      };
    }
  };
});

vi.mock('../../services/server/aiRequestSecurity', async () => {
  const actual = await vi.importActual('../../services/server/aiRequestSecurity') as any;
  return {
    ...actual,
    authorizeAiRequest: vi.fn().mockResolvedValue({
      ok: true,
      context: { uid: 'test-uid' }
    })
  };
});

vi.mock('../../services/firebaseAdmin', async () => {
  const actual = await vi.importActual('../../services/firebaseAdmin') as any;
  return {
    ...actual,
    adminAuth: {
      verifyIdToken: vi.fn().mockResolvedValue({
        uid: 'test-uid',
        email: 'test@example.com'
      })
    },
    adminDb: {
      collection: vi.fn().mockReturnThis(),
      doc: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ role: 'ecosystem_owner', organizationId: 'test-org' })
      })
    }
  };
});

describe('AI Import API Backend Normalization', () => {
  beforeEach(() => {
    // Reset mock state to default for MATCH case
    geminiMockState.text = JSON.stringify({
      capitalizedTitle: "Test Song",
      capitalizedArtist: "Test Artist",
      originalKey: "F#",
      cleanChords: "[Intro] F#  C#/E#  D#m  B",
      cleanLyrics: "Hello world\nAnother line",
      sections: ["Intro"]
    });
  });

  it('should process the request and preserve provenance metadata', async () => {
    const inputText = `Tom: F#\nCapotraste: 2\nForma dos acordes no tom de E\n\n[Intro] E  B/D#  C#m  A`;
    
    const res = await request(app)
      .post('/api/ai-import')
      .set('Authorization', 'Bearer fake-token')
      .send({
        rawText: inputText,
        orgId: 'test-org',
        userId: 'test-uid'
      });
      
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Validate metadata in song
    expect(res.body.song.metadata).toBeDefined();
    expect(res.body.song.metadata.declaredKey).toBe("F#");
    expect(res.body.song.metadata.shapeKey).toBe("E");
    expect(res.body.song.metadata.capo).toBe(2);
    expect(res.body.song.metadata.transpositionSemitones).toBe(2);
    expect(res.body.song.metadata.normalizedToConcertKey).toBe(true);
    expect(res.body.song.metadata.chordContentKey).toBe("F#");
    expect(res.body.song.metadata.chordContentKeyValidationStatus).toBe("MATCH");

    // Validate metadata in result
    expect(res.body.result.metadata).toBeDefined();
    expect(res.body.result.metadata.declaredKey).toBe("F#");
    expect(res.body.result.metadata.shapeKey).toBe("E");
    expect(res.body.result.metadata.capo).toBe(2);
    expect(res.body.result.metadata.transpositionSemitones).toBe(2);
    expect(res.body.result.metadata.normalizedToConcertKey).toBe(true);
    expect(res.body.result.metadata.chordContentKey).toBe("F#");
    expect(res.body.result.metadata.chordContentKeyValidationStatus).toBe("MATCH");

    // Validate keys
    expect(res.body.song.key).toBe("F#");
    expect(res.body.song.originalKey).toBe("F#");
    expect(res.body.song.selectedKey).toBe("F#");
  });

  it('should return error when there is a clear physical chord MISMATCH', async () => {
    geminiMockState.text = JSON.stringify({
      capitalizedTitle: "Test Song",
      capitalizedArtist: "Test Artist",
      originalKey: "F#",
      cleanChords: "[Intro] G  D/F#  Em  C",
      cleanLyrics: "Hello world\nAnother line",
      sections: ["Intro"]
    });

    const inputText = `Tom: F#\nCapotraste: 2\nForma dos acordes no tom de E\n\n[Intro] E  B/D#  C#m  A`;
    
    const res = await request(app)
      .post('/api/ai-import')
      .set('Authorization', 'Bearer fake-token')
      .send({
        rawText: inputText,
        orgId: 'test-org',
        userId: 'test-uid'
      });
      
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.code).toBe("PARSING");
    expect(res.body.details.error).toBe("CHORD_CONTENT_KEY_MISMATCH");
    expect(res.body.details.validationStatus).toBe("MISMATCH");
    expect(res.body.details.expectedKey).toBe("F#");
    // Ensure detected key is enharmonically equivalent to G
    expect(typeof res.body.details.detectedKey).toBe("string");
    expect(areKeysEnharmonicallyEquivalent(res.body.details.detectedKey, 'G')).toBe(true);
    
    expect(res.body.song).toBeUndefined();
  });

  it('should return INDETERMINATE when automatic confirmation is inconclusive', async () => {
    geminiMockState.text = JSON.stringify({
      capitalizedTitle: "Test Song",
      capitalizedArtist: "Test Artist",
      originalKey: "C",
      cleanChords: "[Intro] F  G",
      cleanLyrics: "Hello world\nAnother line",
      sections: ["Intro"]
    });

    const inputText = `Tom: C\nCapotraste: 5\nForma dos acordes no tom de G\n\n[Intro]\nG  G  D  Em  C`;
    
    const res = await request(app)
      .post('/api/ai-import')
      .set('Authorization', 'Bearer fake-token')
      .send({
        rawText: inputText,
        orgId: 'test-org',
        userId: 'test-uid'
      });
      
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Validate metadata in song
    expect(res.body.song.metadata.declaredKey).toBe("C");
    expect(res.body.song.metadata.shapeKey).toBe("G");
    expect(res.body.song.metadata.capo).toBe(5);
    expect(res.body.song.metadata.transpositionSemitones).toBe(5);
    expect(res.body.song.metadata.normalizedToConcertKey).toBe(true);
    expect(res.body.song.metadata.chordContentKeyValidationStatus).toBe("INDETERMINATE");
    expect(res.body.song.metadata.chordContentKey).toBeUndefined();

    // Validate metadata in result
    expect(res.body.result.metadata.declaredKey).toBe("C");
    expect(res.body.result.metadata.shapeKey).toBe("G");
    expect(res.body.result.metadata.capo).toBe(5);
    expect(res.body.result.metadata.transpositionSemitones).toBe(5);
    expect(res.body.result.metadata.normalizedToConcertKey).toBe(true);
    expect(res.body.result.metadata.chordContentKeyValidationStatus).toBe("INDETERMINATE");
    expect(res.body.result.metadata.chordContentKey).toBeUndefined();

    // Check warnings
    expect(Array.isArray(res.body.result.warnings)).toBe(true);
    expect(res.body.result.warnings.includes("Não foi possível confirmar automaticamente o tom físico dos acordes.")).toBe(true);
  });

  it('should split concatenated title and artist when evident, and use explicit values when provided', async () => {
    geminiMockState.text = JSON.stringify({
      capitalizedTitle: "Toda Terra",
      capitalizedArtist: "Gabriela Rocha",
      originalKey: "E",
      cleanChords: "[Intro] E  B  C#m  A",
      cleanLyrics: "Toda Terra",
      sections: ["Intro"]
    });

    const inputText = `Toda TerraGabriela Rocha\nTom: E\n[Intro] E  B  C#m  A`;
    
    // First, test without explicit title/artist
    const res1 = await request(app)
      .post('/api/ai-import')
      .set('Authorization', 'Bearer fake-token')
      .send({
        rawText: inputText,
        orgId: 'test-org',
        userId: 'test-uid'
      });
      
    expect(res1.status).toBe(200);
    expect(res1.body.ok).toBe(true);
    expect(res1.body.song.title).toBe("Toda Terra");
    expect(res1.body.song.artist).toBe("Gabriela Rocha");
    expect(res1.body.result.title).toBe("Toda Terra");
    expect(res1.body.result.artist).toBe("Gabriela Rocha");

    // Second, test WITH explicit title/artist overriding AI
    const res2 = await request(app)
      .post('/api/ai-import')
      .set('Authorization', 'Bearer fake-token')
      .send({
        rawText: inputText,
        title: "Explicit Title",
        artist: "Explicit Artist",
        orgId: 'test-org',
        userId: 'test-uid'
      });

    expect(res2.status).toBe(200);
    expect(res2.body.ok).toBe(true);
    expect(res2.body.song.title).toBe("Explicit Title");
    expect(res2.body.song.artist).toBe("Explicit Artist");
    expect(res2.body.result.title).toBe("Explicit Title");
    expect(res2.body.result.artist).toBe("Explicit Artist");
  });
});
