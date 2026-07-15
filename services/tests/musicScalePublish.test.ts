// @ts-ignore
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MusicRepository } from '../MusicRepository';

// Mock the firebase module
vi.mock('../firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('mock-token-abc-123')
    }
  },
  db: {}
}));

describe('MusicScaleCommand API - Publish', () => {
    let repository: MusicRepository;
    let mockFetch: any;

    beforeEach(() => {
        vi.clearAllMocks();
        repository = new MusicRepository('test-org-123');
        mockFetch = vi.fn();
        global.fetch = mockFetch;
    });

    it('should successfully publish a music scale with valid parameters', async () => {
        const mockResponsePayload = {
            musicScaleId: 'scale-456',
            version: 2,
            createdNotificationCount: 5,
            createdResponseCount: 3,
            eventAssignmentCount: 3,
            broadcastRecipientCount: 0,
            fromCache: false
        };

        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => mockResponsePayload
        });

        const payload = { bandScaleId: 'band-789' };
        const idempotencyKey = 'key-uuid-9999';

        const result = await repository.musicScaleCommands.publish('scale-456', payload, idempotencyKey);

        expect(mockFetch).toHaveBeenCalledWith(
            '/api/v1/music-scales/scale-456/publish',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer mock-token-abc-123',
                    'Idempotency-Key': 'key-uuid-9999',
                    'X-Organization-Id': 'test-org-123'
                },
                body: JSON.stringify(payload)
            })
        );

        expect(result).toEqual(mockResponsePayload);
    });

    it('should throw an error with correlationId when the request fails', async () => {
        const mockErrorResponse = {
            error: 'Permissão insuficiente para publicar escalas.',
            correlationId: 'corr-xyz-777'
        };

        mockFetch.mockResolvedValue({
            ok: false,
            status: 403,
            json: async () => mockErrorResponse
        });

        await expect(
            repository.musicScaleCommands.publish('scale-456', {}, 'key-123')
        ).rejects.toThrow('Permissão insuficiente para publicar escalas.');
    });
});
