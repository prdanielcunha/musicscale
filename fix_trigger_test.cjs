const fs = require('fs');
let code = fs.readFileSync('functions/tests/trigger.test.ts', 'utf8');

const regexMock = /runTransaction: async \(cb: any\) => \{[\s\S]*?\}\);\s*\}/;
const replacementMock = `runTransaction: async (cb: any) => {
      transactionCalls++;
      let writeStarted = false;
      const t = {
        get _get() {
          return async (ref: any) => {
            if (writeStarted) throw new Error('FIRESTORE_READ_AFTER_WRITE_FORBIDDEN');
            getCalls++;
            targetPath = ref.id;
            return {
              exists: !!existingDoc,
              data: () => existingDoc
            };
          };
        },
        get _set() {
          return (ref: any, data: any) => { writeStarted = true; setCalls++; targetPath = ref.id; writtenData = data; };
        },
        get _update() {
          return (ref: any, data: any) => { writeStarted = true; updateCalls++; targetPath = ref.id; updatedData = data; };
        }
      };
      
      Object.defineProperty(t, 'get', { get: function() { return this._get; }, set: function() { throw new Error('OVERRIDE_FORBIDDEN'); } });
      Object.defineProperty(t, 'set', { get: function() { return this._set; }, set: function() { throw new Error('OVERRIDE_FORBIDDEN'); } });
      Object.defineProperty(t, 'update', { get: function() { return this._update; }, set: function() { throw new Error('OVERRIDE_FORBIDDEN'); } });
      
      return cb(t);
    }`;
code = code.replace(regexMock, replacementMock);
fs.writeFileSync('functions/tests/trigger.test.ts', code);
