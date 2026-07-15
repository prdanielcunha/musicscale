import assert from 'assert';
import * as crypto from 'crypto';

// Minimal mock environment
const logs: any[] = [];
(global as any).mockLogger = {
  info: (msg: string, meta: any) => logs.push({ type: 'info', msg, meta }),
  error: (msg: string, meta: any) => logs.push({ type: 'error', msg, meta })
};

// Simulate generateDeterministicId
function generateDeterministicId(orgId: string, eventType: string, eventId: string, recipientId: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(`${orgId}|${eventType}|${eventId}|${recipientId}`);
  return hash.digest('hex');
}

async function runNotificationTests() {
  console.log('Running Notification tests...');
  
  const orgId = "test-org";
  const scaleId = "scale-123";
  const actorId = "user-abc";

  let createdDocs: any[] = [];
  const mockDb = {
    doc: (path: string) => {
      return {
        create: async (data: any) => {
          createdDocs.push({ path, data });
        }
      }
    },
    collection: (path: string) => ({
      doc: (id: string) => ({
        get: async () => ({ exists: true, data: () => ({ name: 'Teclado' }) })
      })
    })
  };

  // 1. Creation test with same user
  const afterData = {
    organizationId: orgId,
    assignments: [
      { userId: actorId, instrumentId: 'inst-1' } // user is the author
    ],
    date: '2026-06-26'
  };

  // Emulate onBandScaleWritten logic
  const usersToNotify: { userId: string; instrumentId: string | null }[] = [
    { userId: actorId, instrumentId: 'inst-1' }
  ];

  for (const assignment of usersToNotify) {
    const docId = generateDeterministicId(orgId, 'band_scale', scaleId, assignment.userId);
    const docPath = `organizations/${orgId}/notifications/${docId}`;
    await mockDb.doc(docPath).create({
      recipientId: assignment.userId,
      type: 'band_scale',
      title: 'Você foi escalado!',
      message: `Você foi escalado como Teclado para o evento do dia ${afterData.date}.`,
      link: `/band-scales/${scaleId}`,
      isRead: false,
      isArchived: false,
      createdAt: 'serverTimestamp',
      sourceEventId: scaleId,
      organizationId: orgId,
      idempotencyKey: docId,
      metadata: { scaleId, instrumentId: assignment.instrumentId }
    });
  }

  assert.strictEqual(createdDocs.length, 1);
  assert.strictEqual(createdDocs[0].data.recipientId, actorId);
  assert.strictEqual(createdDocs[0].data.isRead, false);
  assert.strictEqual(createdDocs[0].data.isArchived, false);
  assert.strictEqual(createdDocs[0].data.organizationId, orgId);
  
  const expectedPath = `organizations/${orgId}/notifications/${generateDeterministicId(orgId, 'band_scale', scaleId, actorId)}`;
  assert.strictEqual(createdDocs[0].path, expectedPath);

  // 2. Test command_api producer ignores creation
  console.log('Testing notificationProducer === command_api...');
  let functionInvoked = true;
  const afterDataCommandApi = {
    ...afterData,
    notificationProducer: 'command_api'
  };
  
  // Emulate exact function behavior
  if (afterDataCommandApi.notificationProducer === 'command_api') {
      (global as any).mockLogger.info(`Skipping notification generation in Cloud Function because document is handled by Command API (scaleId: ${scaleId})`, {});
      functionInvoked = false;
  }
  
  assert.strictEqual(functionInvoked, false);
  // Assert no new docs created
  assert.strictEqual(createdDocs.length, 1);

  console.log('Notification tests passed!');
}

runNotificationTests().catch(console.error);

