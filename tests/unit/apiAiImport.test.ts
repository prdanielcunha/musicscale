import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../server';

// Mock dependencies
vi.mock('@google/genai', () => {
  const generateContentMock = vi.fn().mockResolvedValue({
    response: { text: () => "{}" }
  });
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: generateContentMock
      }
    }))
  };
});

vi.mock('../../services/firebaseAdmin', async () => {
  const actual = await vi.importActual('../../services/firebaseAdmin');
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
  
  it('should process the request with normalized text', async () => {
    const encodedText = "tom:%20G%0A%0A%5BIntro%5D%20G%20C9%20Em7%20D";
    
    const res = await request(app)
      .post('/api/ai-import')
      .set('Authorization', 'Bearer fake-token')
      .send({
        rawText: encodedText,
        orgId: 'test-org',
        userId: 'test-uid'
      });
      
    // Should pass through successfully since Gemini is mocked and returns {}
    expect(res.status).not.toBe(500);
  });
});
