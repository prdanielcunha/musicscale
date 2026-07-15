import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const targetStr = `  app.post("/api/admin/scan-organization-repertoire", requireEcosystemRole, async (req: any, res: any) => {`;

const newCode = `  app.post("/api/admin/fix-candidates-without-title", requireEcosystemRole, async (req: any, res: any) => {
    try {
        if (!db) return res.status(500).json({ error: "Banco de dados não carregado." });
        
        const context = req.ecosystemContext;
        const allowedRoles = ['ceo', 'global_admin', 'ecosystem_owner', 'founder'];
        if (!allowedRoles.includes(context?.systemRole?.toLowerCase().trim() || '') && !context?.hasCurationAccess && !context?.isGlobalAdminEmail) {
            return res.status(403).json({ error: "FORBIDDEN" });
        }

        const stats = await fixCandidatesWithoutTitle(db);
        return res.json({ stats });
    } catch (err: any) {
        return res.status(500).json({ error: "Erro na fixação.", details: err.message });
    }
  });\n\n  app.post("/api/admin/scan-organization-repertoire", requireEcosystemRole, async (req: any, res: any) => {`;

content = content.replace(targetStr, newCode);

const importAdd = `import { fixCandidatesWithoutTitle } from "./services/server/fixCandidatesWithoutTitle.js";\n`;
if (!content.includes('fixCandidatesWithoutTitle')) {
   const importMarker = `import { analyzeInboxBatch }`;
   content = content.replace(importMarker, importAdd + importMarker);
}


fs.writeFileSync('server.ts', content, 'utf-8');
console.log("Done inserting fix endpoint!");
