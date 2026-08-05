import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server';
import { areKeysEnharmonicallyEquivalent } from '../../utils/chordEngine';

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

    // Validate metadata in result
    expect(res.body.result.metadata).toBeDefined();
    expect(res.body.result.metadata.declaredKey).toBe("F#");
    expect(res.body.result.metadata.shapeKey).toBe("E");
    expect(res.body.result.metadata.capo).toBe(2);
    expect(res.body.result.metadata.transpositionSemitones).toBe(2);
    expect(res.body.result.metadata.normalizedToConcertKey).toBe(true);
    expect(res.body.result.metadata.chordContentKey).toBe("F#");

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
    expect(res.body.details.expectedKey).toBe("F#");
    // Ensure detected key is enharmonically equivalent to G
    expect(areKeysEnharmonicallyEquivalent(res.body.details.detectedKey, 'G')).toBe(true);
    
    expect(res.body.song).toBeUndefined();
  });
});
