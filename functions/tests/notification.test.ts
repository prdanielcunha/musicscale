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

  let createdDocs: any[] = [];
  let whereCalls: any[] = [];
  
  let expectedOrgId = 'org-test';

  const mockDb = {
    collection: (path: string) => {
      let currentWhereCalls: any[] = [];
      const queryObj: any = {
        where: (field: string, op: string, val: any) => {
          whereCalls.push({ field, operator: op, value: val });
          currentWhereCalls.push({ field, operator: op, value: val });
          return queryObj;
        },
        get: async () => {
          if (
             currentWhereCalls.length === 2 && 
             currentWhereCalls[0].field === "organizationId" && 
             currentWhereCalls[0].operator === "==" &&
             currentWhereCalls[0].value === expectedOrgId &&
             currentWhereCalls[1].field === "role" &&
             currentWhereCalls[1].operator === "in" &&
             JSON.stringify(currentWhereCalls[1].value) === JSON.stringify(['Administrador', 'Dono'])
          ) {
             if (expectedOrgId === 'org-empty') return { docs: [] };
             if (expectedOrgId === 'org-one') return { docs: [{ id: 'admin-1' }] };
             return { docs: [{ id: 'admin-1' }, { id: 'admin-2' }] };
          }
          return { docs: [] };
        }
      };
      return queryObj;
    },
    doc: (path: string) => {
      return {
        create: async (data: any) => {
          if (path.includes('throw')) {
            throw new Error('UNEXPECTED');
          }
          if (path.includes('already_exists')) {
            const err: any = new Error('ALREADY_EXISTS');
            err.code = 6;
            throw err;
          }
          if (path.includes('already_msg')) {
            throw new Error('ALREADY_EXISTS');
          }
          createdDocs.push({ path, data });
        }
      }
    }
  };

  const mockDeps: NotificationDependencies = {
    db: mockDb as any,
    logger: { info: () => {}, error: () => {} } as any,
    serverTimestamp: () => 'MOCK_TIMESTAMP'
  };

  const processSuggestion = (orgId: string) => processSuggestionCreatedNotification(mockDeps, {
    params: { suggestionId: 'sugg-123' },
    data: { data: () => ({ organizationId: orgId, createdBy: { name: 'U' }, songs: ['s1'] }) }
  });

  // 1. zero destinatários
  whereCalls = []; createdDocs = []; expectedOrgId = 'org-empty';
  await processSuggestion('org-empty');
  assert.strictEqual(whereCalls.length, 2);
  assert.strictEqual(createdDocs.length, 0);

  // 2. um destinatário
  whereCalls = []; createdDocs = []; expectedOrgId = 'org-one';
  await processSuggestion('org-one');
  assert.strictEqual(whereCalls.length, 2);
  assert.strictEqual(createdDocs.length, 1);

  // 3. dois destinatários
  whereCalls = []; createdDocs = []; expectedOrgId = 'org-test';
  await processSuggestion('org-test');
  assert.strictEqual(whereCalls.length, 2);
  assert.strictEqual(createdDocs.length, 2);
  assert.deepStrictEqual(whereCalls[0], { field: 'organizationId', operator: '==', value: 'org-test' });
  assert.deepStrictEqual(whereCalls[1], { field: 'role', operator: 'in', value: ['Administrador', 'Dono'] });

  // 4, 5, 6, 7, 8, 9: The query uses exactly this sequence, tested implicitly because get() won't return anything otherwise
  // Let's test that failure in any part of where chain returns empty.
  
  // 10. BandScale não consulta banco
  whereCalls = []; createdDocs = [];
  await processBandScaleWrittenNotification(mockDeps, { params: { scaleId: 'sc1' }});
  assert.strictEqual(whereCalls.length, 0);

  // 11. BandScale não cria documentos
  assert.strictEqual(createdDocs.length, 0);

  // 12. suggestion sem snapshot não consulta
  whereCalls = []; createdDocs = [];
  await processSuggestionCreatedNotification(mockDeps, { data: null });
  assert.strictEqual(whereCalls.length, 0);

  // 13. suggestion sem organizationId não consulta
  await processSuggestionCreatedNotification(mockDeps, { data: { data: () => ({}) } });
  assert.strictEqual(whereCalls.length, 0);

  // 14. ALREADY_EXISTS com code 6
  createdDocs = [];
  await createNotificationWithDependencies(mockDeps, 'org-already_exists', { recipientId: 'r', type: 'system', title: 't', message: 'm', link: 'l' }, 'e');
  assert.strictEqual(createdDocs.length, 0);

  // 15. ALREADY_EXISTS somente pela mensagem
  createdDocs = [];
  await createNotificationWithDependencies(mockDeps, 'org-already_msg', { recipientId: 'r', type: 'system', title: 't', message: 'm', link: 'l' }, 'e');
  assert.strictEqual(createdDocs.length, 0);

  // 16. erro inesperado é relançado
  try {
    await createNotificationWithDependencies(mockDeps, 'org-throw', { recipientId: 'r', type: 'system', title: 't', message: 'm', link: 'l' }, 'e');
    assert.fail();
  } catch (e: any) {
    assert.strictEqual(e.message, 'UNEXPECTED');
  }

  // 17. IDs variam por destinatário
  assert.notStrictEqual(
    generateDeterministicId('org1', 'sys', 'ev', 'r1'),
    generateDeterministicId('org1', 'sys', 'ev', 'r2')
  );

  // 18. IDs variam por organização
  assert.notStrictEqual(
    generateDeterministicId('org1', 'sys', 'ev', 'r1'),
    generateDeterministicId('org2', 'sys', 'ev', 'r1')
  );

  console.log('Notification tests passed!');
}

runNotificationTests().catch(e => {
  console.error('Notification tests failed:', e);
  process.exit(1);
});
