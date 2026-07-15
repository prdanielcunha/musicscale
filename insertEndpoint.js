import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const targetStr = `  app.post("/api/admin/scan-organization-repertoire", requireEcosystemRole, async (req: any, res: any) => {`;

const newCode = `  app.post("/api/admin/analyze-inbox", requireEcosystemRole, async (req: any, res: any) => {
    try {
        if (!db) return res.status(500).json({ error: "Banco de dados não carregado." });

        const context = req.ecosystemContext;
        const allowedRoles = ['ceo', 'global_admin', 'ecosystem_owner', 'founder'];
        if (!allowedRoles.includes(context?.systemRole?.toLowerCase().trim() || '') && !context?.hasCurationAccess && !context?.isGlobalAdminEmail) {
             return res.status(403).json({ error: "FORBIDDEN: Acesso administrativo restrito negado." });
        }

        const limitMsgs = req.body.limit || 10;
        const results = await analyzeInboxBatch(limitMsgs, db);
        
        return res.json({ results });
    } catch (err: any) {
        return res.status(500).json({ error: "Erro na análise.", details: err.message });
    }
  });

  app.post("/api/admin/scan-organization-repertoire", requireEcosystemRole, async (req: any, res: any) => {`;

content = content.replace(targetStr, newCode);

fs.writeFileSync('server.ts', content, 'utf-8');
console.log("Done inserting analyze endpoint!");
