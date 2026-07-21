const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const regex = /app\.post\("\/api\/curation\/approve", requireEcosystemRole, async \(req: any, res: any\) => \{[\s\S]*? \}\);\n/g;

const replacement = `app.post("/api/curation/approve", requireEcosystemRole, async (req: any, res: any) => {
    try {
        if (!db) throw new Error("Database not initialized");
        const { createCurationApprovalHttpHandler } = await import('./services/server/curationApprovalHttpHandler.js');
        const handler = createCurationApprovalHttpHandler({ db, admin, logger });
        return await handler(req, res);
    } catch (error: any) {
        logger.error("Admin curation fallback error:", error);
        return res.status(500).json({ error: error.message });
    }
});\n`;

content = content.replace(regex, replacement);
fs.writeFileSync('server.ts', content);
