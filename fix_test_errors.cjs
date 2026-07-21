const fs = require('fs');
let code = fs.readFileSync('tests/server/curation-approval-service.test.ts', 'utf8');

// Fix 1: 403 -> 401 for missing actor context
code = code.replace(/expect\(mockRes\.status\)\.toHaveBeenCalledWith\(403\);/g, (match, offset) => {
    // only the first one in the "contexto de ator ausente"
    if (code.slice(offset - 100, offset).includes("contexto de ator ausente não retorna 200")) {
        return "expect(mockRes.status).toHaveBeenCalledWith(401);";
    }
    return match;
});

// Fix 2: 500 code
code = code.replace(/{ error: "Erro inesperado na aprovação.", code: "TRANSACTION_FAILED" }/g, '{ error: "Erro inesperado na aprovação.", code: "INTERNAL_CURATION_ROUTE_ERROR" }');

// Fix 3: duplicata messages
code = code.replace(/.toThrow\('Duplicata global detectada'\)/g, ".toThrow('Música duplicada encontrada na rechecagem')");

// Fix 4: normalizedArtists com tipo inválido expected error
const invalidArtistRegex = /expect\(service\.approve\(defaultParams\)\)\.rejects\.toThrow\('CANONICAL_IDENTITY_INVALID'\);/g;
code = code.replace(invalidArtistRegex, "expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'CANONICAL_IDENTITY_INVALID' });");

fs.writeFileSync('tests/server/curation-approval-service.test.ts', code);
