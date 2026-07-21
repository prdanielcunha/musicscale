import assert from 'assert';
import { 
  processBandScaleWrittenNotification, 
  processSuggestionCreatedNotification,
  createNotificationWithDependencies,
  generateDeterministicId,
  NotificationDependencies
} from '../src/notifications.js';

async function runNotificationTests() {
  console.log('Running Notification tests (Importing Production Functions)...');

  // Set up mock deps
  let createdDocs: any[] = [];
  let threwError: any = null;
  const logs: any[] = [];
  
  let mockDb = {
    collection: (path: string) => ({
      where: (field: string, op: string, val: any) => mockDb.collection(path),
      get: async () => ({ docs: [{ id: 'admin-1' }, { id: 'admin-2' }] })
    }),
    doc: (path: string) => {
      return {
        create: async (data: any) => {
          if (path.includes('throw')) {
            const err = new Error('UNEXPECTED');
            throw err;
          }
          if (path.includes('already_exists')) {
            const err: any = new Error('ALREADY_EXISTS');
            err.code = 6;
            throw err;
          }
          createdDocs.push({ path, data });
        }
      }
    }
  };

  const mockLogger = {
    info: (msg: string, meta: any) => logs.push({ type: 'info', msg, meta }),
    error: (msg: string, meta: any) => logs.push({ type: 'error', msg, meta })
  };

  const mockDeps: NotificationDependencies = {
    db: mockDb,
    logger: mockLogger,
    serverTimestamp: () => 'MOCK_TIMESTAMP'
  };

  // 1. Band Scale returns no-op, no instruments queried, no notification written
  createdDocs = [];
  await processBandScaleWrittenNotification(mockDeps, { params: { scaleId: 'scale-123' }});
  assert.strictEqual(createdDocs.length, 0, 'Band scale should not create notifications');

  // 4, 5. Suggestion without snapshot or without orgId is ignored
  await processSuggestionCreatedNotification(mockDeps, { data: null });
  await processSuggestionCreatedNotification(mockDeps, { data: { data: () => ({}) } });
  assert.strictEqual(createdDocs.length, 0, 'Invalid suggestions should be ignored');

  // Test suggestion creation
  createdDocs = [];
  await processSuggestionCreatedNotification(mockDeps, {
    params: { suggestionId: 'sugg-123' },
    data: {
      data: () => ({
        organizationId: 'org-test',
        createdBy: { name: 'TestUser' },
        songs: ['s1', 's2']
      })
    }
  });

  // 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18
  assert.strictEqual(createdDocs.length, 2, 'Should create for both eligible admins');
  const doc0 = createdDocs[0].data;
  assert.strictEqual(doc0.organizationId, 'org-test');
  assert.strictEqual(doc0.recipientId, 'admin-1');
  assert.strictEqual(doc0.metadata.suggestionId, 'sugg-123');
  assert.strictEqual(doc0.link, '/suggestions');
  assert.strictEqual(doc0.title, 'Nova Indicação de Música');
  assert.strictEqual(doc0.message, 'TestUser indicou 2 música(s) para o repertório.');
  assert.strictEqual(doc0.isRead, false);
  assert.strictEqual(doc0.isArchived, false);
  assert.strictEqual(doc0.sourceEventId, 'sugg-123');
  
  const expectedId0 = generateDeterministicId('org-test', 'suggestion', 'sugg-123', 'admin-1');
  assert.strictEqual(doc0.idempotencyKey, expectedId0);
  assert.strictEqual(createdDocs[0].path, `organizations/org-test/notifications/${expectedId0}`);

  // 19. ALREADY_EXISTS is treated as idempotent
  createdDocs = [];
  await createNotificationWithDependencies(mockDeps, 'org-already_exists', {
    recipientId: 'already_exists_user',
    type: 'suggestion',
    title: 'T',
    message: 'M',
    link: 'L'
  }, 'e-1');
  console.log('createdDocs:', createdDocs);
  assert.strictEqual(createdDocs.length, 0, 'ALREADY_EXISTS should be swallowed idempotently');

  // 20. Unexpected write failure is propagated for retry
  try {
    await createNotificationWithDependencies(mockDeps, 'org-throw', {
      recipientId: 'throw_user',
      type: 'suggestion',
      title: 'T',
      message: 'M',
      link: 'L'
    }, 'e-1');
    assert.fail('Should have thrown unexpected error');
  } catch (e: any) {
    assert.strictEqual(e.message, 'UNEXPECTED');
  }

  // 21. Two orgs do not share ID
  const id1 = generateDeterministicId('org-A', 'system', 'event-1', 'user-1');
  const id2 = generateDeterministicId('org-B', 'system', 'event-1', 'user-1');
  assert.notStrictEqual(id1, id2);

  // 22. Two recipients generate different docs
  assert.notStrictEqual(
    generateDeterministicId('org-A', 'system', 'event-1', 'user-1'),
    generateDeterministicId('org-A', 'system', 'event-1', 'user-2')
  );

  console.log('Notification tests passed!');
}

runNotificationTests().catch(e => {
  console.error('Notification tests failed:', e);
  process.exit(1);
});
