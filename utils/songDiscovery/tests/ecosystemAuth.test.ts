import assert from 'node:assert';
import { validateEcosystemAuthToken } from '../../../services/server/ecosystemAuth.js';

export async function runTests() {
   console.log('Running ecosystem auth middleware tests...');
   
   const authMock = {
       verifyIdToken: async (token: string) => {
           if (token === '123') throw new Error("Invalid token");
           return { uid: 'user-id', email: 'test@example.com' };
       }
   };
   
   const dbMock = {
       collection: () => ({ doc: () => ({ get: async () => ({ exists: false, data: () => ({}) }) }) })
   };

   // 1. Missing Header
   let result = await validateEcosystemAuthToken(undefined, dbMock, authMock);
   assert.strictEqual(result.statusCode, 401);
   assert.ok(result.error?.includes("ausente"));

   // 2. Invalid Token Format
   result = await validateEcosystemAuthToken("Basic 123", dbMock, authMock);
   assert.strictEqual(result.statusCode, 401);

   // 3. User with valid ecosystem role
   const dbMockGlobal = {
       collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ systemRole: 'ceo' }) }) }) })
   };
   
   result = await validateEcosystemAuthToken("Bearer abc", dbMockGlobal, authMock);
   assert.strictEqual(result.statusCode, undefined);
   assert.strictEqual(result.context?.hasCurationAccess, true);
   assert.strictEqual(result.context?.systemRole, 'ceo');

   // 4. User with organizational role (should be denied)
   const dbMockOrg = {
       collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ systemRole: 'owner' }) }) }) })
   };
   
   result = await validateEcosystemAuthToken("Bearer abc", dbMockOrg, authMock);
   assert.strictEqual(result.statusCode, 403);
   assert.ok(result.error?.includes("negado"));

   console.log('ecosystem auth middleware tests passed!');
}
