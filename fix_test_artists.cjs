const fs = require('fs');
let code = fs.readFileSync('tests/server/curation-approval-service.test.ts', 'utf8');

const regexActor = /it\('3\. contexto de ator ausente não retorna 200', async \(\) => \{\s+const handler = createCurationApprovalHttpHandler\(mockDeps\);\s+mockReq\.ecosystemContext = undefined;\s+await handler\(mockReq, mockRes\);\s+expect\(mockRes\.status\)\.toHaveBeenCalledWith\(403\);\s+\}\);/;
const replaceActor = `it('3. contexto de ator ausente não retorna 200', async () => {
        const handler = createCurationApprovalHttpHandler(mockDeps);
        mockReq.ecosystemContext = undefined;
        await handler(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(401);
    });`;
code = code.replace(regexActor, replaceActor);

const regexArtist = /await service\.approve\(defaultParams\); \/\/ Falls back to empty array gracefully\s+expect\(myT\.sets\.some\(s => s\.ref\.id === 'A_'\)\)\.toBe\(true\);/;
const replaceArtist = `await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'CANONICAL_IDENTITY_INVALID' });`;
code = code.replace(regexArtist, replaceArtist);

fs.writeFileSync('tests/server/curation-approval-service.test.ts', code);
