import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const targetStr = `  app.post("/api/admin/analyze-inbox", requireEcosystemRole, async (req: any, res: any) => {`;

const newCode = `  app.get("/api/admin/inbox-count", requireEcosystemRole, async (req: any, res: any) => {
    try {
        if (!db) return res.status(500).json({ error: "Banco de dados não carregado." });
        const snapshot = await db.collection('songDiscoveryInbox').where('status', 'in', ['pending', 'failed']).count().get();
        return res.json({ count: snapshot.data().count });
    } catch (err: any) {
        return res.status(500).json({ error: "Erro ao contar inbox", details: err.message });
    }
  });\n\n  app.post("/api/admin/analyze-inbox", requireEcosystemRole, async (req: any, res: any) => {`;

content = content.replace(targetStr, newCode);

fs.writeFileSync('server.ts', content, 'utf-8');
console.log("Done inserting inbox-count endpoint!");
