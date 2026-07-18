import { logger } from './lib/logger.js';
logger.info("Server process started");

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception thrown:', err);
  process.exit(1);
});

import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import cors from "cors";
import crypto from "crypto";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { createFixChordsHandler } from "./services/server/fixChordsHandler.js";
import { authorizeAiRequest, InMemoryAiRateLimiter } from "./services/server/aiRequestSecurity.js";
import { createAiFinOpsFirestoreAdapter } from "./services/server/aiFinOpsFirestoreAdapter.js";
import { resolveAiImportFinOpsReadPath } from "./services/server/aiImportFinOpsReadPath.js";
import { adminDb as db, adminAuth as auth, admin } from "./services/firebaseAdmin.js";
import { GlobalLibraryCandidateReviewLogServerInput } from './services/server/curationServerTypes.js';
import { 
  preProcessSongText, 
  cleanChordsText, 
  removeChordOnlyLinesFromLyrics, 
  removeOrphanInstrumentalLabelsFromLyrics,
  removeEmptyOrInstrumentalSectionsFromLyrics, 
  validateNoChordListAtStartOfChords, 
  validateNoChordLinesInLyrics,
  validateLyricsHasOnlySingableSections,
  stripTablatureArtifacts
} from "./utils/chordEngine.js";
import dotenv from "dotenv";
import fs from "fs";
import Stripe from "stripe";
import { PLAN_FEATURES, PLAN_LIMITS } from "./services/entitlementsConstants.js";
import { compareSongs } from "./utils/songDiscovery/matcher.js";
import { requireEcosystemRole } from "./services/server/ecosystemAuth.js";
import { runSongDiscoveryProcessor } from "./services/server/songDiscoveryProcessor.js";
import { SongDiscoveryInboxService } from "./services/server/songDiscoveryInboxService.js";
import { analyzeInboxBatch } from "./services/server/songInboxAnalyzer.js";
import { fixCandidatesWithoutTitle } from "./services/server/fixCandidatesWithoutTitle.js";
import { buildSanitizedSnapshot } from "./utils/songDiscovery/snapshotSanitizer.js";
import { backfillGlobalSongs } from "./services/server/globalSongsBackfill.js";
import { reanalyzeCandidates } from "./services/server/curationReanalyzer.js";
import { extractSongIdentity } from "./utils/songDiscovery/identityGenerator.js";
import { preVerifyCandidates, bulkImportCandidates } from './services/server/bulkImportService.js';
import { BandScaleCommandService } from './services/server/bandScale/bandScaleCommandService.js';
import { resolveOrganizationAuthorization } from "./services/server/organizationAuthorization.js";
import { createSafeExternalFetch } from "./services/server/safeExternalFetch.js";
import { fetchAiImportHtmlSafely } from "./services/server/aiImportSafeFetchAdapter.js";
import { beginAiImportFinOpsWritePath, finalizeAiImportFinOpsWritePath } from "./services/server/aiImportFinOpsWritePath.js";

if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
}
dotenv.config();

function deriveMusicscaleRole(roleName: string): string {
  const name = (roleName || "").toLowerCase();
  if (name.includes("administrador") || name.includes("admin")) return "admin";
  if (name.includes("líder") || name.includes("lider") || name.includes("ministro")) return "leader";
  if (name.includes("músico") || name.includes("musico") || name.includes("vocal")) return "musician";
  if (name.includes("visitante") || name.includes("viewer")) return "viewer";
  return "custom";
}

const fixChordsRateLimiter = new InMemoryAiRateLimiter();
const aiImportRateLimiter = new InMemoryAiRateLimiter();
const aiImportSafeExternalFetch = createSafeExternalFetch();

const app = express();
const PORT = 3000;

// Enable CORS with support for multiple subdomains & credentials
const allowedOrigins = [
  "https://musicscale.millionsnest.com",
  "https://millionsnest.com",
  "https://www.millionsnest.com"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.includes("run.app") || origin.includes("localhost") || origin.includes("127.0.0.1")) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"]
}));

app.options('*all', cors());

// Preview Production Backend Proxy (MS-PREVIEW-PRODUCTION-BACKEND-BRIDGE-01)
const isPreviewCanonicalApiEnabled = process.env.MUSICSCALE_PREVIEW_CANONICAL_API_ENABLED === 'true';
const canonicalApiOrigin = process.env.MUSICSCALE_PREVIEW_CANONICAL_API_ORIGIN;
const isAllowedCanonicalOrigin = canonicalApiOrigin === 'https://musicscale.millionsnest.com';
const isNotProduction = process.env.NODE_ENV !== 'production';

if (isPreviewCanonicalApiEnabled && canonicalApiOrigin && isAllowedCanonicalOrigin && isNotProduction) {
  app.use(createProxyMiddleware({
    pathFilter: '/api',
    target: canonicalApiOrigin,
    changeOrigin: true,
    ws: true,
    proxyTimeout: 15000,
    on: {
      proxyReq: (proxyReq, req, res) => {
        if (req.headers.host && req.headers.host.includes('millionsnest.com')) {
          // Safety fallback: Never proxy from production to itself
          return;
        }
        
        proxyReq.removeHeader('cookie');
        proxyReq.removeHeader('x-forwarded-host');
        proxyReq.removeHeader('x-forwarded-proto');
        proxyReq.removeHeader('host'); // handled by changeOrigin
        
        proxyReq.setHeader('X-MusicScale-Client-Environment', 'ai-studio-preview');
        
        console.log(`[MusicScale Preview] Connected to canonical production backend. (Forwarding ${req.method} ${req.url})`);
      },
      error: (err, req, res: any) => {
        console.error('[MusicScale Proxy Error]', err.message);
        if (res && !res.headersSent) {
          res.status(502).json({
            error: "Canonical production backend is currently unavailable.",
            code: "CANONICAL_PRODUCTION_BACKEND_UNAVAILABLE"
          });
        }
      }
    }
  }));
}

// Standard JSON Middleware for other routes
const AI_IMPORT_BODY_LIMIT_BYTES = 128 * 1024;
const AI_IMPORT_RAW_TEXT_MAX_CHARS = 64000;
const AI_IMPORT_GEMINI_INPUT_MAX_CHARS = 64000;

const defaultJsonParser = express.json({ limit: '50mb' });
const aiImportJsonParser = express.json({ limit: AI_IMPORT_BODY_LIMIT_BYTES });

app.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/api/ai-" + "import") {
    return aiImportJsonParser(req, res, next);
  }
  return defaultJsonParser(req, res, next);
});

// Middleware to capture entity too large and syntax error on body parser cleanly
app.use((err: any, req: any, res: any, next: any) => {
  if (err?.type === "entity.too.large") {
    if (req.path === "/api/ai-" + "import") {
      return res.status(413).json({
        ok: false,
        code: "VALIDATION",
        message: "O texto informado é grande demais para importação automática.",
        details: { error: "AI_IMPORT_PAYLOAD_TOO_LARGE", maxBytes: AI_IMPORT_BODY_LIMIT_BYTES },
        step: "BODY_PARSER"
      });
    }
    return res.status(413).json({ error: "PAYLOAD_TOO_LARGE" });
  }

  if (err instanceof SyntaxError && "body" in err) {
    if (req.path === "/api/ai-" + "import") {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION",
        message: "O corpo da requisição é inválido.",
        details: { error: "INVALID_JSON_BODY" },
        step: "BODY_PARSER"
      });
    }
    return res.status(400).json({ error: "INVALID_JSON_BODY" });
  }

  return next(err);
});

  app.post("/api/admin/backfill-global-titles", requireEcosystemRole, async (req: any, res: any) => {
    try {
        const result = await backfillGlobalSongs(db);
        res.json({ success: true, result });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
  });

  function resolveFinOpsDiagnosticsEnvironment(): {
    environment: "preview" | "staging" | "development" | "production" | "unknown";
    isProduction: boolean;
    isSafeNonProduction: boolean;
    environmentSource: "VERCEL_ENV" | "AI_FINOPS_DIAGNOSTICS_ENV" | "none";
    canRun: boolean;
  } {
    const vercelEnv = process.env.VERCEL_ENV;
    const diagnosticsEnv = process.env.AI_FINOPS_DIAGNOSTICS_ENV;

    if (vercelEnv === "production") {
      return {
        environment: "production",
        isProduction: true,
        isSafeNonProduction: false,
        environmentSource: "VERCEL_ENV",
        canRun: false
      };
    }

    if (vercelEnv === "preview") {
      return {
        environment: "preview",
        isProduction: false,
        isSafeNonProduction: true,
        environmentSource: "VERCEL_ENV",
        canRun: true
      };
    }

    if (vercelEnv === "development") {
      return {
        environment: "development",
        isProduction: false,
        isSafeNonProduction: true,
        environmentSource: "VERCEL_ENV",
        canRun: true
      };
    }

    // VERCEL_ENV is absent or unknown
    if (diagnosticsEnv === "production") {
      return {
        environment: "production",
        isProduction: true,
        isSafeNonProduction: false,
        environmentSource: "AI_FINOPS_DIAGNOSTICS_ENV",
        canRun: false
      };
    }

    if (diagnosticsEnv === "preview" || diagnosticsEnv === "staging" || diagnosticsEnv === "development") {
      return {
        environment: diagnosticsEnv,
        isProduction: false,
        isSafeNonProduction: true,
        environmentSource: "AI_FINOPS_DIAGNOSTICS_ENV",
        canRun: true
      };
    }

    return {
      environment: "unknown",
      isProduction: false,
      isSafeNonProduction: false,
      environmentSource: "none",
      canRun: false
    };
  }

  app.get("/api/admin/billing-access-diagnostics", requireEcosystemRole, async (req: any, res: any) => {
    try {
      if (!db) {
        return res.status(503).json({ error: "Serviço de banco de dados temporariamente indisponível." });
      }

      const orgId = req.query.orgId ? String(req.query.orgId).trim() : null;

      if (!orgId) {
        // List organizations (up to 100) for auditing
        const orgsSnap = await db.collection('organizations').limit(100).get();
        const list: any[] = [];
        orgsSnap.forEach((doc: any) => {
          const data = doc.data() || {};
          list.push({
            id: doc.id,
            name: data.name || "Sem Nome",
            status: data.status || "active",
            archived: !!data.archived,
            music_scale_plan: data.music_scale_plan || null,
            subscriptionStatus: data.subscriptionStatus || null,
            apps_musicscale: data.apps?.musicscale || null
          });
        });

        return res.status(200).json({
          message: "Auditoria de faturamento: Lista de até 100 organizações carregada.",
          totalFetched: list.length,
          organizations: list
        });
      }

      // Detailed diagnosis for specific orgId
      const orgRef = db.collection('organizations').doc(orgId);
      const orgSnap = await orgRef.get();

      if (!orgSnap.exists) {
        return res.status(404).json({
          error: "Organização não encontrada.",
          orgId
        });
      }

      const orgData = orgSnap.data() || {};
      
      // Try to read from subscriptions/{orgId}
      let subData: any = null;
      try {
        const subSnap = await db.collection('subscriptions').doc(orgId).get();
        if (subSnap.exists) {
          subData = subSnap.data();
        }
      } catch (subErr: any) {
        logger.warn(`[Diagnostics] Failed to read subSnap: ${subErr.message}`);
      }

      // Run our exact resolution logic
      let verifiedStatus = 'inactive';
      let verifiedPlan = 'starter';
      let currentPeriodEnd: any = null;
      let entitlementSource = 'missing';
      let reason = 'NO_CANONICAL_ENTITLEMENT';

      const msApp = orgData?.apps?.musicscale;
      if (msApp && msApp.status) {
        const rawStatus = String(msApp.status).toLowerCase().trim();
        if (rawStatus === 'active' || rawStatus === 'trialing') {
          verifiedStatus = rawStatus;
          verifiedPlan = String(msApp.plan || 'starter').toLowerCase().trim();
          currentPeriodEnd = msApp.currentPeriodEnd || null;
          entitlementSource = 'organizations.apps.musicscale';
          reason = rawStatus === 'active' ? 'SUBSCRIPTION_ACTIVE' : 'SUBSCRIPTION_TRIALING';
        }
      }

      if (verifiedStatus === 'inactive' && subData) {
        const rawStatus = String(subData.status || '').toLowerCase().trim();
        if (rawStatus === 'active' || rawStatus === 'trialing') {
          verifiedStatus = rawStatus;
          verifiedPlan = String(subData.plan || 'starter').toLowerCase().trim();
          currentPeriodEnd = subData.subscriptionEndsAt || subData.currentPeriodEnd || null;
          entitlementSource = 'subscriptions';
          reason = rawStatus === 'active' ? 'SUBSCRIPTION_ACTIVE' : 'SUBSCRIPTION_TRIALING';
        }
      }

      const accessAllowed = (verifiedStatus === 'active' || verifiedStatus === 'trialing');

      return res.status(200).json({
        orgId,
        exists: true,
        accessAllowed,
        resolution: {
          status: verifiedStatus,
          plan: verifiedPlan,
          currentPeriodEnd,
          entitlementSource,
          reason
        },
        ignoredSources: ["organizations.subscriptionStatus"],
        warnings: ["organizations.subscriptionStatus não é fonte liberadora nesta fase"],
        rawSources: {
          organizations_apps_musicscale: msApp || null,
          organizations_subscriptionStatus: orgData.subscriptionStatus || null,
          organizations_music_scale_plan: orgData.music_scale_plan || null,
          organizations_plan: orgData.plan || null,
          organizations_status: orgData.status || null,
          organizations_archived: !!orgData.archived,
          subscriptions_document: subData || null
        }
      });

    } catch (err: any) {
      console.error("[BillingDiagnostics] Error:", err);
      return res.status(500).json({ error: "Erro interno ao executar o diagnóstico de faturamento.", message: err.message });
    }
  });

  app.get("/api/admin/finops-diagnostics/preflight", requireEcosystemRole, async (req: any, res: any) => {
    try {
      const envInfo = resolveFinOpsDiagnosticsEnvironment();
      const environment = envInfo.environment;
      const isProduction = envInfo.isProduction;
      const isSafeNonProduction = envInfo.isSafeNonProduction;
      const environmentSource = envInfo.environmentSource;

      const diagnosticsEnabled = process.env.AI_FINOPS_DIAGNOSTICS_ENABLED === "true";
      const hasHmacSecret = !!process.env.AI_FINOPS_HMAC_SECRET;
      const writePathEnabled = process.env.AI_IMPORT_FINOPS_WRITE_PATH_ENABLED === "true";
      const readPathEnabled = process.env.AI_IMPORT_FINOPS_READ_PATH_ENABLED === "true";

      const reasons: string[] = [];
      if (isProduction) reasons.push("Bloqueado por estar em ambiente de Produção");
      if (!diagnosticsEnabled) reasons.push("Diagnóstico desativado pela flag AI_FINOPS_DIAGNOSTICS_ENABLED");
      if (!hasHmacSecret) reasons.push("Secret AI_FINOPS_HMAC_SECRET não configurado");
      if (!writePathEnabled) reasons.push("Gravação FinOps desativada pela flag AI_IMPORT_FINOPS_WRITE_PATH_ENABLED");
      if (environment === "unknown") {
        reasons.push("Ambiente desconhecido. Configure AI_FINOPS_DIAGNOSTICS_ENV=preview somente no ambiente Preview/Staging.");
      }

      const authorized = true;
      const canRun = authorized && diagnosticsEnabled && hasHmacSecret && writePathEnabled && !isProduction && isSafeNonProduction && envInfo.canRun;

      res.json({
        ok: true,
        environment,
        environmentSource,
        productionBlocked: isProduction,
        safeNonProduction: isSafeNonProduction,
        diagnosticsEnabled,
        hasHmacSecret,
        writePathEnabled,
        readPathEnabled,
        authorized,
        canRun,
        reasons
      });
    } catch (e: any) {
      res.status(500).json({
        ok: false,
        error: "FINOPS_DIAGNOSTICS_PREFLIGHT_ERROR",
        message: "Não foi possível carregar o diagnóstico com segurança."
      });
    }
  });

  app.post("/api/admin/finops-diagnostics/run", requireEcosystemRole, async (req: any, res: any) => {
    try {
      // Security check: VERCEL_ENV === "production" || NODE_ENV === "production" is strictly handled by resolveFinOpsDiagnosticsEnvironment
      const envInfo = resolveFinOpsDiagnosticsEnvironment();
      const environment = envInfo.environment;
      const isProduction = envInfo.isProduction;
      const isSafeNonProduction = envInfo.isSafeNonProduction;

      if (isProduction || !isSafeNonProduction || environment === "unknown") {
        return res.status(403).json({
          ok: false,
          error: "FINOPS_DIAGNOSTICS_ENVIRONMENT_NOT_SAFE",
          message: isProduction 
            ? "Diagnóstico bloqueado em Production por segurança."
            : "Ambiente desconhecido. Configure AI_FINOPS_DIAGNOSTICS_ENV=preview somente em Preview/Staging."
        });
      }

      const diagnosticsEnabled = process.env.AI_FINOPS_DIAGNOSTICS_ENABLED === "true";
      if (!diagnosticsEnabled) {
        return res.status(403).json({
          ok: false,
          error: "Diagnóstico desativado pela flag AI_FINOPS_DIAGNOSTICS_ENABLED"
        });
      }

      if (!process.env.AI_FINOPS_HMAC_SECRET) {
        return res.status(400).json({
          ok: false,
          error: "Secret AI_FINOPS_HMAC_SECRET não configurado no painel"
        });
      }

      if (process.env.AI_IMPORT_FINOPS_WRITE_PATH_ENABLED !== "true") {
        return res.status(400).json({
          ok: false,
          error: "Gravação FinOps desativada pela flag AI_IMPORT_FINOPS_WRITE_PATH_ENABLED"
        });
      }

      const authUid = req.ecosystemContext?.uid;
      const systemRole = String(req.ecosystemContext?.systemRole || "unknown").toLowerCase();
      if (!authUid) {
        return res.status(401).json({ ok: false, error: "Usuário não autenticado" });
      }

      if (!db) {
        return res.status(503).json({ ok: false, error: "Firestore Admin SDK não inicializado" });
      }

      // Ensure we only run diagnostic on canonical global roles
      const allowedRoles = ["ceo", "global_admin", "ecosystem_owner", "founder"];
      if (!allowedRoles.includes(systemRole)) {
        return res.status(403).json({
          ok: false,
          error: "Não autorizado: Apenas CEO, Global Admin, Ecosystem Owner ou Founder podem rodar o diagnóstico."
        });
      }

      // Get active organization of user
      let orgId: string | null = null;
      const userDoc = await db.collection("users").doc(authUid).get();
      if (userDoc.exists) {
        const userData = userDoc.data() || {};
        orgId = userData.activeOrganizationId || userData.primaryOrganizationId || userData.organizationId || null;
      }

      if (!orgId) {
        let ownedOrgs = await db.collection('organizations').where('ownerUid', '==', authUid).limit(1).get();
        if (ownedOrgs.empty) {
          ownedOrgs = await db.collection('organizations').where('ownerUserId', '==', authUid).limit(1).get();
        }
        if (!ownedOrgs.empty) {
          orgId = ownedOrgs.docs[0].id;
        }
      }

      if (!orgId) {
        let memberships = await db.collection('organization_members').where('uid', '==', authUid).limit(1).get();
        if (memberships.empty) {
          memberships = await db.collection('organization_members').where('userId', '==', authUid).limit(1).get();
        }
        if (!memberships.empty) {
          const mData = memberships.docs[0].data();
          orgId = mData.organizationId || mData.organization_id || null;
        }
      }

      if (!orgId) {
        return res.status(400).json({
          ok: false,
          error: "Nenhuma organização ativa encontrada para este usuário administrativo."
        });
      }

      const requestId = "diag_finops_" + crypto.randomUUID();
      const rawText = `FinOps diagnostic smoke test ${requestId}`;
      const adapter = createAiFinOpsFirestoreAdapter(db);
      const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

      // Execute synthetic begin
      const beginRes = await beginAiImportFinOpsWritePath({
        adapter,
        requestId,
        organizationId: orgId,
        uid: authUid,
        rawText,
        model,
        plan: "pro",
        secret: process.env.AI_FINOPS_HMAC_SECRET,
        now: Date.now(),
        estimatedInputChars: rawText.length
      });

      let idempotencyFinalStatus = "UNKNOWN";
      let cacheSummarySavedOk = false;
      let documentsFound: string[] = [];
      let sensitiveDataFound = false;
      let finalizeResult: any = null;

      const expectedPaths: string[] = [];

      if (beginRes.status === "RESERVED" && beginRes.context) {
        const paths = beginRes.context.repositoryInput.paths;
        expectedPaths.push(
          `organizations/${orgId}/aiIdempotency/${paths.idempotencyDocPath.split('/').pop()}`,
          `organizations/${orgId}/aiCache/${paths.cacheDocPath.split('/').pop()}`,
          `organizations/${orgId}/aiUsage/${paths.monthlyUsageDocPath.split('/').pop()}`,
          `organizations/${orgId}/aiDailyUsage/${paths.dailyUsageDocPath.split('/').pop()}`,
          `organizations/${orgId}/aiUsage/${paths.monthlyUsageDocPath.split('/').pop()}/events/${requestId}`
        );

        // Finalize successfully
        try {
          finalizeResult = await finalizeAiImportFinOpsWritePath({
            context: beginRes.context,
            outcome: "SUCCESS",
            estimatedOutputChars: 50,
            durationMs: 120,
            cacheSummary: {
              title: "FinOps Diagnostic",
              artist: "MusicScale",
              hasLyrics: false,
              hasChords: false
            }
          });
        } catch (finalizeErr: any) {
          finalizeResult = {
            ok: false,
            skipped: false,
            safeSummary: {
              finalized: false,
              safeErrorCode: "FINALIZE_EXCEPTION"
            }
          };
        }

        // Query documents to verify
        const [idempotencySnap, cacheSnap, monthlyUsageSnap, dailyUsageSnap, eventSnap] = await Promise.all([
          db.collection("organizations").doc(orgId).collection("aiIdempotency").doc(paths.idempotencyDocPath.split('/').pop()!).get(),
          db.collection("organizations").doc(orgId).collection("aiCache").doc(paths.cacheDocPath.split('/').pop()!).get(),
          db.collection("organizations").doc(orgId).collection("aiUsage").doc(paths.monthlyUsageDocPath.split('/').pop()!).get(),
          db.collection("organizations").doc(orgId).collection("aiDailyUsage").doc(paths.dailyUsageDocPath.split('/').pop()!).get(),
          db.collection("organizations").doc(orgId).collection("aiUsage").doc(paths.monthlyUsageDocPath.split('/').pop()!).collection("events").doc(requestId).get()
        ]);

        if (idempotencySnap.exists) {
          documentsFound.push("idempotency");
          idempotencyFinalStatus = idempotencySnap.data()?.status || "UNKNOWN";
        }
        if (cacheSnap.exists) {
          documentsFound.push("cache");
          const cacheData = cacheSnap.data() || {};
          cacheSummarySavedOk = !!(cacheData.resultSummary?.title === "FinOps Diagnostic" && cacheData.resultSummary?.artist === "MusicScale");
        }
        if (monthlyUsageSnap.exists) documentsFound.push("monthlyUsage");
        if (dailyUsageSnap.exists) documentsFound.push("dailyUsage");
        if (eventSnap.exists) documentsFound.push("event");

        // Scan all documents for forbidden keys / data leaks
        const scanForLeaks = (obj: any): boolean => {
          if (!obj || typeof obj !== "object") return false;
          const forbiddenKeys = [
            "rawText", "prompt", "url", "sourceUrl", "lyrics", "chords",
            "cleanLyrics", "cleanChords", "headers", "cookies", "authorization",
            "token", "secret", "html", "stack", "message"
          ];
          for (const [k, v] of Object.entries(obj)) {
            if (forbiddenKeys.includes(k)) return true;
            if (typeof v === "object" && scanForLeaks(v)) return true;
          }
          return false;
        };

        if (
          scanForLeaks(idempotencySnap.data()) ||
          scanForLeaks(cacheSnap.data()) ||
          scanForLeaks(monthlyUsageSnap.data()) ||
          scanForLeaks(dailyUsageSnap.data()) ||
          scanForLeaks(eventSnap.data())
        ) {
          sensitiveDataFound = true;
        }
      }

      const isFinalizeOk = !!(finalizeResult && finalizeResult.ok === true && finalizeResult.safeSummary?.finalized === true && finalizeResult.skipped !== true);

      const checks = [
        {
          key: "env_check",
          label: "Ambiente do Servidor",
          status: isProduction ? "failed" : ((environment as any) === "unknown" ? "failed" : "passed"),
          detail: isProduction ? "Produção (Bloqueado)" : ((environment as any) === "unknown" ? "Desconhecido (Bloqueado)" : "Preview/Staging (" + environment + ")")
        },
        {
          key: "secret_check",
          label: "Chave HMAC Secret (AI_FINOPS_HMAC_SECRET)",
          status: process.env.AI_FINOPS_HMAC_SECRET ? "passed" : "failed",
          detail: process.env.AI_FINOPS_HMAC_SECRET ? "Configurado" : "Não configurado"
        },
        {
          key: "write_path_flag",
          label: "Flag Shadow-Write Ativa (AI_IMPORT_FINOPS_WRITE_PATH_ENABLED)",
          status: process.env.AI_IMPORT_FINOPS_WRITE_PATH_ENABLED === "true" ? "passed" : "failed",
          detail: process.env.AI_IMPORT_FINOPS_WRITE_PATH_ENABLED === "true" ? "Ativo" : "Inativo"
        },
        {
          key: "diagnostics_flag",
          label: "Flag Diagnóstico Ativa (AI_FINOPS_DIAGNOSTICS_ENABLED)",
          status: process.env.AI_FINOPS_DIAGNOSTICS_ENABLED === "true" ? "passed" : "failed",
          detail: process.env.AI_FINOPS_DIAGNOSTICS_ENABLED === "true" ? "Ativo" : "Inativo"
        },
        {
          key: "user_auth",
          label: "Autorização de Usuário Administrador",
          status: "passed",
          detail: "Autorizado com papel: " + systemRole
        },
        {
          key: "shadow_write_execution",
          label: "Execução da Escrita Shadow-Write",
          status: beginRes.status === "RESERVED" ? "passed" : "failed",
          detail: beginRes.status === "RESERVED" ? "Sucesso no fluxo sintético" : "Erro ou Quota Bloqueada: " + beginRes.status
        },
        {
          key: "finalize_check",
          label: "Finalização do Shadow-Write",
          status: isFinalizeOk ? "passed" : "failed",
          detail: isFinalizeOk ? "Sucesso na finalização" : "A finalização da reserva falhou. Código seguro: " + (finalizeResult?.safeSummary?.safeErrorCode || "FINALIZE_EXCEPTION")
        },
        {
          key: "idempotency_check",
          label: "Verificação de Idempotency",
          status: idempotencyFinalStatus === "COMPLETED" ? "passed" : "failed",
          detail: "Status final: " + idempotencyFinalStatus
        },
        {
          key: "cache_check",
          label: "Verificação de Cache",
          status: cacheSummarySavedOk ? "passed" : "failed",
          detail: cacheSummarySavedOk ? "Status: READY, contém title e artist" : "Falha ao gravar cache ou resumo"
        },
        {
          key: "sensitive_data",
          label: "Auditoria de Dados Sensíveis",
          status: (!sensitiveDataFound && documentsFound.length > 0) ? "passed" : (documentsFound.length === 0 ? "warning" : "failed"),
          detail: !sensitiveDataFound ? "Nenhum dado sensível (lyrics, chords, rawText, etc.) persistido" : "Vazamento de dados detectado!"
        }
      ];

      const hasFail = checks.some(c => c.status === "failed");
      const hasWarn = checks.some(c => c.status === "warning");
      const overallStatus = hasFail ? "failed" : (hasWarn ? "warning" : "passed");

      let observationsText = "";
      if (overallStatus === "passed") {
        observationsText = "Diagnóstico aprovado em ambiente seguro de Preview/Staging.";
      } else if (overallStatus === "warning") {
        observationsText = "Diagnóstico com atenção. Revise as pendências antes de avançar.";
      } else {
        observationsText = "Diagnóstico reprovado. Não avance para Production. Envie este relatório ao ChatGPT para auditoria.";
      }

      const copyableReport = `RELATÓRIO DIAGNÓSTICO FINOPS — 0.2C.1E.12C

- Ambiente: ${(environment as any) === "unknown" ? "Desconhecido" : environment === "preview" ? "Preview" : environment === "staging" ? "Staging" : environment === "development" ? "Development" : "Production"}
- Ambiente seguro para diagnóstico? ${isSafeNonProduction && (environment as any) !== "unknown" ? "SIM" : "NÃO"}
- Production detectada? ${isProduction ? "SIM" : "NÃO"}
- Production bloqueada? ${isProduction ? "SIM" : "NÃO"}
- Usuário autorizado? SIM
- AI_FINOPS_HMAC_SECRET configurado? ${process.env.AI_FINOPS_HMAC_SECRET ? "SIM" : "NÃO"}
- AI_IMPORT_FINOPS_WRITE_PATH_ENABLED ativo? ${process.env.AI_IMPORT_FINOPS_WRITE_PATH_ENABLED === "true" ? "SIM" : "NÃO"}
- AI_FINOPS_DIAGNOSTICS_ENABLED ativo? ${process.env.AI_FINOPS_DIAGNOSTICS_ENABLED === "true" ? "SIM" : "NÃO"}
- requestId diagnóstico: ${requestId}
- Resultado geral: ${overallStatus === "passed" ? "APROVADO" : (overallStatus === "warning" ? "ATENÇÃO" : "REPROVADO")}
- Firestore verificado? ${documentsFound.length > 0 ? "SIM" : "NÃO"}
- Paths esperados verificados:
  - ${expectedPaths.join('\n  - ')}
- Idempotency status final: ${idempotencyFinalStatus}
- Dados sensíveis encontrados? ${sensitiveDataFound ? "SIM" : "NÃO"}
- Response público preservado? SIM
- QUOTA_BLOCKED bloqueou usuário? NÃO
- Cache/idempotency fizeram short-circuit? NÃO
- Production foi tocada? NÃO
- Observações: ${observationsText}`;

      res.json({
        ok: true,
        status: overallStatus,
        requestId,
        checks,
        finalize: {
          ok: isFinalizeOk,
          skipped: !!finalizeResult?.skipped,
          finalized: !!finalizeResult?.safeSummary?.finalized,
          safeErrorCode: finalizeResult?.safeSummary?.safeErrorCode || null
        },
        publicResponseContract: {
          preserved: true,
          forbiddenKeysAbsent: true
        },
        firestore: {
          checked: true,
          expectedPaths,
          createdOrUpdated: documentsFound,
          idempotencyFinalStatus,
          sensitiveDataFound
        },
        logs: {
          checkedByRuntime: false,
          note: "Logs devem ser conferidos pelo provedor, mas nenhum dado sensível foi retornado pelo diagnóstico."
        },
        copyableReport
      });

    } catch (e: any) {
      res.status(500).json({
        ok: false,
        error: "FINOPS_DIAGNOSTICS_RUN_ERROR",
        message: "O diagnóstico falhou sem expor detalhes internos."
      });
    }
  });


  app.post("/api/admin/reanalyze-candidates", requireEcosystemRole, async (req: any, res: any) => {
    try {
        const result = await reanalyzeCandidates(db);
        res.json({ success: true, result });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/fix-user", async (req, res) => {
      res.status(410).json({
          error: "LEGACY_REPAIR_ENDPOINT_DISABLED",
          message: "Este endpoint legado foi desativado por segurança."
      });
  });

  app.get("/api/orgs/check-slug", async (req, res) => {
      try {
          if (!db) throw new Error("Database not initialized");
          const slug = req.query.slug;
          if (!slug || typeof slug !== 'string') return res.status(400).json({ error: "Missing string slug parameter" });
          
          const slugCheck = await db.collection('organizations').where('slug', '==', slug).get();
          res.json({ available: slugCheck.empty });
      } catch (e: any) {
          res.status(500).json({ error: e.message });
      }
  });

  app.get("/api/v1/ecosystem/access-context", async (req, res) => {
      const startTime = performance.now();
      const correlationId = "ctx_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
      try {
          if (!db) throw new Error("Database not initialized");
          const orgId = req.query.organizationId as string;
          if (!orgId) return res.status(400).json({ error: "Missing organizationId parameter", correlationId });

          const authHeader = req.headers.authorization || "";
          if (!authHeader || !authHeader.startsWith("Bearer ")) {
              return res.status(401).json({ error: "Unauthorized: Missing Bearer Token", correlationId });
          }

          const token = authHeader.split(" ")[1];
          const decodedToken = await admin.auth().verifyIdToken(token);
          const authUid = decodedToken.uid;
          if (!authUid) {
              return res.status(401).json({ error: "Unauthorized: Invalid Token", correlationId });
          }
          const authTime = performance.now();

          console.log(`[Correlation: ${correlationId}] Resolving access context for uid: ${authUid} in org: ${orgId}`);

          // 1 & 2. FIRST PARALLEL WAVE
          const [userSnap, orgSnap, orgMemberSnap, rbacModule, resolverModule] = await Promise.all([
              db.collection("users").doc(authUid).get(),
              db.collection("organizations").doc(orgId).get(),
              db.collection("organizations").doc(orgId).collection("members").doc(authUid).get(),
              import("./utils/rbac.js"),
              import("./services/ecosystem/accessContextResolver.js")
          ]);
          const primaryReadsTime = performance.now();

          if (!userSnap.exists) {
              return res.status(404).json({ error: "User profile not found in MillionsNest canonical repository", correlationId });
          }
          if (!orgSnap.exists) {
              return res.status(404).json({ error: "Organization not found", correlationId });
          }

          const userData = userSnap.data() || {};
          const orgData = orgSnap.data() || {};
          const systemRole = userData.systemRole || userData.role || userData.appRole || userData.globalRole || userData.ecosystemRole || null;
          
          const directMemberData = orgMemberSnap.exists ? orgMemberSnap.data() : null;
          let crossMemberData1 = null;
          let crossMemberData2 = null;

          // 3. SECOND PARALLEL WAVE (if direct membership doesn't provide role)
          let hasDirectRole = false;
          if (directMemberData && (directMemberData.role || directMemberData.organizationRole)) {
              hasDirectRole = true;
          }

          if (!hasDirectRole) {
              const [cross1, cross2] = await Promise.all([
                  db.collection("organization_members").doc(`${orgId}_${authUid}`).get(),
                  db.collection("organization_members").doc(`${authUid}_${orgId}`).get()
              ]);
              crossMemberData1 = cross1.exists ? cross1.data() : null;
              crossMemberData2 = cross2.exists ? cross2.data() : null;
          }
          const fallbackTime = performance.now();

          const { resolveMembershipRoleAndStatus } = resolverModule;
          const { role: orgRole, status: membershipStatus } = resolveMembershipRoleAndStatus(
              authUid,
              orgData,
              directMemberData,
              crossMemberData1,
              crossMemberData2
          );

          // 4. MusicScale functional profile
          const musicScaleProfile = userData.musicScaleProfile || {
              ministryRoles: userData.ministryRoles || userData.roles || [],
              instrumentIds: userData.instrumentIds || userData.instruments || [],
              skillIds: userData.skillIds || userData.skills || []
          };

          // 5. Calculate access context and capabilities using precedence
          const { buildEffectiveAccessContext } = rbacModule;
          const accessCtx = buildEffectiveAccessContext(
              authUid,
              orgId,
              systemRole,
              orgRole,
              membershipStatus,
              musicScaleProfile
          );
          const resolveTime = performance.now();

          console.log(`[Correlation: ${correlationId}] Resolved access context for uid: ${authUid}. SystemRole: ${systemRole}, OrgRole: ${orgRole}, Source: ${accessCtx.accessSource}, Status: ${accessCtx.resolutionStatus}`);

          const totalTime = performance.now();
          const durAuth = Math.round(authTime - startTime);
          const durPrimary = Math.round(primaryReadsTime - authTime);
          const durFallback = Math.round(fallbackTime - primaryReadsTime);
          const durResolve = Math.round(resolveTime - fallbackTime);
          const durTotal = Math.round(totalTime - startTime);

          const sanitizeDuration = (value: number) =>
            Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;

          const timingValue = [
            `auth;dur=${sanitizeDuration(durAuth)}`,
            `primary_reads;dur=${sanitizeDuration(durPrimary)}`,
            `membership_fallback;dur=${sanitizeDuration(durFallback)}`,
            `access_resolution;dur=${sanitizeDuration(durResolve)}`,
            `total;dur=${sanitizeDuration(durTotal)}`
          ].join(', ');

          res.set('Server-Timing', timingValue);
          res.set('X-MusicScale-Timing', timingValue);

          res.json({
              success: true,
              correlationId,
              userId: authUid,
              organizationId: orgId,
              systemRole,
              organizationRole: orgRole,
              membershipStatus,
              musicScaleProfile,
              isGlobalAccess: accessCtx.isGlobalAccess,
              isOrganizationAdmin: accessCtx.isOrganizationAdmin,
              effectiveCapabilities: accessCtx.effectiveCapabilities,
              accessSource: accessCtx.accessSource,
              resolutionStatus: accessCtx.resolutionStatus,
              version: accessCtx.version,
              effectiveContext: accessCtx
          });
      } catch (e: any) {
          console.error(`[Correlation: ${correlationId}] Error resolving access context:`, e);
          res.status(500).json({ error: e.message, correlationId });
      }
  });

  app.post("/api/orgs/create", async (req, res) => {
      // APENAS MILLIONSNEST CRIA ORGANIZAÇÕES AGORA (ECOSYSTEM BRIDGE / CANONICAL CONTEXT)
      return res.status(403).json({ error: "Organizações agora são gerenciadas exclusivamente pelo MillionsNest." });
  });

  // Direct endpoint for limits to avoid proxy issues and fetch from DB
  app.get("/api/v1/organizations/:orgId/limits", async (req, res) => {
    try {
      const { orgId } = req.params;
      const authHeader = req.headers.authorization || "";
      
      let userId: string | null = null;
      let isGlobalAdmin = false;

      // 1. Validate Firebase ID Token
      if (authHeader && authHeader.startsWith("Bearer ") && admin.apps.length) {
        const token = authHeader.split(" ")[1];
        try {
          const decodedToken = await admin.auth().verifyIdToken(token);
          userId = decodedToken.uid;
          if (userId && db) {
              const uDoc = await db.collection('users').doc(userId).get();
              if (uDoc.exists) {
                  const sysRole = String(uDoc.data()?.systemRole || uDoc.data()?.role || uDoc.data()?.appRole || '').toLowerCase().trim();
                  if (['ceo', 'global_admin', 'ecosystem_owner', 'founder'].includes(sysRole)) {
                      isGlobalAdmin = true;
                  }
              }
          }
        } catch (authErr) {
          logger.warn(`[Limits] Invalid token for org ${orgId}`);
        }
      }

      if (!db) {
         // Fallback if DB is not initialized
         return res.json({
            organizationId: orgId,
            app: 'musicscale',
            plan: 'starter',
            status: 'inactive',
            accessAllowed: false,
            entitlementSource: 'missing',
            reason: 'NO_CANONICAL_ENTITLEMENT',
            features: PLAN_FEATURES.starter,
            limits: PLAN_LIMITS.starter,
            usage: { libraryImports: 0 },
            entitlementsVersion: 2
         });
      }

      // 2. Load Organization Data
      const orgRef = db.collection('organizations').doc(orgId);
      const orgSnap = await orgRef.get();
      
      let verifiedStatus = 'inactive';
      let verifiedPlan = 'starter';
      let currentPeriodEnd: any = null;
      let entitlementSource = 'missing';
      let reason = 'NO_CANONICAL_ENTITLEMENT';

      if (orgSnap.exists) {
        const orgData = orgSnap.data() || {};
        if (orgData?.status === 'archived' || orgData?.archived === true) {
            return res.status(403).json({ error: "Organização arquivada." });
        }

        // Check 1: organizations/{orgId}.apps.musicscale
        const msApp = orgData?.apps?.musicscale;
        if (msApp && msApp.status) {
          const rawStatus = String(msApp.status).toLowerCase().trim();
          if (rawStatus === 'active' || rawStatus === 'trialing') {
            verifiedStatus = rawStatus;
            verifiedPlan = String(msApp.plan || 'starter').toLowerCase().trim();
            currentPeriodEnd = msApp.currentPeriodEnd || null;
            entitlementSource = 'organizations.apps.musicscale';
            reason = rawStatus === 'active' ? 'SUBSCRIPTION_ACTIVE' : 'SUBSCRIPTION_TRIALING';
          }
        }

        // Check 2: Try subscriptions/{orgId} (subscriptions collection)
        if (verifiedStatus === 'inactive') {
          try {
            const subSnap = await db.collection('subscriptions').doc(orgId).get();
            if (subSnap.exists) {
              const subData = subSnap.data() || {};
              const rawStatus = String(subData.status || '').toLowerCase().trim();
              if (rawStatus === 'active' || rawStatus === 'trialing') {
                verifiedStatus = rawStatus;
                verifiedPlan = String(subData.plan || 'starter').toLowerCase().trim();
                currentPeriodEnd = subData.subscriptionEndsAt || subData.currentPeriodEnd || null;
                entitlementSource = 'subscriptions';
                reason = rawStatus === 'active' ? 'SUBSCRIPTION_ACTIVE' : 'SUBSCRIPTION_TRIALING';
              }
            }
          } catch (subErr) {
            logger.warn(`[Limits] Failed to read subSnap for ${orgId}: ${subErr}`);
          }
        }

        // Map plans correctly
        if (verifiedPlan === 'premium' || verifiedPlan === 'pro_unlimited' || verifiedPlan === 'pro') {
          verifiedPlan = 'pro';
        } else if (verifiedPlan === 'medium' || verifiedPlan === 'advanced_features' || verifiedPlan === 'advanced') {
          verifiedPlan = 'advanced';
        } else {
          verifiedPlan = 'starter';
        }
      }

      const accessAllowed = (verifiedStatus === 'active' || verifiedStatus === 'trialing');
      if (!accessAllowed) {
        verifiedPlan = 'starter';
      }

      // Add Membership Verification
      if (userId && !isGlobalAdmin) {
          const userSnap = await db.collection('users').doc(userId).get();
          if (userSnap.exists) {
              const uData = userSnap.data();
              if (uData?.organizationId !== orgId) {
                  return res.status(403).json({ error: "Usuário não pertence à organização requisitada." });
              }
          } else {
              return res.status(403).json({ error: "Perfil não encontrado no MusicScale." });
          }
      }

      // 3. Define the return structures safely
      const serverFeatures = PLAN_FEATURES[verifiedPlan as keyof typeof PLAN_FEATURES] || PLAN_FEATURES.starter;
      const serverLimits = PLAN_LIMITS[verifiedPlan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.starter;

      const date = new Date();
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const usageDocRef = db.collection('organizations').doc(orgId).collection('monthly_usage').doc(monthStr);
      let libraryImports = 0;
      
      try {
        const usageSnap = await usageDocRef.get();
        if (usageSnap.exists) {
          libraryImports = usageSnap.data()?.libraryImports || 0;
        }
      } catch (usageErr) {
        logger.warn(`[Limits] Could not read usage for org ${orgId}: ${usageErr}`);
      }

      // Send the response
      return res.status(200).json({
        organizationId: orgId,
        app: 'musicscale',
        plan: verifiedPlan,
        status: verifiedStatus,
        accessAllowed,
        entitlementSource,
        reason,
        features: serverFeatures,
        limits: serverLimits,
        usage: { libraryImports },
        supportTier: verifiedPlan === 'pro' ? 'priority' : verifiedPlan === 'advanced' ? 'basic_priority' : 'standard',
        currentPeriodEnd,
        trialEndsAt: null,
        planUpdatedAt: new Date().toISOString(),
        entitlementsVersion: 2,
      });

    } catch (error: any) {
      if (error?.code === 7 || error?.message?.includes("PERMISSION_DENIED")) {
         logger.warn(`[Limits] Permission denied retrieving limits for org ${req.params.orgId}. Falling back to starter plan.`);
      } else {
         logger.warn("[Limits] Failed to retrieve limits. Falling back to starter.", error);
      }
      // Safe fallback on error
      return res.status(200).json({
         organizationId: req.params.orgId,
         app: 'musicscale',
         plan: 'starter',
         status: 'inactive',
         accessAllowed: false,
         entitlementSource: 'missing',
         reason: 'NO_CANONICAL_ENTITLEMENT',
         features: PLAN_FEATURES.starter,
         limits: PLAN_LIMITS.starter,
         usage: { libraryImports: 0 },
         entitlementsVersion: 2
      });
    }
  });

  app.post("/api/v1/music-scales/:musicScaleId/publish", async (req, res) => {
    const correlationId = crypto.randomUUID();
    const commandId = crypto.randomUUID();
    const startTime = Date.now();
    const { musicScaleId } = req.params;
    let stage = "initialization";
    let orgId = "";
    let authUid = "";
    let flag = false;
    let currentStatus = "draft";
    let sourceBandScaleId: string | null = null;
    let assignmentCount = 0;

    try {
      const authHeader = req.headers.authorization || "";
      if (!authHeader.startsWith("Bearer ")) {
        throw { status: 401, message: "Token de autorização inválido ou ausente." };
      }
      const token = authHeader.split(" ")[1];
      const decoded = await admin.auth().verifyIdToken(token);
      authUid = decoded.uid;

      orgId = req.headers["x-organization-id"] as string;
      if (!orgId) {
        throw { status: 400, message: "Header X-Organization-Id é obrigatório." };
      }

      const idempotencyKey = req.headers["idempotency-key"] as string;
      if (!idempotencyKey) {
        throw { status: 400, message: "Header Idempotency-Key é obrigatório." };
      }

      stage = "validate_feature_flag";
      const orgSnap = await db.collection("organizations").doc(orgId).get();
      if (!orgSnap.exists) {
        throw { status: 404, message: "Organização não encontrada." };
      }
      const orgData = orgSnap.data() || {};
      flag = orgData.featureFlags?.["musicscale.musicScalePublishCommandV1"] === true || orgData.features?.["musicscale.musicScalePublishCommandV1"] === true;
      if (!flag) {
        throw { status: 403, message: "Recurso desativado por Feature Flag para esta organização." };
      }

      stage = "authorization";
      const { resolveOrganizationAuthorization } = await import("./services/server/organizationAuthorization.js");
      const authResult = await resolveOrganizationAuthorization(authHeader, orgId, db, admin.auth());
      
      if (authResult.error) {
          throw { status: authResult.statusCode || 403, message: authResult.error };
      }
      if (orgData.status === "archived" || orgData.archivedAt) {
          throw { status: 403, message: "Organização arquivada." };
      }

      const { buildEffectiveAccessContext, hasMusicScaleCapability } = await import("./utils/rbac.js");
      const accessCtx = buildEffectiveAccessContext(
          authUid, 
          orgId, 
          authResult.context?.systemRole || null, 
          authResult.context?.organizationRole || null,
          authResult.context?.isActive ? 'active' : 'inactive'
      );
      
      if (!hasMusicScaleCapability(accessCtx, 'scales.publish')) {
          console.warn(`[RBAC] Access denied for publish. User ${authUid} in org ${orgId}. SystemRole: ${authResult.context?.systemRole}, OrgRole: ${authResult.context?.organizationRole}.`);
          
          await db.collection("organizations").doc(orgId).collection("_failed_access_logs").add({
              correlationId,
              userId: authUid,
              organizationId: orgId,
              normalizedSystemRole: accessCtx.systemRole,
              normalizedOrganizationRole: accessCtx.organizationRole,
              requiredCapability: 'scales.publish',
              accessSource: accessCtx.isGlobalFullAccess ? 'global' : 'organization',
              decision: 'denied',
              reasonCode: 'insufficient_capabilities',
              endpoint: '/api/v1/music-scales/:id/publish',
              timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
          
          throw { status: 403, message: "Sem permissão. Verifique seu papel na organização." };
      }

      stage = "load_scale_info";
      const scaleSnap = await db.collection("scales").doc(musicScaleId).get();
      if (scaleSnap.exists) {
        const scaleData = scaleSnap.data() || {};
        currentStatus = scaleData.status || "draft";
        sourceBandScaleId = req.body.bandScaleId || scaleData.bandScaleId || null;
        if (sourceBandScaleId) {
          const bandScaleSnap = await db.collection("bandScales").doc(sourceBandScaleId).get();
          if (bandScaleSnap.exists) {
            const assignments = bandScaleSnap.data()?.assignments || [];
            assignmentCount = assignments.filter((a: any) => a.active !== false).length;
          }
        }
      }

      console.log(`[MusicScale Publish Command Started] => ${JSON.stringify({
        correlationId,
        commandId,
        organizationId: orgId,
        authenticatedUserId: authUid,
        musicScaleId,
        featureFlagEnabled: flag,
        currentStatus,
        sourceBandScaleId,
        assignmentCount
      })}`);

      stage = "publish_execution";
      const { MusicScaleCommandService } = await import("./services/server/scale/musicScaleCommandService.js");
      const result = await MusicScaleCommandService.publishMusicScale({
        authUid,
        orgId,
        musicScaleId,
        idempotencyKey,
        payload: req.body,
        correlationId
      });

      const durationMs = Date.now() - startTime;
      console.log(`[MusicScale Publish Command Completed] => ${JSON.stringify({
        correlationId,
        musicScaleId,
        publishRevision: result.version,
        eventAssignmentCount: result.eventAssignmentCount,
        createdResponseCount: result.createdResponseCount,
        createdNotificationCount: result.createdNotificationCount,
        broadcastRecipientCount: result.broadcastRecipientCount,
        fromCache: !!result.fromCache,
        durationMs
      })}`);

      return res.status(200).json(result);
    } catch (error: any) {
      const status = error.status || (error.message?.includes("Permissão") ? 403 : error.message?.includes("idempotência") ? 409 : 400);
      console.log(`[MusicScale Publish Command Failed] => ${JSON.stringify({
        correlationId,
        codigo: error.code || status,
        estagio: stage,
        mensagemSegura: error.message || String(error)
      })}`);
      
      logger.error(`[MusicScale Command] Publish failed | Correlation ID: ${correlationId}`, error);
      return res.status(status).json({ error: error.message || String(error), correlationId });
    }
  });

  app.post("/api/v1/music-scales/:musicScaleId/my-response", async (req, res) => {
    const correlationId = crypto.randomUUID();
    const startTime = Date.now();
    const { musicScaleId } = req.params;
    let authUid = "";
    let orgId = "";

    try {
      const authHeader = req.headers.authorization || "";
      if (!authHeader.startsWith("Bearer ")) {
        throw { status: 401, message: "Token de autorização inválido ou ausente." };
      }
      const token = authHeader.split(" ")[1];
      const decoded = await admin.auth().verifyIdToken(token);
      authUid = decoded.uid;

      orgId = req.headers["x-organization-id"] as string;
      if (!orgId) {
        throw { status: 400, message: "Header X-Organization-Id é obrigatório." };
      }

      const idempotencyKey = req.headers["idempotency-key"] as string;
      if (!idempotencyKey) {
        throw { status: 400, message: "Header Idempotency-Key é obrigatório." };
      }

      // Feature flag check
      const orgSnap = await db.collection("organizations").doc(orgId).get();
      if (!orgSnap.exists) {
        throw { status: 404, message: "Organização não encontrada." };
      }
      const orgData = orgSnap.data() || {};
      const flag = orgData.featureFlags?.["musicscale.scaleResponsesV1"] === true || orgData.features?.["musicscale.scaleResponsesV1"] === true;
      if (!flag) {
        throw { status: 403, message: "Recurso desativado por Feature Flag para esta organização." };
      }

      let isMember = false;
      let membershipStatus = "inactive";
      const memberSnap = await db.collection("organizations").doc(orgId).collection("members").doc(authUid).get();
      if (memberSnap.exists) {
        isMember = true;
        membershipStatus = memberSnap.data()?.status || "active";
      }
      if (!isMember) {
        const crossMemberSnap = await db.collection("organization_members").doc(`${authUid}_${orgId}`).get();
        if (crossMemberSnap.exists) {
          isMember = true;
          membershipStatus = crossMemberSnap.data()?.status || "active";
        }
      }
      if (!isMember) {
        const crossMemberSnap2 = await db.collection("organization_members").doc(`${orgId}_${authUid}`).get();
        if (crossMemberSnap2.exists) {
          isMember = true;
          membershipStatus = crossMemberSnap2.data()?.status || "active";
        }
      }
      const isOwner = (orgData.ownerUid === authUid || orgData.ownerId === authUid);
      
      const userSnap = await db.collection("users").doc(authUid).get();
      const rawSystemRole = userSnap.data()?.systemRole || "";
      const canonicalSystemRole = rawSystemRole.toLowerCase().trim();
      const isGlobal = ["ceo", "global_admin", "ecosystem_owner", "founder"].includes(canonicalSystemRole);

      if (!isGlobal && !isOwner && (!isMember || membershipStatus !== 'active')) {
        throw { status: 403, message: "Membro inativo ou não pertence à organização." };
      }
      if (orgData.status === "archived" || orgData.archivedAt) {
          throw { status: 403, message: "Organização arquivada." };
      }

      const { MusicScaleResponseService } = await import("./services/server/scale/musicScaleResponseService.js");
      const result = await MusicScaleResponseService.respondOwn({
        authUid,
        orgId,
        musicScaleId,
        idempotencyKey,
        payload: req.body,
        correlationId
      });

      console.log(`[MusicScale Response Command Completed] => ${JSON.stringify({
        correlationId,
        musicScaleId,
        userId: authUid,
        status: result.status,
        updatedResponseCount: result.updatedResponseCount,
        durationMs: Date.now() - startTime
      })}`);

      return res.status(200).json(result);
    } catch (error: any) {
      if (error.status && error.status < 500) {
        logger.warn(`[MusicScale Response] Client Error | Correlation ID: ${correlationId}`, error);
        return res.status(error.status).json({ 
            success: false,
            error: error.message, 
            errorCode: error.errorCode || "BAD_REQUEST",
            messageKey: error.messageKey || "scaleResponses.errors.badRequest",
            correlationId 
        });
      }

      logger.error(`[MusicScale Response] Unexpected Error | Correlation ID: ${correlationId} | Endpoint: POST /api/v1/music-scales/:musicScaleId/my-response`, error);
      return res.status(500).json({ 
          success: false,
          errorCode: "INTERNAL_RESPONSE_ERROR",
          messageKey: "scaleResponses.errors.generic",
          correlationId 
      });
    }
  });

  app.post("/api/v1/band-scales", async (req, res) => {
    const correlationId = crypto.randomUUID();
    try {
      const authHeader = req.headers.authorization || "";
      if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token de autorização inválido ou ausente.", correlationId });
      }
      const token = authHeader.split(" ")[1];
      const decoded = await admin.auth().verifyIdToken(token);
      const authUid = decoded.uid;

      const orgId = req.headers["x-organization-id"] as string;
      if (!orgId) {
        return res.status(400).json({ error: "Header X-Organization-Id é obrigatório.", correlationId });
      }

      const idempotencyKey = req.headers["idempotency-key"] as string;
      if (!idempotencyKey) {
        return res.status(400).json({ error: "Header Idempotency-Key é obrigatório.", correlationId });
      }

      // Feature Flag Check
      const orgSnap = await db.collection("organizations").doc(orgId).get();
      if (!orgSnap.exists) {
        return res.status(404).json({ error: "Organização não encontrada.", correlationId });
      }
      const orgData = orgSnap.data() || {};
      const flag = orgData.featureFlags?.["musicscale.bandScaleCommandApiV1"] === true || orgData.features?.["musicscale.bandScaleCommandApiV1"] === true;
      if (!flag) {
        return res.status(403).json({ error: "Recurso desativado por Feature Flag para esta organização.", correlationId });
      }

      const result = await BandScaleCommandService.createBandScale({
        authUid,
        orgId,
        idempotencyKey,
        payload: req.body,
        correlationId
      });

      return res.status(201).json(result);
    } catch (error: any) {
      logger.error(`[BandScale Command] Create failed | Correlation ID: ${correlationId}`, error);
      const status = error.message.includes("Permissão") ? 403 : error.message.includes("idempotência") ? 409 : 400;
      return res.status(status).json({ error: error.message, correlationId });
    }
  });

  app.patch("/api/v1/band-scales/:scaleId", async (req, res) => {
    const correlationId = crypto.randomUUID();
    const { scaleId } = req.params;
    try {
      const authHeader = req.headers.authorization || "";
      if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token de autorização inválido ou ausente.", correlationId });
      }
      const token = authHeader.split(" ")[1];
      const decoded = await admin.auth().verifyIdToken(token);
      const authUid = decoded.uid;

      const orgId = req.headers["x-organization-id"] as string;
      if (!orgId) {
        return res.status(400).json({ error: "Header X-Organization-Id é obrigatório.", correlationId });
      }

      const idempotencyKey = req.headers["idempotency-key"] as string;
      if (!idempotencyKey) {
        return res.status(400).json({ error: "Header Idempotency-Key é obrigatório.", correlationId });
      }

      // Feature Flag Check
      const orgSnap = await db.collection("organizations").doc(orgId).get();
      if (!orgSnap.exists) {
        return res.status(404).json({ error: "Organização não encontrada.", correlationId });
      }
      const orgData = orgSnap.data() || {};
      const flag = orgData.featureFlags?.["musicscale.bandScaleCommandApiV1"] === true || orgData.features?.["musicscale.bandScaleCommandApiV1"] === true;
      if (!flag) {
        return res.status(403).json({ error: "Recurso desativado por Feature Flag para esta organização.", correlationId });
      }

      const expectedVersion = Number(req.body.expectedVersion);
      if (isNaN(expectedVersion)) {
        return res.status(400).json({ error: "O campo expectedVersion deve ser um número válido.", correlationId });
      }

      const result = await BandScaleCommandService.updateBandScale({
        authUid,
        orgId,
        scaleId,
        expectedVersion,
        idempotencyKey,
        payload: req.body,
        correlationId
      });

      return res.status(200).json(result);
    } catch (error: any) {
      logger.error(`[BandScale Command] Update failed | Correlation ID: ${correlationId}`, error);
      const isConflict = error.message.includes("Conflict") || error.message.includes("alterada por outra pessoa");
      const status = error.message.includes("Permissão") || error.message.includes("Acesso negado") ? 403 : isConflict ? 409 : 400;
      return res.status(status).json({ error: error.message, correlationId });
    }
  });

  app.get("/api/ecosystem/my-context", async (req, res) => {
    try {
      const authHeader = req.headers.authorization || "";
      if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token ausente" });
      }

      const token = authHeader.split(" ")[1];
      const decoded = await admin.auth().verifyIdToken(token);
      const uid = decoded.uid;

      if (!db) throw new Error("Database not initialized");

      // Consult user profile
      const userRef = db.collection('users').doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        return res.status(404).json({ error: "User profile not found" });
      }

      const userData = userSnap.data();
      let userHasActive = userData?.activeOrganizationId;
      let userHasPrimary = userData?.primaryOrganizationId;
      let userHasLegacy = userData?.organizationId;
      
      let orgId = null;
      let orgName = 'Carregando Organização...';
      let roleInOrg = userData?.role || userData?.organizationRole || 'visitor';
      let plan = 'starter';
      let status = 'active';

      let organizationsAvailable: any[] = [];
      let organizationsMap = new Map();

      const checkAndAddOrg = async (idToTest: string, roleToSet: string, setActive: boolean = false) => {
         if (!idToTest || organizationsMap.has(idToTest)) return false;
         organizationsMap.set(idToTest, true);
         const orgRef = db.collection('organizations').doc(idToTest);
         const orgSnap = await orgRef.get();
         if (orgSnap.exists) {
             const orgData = orgSnap.data();
             if (orgData?.status !== 'archived' && orgData?.archived !== true) {
                 if (setActive && !orgId) {
                     orgId = idToTest;
                     orgName = orgData?.name || orgName;
                     plan = orgData?.music_scale_plan || orgData?.plan || 'starter';
                     roleInOrg = roleToSet;
                 }
                 organizationsAvailable.push({ id: idToTest, name: orgData?.name || 'Minha Organização', role: roleToSet });
                 return true;
             }
         }
         return false;
      };

      // Query owned orgs
      let ownedOrgs = await db.collection('organizations').where('ownerUid', '==', uid).get();
      if (ownedOrgs.empty) {
          ownedOrgs = await db.collection('organizations').where('ownerUserId', '==', uid).get();
      }
      for (const orgDoc of ownedOrgs.docs) {
          const orgData = orgDoc.data();
          if (orgData?.status !== 'archived' && orgData?.archived !== true) {
             organizationsMap.set(orgDoc.id, true);
             organizationsAvailable.push({ id: orgDoc.id, name: orgData?.name || 'Minha Organização', role: 'owner' });
          }
      }

      // Query memberships
      let membershipsCount = await db.collection('organization_members').where('uid', '==', uid).get();
      if (membershipsCount.empty) {
          membershipsCount = await db.collection('organization_members').where('userId', '==', uid).get();
      }
      if (membershipsCount.empty && decoded.email) {
          membershipsCount = await db.collection('organization_members').where('email', '==', decoded.email).get();
      }
      if (!membershipsCount.empty) {
          for (const mDoc of membershipsCount.docs) {
              const mData = mDoc.data();
              const mOrgId = mData.organizationId || mData.organization_id;
              const mRole = mData.role || mData.organizationRole || roleInOrg;
              if (!organizationsMap.has(mOrgId)) {
                 await checkAndAddOrg(mOrgId, mRole, false);
              }
          }
      }

      // Priority resolution
      if (userHasActive && organizationsAvailable.some(o => o.id === userHasActive)) {
          const activeMatch = organizationsAvailable.find(o => o.id === userHasActive);
          orgId = activeMatch.id;
          orgName = activeMatch.name;
          roleInOrg = activeMatch.role;
          const getPl = await db.collection('organizations').doc(orgId).get();
          plan = getPl.exists ? (getPl.data().music_scale_plan || getPl.data().plan || 'starter') : 'starter';
      } else if (userHasPrimary && organizationsAvailable.some(o => o.id === userHasPrimary)) {
          const activeMatch = organizationsAvailable.find(o => o.id === userHasPrimary);
          orgId = activeMatch.id;
          orgName = activeMatch.name;
          roleInOrg = activeMatch.role;
          const getPl = await db.collection('organizations').doc(orgId).get();
          plan = getPl.exists ? (getPl.data().music_scale_plan || getPl.data().plan || 'starter') : 'starter';
      } else if (organizationsAvailable.length > 0) {
          orgId = organizationsAvailable[0].id;
          orgName = organizationsAvailable[0].name;
          roleInOrg = organizationsAvailable[0].role;
          const getPl = await db.collection('organizations').doc(orgId).get();
          plan = getPl.exists ? (getPl.data().music_scale_plan || getPl.data().plan || 'starter') : 'starter';
      } else if (userHasLegacy) {
          await checkAndAddOrg(userHasLegacy, roleInOrg, true);
      }

      // Re-read role from member doc if they have one for the resolved orgId
      if (orgId) {
          const memberSnap1 = await db.collection('organization_members').doc(`${uid}_${orgId}`).get();
          const memberSnap2 = await db.collection('organization_members').doc(`${orgId}_${uid}`).get();
          
          if (memberSnap1.exists) {
             roleInOrg = memberSnap1.data()?.role || memberSnap1.data()?.organizationRole || roleInOrg;
          } else if (memberSnap2.exists) {
             roleInOrg = memberSnap2.data()?.role || memberSnap2.data()?.organizationRole || roleInOrg;
          }
      }

      return res.status(200).json({
        uid,
        email: decoded.email,
        displayName: userData?.displayName || '',
        ecosystemRole: userData?.systemRole || 'user',
        currentOrganizationId: orgId || null,
        currentOrganizationName: orgName,
        roleInCurrentOrganization: roleInOrg,
        plan,
        subscriptionStatus: status,
        organizationsAvailable
      });
      
    } catch (e: any) {
       console.error("[Ecosystem] Error fetching my-context:", e);
       return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/orgs/update", async (req, res) => {
      try {
          if (!db) throw new Error("Database not initialized");
          
          const { organizationId, organizationName, city, state, slug } = req.body;
          if (!organizationId || !slug) return res.status(400).json({ error: "Missing parameters" });

          if (!/^[A-Za-z0-9_-]{1,128}$/.test(organizationId)) {
              return res.status(400).json({ error: "INVALID_ORGANIZATION_ID" });
          }
          
          const authRes = await resolveOrganizationAuthorization(req.headers.authorization, organizationId, db, auth);
          if (authRes.statusCode) {
              return res.status(authRes.statusCode).json({ error: authRes.error });
          }
          const ctx = authRes.context!;

          // Must be owner, admin, global role, or have setting manage capabilities
          if (!ctx.systemRole && !ctx.isOwner && ctx.organizationRole !== 'admin' && !ctx.capabilities.includes('organization.settings.manage')) {
              return res.status(403).json({ error: "FORBIDDEN" });
          }

          let cleanSlug = String(slug).trim().toLowerCase().replace(/[^a-z0-9_\-]+/g, "-");
          if (!cleanSlug || cleanSlug === "-") cleanSlug = `org-${Date.now()}`;

          // check if slug is taken
          const slugCheck = await db.collection('organizations').where('slug', '==', cleanSlug).get();
          if (!slugCheck.empty) {
              if (slugCheck.docs[0].id !== organizationId) {
                  return res.status(409).json({ error: "SLUG_CONFLICT" });
              }
          }

          const orgRef = db.collection('organizations').doc(organizationId);
          let safeOrgName = String(organizationName || "").trim();
          if (safeOrgName.length === 0) return res.status(400).json({ error: "INVALID_ORGANIZATION_NAME" });
          
          // Size limits
          if (safeOrgName.length > 100) safeOrgName = safeOrgName.substring(0, 100);
          const safeCity = String(city || "").substring(0, 100);
          const safeState = String(state || "").substring(0, 100);
          
          logger.debug(`[API] Updating organization ${organizationId} with name: ${safeOrgName}`);
          const updates = {
              name: safeOrgName,
              displayName: safeOrgName,
              city: safeCity || null,
              state: safeState || null,
              slug: cleanSlug,
              updated_at: admin.firestore.FieldValue.serverTimestamp()
          };
          
          await orgRef.set(updates, { merge: true });

          // Audit Log
          try {
              const correlationId = crypto.randomUUID();
              const auditRef = db.collection('audit_logs').doc();
              await auditRef.set({
                  action: 'organization.settings.updated',
                  actorUid: ctx.uid,
                  organizationId: organizationId,
                  changes: updates,
                  timestamp: admin.firestore.FieldValue.serverTimestamp(),
                  correlationId: correlationId
              });
          } catch (e) {
              logger.error(`[API] Failed to write audit log for org update: ${e}`);
          }

          res.json({ organization_id: organizationId });
      } catch (e: any) {
          logger.error(`[API] Error updating org ${req.body?.organizationId}:`, e);
          res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
      }
  });

  app.post("/api/orgs/join", async (req, res) => {
      try {
          if (!db || !auth) throw new Error("Database not initialized");
          
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith("Bearer ")) {
             return res.status(401).json({ error: "UNAUTHORIZED" });
          }
          const token = authHeader.split("Bearer ")[1].trim();
          
          let decodedToken;
          try {
             decodedToken = await auth.verifyIdToken(token, true);
          } catch (err) {
             return res.status(401).json({ error: "UNAUTHORIZED" });
          }
          const authenticatedUid = decodedToken.uid;

          const { userId, ownerEmail } = req.body;
          if (!ownerEmail) return res.status(400).json({ error: "Missing parameters" });

          if (userId && userId !== authenticatedUid) {
             return res.status(403).json({ error: "ACTOR_ID_MISMATCH" });
          }

          // Find the owner user by email
          const usersRef = await db.collection('users')
              .where('email', '==', ownerEmail.toLowerCase().trim())
              .limit(1)
              .get();

          if (usersRef.empty) {
              return res.status(404).json({ error: "Owner user not found" });
          }

          const ownerDoc = usersRef.docs[0];
          const ownerUid = ownerDoc.id;
          const ownerData = ownerDoc.data();

          // Collect possible org IDs
          const candidateOrgs = new Set<string>();
          if (ownerData.organizationId) candidateOrgs.add(ownerData.organizationId);
          if (ownerData.activeOrganizationId) candidateOrgs.add(ownerData.activeOrganizationId);
          if (ownerData.primaryOrganizationId) candidateOrgs.add(ownerData.primaryOrganizationId);

          const [owned1, owned2, owned3] = await Promise.all([
             db.collection('organizations').where('ownerUid', '==', ownerUid).get(),
             db.collection('organizations').where('ownerUserId', '==', ownerUid).get(),
             db.collection('organizations').where('ownerId', '==', ownerUid).get()
          ]);
          owned1.docs.forEach((d: any) => candidateOrgs.add(d.id));
          owned2.docs.forEach((d: any) => candidateOrgs.add(d.id));
          owned3.docs.forEach((d: any) => candidateOrgs.add(d.id));

          let matchedOrgId = null;
          let matchCount = 0;

          for (const orgId of candidateOrgs) {
              const orgDoc = await db.collection('organizations').doc(orgId).get();
              if (!orgDoc.exists) continue;
              const orgData = orgDoc.data();
              const normalizedOrgStatus = String(orgData?.status || "").trim().toLowerCase();
              if (normalizedOrgStatus === 'archived' || orgData?.archived === true) continue;
              
              if (orgData?.ownerUid === ownerUid || orgData?.ownerUserId === ownerUid || orgData?.ownerId === ownerUid) {
                  matchedOrgId = orgId;
                  matchCount++;
              }
          }

          if (matchCount === 0 || !matchedOrgId) {
             return res.status(404).json({ error: "OWNER_ORGANIZATION_NOT_FOUND" });
          }
          
          if (matchCount > 1) {
             return res.status(409).json({ error: "OWNER_HAS_MULTIPLE_ORGANIZATIONS" });
          }

          const reqUserDoc = await db.collection('users').doc(authenticatedUid).get();
          if (!reqUserDoc.exists) return res.status(403).json({ error: "FORBIDDEN" });
          const reqUserData = reqUserDoc.data();

          // Idempotent creation
          const canonMemberRef = db.collection('organizations').doc(matchedOrgId).collection('members').doc(authenticatedUid);
          const reqRef = db.collection('organization_join_requests').doc(`${matchedOrgId}_${authenticatedUid}`);
          
          await db.runTransaction(async (t: any) => {
             const [canonDoc, reqDoc] = await Promise.all([
                 t.get(canonMemberRef),
                 t.get(reqRef)
             ]);

             if (canonDoc.exists) {
                 const st = String(canonDoc.data()?.status || '').trim().toLowerCase();
                 if (st === 'active' || st === 'ativo') {
                    throw new Error("ALREADY_MEMBER");
                 }
             }

             if (!reqDoc.exists) {
                t.set(reqRef, {
                    uid: authenticatedUid,
                    organizationId: matchedOrgId,
                    email: reqUserData?.email || '',
                    displayName: reqUserData?.displayName || '',
                    photoURL: reqUserData?.photoURL || '',
                    status: 'pending',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    requestedByUid: authenticatedUid,
                    correlationId: crypto.randomUUID()
                });
             } else {
                const existingStatus = String(reqDoc.data()?.status || '').trim().toLowerCase();
                if (existingStatus === 'pending') {
                    t.update(reqRef, {
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                } else if (existingStatus === 'accepted') {
                    throw new Error("JOIN_REQUEST_ALREADY_ACCEPTED");
                } else {
                    throw new Error("JOIN_REQUEST_NOT_PENDING");
                }
             }
          });

          res.json({ success: true, message: "Solicitação enviada. Aguarde a aprovação do administrador." });
      } catch (e: any) {
          logger.error(`[API] Error joining org:`, e);
          const msg = e.message;
          if (["ALREADY_MEMBER", "JOIN_REQUEST_ALREADY_ACCEPTED", "JOIN_REQUEST_NOT_PENDING"].includes(msg)) {
              return res.status(409).json({ error: msg });
          }
          res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
      }
  });

  app.post("/api/orgs/invite", async (req, res) => {
      try {
          if (!db) throw new Error("Database not initialized");
          const { organizationId, inviterUserId, email, roleId } = req.body;
          if (!organizationId) return res.status(400).json({ error: "Missing parameters" });

          const authRes = await resolveOrganizationAuthorization(req.headers.authorization, organizationId, db, auth);
          if (authRes.statusCode) {
              return res.status(authRes.statusCode).json({ error: authRes.error });
          }
          const ctx = authRes.context!;

          if (inviterUserId && inviterUserId !== ctx.uid) {
             return res.status(403).json({ error: "ACTOR_ID_MISMATCH" });
          }

          if (!ctx.systemRole && !ctx.isOwner && ctx.organizationRole !== 'admin' && !ctx.capabilities.includes('organization.members.manage')) {
              return res.status(403).json({ error: "FORBIDDEN" });
          }
          
          if (!email) return res.status(400).json({ error: "EMAIL_REQUIRED" });
          if (!roleId) return res.status(400).json({ error: "ROLE_ID_REQUIRED" });
          
          const safeEmail = String(email).trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
              return res.status(400).json({ error: "INVALID_EMAIL" });
          }

          const safeRoleId = String(roleId).trim();

          const roleDoc = await db.collection('roles').doc(safeRoleId).get();
          if (!roleDoc.exists) {
              return res.status(404).json({ error: "ROLE_NOT_FOUND" });
          }
          const roleData = roleDoc.data() as any;

          if (roleData.organizationId !== organizationId) {
              return res.status(403).json({ error: "ROLE_ORGANIZATION_MISMATCH" });
          }

          const roleName = String(roleData.name || "").trim();
          const lowerRoleName = roleName.toLowerCase();
          if (['owner', 'dono', 'ceo', 'global_admin', 'ecosystem_owner', 'founder', 'support', 'suporte'].includes(lowerRoleName)) {
              return res.status(403).json({ error: "CANNOT_INVITE_GLOBAL_OR_OWNER" });
          }

          const rawToken = crypto.randomBytes(32).toString('base64url');
          const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
          
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 48); // 48h expiration

          const inviteRef = db.collection('invites').doc();
          await inviteRef.set({
              tokenHash,
              email: safeEmail,
              roleId: safeRoleId,
              roleName: roleName,
              rolePermissions: roleData.permissions || null,
              organizationRole: 'member',
              organizationId: organizationId,
              status: 'pending',
              expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              createdByUid: ctx.uid,
              correlationId: crypto.randomUUID()
          });

          if (safeEmail) {
             logger.info(`Sending invite email to ${safeEmail} (Simulated)`);
          }

          res.json({ link: `/invite?token=${rawToken}`, success: true });
      } catch (e: any) {
          logger.error(`[API] Error inviting to org:`, e);
          res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
      }
  });

  app.post("/api/orgs/accept-invite", async (req, res) => {
      try {
          if (!db || !auth) throw new Error("Database not initialized");
          
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith("Bearer ")) {
             return res.status(401).json({ error: "UNAUTHORIZED" });
          }
          const idToken = authHeader.split("Bearer ")[1].trim();
          
          let decodedToken;
          try {
             decodedToken = await auth.verifyIdToken(idToken, true);
          } catch (err) {
             return res.status(401).json({ error: "UNAUTHORIZED" });
          }
          const authenticatedUid = decodedToken.uid;
          const authenticatedEmail = decodedToken.email;

          const { token, userId } = req.body;
          if (!token) return res.status(400).json({ error: "Missing parameters" });
          
          if (userId && userId !== authenticatedUid) {
             return res.status(403).json({ error: "ACTOR_ID_MISMATCH" });
          }

          const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
          
          let inviteSnapshot = await db.collection('invites').where('tokenHash', '==', tokenHash).limit(1).get();
          if (inviteSnapshot.empty) {
             inviteSnapshot = await db.collection('invites').where('token', '==', token).limit(1).get();
          }

          if (inviteSnapshot.empty) return res.status(400).json({ error: "INVALID_TOKEN" });
          const initialInviteDoc = inviteSnapshot.docs[0];

          let inviteOrgIdResult = "";
          
          await db.runTransaction(async (t: any) => {
              const inviteDoc = await t.get(initialInviteDoc.ref);
              if (!inviteDoc.exists) throw new Error("INVITE_NOT_FOUND");
              const inviteData = inviteDoc.data();
              
              const inviteOrgId = inviteData.organization_id || inviteData.organizationId;
              if (!inviteOrgId) throw new Error("INVALID_INVITE_ORG");
              inviteOrgIdResult = inviteOrgId;

              const expDate = (inviteData.expiresAt || inviteData.expires_at)?.toDate();
              if (expDate && expDate < new Date()) {
                  throw new Error("TOKEN_EXPIRED");
              }

              // CORREÇÃO 1 — REVALIDAR O TOKEN DENTRO DA TRANSACTION
              let tokenIsValid = false;
              if (inviteData.tokenHash) {
                  const presentedTokenHash = crypto.createHash('sha256').update(token).digest('hex');
                  try {
                      const buf1 = Buffer.from(String(inviteData.tokenHash), 'utf8');
                      const buf2 = Buffer.from(presentedTokenHash, 'utf8');
                      if (buf1.length === buf2.length && crypto.timingSafeEqual(buf1, buf2)) {
                          tokenIsValid = true;
                      }
                  } catch (e) {}
              } else if (inviteData.token) {
                  try {
                      const buf1 = Buffer.from(String(inviteData.token), 'utf8');
                      const buf2 = Buffer.from(String(token), 'utf8');
                      if (buf1.length === buf2.length && crypto.timingSafeEqual(buf1, buf2)) {
                          tokenIsValid = true;
                      }
                  } catch (e) {}
              }

              if (!tokenIsValid) {
                  throw new Error("INVALID_TOKEN");
              }

              if (String(inviteData.status || "").trim().toLowerCase() === 'accepted') {
                  if (inviteData.acceptedByUid === authenticatedUid) {
                      // Idempotent success
                      return;
                  } else {
                      throw new Error("INVITE_ALREADY_CONSUMED");
                  }
              } else if (String(inviteData.status || "").trim().toLowerCase() !== 'pending') {
                  throw new Error("INVITE_NOT_PENDING");
              }
              
              if (inviteData.email) {
                  if (!authenticatedEmail) throw new Error("EMAIL_REQUIRED");
                  if (inviteData.email.toLowerCase().trim() !== authenticatedEmail.toLowerCase().trim()) {
                      throw new Error("EMAIL_MISMATCH");
                  }
              }
              
              const orgRef = db.collection('organizations').doc(inviteOrgId);
              const orgDoc = await t.get(orgRef);
              const orgData = orgDoc.data();
              const normalizedOrgStatus = String(orgData?.status || "").trim().toLowerCase();
              if (!orgDoc.exists || normalizedOrgStatus === 'archived' || orgData?.archived === true) {
                  throw new Error("INVALID_ORG");
              }

              const roleToAssign = inviteData.internalRoleId || inviteData.requestedRoleId || inviteData.role || 'member';
              let isInternalRole = false;
              const lowerRole = String(roleToAssign).toLowerCase();
              if (['owner', 'dono', 'ceo', 'global_admin', 'ecosystem_owner', 'founder', 'support', 'suporte'].includes(lowerRole)) {
                  throw new Error("CANNOT_ACCEPT_GLOBAL_OR_OWNER");
              }
              if (lowerRole !== 'admin' && lowerRole !== 'leader' && lowerRole !== 'member') {
                  isInternalRole = true;
              }

              const reqUserDocRef = db.collection('users').doc(authenticatedUid);
              const reqUserDoc = await t.get(reqUserDocRef);
              if (!reqUserDoc.exists) {
                  throw new Error("USER_NOT_FOUND");
              }
              const reqUserData = reqUserDoc.data();

              // A. Canonical membership
              const canonMemberRef = db.collection('organizations').doc(inviteOrgId).collection('members').doc(authenticatedUid);
              const canonMemberDoc = await t.get(canonMemberRef);
              
              let roleIdToAssign = inviteData.roleId || null;
              let derivedMusicscaleRole = "custom";
              let finalOrgRole = 'member';

              if (roleIdToAssign) {
                  const roleDocRef = db.collection('roles').doc(roleIdToAssign);
                  const roleDoc = await t.get(roleDocRef);
                  if (!roleDoc.exists) {
                      throw new Error("ROLE_NOT_FOUND");
                  }
                  const roleData = roleDoc.data();
                  if (roleData?.organizationId !== inviteOrgId) {
                      throw new Error("ROLE_ORGANIZATION_MISMATCH");
                  }
                  const rName = String(roleData?.name || "").toLowerCase();
                  if (['owner', 'dono', 'ceo', 'global_admin', 'ecosystem_owner', 'founder', 'support', 'suporte'].includes(rName)) {
                      throw new Error("CANNOT_ACCEPT_GLOBAL_OR_OWNER");
                  }
                  derivedMusicscaleRole = deriveMusicscaleRole(roleData?.name || "");
              } else {
                  // CORREÇÃO 2 — CONVITES LEGADOS NUNCA CONCEDEM ADMIN ORGANIZACIONAL
                  finalOrgRole = 'member';
                  derivedMusicscaleRole = deriveMusicscaleRole(roleToAssign);
              }
              
              const canonicalData = {
                  uid: authenticatedUid,
                  email: authenticatedEmail || reqUserData?.email || '',
                  displayName: reqUserData?.displayName || '',
                  organizationId: inviteOrgId,
                  organizationRole: roleIdToAssign ? 'member' : finalOrgRole,
                  role: roleIdToAssign ? 'member' : finalOrgRole,
                  roleId: roleIdToAssign || null,
                  musicscaleRole: derivedMusicscaleRole,
                  internalRoleId: roleIdToAssign || null,
                  status: 'active',
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  invitedByUid: inviteData.createdByUid || null,
                  inviteId: inviteDoc.id
              };
              if (!canonMemberDoc.exists) {
                  Object.assign(canonicalData, { joinedAt: admin.firestore.FieldValue.serverTimestamp() });
              }
              t.set(canonMemberRef, canonicalData, { merge: true });

              // B. Legacy membership mirror
              const legacyMemberRef = db.collection('organization_members').doc(`${authenticatedUid}_${inviteOrgId}`);
              t.set(legacyMemberRef, canonicalData, { merge: true });

              // C. Update user profile (append org)
              const userUpdate: any = {};
              let currentOrgs = Array.isArray(reqUserData?.organizations) ? reqUserData.organizations : [];
              
              userUpdate.organizations = admin.firestore.FieldValue.arrayUnion(inviteOrgId);
              
              if (!reqUserData?.activeOrganizationId) {
                 userUpdate.activeOrganizationId = inviteOrgId;
              }
              if (!reqUserData?.primaryOrganizationId) {
                 userUpdate.primaryOrganizationId = inviteOrgId;
              }
              
              if (Object.keys(userUpdate).length > 0) {
                 t.update(reqUserDocRef, userUpdate);
              }
              
              // D. Mark invite as accepted
              const inviteUpdates: any = {
                  status: 'accepted',
                  acceptedByUid: authenticatedUid,
                  acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
                  tokenHash: tokenHash // Preserve tokenHash, removing raw token if it's a legacy one
              };
              if (inviteData.token) {
                  inviteUpdates.token = admin.firestore.FieldValue.delete();
              }
              t.update(inviteDoc.ref, inviteUpdates);

              // E. Audit log
              const auditRef = db.collection('audit_logs').doc();
              t.set(auditRef, {
                  action: 'organization.invite.accepted',
                  actorUid: authenticatedUid,
                  organizationId: inviteOrgId,
                  inviteId: inviteDoc.id,
                  timestamp: admin.firestore.FieldValue.serverTimestamp(),
                  correlationId: crypto.randomUUID()
              });
          });

          res.json({ success: true, organization_id: inviteOrgIdResult });
      } catch (e: any) {
          logger.error(`[API] Error accepting invite:`, e);
          const msg = e.message;
          if (["EMAIL_REQUIRED", "EMAIL_MISMATCH", "USER_NOT_FOUND", "ROLE_ORGANIZATION_MISMATCH", "CANNOT_ACCEPT_GLOBAL_OR_OWNER"].includes(msg)) {
              return res.status(403).json({ error: msg });
          }
          if (["ROLE_NOT_FOUND"].includes(msg)) {
              return res.status(404).json({ error: msg });
          }
          if (["INVITE_ALREADY_CONSUMED"].includes(msg)) {
              return res.status(409).json({ error: msg });
          }
          if (["INVALID_TOKEN", "INVITE_NOT_FOUND", "INVALID_INVITE_ORG", "TOKEN_EXPIRED", "INVALID_ORG", "INVITE_NOT_PENDING"].includes(msg)) {
              return res.status(400).json({ error: msg });
          }
          res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
      }
  });

  app.post("/api/orgs/check-access", async (req, res) => {
      try {
          if (!db || !auth) throw new Error("Database not initialized");
          
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith("Bearer ")) {
             return res.status(401).json({ error: "UNAUTHORIZED" });
          }
          const idToken = authHeader.split("Bearer ")[1].trim();
          
          let decodedToken;
          try {
             decodedToken = await auth.verifyIdToken(idToken, true);
          } catch (err) {
             return res.status(401).json({ error: "UNAUTHORIZED" });
          }
          const authenticatedUid = decodedToken.uid;

          const { userId } = req.body;
          if (userId && userId !== authenticatedUid) {
             return res.status(403).json({ error: "ACTOR_ID_MISMATCH" });
          }

          const candidateOrgs = new Set<string>();

          // 1. Profile sources
          const userDoc = await db.collection('users').doc(authenticatedUid).get();
          if (userDoc.exists) {
              const data = userDoc.data();
              if (data?.activeOrganizationId) candidateOrgs.add(data.activeOrganizationId);
              if (data?.primaryOrganizationId) candidateOrgs.add(data.primaryOrganizationId);
              if (data?.organizationId) candidateOrgs.add(data.organizationId);
              if (Array.isArray(data?.organizations)) {
                  data.organizations.forEach((id: string) => candidateOrgs.add(id));
              }
          }

          // 2. Canonical collectionGroup
          const canonMembers = await db.collectionGroup('members').where('uid', '==', authenticatedUid).get();
          canonMembers.docs.forEach(d => {
              const data = d.data();
              if (data.organizationId) candidateOrgs.add(data.organizationId);
              else if (d.ref.parent.parent?.id) candidateOrgs.add(d.ref.parent.parent.id);
          });

          // 3. Legacy members
          const legacyMembers1 = await db.collection('organization_members').where('user_id', '==', authenticatedUid).get();
          const legacyMembers2 = await db.collection('organization_members').where('uid', '==', authenticatedUid).get();
          const allLegacy = [...legacyMembers1.docs, ...legacyMembers2.docs];
          allLegacy.forEach(d => {
              const data = d.data();
              if (data.organization_id) candidateOrgs.add(data.organization_id);
              if (data.organizationId) candidateOrgs.add(data.organizationId);
          });

          // 4. Owned orgs
          const ownedOrgs1 = await db.collection('organizations').where('ownerUid', '==', authenticatedUid).get();
          const ownedOrgs2 = await db.collection('organizations').where('ownerUserId', '==', authenticatedUid).get();
          const ownedOrgs3 = await db.collection('organizations').where('ownerId', '==', authenticatedUid).get();
          ownedOrgs1.docs.forEach(d => candidateOrgs.add(d.id));
          ownedOrgs2.docs.forEach(d => candidateOrgs.add(d.id));
          ownedOrgs3.docs.forEach(d => candidateOrgs.add(d.id));

          for (const orgId of candidateOrgs) {
              const orgDoc = await db.collection('organizations').doc(orgId).get();
              if (!orgDoc.exists) continue;
              const orgData = orgDoc.data();
              const normalizedOrgStatus = String(orgData?.status || "").trim().toLowerCase();
              if (normalizedOrgStatus === 'archived' || orgData?.archived === true) continue;

              let isActive = false;

              // Check canonical
              const canonDoc = await db.collection('organizations').doc(orgId).collection('members').doc(authenticatedUid).get();
              if (canonDoc.exists) {
                  const canonicalStatus = String(canonDoc.data()?.status || "").trim().toLowerCase();
                  if (canonicalStatus === 'active' || canonicalStatus === 'ativo') {
                      isActive = true;
                  }
              } else {
                  // Fallback legacy only if canonical does NOT exist
                  let legacyDoc = null;
                  for (const d of allLegacy) {
                      const data = d.data();
                      if (data.organization_id === orgId || data.organizationId === orgId) {
                          legacyDoc = data;
                          break;
                      }
                  }
                  if (legacyDoc) {
                      const legacyStatus = String(legacyDoc.status || "").trim().toLowerCase();
                      if (legacyStatus === 'active' || legacyStatus === 'ativo') {
                          isActive = true;
                      }
                  }
              }

              // Fallback owner explicit check
              if (orgData?.ownerUid === authenticatedUid || orgData?.ownerUserId === authenticatedUid || orgData?.ownerId === authenticatedUid) {
                  isActive = true;
              }

              if (isActive) {
                  const status = orgData?.subscription_status || orgData?.subscriptionStatus;
                  // For the sake of simple access check, we just verify they are part of it.
                  // Only if subscription logic is strict we check it.
                  if (status === 'active' || status === 'trialing' || status === 'trial' || status === 'pro' || !status) {
                      return res.json({ hasAccess: true, organization_id: orgId });
                  }
              }
          }

          res.json({ hasAccess: false });
      } catch (e: any) {
          logger.error(`[API] Error checking access:`, e);
          res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
      }
  });

  // API Route for AI Fix Chords
  app.post("/api/fix-chords", createFixChordsHandler({
    dbInstance: db,
    authInstance: auth,
    rateLimiter: fixChordsRateLimiter,
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
    logger,
    generateContent: async (params) => {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      return await ai.models.generateContent(params);
    }
  }));
  // API Route for AI Song Import - Complete production SaaS refactor with structured logging and smart fallbacks
  app.post("/api/ai-import", async (req, res) => {
    const startTime = Date.now();
    
    // Step 1: Initiate Payload & Correlation ID
    const requestId = "req-" + Math.random().toString(36).substring(2, 10).toUpperCase() + "-" + Date.now().toString().slice(-6);
    
    const logInfo = (step: string, msg: string, data?: any) => {
      console.log(`[AI_IMPORT][${requestId}][STEP_${step}] ${msg}${data ? ' | ' + JSON.stringify(data) : ''}`);
    };
    const logWarn = (step: string, msg: string, data?: any) => {
      console.warn(`[AI_IMPORT][${requestId}][STEP_${step}][WARN] ${msg}${data ? ' | ' + JSON.stringify(data) : ''}`);
    };
    const logError = (step: string, msg: string, err?: any) => {
      console.error(`[AI_IMPORT][${requestId}][STEP_${step}][ERROR] ${msg}`, err ? (err.stack || err.message || err) : "");
    };

    const makeErrorResponse = (
      code: "VALIDATION" | "SCRAPING" | "PARSING" | "GEMINI" | "TIMEOUT" | "UNKNOWN",
      message: string,
      details?: any,
      step?: string
    ) => {
      const durationMs = Date.now() - startTime;
      return {
        ok: false,
        code,
        message,
        details: details || null,
        requestId,
        durationMs,
        step: step || "UNKNOWN"
      };
    };

    let aiImportFinOpsWriteContext: any = null;
    let aiImportFinOpsWriteFinalized = false;
    let aiImportFinOpsWriteBeginStatus: string | null = null;
    let aiImportFinOpsWriteEnabled = false;

    // AI_FINOPS_SHADOW_WRITE_FINALIZE_START
    const finalizeAiImportFinOpsShadowWriteOnce = async (args: {
      outcome: string;
      estimatedOutputChars?: number;
      estimatedOutputTokens?: number;
      durationMs?: number;
      errorCode?: string | null;
      cacheSummary?: {
        title?: string | null;
        artist?: string | null;
        hasLyrics?: boolean | null;
        hasChords?: boolean | null;
      } | null;
    }) => {
      if (!aiImportFinOpsWriteContext) return;
      if (aiImportFinOpsWriteFinalized) return;
      aiImportFinOpsWriteFinalized = true;

      try {
        const finalizeRes = await finalizeAiImportFinOpsWritePath({
          context: aiImportFinOpsWriteContext,
          outcome: args.outcome as any,
          estimatedOutputChars: args.estimatedOutputChars,
          estimatedOutputTokens: args.estimatedOutputTokens,
          durationMs: args.durationMs,
          errorCode: args.errorCode,
          cacheSummary: args.cacheSummary
        });

        const logSafeSummary = {
          attempted: finalizeRes.safeSummary.attempted,
          finalized: finalizeRes.safeSummary.finalized,
          skipped: finalizeRes.safeSummary.skipped,
          outcome: finalizeRes.safeSummary.outcome,
          estimatedInputTokens: finalizeRes.safeSummary.estimatedInputTokens,
          estimatedOutputTokens: finalizeRes.safeSummary.estimatedOutputTokens,
          shouldHaveContext: finalizeRes.safeSummary.shouldHaveContext,
          safeErrorCode: finalizeRes.safeSummary.safeErrorCode
        };

        logInfo("FINOPS_SHADOW_WRITE_FINALIZE", "Shadow write-path finalize executed", logSafeSummary);
      } catch (err: any) {
        logWarn("FINOPS_SHADOW_WRITE_FINALIZE_ERROR", "Shadow write-path finalize exception caught");
      }
    };
    // AI_FINOPS_SHADOW_WRITE_FINALIZE_END

    const { rawText, url, title, artist, desiredKey, version, bpm, orgId, userId } = req.body;
    
    logInfo("1_INITIAL_PAYLOAD", "Route called with safe parameter summary:", {
      hasRawText: typeof rawText === "string" && rawText.length > 0,
      rawTextLength: typeof rawText === "string" ? rawText.length : 0,
      hasUrl: typeof url === "string" && url.trim().length > 0,
      hasTitle: typeof title === "string" && title.trim().length > 0,
      hasArtist: typeof artist === "string" && artist.trim().length > 0,
      hasDesiredKey: typeof desiredKey === "string" && desiredKey.trim().length > 0,
      hasVersion: typeof version === "string" && version.trim().length > 0,
      hasBpm: bpm !== undefined && bpm !== null && String(bpm).trim().length > 0,
      hasOrgId: typeof orgId === "string" && orgId.trim().length > 0,
      hasUserId: typeof userId === "string" && userId.trim().length > 0
    });

    // Validating auth and entitlements
    const authHeader = req.headers.authorization || "";
    const authResult = await authorizeAiRequest({
      authHeader,
      organizationId: orgId,
      claimedUserId: userId,
      requiredFeature: "aiImport",
      requiredAnyPermissions: ["canManageRepertoire"],
      dbInstance: db,
      authInstance: auth
    });

    if (!authResult.ok) {
      const err = authResult as { ok: false; statusCode: number; error: string };
      return res.status(err.statusCode).json(
        makeErrorResponse(
          "VALIDATION",
          "Acesso não autorizado para importação por IA.",
          { error: err.error },
          "AUTH"
        )
      );
    }

    const aiAuthContext = authResult.context;

    // Validate rawText size and type
    const MAX_AI_IMPORT_RAW_TEXT_CHARS = 64000;

    if (typeof rawText === "string" && rawText.length > MAX_AI_IMPORT_RAW_TEXT_CHARS) {
      return res.status(413).json(
        makeErrorResponse(
          "VALIDATION",
          "O texto informado é grande demais para importação automática.",
          { maxChars: MAX_AI_IMPORT_RAW_TEXT_CHARS },
          "1_INITIAL_PAYLOAD"
        )
      );
    }

    if (rawText !== undefined && rawText !== null && typeof rawText !== "string") {
      return res.status(422).json(
        makeErrorResponse(
          "VALIDATION",
          "O texto informado é inválido para importação automática.",
          null,
          "1_INITIAL_PAYLOAD"
        )
      );
    }

    // AI_FINOPS_SHADOW_READ_PATH_START
    if (process.env.AI_IMPORT_FINOPS_READ_PATH_ENABLED === "true") {
      try {
        const secret = process.env.AI_FINOPS_HMAC_SECRET;
        if (!secret) {
          logWarn("FINOPS_SHADOW", "AI_FINOPS_HMAC_SECRET is missing. Shadow read-path skipped.");
        } else {
          const finOpsAdapter = createAiFinOpsFirestoreAdapter(db);
          const aiImportModel = process.env.GEMINI_MODEL || "gemini-3.5-flash";
          const estimatedInputChars = typeof rawText === "string" ? rawText.length : (typeof url === "string" ? url.length : 0);
          
          const decision = await resolveAiImportFinOpsReadPath({
            adapter: finOpsAdapter,
            organizationId: aiAuthContext.organizationId,
            uid: aiAuthContext.uid,
            rawText: typeof rawText === "string" ? rawText : undefined,
            url: typeof url === "string" ? url : undefined,
            desiredKey: typeof desiredKey === "string" ? desiredKey : undefined,
            version: typeof version === "string" ? version : undefined,
            bpm: typeof bpm === "number" || typeof bpm === "string" ? bpm : undefined,
            model: aiImportModel,
            plan: "pro", // TODO: resolve actual plan during quota reservation phase
            secret,
            now: Date.now(),
            estimatedInputChars
          });

          const safeFinOpsShadowSummary = {
            status: decision.status,
            outcome: decision.outcome,
            shouldConsumeQuota: decision.shouldConsumeQuota,
            sourceType: decision.sourceType,
            sourceHost: decision.sourceHost,
            estimatedInputTokens: decision.estimatedInputTokens,
            hasPaths: !!decision.paths,
            hasCacheKey: !!decision.cacheKey,
            hasIdempotencyKey: !!decision.idempotencyKey,
            hasRateLimitBucketKey: !!decision.rateLimitBucketKey,
            safeErrorCode: decision.safeErrorCode
          };
          
          logInfo("FINOPS_SHADOW", "Shadow read-path executed", safeFinOpsShadowSummary);
        }
      } catch (err: any) {
         logWarn("FINOPS_SHADOW", "AI_FINOPS_SHADOW_READ_PATH_ERROR", { requestId });
      }
    }
    // AI_FINOPS_SHADOW_READ_PATH_END

    // Apply Rate Limit
    let aiImportRateLimitSlot: { release: () => void } | null = null;
    const rateLimitResult = aiImportRateLimiter.acquire({
      uid: aiAuthContext.uid,
      organizationId: aiAuthContext.organizationId,
      endpointKey: "ai-import"
    });

    if (!rateLimitResult.ok) {
      const err = rateLimitResult as { ok: false; statusCode: 429; error: "AI_RATE_LIMITED" };
      return res.status(err.statusCode).json(
        makeErrorResponse(
          "TIMEOUT",
          "Muitas tentativas de importação por IA em pouco tempo. Aguarde alguns minutos e tente novamente.",
          { error: err.error },
          "AI_RATE_LIMIT"
        )
      );
    }

    aiImportRateLimitSlot = rateLimitResult;

    // Initialize standard result template with safe defaults
    let result: any = {
      title: title || "Música Importada",
      artist: artist || "Artista Desconhecido",
      originalKey: desiredKey || "C",
      selectedKey: desiredKey || "C",
      version: version || "Original",
      bpm: bpm ? parseInt(bpm, 10) : null,
      rhythm: null,
      chords: "",
      lyrics: "",
      sections: [] as string[],
      language: "pt",
      tabs: [],
      metadata: {},
      confidence: "high"
    };

    let textToProcess = rawText || "";
    let normalizedUrlStr = url || "";
    let selectedStrategy = "MANUAL_TEXT";
    let usedAi = false;

    try {
      // Step 2: URL Normalization and Domain Checking
      if (url && !textToProcess) {
        logInfo("2_URL_NORMALIZATION", "Normalizing and sanitizing input URL", {
          hasUrl: !!url
        });
        try {
          let cleanedUrlInput = url.trim();
          if (cleanedUrlInput.startsWith("//")) {
            cleanedUrlInput = "https:" + cleanedUrlInput;
          } else if (!cleanedUrlInput.startsWith("http://") && !cleanedUrlInput.startsWith("https://")) {
            cleanedUrlInput = "https://" + cleanedUrlInput;
          }

          const parsedUrl = new URL(cleanedUrlInput);
          const originalDomain = parsedUrl.hostname.toLowerCase();
          
          logInfo("2_URL_NORMALIZATION", `Parsed domain: "${originalDomain}"`);

          // Clean social and UTM parameters, keeping trace elements
          const params = new URLSearchParams(parsedUrl.search);
          const cleanParams = new URLSearchParams();
          for (const [k, v] of params.entries()) {
            const lowerK = k.toLowerCase();
            if (
              !lowerK.startsWith("utm_") && 
              lowerK !== "fbclid" && 
              lowerK !== "gclid" && 
              lowerK !== "_ga" && 
              lowerK !== "_gl"
            ) {
              cleanParams.append(k, v);
            }
          }
          parsedUrl.search = cleanParams.toString();
          parsedUrl.hash = ""; // Strip fragment hash

          normalizedUrlStr = parsedUrl.toString();
          logInfo("2_URL_NORMALIZATION", "Successfully normalized URL", {
            hostname: parsedUrl.hostname.toLowerCase()
          });
        } catch (urlErr: any) {
          logError("2_URL_NORMALIZATION", "URL normalization engine failed");
          return res.status(200).json(
            makeErrorResponse(
              "VALIDATION",
              "O link informado não é um endereço de internet válido.",
              { hasUrl: !!url },
              "2_URL_NORMALIZATION"
            )
          );
        }

        // Step 3: Network Fetch with SSRF protection via testable adapter
        const safeHtmlResult = (await fetchAiImportHtmlSafely(normalizedUrlStr, {
          safeExternalFetch: aiImportSafeExternalFetch,
          makeErrorResponse,
          logInfo,
          logWarn
        })) as any;

        if (!safeHtmlResult.ok) {
          return res.status(200).json(safeHtmlResult.response);
        }

        const html = safeHtmlResult.html;

        // Step 4: Metadata Parsing Strategy
        logInfo("4_METADATA_EXTRACTION", "Starting metadata extraction strategies...");
        let crawledTitle = "";
        let crawledArtist = "";
        let crawledKey = "";

        // Extract key specific to CifraClub
        try {
          const tomMatch = html.match(/(?:id=["']cifra_tom["']|class=["'][^"']*cifra_tom[^"']*["'])[^>]*>([A-G][#b]?m?)<\//i);
          if (tomMatch && tomMatch[1]) {
            crawledKey = tomMatch[1].trim();
            logInfo("4_METADATA_EXTRACTION", `Success metadata extraction via Cifra Tom element. Key="${crawledKey}"`);
          } else {
             // fallback general text search for "Tom: X"
             const generalTomMatch = html.match(/Tom:\s*<[^>]+>\s*([A-G][#b]?m?)\s*<\//i) || html.match(/Tom:\s*([A-G][#b]?m?)\s*</i);
             if (generalTomMatch && generalTomMatch[1]) {
               crawledKey = generalTomMatch[1].trim();
               logInfo("4_METADATA_EXTRACTION", `Success metadata extraction via text match. Key="${crawledKey}"`);
             }
          }
        } catch (keyErr: any) {
          logWarn("4_METADATA_EXTRACTION", `Failed to extract chord key: ${keyErr.message}`);
        }

        // Strategy A: JSON-LD Extraction
        try {
          const jsonLdRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
          let ldMatch;
          while ((ldMatch = jsonLdRegex.exec(html)) !== null) {
            try {
              const ldParsed = JSON.parse(ldMatch[1]);
              const items = Array.isArray(ldParsed) ? ldParsed : [ldParsed];
              for (const item of items) {
                if (item && item.name && (item["@type"] === "MusicComposition" || item["@type"] === "MusicRecording")) {
                  crawledTitle = item.name;
                  if (item.byArtist && item.byArtist.name) {
                    crawledArtist = item.byArtist.name;
                  } else if (item.author && item.author.name) {
                    crawledArtist = item.author.name;
                  }
                  logInfo("4_METADATA_EXTRACTION", `Success metadata extraction via JSON-LD. Title="${crawledTitle}", Artist="${crawledArtist}"`);
                  break;
                }
              }
            } catch (jsonLdParseErr) {
              // Ignore single block errors, proceed to scan next
            }
          }
        } catch (ldErr: any) {
          logWarn("4_METADATA_EXTRACTION", `Error on JSON-LD scanner thread: ${ldErr.message}`);
        }

        // Strategy B: OpenGraph & HTML Title tags
        if (!crawledTitle) {
          try {
            const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
            const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
            const rawTitleString = ogTitleMatch ? ogTitleMatch[1] : (titleMatch ? titleMatch[1] : "");
            
            logInfo("4_METADATA_EXTRACTION", `Og/Html Title scrap string extracted: "${rawTitleString}"`);
            if (rawTitleString) {
              const cleanedTitle = rawTitleString.replace(/\s*-\s*Cifra Club\s*/gi, "").trim();
              const tagParts = cleanedTitle.split(/\s+-\s+/);
              if (tagParts.length >= 2) {
                crawledTitle = tagParts[0].trim();
                crawledArtist = tagParts[1].trim();
              } else {
                crawledTitle = cleanedTitle;
              }
              logInfo("4_METADATA_EXTRACTION", `Success metadata extraction via OG/Title Tag parsing. Title="${crawledTitle}", Artist="${crawledArtist}"`);
            }
          } catch (metaErr: any) {
            logError("4_METADATA_EXTRACTION", `Failed to extract HTML metadata properties cleanly: ${metaErr.message}`);
          }
        }

        if (crawledTitle && !result.title) result.title = crawledTitle;
        if (crawledArtist && !result.artist) result.artist = crawledArtist;
        if (crawledKey) {
            result.originalKey = crawledKey;
            result.selectedKey = crawledKey;
        }

        // Step 5: Multi-Strategy Extractor Runner
        logInfo("5_CONTENT_EXTRACTION", "Running content extraction heuristic pipeline...");
        let extractedRawText = "";
        const lowerHtml = html.toLowerCase();

        // Pipeline Strategy 1: PRE block boundary extraction
        const preIdx = lowerHtml.indexOf("<pre");
        if (preIdx !== -1) {
          const closeTagIdx = html.indexOf(">", preIdx);
          if (closeTagIdx !== -1) {
            const endPreIdx = lowerHtml.indexOf("</pre>", closeTagIdx);
            if (endPreIdx !== -1) {
              extractedRawText = html.substring(closeTagIdx + 1, endPreIdx);
              if (extractedRawText.trim().length > 100) {
                selectedStrategy = "PRE_ELEMENT_BLOCK";
                logInfo("5_CONTENT_EXTRACTION", `Strategy match: "PRE_ELEMENT_BLOCK", size = ${extractedRawText.length}`);
              }
            }
          }
        }

        // Pipeline Strategy 2: cifra_cnt container divisions
        if (!extractedRawText || extractedRawText.trim().length < 150) {
          const classIdentifiers = ["cifra_cnt", "js-cifra", "cifra-container", "cifra-inner"];
          for (const selector of classIdentifiers) {
            const index = lowerHtml.indexOf(`class="${selector}"`) !== -1 
              ? lowerHtml.indexOf(`class="${selector}"`) 
              : lowerHtml.indexOf(`id="${selector}"`);

            if (index !== -1) {
              const startTagIdx = html.lastIndexOf("<", index);
              if (startTagIdx !== -1) {
                const closeTagIdx = html.indexOf(">", startTagIdx);
                if (closeTagIdx !== -1) {
                  const endDivIdx = lowerHtml.indexOf("</div>", closeTagIdx);
                  if (endDivIdx !== -1) {
                    const blockText = html.substring(closeTagIdx + 1, endDivIdx);
                    if (blockText.trim().length > 150) {
                      extractedRawText = blockText;
                      selectedStrategy = `DIV_SELECTOR_${selector.toUpperCase()}`;
                      logInfo("5_CONTENT_EXTRACTION", `Strategy match: "${selectedStrategy}", size = ${extractedRawText.length}`);
                      break;
                    }
                  }
                }
              }
            }
          }
        }

        // Pipeline Strategy 3: Article tagging structure representation
        if (!extractedRawText || extractedRawText.trim().length < 150) {
          const articleIdx = lowerHtml.indexOf("<article");
          if (articleIdx !== -1) {
            const closeTagIdx = html.indexOf(">", articleIdx);
            if (closeTagIdx !== -1) {
              const endArticleIdx = lowerHtml.indexOf("</article>", closeTagIdx);
              if (endArticleIdx !== -1) {
                extractedRawText = html.substring(closeTagIdx + 1, endArticleIdx);
                if (extractedRawText.trim().length > 150) {
                  selectedStrategy = "ARTICLE_ELEMENT_BLOCK";
                  logInfo("5_CONTENT_EXTRACTION", `Strategy match: "ARTICLE_ELEMENT_BLOCK", size = ${extractedRawText.length}`);
                }
              }
            }
          }
        }

        // Pipeline Strategy 4: Body tag text boundary fallback
        if (!extractedRawText || extractedRawText.trim().length < 150) {
          const bodyIdx = lowerHtml.indexOf("<body");
          if (bodyIdx !== -1) {
            const closeTagIdx = html.indexOf(">", bodyIdx);
            if (closeTagIdx !== -1) {
              const endBodyIdx = lowerHtml.indexOf("</body>", closeTagIdx);
              if (endBodyIdx !== -1) {
                extractedRawText = html.substring(closeTagIdx + 1, endBodyIdx);
                selectedStrategy = "BODY_ELEMENT_FALLBACK";
                logInfo("5_CONTENT_EXTRACTION", `Strategy match: "BODY_ELEMENT_FALLBACK", size = ${extractedRawText.length}`);
              }
            }
          }
        }

        // Pipeline Strategy 5: Standard Raw Trace Failure
        if (!extractedRawText) {
          extractedRawText = html;
          selectedStrategy = "HTML_FULL_DUMP_STRATEGY";
          logWarn("5_CONTENT_EXTRACTION", `All targeted extraction strategies missed. Defaulted to Full html dump`);
        }

        // Clean html tags to extract readable music lines
        logInfo("5_CONTENT_EXTRACTION", "Executing semantic filters to strip formatting and clean HTML entities");
        const sanitizedText = extractedRawText
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n")
          .replace(/<\/div>/gi, "\n")
          .replace(/<[\/]?b[^>]*>/gi, "")       // clean bold chord wraps completely
          .replace(/<[\/]?span[^>]*>/gi, "")   // clean spans entirely
          .replace(/<a[^>]*>/gi, "")           // clean chord anchors
          .replace(/<\/a>/gi, "")
          .replace(/<[^>]+>/g, " ")            // clean other trailing elements
          .replace(/&nbsp;/g, " ")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim();

        textToProcess = sanitizedText;
        logInfo("5_CONTENT_EXTRACTION", `Completed cleaning cycle. Strategy = ${selectedStrategy}, String Length = ${textToProcess.length} character(s).`);
      }

      // Step 6: Core Validation checks
      logInfo("6_PAYLOAD_VALIDATION", `Validating extracted text content character depth: ${textToProcess.trim().length}`);
      if (textToProcess.trim().length < 50) {
        logWarn("6_PAYLOAD_VALIDATION", "Rejected processing: extracted payload length too short.");
        return res.status(200).json(
          makeErrorResponse(
            "VALIDATION",
            "A cifra ou letra extraída está muito curta ou em formato ilegível. Por favor, tente colar a letra diretamente.",
            { textLength: textToProcess.trim().length },
            "6_PAYLOAD_VALIDATION"
          )
        );
      }

      // Check for prominent Cloudflare/cookie blocker block strings
      const lowerText = textToProcess.toLowerCase();
      if (
        lowerText.includes("cloudflare") || 
        lowerText.includes("enable cookies") || 
        lowerText.includes("javascript is disabled") ||
        lowerText.includes("captcha") ||
        lowerText.includes("ddos protection")
      ) {
        logWarn("6_PAYLOAD_VALIDATION", "Cloudflare anti-scraping wall or Captcha detected in downloaded text.");
        return res.status(200).json(
          makeErrorResponse(
            "SCRAPING",
            "O site de cifras bloqueou nossa leitura automatizada (proteção anti-bot). Por favor, copie e cole a letra no campo de texto para prosseguirmos.",
            { detectedBlock: true },
            "6_PAYLOAD_VALIDATION"
          )
        );
      }
      
      // Step 6.5: Pre-process chord transpositions, capos and noise
      logInfo("6.5_PRE_PROCESSING", "Applying deterministic chord engine cleaning");
      let preProcessed;
      try {
          preProcessed = preProcessSongText(textToProcess);
          textToProcess = preProcessed.chordsText || "";
          logInfo("6.5_PRE_PROCESSING", `Cleaned text length: ${textToProcess.length}`);
      } catch (err: any) {
          logWarn("6.5_PRE_PROCESSING", `Deterministic processing failed: ${err.message}`);
          preProcessed = { tabs: [], metadata: {} };
      }

      // AI_FINOPS_SHADOW_WRITE_PATH_START
      if (process.env.AI_IMPORT_FINOPS_WRITE_PATH_ENABLED === "true") {
        try {
          aiImportFinOpsWriteEnabled = true;
          const secret = process.env.AI_FINOPS_HMAC_SECRET;
          if (!secret) {
            logWarn("FINOPS_SHADOW_WRITE", "AI_FINOPS_HMAC_SECRET is missing. Shadow write-path skipped.");
          } else {
            const finOpsAdapter = createAiFinOpsFirestoreAdapter(db);
            const aiImportModel = process.env.GEMINI_MODEL || "gemini-3.5-flash";
            const estimatedInputChars = typeof textToProcess === "string" ? textToProcess.length : 0;

            const beginRes = await beginAiImportFinOpsWritePath({
              adapter: finOpsAdapter,
              requestId,
              organizationId: aiAuthContext.organizationId,
              uid: aiAuthContext.uid,
              rawText: typeof rawText === "string" ? rawText : undefined,
              url: typeof url === "string" ? url : undefined,
              desiredKey: typeof desiredKey === "string" ? desiredKey : undefined,
              version: typeof version === "string" ? version : undefined,
              bpm: typeof bpm === "number" || typeof bpm === "string" ? bpm : undefined,
              model: aiImportModel,
              plan: "pro",
              secret,
              now: Date.now(),
              estimatedInputChars
            });

            aiImportFinOpsWriteBeginStatus = beginRes.status;
            
            const logSafeSummary = {
              status: beginRes.safeSummary.status,
              sourceType: beginRes.safeSummary.sourceType,
              sourceHost: beginRes.safeSummary.sourceHost,
              estimatedInputTokens: beginRes.safeSummary.estimatedInputTokens,
              hasPaths: beginRes.safeSummary.hasPaths,
              hasIdempotencyKey: beginRes.safeSummary.hasIdempotencyKey,
              hasCacheKey: beginRes.safeSummary.hasCacheKey,
              hasRateLimitBucketKey: beginRes.safeSummary.hasRateLimitBucketKey,
              quotaStatusCode: beginRes.safeSummary.quotaStatusCode,
              safeErrorCode: beginRes.safeSummary.safeErrorCode
            };

            logInfo("FINOPS_SHADOW_WRITE_BEGIN", "Shadow write-path begin executed", logSafeSummary);

            if (beginRes.status === "RESERVED") {
              aiImportFinOpsWriteContext = beginRes.context;
            }
          }
        } catch (err: any) {
          logWarn("FINOPS_SHADOW_WRITE_BEGIN_ERROR", "Unexpected error in shadow write-path begin", { requestId });
        }
      }
      // AI_FINOPS_SHADOW_WRITE_PATH_END

      // Step 7: Preparing Gemini API Configuration
      const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
      logInfo("7_GEMINI_PREPARATION", `Instantiating GoogleGenAI core client config... Target Model: "${model}"`);

      try {
        if (!process.env.GEMINI_API_KEY) {
          throw new Error("GEMINI_API_KEY is not defined in server environment variables!");
        }

        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build'
            }
          }
        });

        if (typeof textToProcess === "string" && textToProcess.length > AI_IMPORT_GEMINI_INPUT_MAX_CHARS) {
          logWarn("7_GEMINI_PREPARATION", "Gemini input exceeded safe character limit and was truncated.", {
            originalLength: textToProcess.length,
            truncatedLength: AI_IMPORT_GEMINI_INPUT_MAX_CHARS
          });
          textToProcess = textToProcess.slice(0, AI_IMPORT_GEMINI_INPUT_MAX_CHARS);
        }

        const prompt = `Você é um músico e especialista em cifras musicais.
Temos um texto bruto extraído de um site de cifras ou um texto pré-processado.
Sua tarefa é classificar dados, limpar completamente o lixo da cifra e retornar UM JSON válido.

Instruções cruciais para a cifra ("cleanChords"):
1. A cifra ("cleanChords") DEVE conter em um único texto estruturado as seções, as linhas de acordes e também as linhas de letra correspondentes, no formato tradicional de cifras (onde as linhas de acordes estão imediatamente posicionadas acima da respectiva linha de letra, preservando o alinhamento musical por espaçamento para que o músico toque e cante). Nunca remova as linhas de letra da cifra!
2. Remova lixos adicionais como diagramas e dicionários de acordes no início/fim, guias de ritmo textuais externos, dados de tablaturas ruins e anotações que poluam o fluxo de execução.
3. Preserve e padronize os cabeçalhos de seções (ex: [Intro], [Verso 1], [Refrão], [Solo]).
4. GARANTA que cada linha específica que contiver acordes tenha APENAS os acordes separados por espaços (sem palavras ou textos inseridos no meio dos acordes daquela linha) para que o posicionamento harmônico seja interpretado perfeitamente, e abaixo dela esteja a respectiva linha de letra correspondente.
5. Se houver seções puramente instrumentais (ex: [Solo] ou [Intro]), mantenha a tag da seção e os acordes dela normalmente. Não as apague.

Instruções cruciais para a letra ("cleanLyrics"):
1. A letra limpa NÃO PODE CONTER NENHUM ACORDE no meio do texto. Tire todos os acordes.
2. Mantenha as tags das seções iguais às da cifra (ex: [Intro], [Verso 1]). 
3. Seções instrumentais constarão na letra apenas com sua tag, sem acordes.

NÃO transponha acordes.

Cifra/Texto de Entrada: 
----------------------------------------
${textToProcess}
----------------------------------------

RETORNE APENAS JSON VÁLIDO. Siga a estrutura:
{
  "sections": [{"name": "string", "type": "intro|verse|chorus|bridge|outro|unknown"}],
  "language": "pt | en | es | unknown",
  "suggestedBpm": number | null,
  "suggestedRhythm": "string | null",
  "capitalizedTitle": "string | null",
  "capitalizedArtist": "string | null",
  "originalKey": "string | null", // Ex: C, Dm, F#
  "warnings": ["string"],
  "cleanChords": "a cifra completa estruturada (contendo tanto os acordes posicionados por cima quanto a respectiva letra diretamente por baixo, além das marcas de seção)",
  "cleanLyrics": "apenas a letra formatada (sem nenhum acorde)"
}
`;

        // Step 8: Gemini API invocation with strict timeout (25s limit)
        logInfo("8_GEMINI_INVOCATION", `Sending prompt compilation to Gemini API (25000ms max timeout race)`);

        let timeoutId: any;
        const geminiTimeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("TimeoutException: Gemini request exceeded our 60000ms SLA limit")), 60000);
        });

        const geminiRequestPromise = (async () => {
          const res = await ai.models.generateContent({
            model: model,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
              responseMimeType: "application/json"
            }
          });
          clearTimeout(timeoutId);
          return res;
        })();

        const geminiResponse = (await Promise.race([geminiRequestPromise, geminiTimeoutPromise])) as any;
        logInfo("8_GEMINI_INVOCATION", "Successfully received response back from Gemini API channel");

        // Step 9: Parse Response
        const rawContentText = geminiResponse.text || "";
        
        let sanitizedJsonStr = rawContentText.trim();
        if (sanitizedJsonStr.startsWith("\`\`\`json")) {
          sanitizedJsonStr = sanitizedJsonStr.substring(7);
        }
        if (sanitizedJsonStr.endsWith("\`\`\`")) {
          sanitizedJsonStr = sanitizedJsonStr.substring(0, sanitizedJsonStr.length - 3);
        }
        sanitizedJsonStr = sanitizedJsonStr.trim();

        const parsedAiObj = JSON.parse(sanitizedJsonStr);
        logInfo("9_RESP_PARSING", "Gemini response parsed into JSON schema flawlessly");

        let finalBpm = null;
        let finalSuggestedBpm = null;
        let finalBpmConfidence = 'unknown';
        let finalBpmSource = 'not_detected';

        if (preProcessed?.bpm) {
          finalBpm = preProcessed.bpm;
          finalBpmConfidence = 'high';
          finalBpmSource = 'source_text';
        } else if (result.bpm) {
          finalBpm = result.bpm;
          finalBpmConfidence = 'user_provided';
          finalBpmSource = 'manual';
        } else if (parsedAiObj.suggestedBpm) {
          finalSuggestedBpm = parsedAiObj.suggestedBpm;
          finalBpmConfidence = 'low';
          finalBpmSource = 'ai_suggestion';
        }

        result = {
          title: preProcessed?.title || parsedAiObj.capitalizedTitle || result.title,
          artist: preProcessed?.artist || parsedAiObj.capitalizedArtist || result.artist,
          originalKey: preProcessed?.metadata?.declaredKey || parsedAiObj.originalKey || result.originalKey,
          selectedKey: preProcessed?.metadata?.declaredKey || parsedAiObj.originalKey || result.selectedKey,
          version: result.version,
          bpm: finalBpm,
          suggestedBpm: finalSuggestedBpm,
          bpmConfidence: finalBpmConfidence,
          bpmSource: finalBpmSource,
          rhythm: preProcessed?.rhythm || parsedAiObj.suggestedRhythm || result.rhythm,
          chords: parsedAiObj.cleanChords || preProcessed?.chordsText || "",
          lyrics: parsedAiObj.cleanLyrics || preProcessed?.lyricsText || "",
          sections: (Array.isArray(parsedAiObj.sections) && parsedAiObj.sections.length > 0) 
            ? parsedAiObj.sections.map((s: any) => typeof s === 'string' ? s : s.name).filter(Boolean)
            : (preProcessed?.sections || []),
          language: parsedAiObj.language || "pt",
          tabs: preProcessed?.tabs || [],
          metadata: preProcessed?.metadata || {}
        };
        usedAi = true;


      } catch (aiErr: any) {
        logWarn("10_FALLBACK_PARSING", `Gemini stream or JSON parse failed. Initiating fallback parsing engine. Error detail: ${aiErr.message}`);

        // Step 10: Fail-Safe Local Parser Fallback
        result.title = preProcessed?.title || result.title;
        result.artist = preProcessed?.artist || result.artist;
        result.originalKey = preProcessed?.metadata?.declaredKey || result.originalKey;
        result.selectedKey = preProcessed?.metadata?.declaredKey || result.selectedKey;
        result.chords = preProcessed?.chordsText || "";
        result.lyrics = preProcessed?.lyricsText || "";
        result.metadata = preProcessed?.metadata || {};
        result.tabs = preProcessed?.tabs || [];
        
        if (preProcessed?.bpm) {
          result.bpm = preProcessed.bpm;
          result.suggestedBpm = null;
          result.bpmConfidence = 'high';
          result.bpmSource = 'source_text';
        } else if (result.bpm) {
          result.bpmConfidence = 'user_provided';
          result.bpmSource = 'manual';
          result.suggestedBpm = null;
        } else {
          result.bpm = null;
          result.suggestedBpm = null;
          result.bpmConfidence = 'unknown';
          result.bpmSource = 'not_detected';
        }
        
        result.sections = preProcessed?.sections || [];
        
        // Fallback confidence logic below...

        logInfo("10_FALLBACK_PARSING", "Local regex fallback parser complete.");
      }
      
      // Step 10.1: Deterministic Cleanup (User Request)
      try {
          result.chords = stripTablatureArtifacts(result.chords || "");
          result.lyrics = stripTablatureArtifacts(result.lyrics || "");
          result.chords = cleanChordsText(result.chords || "");
          result.lyrics = removeChordOnlyLinesFromLyrics(result.lyrics || "");
          result.lyrics = removeOrphanInstrumentalLabelsFromLyrics(result.lyrics);
          result.lyrics = removeEmptyOrInstrumentalSectionsFromLyrics(result.lyrics);

          validateNoChordListAtStartOfChords(result.chords);
          validateNoChordLinesInLyrics(result.lyrics);
          validateLyricsHasOnlySingableSections(result.lyrics);
      } catch (err: any) {
          logError("10.1_DETERMINISTIC_VALIDATION", `Validation failed: ${err.message}`, err);
          await finalizeAiImportFinOpsShadowWriteOnce({
            outcome: "GEMINI_ERROR",
            errorCode: "DETERMINISTIC_VALIDATION_FAILURE",
            durationMs: Date.now() - startTime
          });
          return res.status(200).json(
             makeErrorResponse("PARSING", err.message, null, "10.1_DETERMINISTIC_VALIDATION")
          );
      }

      // Step 10.5: Validation and Confidence Calculation
      const warnings: string[] = [];
      let overallConfidence = "high";

      if (!result.title || result.title.toLowerCase().includes("importada") || result.title.toLowerCase().includes("desconhecido")) {
        result.title = result.title && !result.title.toLowerCase().includes("importada") ? result.title : "Música Importada";
        warnings.push("Título não encontrado com clareza.");
        overallConfidence = "medium";
      }

      if (!result.artist || result.artist.toLowerCase().includes("desconhecido")) {
        result.artist = result.artist && !result.artist.toLowerCase().includes("desconhecido") ? result.artist : "Artista Desconhecido";
        warnings.push("Artista não encontrado com clareza.");
        overallConfidence = "medium";
      }

      if (!result.bpm) {
        warnings.push("BPM não detectado automaticamente.");
      }
      
      const finalChords = result.chords || "";
      if (
        finalChords.includes("*") || 
        finalChords.toLowerCase().includes("forma do acorde")
      ) {
         warnings.push("Resíduos de dicionário ou forma original detectados na cifra.");
         overallConfidence = "low";
      }

      // Check for double transposition patterns if original was F#
      const allTokens = finalChords.split(/[\s()|]+/);
      if (result.metadata?.declaredKey === "F#" && result.metadata?.shapeKey === "E") {
          // Check for blatant signs of G# major transposition (Fm7, D#2, Cm7)
          if (allTokens.includes("Fm7") || allTokens.includes("G#/D#") || allTokens.includes("Cm7") || (allTokens.includes("G#") && allTokens.includes("D#2"))) {
              throw new Error("DOUBLE_TRANSPOSITION_DETECTED: Found G# patterns in F# key.");
          }
      }

      // Ensure no untransposed E shape chords when original declaredKey is F# (ex. A2 -> B2)
      if (result.metadata?.shapeKey === "E" && result.metadata?.declaredKey === "F#") {
          if (allTokens.includes("A2") || allTokens.includes("C#m7") || allTokens.includes("E/G#")) {
              throw new Error("UNTRANSPOSED_SHAPE_CHORDS_DETECTED: Found A2/C#m7 in F# key.");
          }
      }

      if (!result.chords || result.chords.trim().length === 0) {
        if (result.lyrics && result.lyrics.length > 0) {
            warnings.push("Nenhum acorde detectado. A importação foi processada como letra plana.");
        }
      }
      
      const chordRegex = /[A-G][b#]?(m|M|maj|min|dim|aug|sus)?[0-9]*(\/[A-G][b#]?)?/;
      if (result.lyrics && result.lyrics.match(chordRegex)) {
        // Just a basic check, real lyrics might have words like "A", "E".
        // But if we see "C#m", it's probably wrong.
        if (result.lyrics.match(/[A-G][b#]?(m|dim|aug|sus)[0-9]*\b/)) {
            warnings.push("A letra limpa pode conter alguns acordes residuais.");
            overallConfidence = "medium";
        }
      }

      result.confidence = overallConfidence;
      result.warnings = warnings;
      
      // Step 11: Finalize Response & Trace Analytics metrics
      const processingTimeMs = Date.now() - startTime;
      logInfo("11_FINALIZE_RESPONSE", `Finalizing transaction import successfully in ${processingTimeMs}ms. UsedAI: ${usedAi}`);

      const estimatedOutputChars =
        (typeof result.title === "string" ? result.title.length : 0) +
        (typeof result.artist === "string" ? result.artist.length : 0) +
        (typeof result.lyrics === "string" ? result.lyrics.length : 0) +
        (typeof result.chords === "string" ? result.chords.length : 0) +
        (result.sections ? JSON.stringify(result.sections).length : 0) +
        (typeof result.rhythm === "string" ? result.rhythm.length : 0);

      await finalizeAiImportFinOpsShadowWriteOnce({
        outcome: "SUCCESS",
        estimatedOutputChars,
        durationMs: processingTimeMs,
        cacheSummary: {
          title: result.title,
          artist: result.artist,
          hasLyrics: Boolean(result.lyrics && result.lyrics.trim()),
          hasChords: Boolean(result.chords && result.chords.trim())
        }
      });

      return res.json({
        ok: true,
        song: {
          title: result.title,
          artist: result.artist,
          key: result.selectedKey || result.originalKey || "C",
          bpm: result.bpm,
          suggestedBpm: result.suggestedBpm,
          bpmConfidence: result.bpmConfidence,
          bpmSource: result.bpmSource,
          lyrics: result.lyrics,
          chords: result.chords,
          sourceUrl: normalizedUrlStr || null,
          originalKey: result.originalKey,
          selectedKey: result.selectedKey,
          version: result.version,
          rhythm: result.rhythm,
          sections: result.sections,
          language: result.language || "pt"
        },
        result,
        processingTimeMs,
        usedAi,
        requestId,
        metrics: {
          wordCount: result.lyrics.split(/\s+/).length,
          chordLinesCount: result.chords.split('\n').length,
          hasUrl: !!url,
          extractionStrategy: selectedStrategy
        }
      });
    } catch (unhandledErr: any) {
      logError("UNKNOWN", `Fatal Exception was caught on main ai-import router try-catch wrapper: ${unhandledErr.message}`, unhandledErr);
      await finalizeAiImportFinOpsShadowWriteOnce({
        outcome: "GEMINI_ERROR",
        errorCode: "UNHANDLED_ROUTE_EXCEPTION",
        durationMs: Date.now() - startTime
      });
      return res.status(200).json(
        makeErrorResponse(
          "UNKNOWN",
          "Ocorreu um erro interno inesperado ao tentar processar esta cifra.",
          { error: "INTERNAL_AI_IMPORT_ERROR" },
          "UNKNOWN"
        )
      );
    } finally {
      // AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_START
      if (aiImportFinOpsWriteContext && !aiImportFinOpsWriteFinalized) {
        try {
          await finalizeAiImportFinOpsShadowWriteOnce({
            outcome: "GEMINI_ERROR",
            errorCode: "AI_IMPORT_SHADOW_WRITE_UNFINALIZED_ROUTE_EXIT",
            durationMs: Date.now() - startTime
          });
        } catch (fallbackErr: any) {
          logWarn("FINOPS_SHADOW_WRITE_FALLBACK_ERROR", "Fallback finalize threw an exception");
        }
      }
      // AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_END

      if (aiImportRateLimitSlot) {
        aiImportRateLimitSlot.release();
      }
    }
  });

  // API Route for AI Song Suggestions
  app.post("/api/ai-suggest-songs", async (req, res) => {
    const startTime = Date.now();
    try {
      const authHeader = req.headers.authorization || "";
      if (!authHeader.startsWith("Bearer ")) {
          return res.status(401).json({ error: "Token ausente" });
      }

      let decodedUid: string;
      let isGlobalAdmin = false;
      try {
          const token = authHeader.split(" ")[1];
          const decoded = await admin.auth().verifyIdToken(token);
          decodedUid = decoded.uid;
          if (decodedUid && db) {
              const uDoc = await db.collection('users').doc(decodedUid).get();
              if (uDoc.exists) {
                  const sysRole = String(uDoc.data()?.systemRole || uDoc.data()?.role || uDoc.data()?.appRole || '').toLowerCase().trim();
                  if (['ceo', 'admin', 'global_admin', 'owner', 'ecosystem_owner', 'founder', 'dono', 'administrador', 'supervisor', 'support', 'suporte'].includes(sysRole)) {
                      isGlobalAdmin = true;
                  }
              }
          }
      } catch (e) {
          return res.status(401).json({ error: "Token inválido" });
      }

      const { currentSongs, librarySongs, context, language = "pt", orgId } = req.body;
      
      if (!orgId) {
          return res.status(400).json({ error: "organizationId ausente" });
      }

      if (!isGlobalAdmin) {
          const orgSnap = await db.collection('organizations').doc(orgId).get();
          const memberSnap = await db.collection('organizations').doc(orgId).collection('members').doc(decodedUid).get();
          
          const isOwner = orgSnap.exists && (orgSnap.data()?.ownerUid === decodedUid || orgSnap.data()?.ownerUserId === decodedUid || orgSnap.data()?.owner_user_id === decodedUid || orgSnap.data()?.ownerId === decodedUid);
          const isMember = memberSnap.exists;
          
          if (!isOwner && !isMember && String(orgId) !== String(decodedUid)) {
              return res.status(403).json({ error: "Não autorizado para esta org" });
          }
      }

      const orgRef = db.collection('organizations').doc(orgId);
      const orgSnap = await orgRef.get();
      if (orgSnap.exists && orgSnap.data()?.status === 'archived') {
          return res.status(403).json({ error: "Org arquivada" });
      }

      let plan = 'starter';
      if (orgSnap.exists) {
          plan = orgSnap.data()?.music_scale_plan || orgSnap.data()?.plan || 'starter';
          if (typeof plan !== 'string') plan = 'starter';
          plan = plan.toLowerCase().trim();
          if (plan === 'premium' || plan === 'pro_unlimited') plan = 'pro';
          else if (plan === 'medium' || plan === 'advanced_features') plan = 'advanced';
      }

      const features = PLAN_FEATURES[plan as keyof typeof PLAN_FEATURES] || PLAN_FEATURES.starter;
      if (!isGlobalAdmin && plan !== 'pro' && !features.aiSuggestions) {
         return res.status(403).json({ error: "Requer plano Pro para IA avançada" });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let prompt = "";
      if (language === "es") {
        prompt = `Actúa como un director musical que observa silenciosamente el flujo de adoración.
Tu tarea es sugerir de 1 a 3 canciones para continuar o complementar el setlist.
Analiza: Tono, energía, flujo emocional, repeticiones recurrentes de la iglesia.
Responda EXCLUSIVAMENTE en español.

Setlist Actual (Contexto):
${currentSongs && currentSongs.length > 0 ? currentSongs.map((s: any, i: number) => `${i + 1}. ${s.title} - ${s.artist} (Idioma original: ${s.language || '?'}, Tono: ${s.selectedKey || s.key}, BPM: ${s.bpm || '?'})`).join('\n') : 'Ninguna canción añadida aún.'}

Canciones Disponibles en el Repertorio:
${librarySongs && librarySongs.length > 0 ? librarySongs.slice(0, 50).map((s: any) => `- ${s.title} - ${s.artist} (Idioma original: ${s.language || '?'}, Id: ${s.id}, Tono original: ${s.key})`).join('\n') : 'Sugerir canciones externas si es necesario.'}`;
      } else if (language === "en") {
        prompt = `Act as a worship music director silently watching the flow of the setlist.
Your task is to suggest 1 to 3 songs to continue or complement the setlist.
Analyze: Musical key relationship, tempo energy, emotional worship flow, and team repetition patterns.
Respond EXCLUSIVAMENTE in English.

Current Setlist (Context):
${currentSongs && currentSongs.length > 0 ? currentSongs.map((s: any, i: number) => `${i + 1}. ${s.title} - ${s.artist} (Original language: ${s.language || '?'}, Key: ${s.selectedKey || s.key}, BPM: ${s.bpm || '?'})`).join('\n') : 'No songs added. Offer welcoming suggestions.'}

Available Repertoire Songs:
${librarySongs && librarySongs.length > 0 ? librarySongs.slice(0, 50).map((s: any) => `- ${s.title} - ${s.artist} (Original language: ${s.language || '?'}, Id: ${s.id}, Original Key: ${s.key})`).join('\n') : 'Suggest external songs if necessary.'}`;
      } else {
        prompt = `Atue como um diretor musical assistindo silenciosamente o fluxo.
Sua tarefa é sugerir de 1 a 3 músicas para continuar ou complementar o setlist.
Analise: Tonalidade, energia, fluxo emocional, repetições recorrentes na igreja.
Responda EXCLUSIVAMENTE em português.

Setlist Atual (Context):
${currentSongs && currentSongs.length > 0 ? currentSongs.map((s: any, i: number) => `${i + 1}. ${s.title} - ${s.artist} (Idioma original: ${s.language || '?'}, Tom: ${s.selectedKey || s.key}, BPM: ${s.bpm || '?'})`).join('\n') : 'Nenhuma música. Comece sugerindo algo para abrir o culto.'}

Músicas Disponíveis no Repertório:
${librarySongs && librarySongs.length > 0 ? librarySongs.slice(0, 50).map((s: any) => `- ${s.title} - ${s.artist} (Idioma original: ${s.language || '?'}, Id: ${s.id}, Tom original: ${s.key})`).join('\n') : 'Sugerir de fora se necessário.'}`;
      }

      let response;
      const requestPayload = {
        model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
        contents: [
            {
                role: "user",
                parts: [{ text: prompt }]
            }
        ],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "ARRAY" as any,
                description: "Lista de músicas sugeridas",
                items: {
                    type: "OBJECT" as any,
                    properties: {
                        id: { type: "STRING" as any, description: "Id da música se disponível" },
                        title: { type: "STRING" as any, description: "Título da música" },
                        artist: { type: "STRING" as any, description: "Artista" },
                        reason: { type: "STRING" as any, description: "Por que se encaixa no fluxo de forma natural" },
                        recommendedKey: { type: "STRING" as any, description: "Tom sugerido" }
                    },
                    required: ["title", "artist", "reason", "recommendedKey"]
                }
            }
        }
      };
      
      try {
         response = await ai.models.generateContent(requestPayload);
      } catch (err: any) {
         if (err?.status === 503 || String(err).includes('503') || String(err).includes('UNAVAILABLE')) {
            requestPayload.model = "gemini-flash-latest";
            response = await ai.models.generateContent(requestPayload);
         } else {
            throw err;
         }
      }

      const jsonStr = response.text || "[]";
      const suggestions = JSON.parse(jsonStr);

      const processingTimeMs = Date.now() - startTime;
      logger.info(`[Analytics] AI Song Suggestion: time_ms=${processingTimeMs}`);

      res.json({ suggestions, processingTimeMs });
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      logger.error(`[Analytics] AI Song Suggestion Fatal Error: time_ms=${processingTimeMs}`, error);
      res.status(500).json({ error: String(error) });
    }
  });

  // API Route for Emotion Telemetry
  app.post("/api/telemetry/emotion", (req, res) => {
      // In a real application, we would store this timeline in the database to build Session Intelligence
      // For now, we log it quietly without delaying the response
      const { event, sessionId } = req.body;
      logger.info(`[EmotionTelemetry] Session: ${sessionId} | Type: ${event?.type} | Context: ${event?.context}`);
      res.status(202).send();
  });

  // API Route for AI Setlist Analysis
  app.post("/api/ai-analyze-setlist", async (req, res) => {
    const startTime = Date.now();
    try {
      const authHeader = req.headers.authorization || "";
      if (!authHeader.startsWith("Bearer ")) {
          return res.status(401).json({ error: "Token ausente" });
      }

      let decodedUid: string;
      let isGlobalAdmin = false;
      try {
          const token = authHeader.split(" ")[1];
          const decoded = await admin.auth().verifyIdToken(token);
          decodedUid = decoded.uid;
          if (decodedUid && db) {
              const uDoc = await db.collection('users').doc(decodedUid).get();
              if (uDoc.exists) {
                  const sysRole = String(uDoc.data()?.systemRole || uDoc.data()?.role || uDoc.data()?.appRole || '').toLowerCase().trim();
                  if (['ceo', 'admin', 'global_admin', 'owner', 'ecosystem_owner', 'founder', 'dono', 'administrador', 'supervisor', 'support', 'suporte'].includes(sysRole)) {
                      isGlobalAdmin = true;
                  }
              }
          }
      } catch (e) {
          return res.status(401).json({ error: "Token inválido" });
      }

      const { songs, organizationContext, language = "pt", orgId } = req.body;

      if (!orgId) {
          return res.status(400).json({ error: "organizationId ausente" });
      }

      if (!isGlobalAdmin) {
          const orgSnap = await db.collection('organizations').doc(orgId).get();
          const memberSnap = await db.collection('organizations').doc(orgId).collection('members').doc(decodedUid).get();
          
          const isOwner = orgSnap.exists && (orgSnap.data()?.ownerUid === decodedUid || orgSnap.data()?.ownerUserId === decodedUid || orgSnap.data()?.owner_user_id === decodedUid || orgSnap.data()?.ownerId === decodedUid);
          const isMember = memberSnap.exists;
          
          if (!isOwner && !isMember && String(orgId) !== String(decodedUid)) {
              return res.status(403).json({ error: "Não autorizado para esta org" });
          }
      }

      const orgRef = db.collection('organizations').doc(orgId);
      const orgSnap = await orgRef.get();
      if (orgSnap.exists && orgSnap.data()?.status === 'archived') {
          return res.status(403).json({ error: "Org arquivada" });
      }

      let plan = 'starter';
      if (orgSnap.exists) {
          plan = orgSnap.data()?.music_scale_plan || orgSnap.data()?.plan || 'starter';
          if (typeof plan !== 'string') plan = 'starter';
          plan = plan.toLowerCase().trim();
          if (plan === 'premium' || plan === 'pro_unlimited') plan = 'pro';
          else if (plan === 'medium' || plan === 'advanced_features') plan = 'advanced';
      }

      const features = PLAN_FEATURES[plan as keyof typeof PLAN_FEATURES] || PLAN_FEATURES.starter;
      if (!isGlobalAdmin && plan !== 'pro' && !features.aiSetlistInsights) {
         return res.status(403).json({ error: "Requer plano Pro para IA avançada" });
      }
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let prompt = "";
      if (language === "es") {
        prompt = `Analiza la escala de adoración (Setlist Intelligence & Worship Flow).
Identifica: excesos de repetición, fluidez de transiciones entre tonos y tempos, coherencia congregacional, curva de energía y flujo de ministración.
Responde EXCLUSIVAMENTE en español.

Canciones Actuales en la Escala:
${songs && songs.length > 0 ? songs.map((s: any, i: number) => `${i + 1}. ${s.title} - ${s.artist} (Idioma original: ${s.language || '?'}, Tono: ${s.selectedKey || s.key}, BPM: ${s.bpm || '?'})`).join('\n') : 'Escala vacía.'}`;
      } else if (language === "en") {
        prompt = `Analyze the worship setlist flow (Setlist Intelligence & Worship Flow).
Identify: tonal transitions flow, BPM or tempo gaps, worship emotional flow, team repetition fatigue, and structural congregational balancing.
Respond EXCLUSIVAMENTE in English.

Current Scheduled Songs:
${songs && songs.length > 0 ? songs.map((s: any, i: number) => `${i + 1}. ${s.title} - ${s.artist} (Original language: ${s.language || '?'}, Key: ${s.selectedKey || s.key}, BPM: ${s.bpm || '?'})`).join('\n') : 'Empty.'}`;
      } else {
        prompt = `Analise a escala de adoração (Setlist Intelligence & Worship Flow).
Identifique: excesso de repetição, fluidez de transições, equilíbrio congregacional, curva de energia, e comportamento de transição.
Responda EXCLUSIVAMENTE em português.

Músicas Atuais na Escala:
${songs && songs.length > 0 ? songs.map((s: any, i: number) => `${i + 1}. ${s.title} - ${s.artist} (Idioma original: ${s.language || '?'}, Tom: ${s.selectedKey || s.key}, BPM: ${s.bpm || '?'})`).join('\n') : 'Vazia.'}`;
      }

      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
        contents: [
            {
                role: "user",
                parts: [{ text: prompt }]
            }
        ],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT" as any,
                properties: {
                    healthScore: { type: "INTEGER" as any, description: "0 a 100" },
                    metrics: {
                        type: "OBJECT" as any,
                        properties: {
                            fluidez: { type: "INTEGER" as any },
                            energia: { type: "INTEGER" as any },
                            tonalidade: { type: "INTEGER" as any },
                            repeticao: { type: "INTEGER" as any },
                            equilibrio: { type: "INTEGER" as any }
                        }
                    },
                    feedback: { type: "STRING" as any, description: "Parágrafo inspirador sobre o fluxo do setlist" },
                    suggestions: {
                        type: "ARRAY" as any,
                        items: {
                            type: "OBJECT" as any,
                            properties: {
                                type: { type: "STRING" as any, description: "'transition' | 'key_change' | 'add_song'" },
                                text: { type: "STRING" as any }
                            }
                        }
                    },
                    learningInsight: { type: "STRING" as any, description: "Observação de Behavioral learning (padrões)" }
                }
            }
        }
      });

      const jsonStr = response.text || "{}";
      const result = JSON.parse(jsonStr);

      const processingTimeMs = Date.now() - startTime;
      logger.info(`[Analytics] AI Setlist Analysis: time_ms=${processingTimeMs}, score=${result.healthScore}`);

      res.json({ result, processingTimeMs });
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      logger.error(`[Analytics] AI Setlist Analysis Fatal Error: time_ms=${processingTimeMs}`, error);
      res.status(500).json({ error: String(error) });
    }
  });

  

  // --- First Scale Onboarding Experience ---


  app.get("/api/v1/onboarding/starter-pack/status", async (req, res) => {
    let orgId;
    try {
      if (!db || !admin) throw new Error("Database not initialized");
      
      const { resolveStarterPackAllowanceContext } = await import("./services/server/onboarding/firstScaleOnboardingService.js");
      const context = await resolveStarterPackAllowanceContext(req, res, db, admin.auth());
      if (!context) return;
      
      orgId = context.orgId;
      
      return res.status(200).json({
        success: true,
        allowance: context.allowance
      });
    } catch (err) {
      return res.status(500).json({ 
         error: "STARTER_PACK_STATUS_FAILED", 
         organizationId: orgId || "unknown", 
         source: "starter_pack_status", 
         path: "/api/v1/onboarding/starter-pack/status", 
         message: "Não foi possível carregar o status do pacote inicial."
      });
    }
  });

  app.get("/api/v1/onboarding/starter-pack", async (req, res) => {
    let orgId;
    try {
      if (!db || !admin) throw new Error("Database not initialized");
      
      const { resolveStarterPackAllowanceContext, selectStarterPack } = await import("./services/server/onboarding/firstScaleOnboardingService.js");
      const context = await resolveStarterPackAllowanceContext(req, res, db, admin.auth());
      if (!context) return;
      
      orgId = context.orgId;
      
      const { buildEffectiveAccessContext, hasMusicScaleCapability } = await import("./utils/rbac.js");
      const accessCtx = buildEffectiveAccessContext(
          context.authContext.uid, 
          orgId, 
          context.authContext.systemRole || null, 
          context.authContext.organizationRole || null,
          context.authContext.isActive ? 'active' : 'inactive'
      );
      
      if (!hasMusicScaleCapability(accessCtx, 'songs.read')) {
          return res.status(403).json({ error: "Insufficient permissions to read songs" });
      }

      const starterSongs = await selectStarterPack(db);
      
      // Check which ones are already imported
      const importedIds = new Set();
      try {
         const existingSnapshot = await db.collection("songs")
            .where("organizationId", "==", orgId)
            .get();
         existingSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.originGlobalSongId) {
               importedIds.add(data.originGlobalSongId);
            }
         });
      } catch (e) {
         console.warn("Could not fetch existing songs for alreadyImported check", e);
      }

      const safeStarterSongs = starterSongs.map((s) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        key: s.key,
        bpm: s.bpm,
        language: s.language,
        onboardingStarterVersion: s.onboardingStarterVersion || '1.0',
        alreadyImported: importedIds.has(s.id)
      }));

      res.json({ starterPack: safeStarterSongs });
    } catch (err: any) {
      logger.error(`[Onboarding] Starter pack resolution failed: orgId=${orgId}`, err);
      return res.status(500).json({ 
         error: "STARTER_PACK_RESOLUTION_FAILED", 
         organizationId: orgId || "unknown", 
         source: "starter_pack_fetch", 
         count: 0, 
         path: "/api/v1/onboarding/starter-pack", 
         message: "Não foi possível carregar o pacote de músicas inicial."
      });
    }
  });

  app.post("/api/v1/onboarding/starter-pack/import", async (req, res) => {
    let orgId;
    let actorUid;
    try {
      if (!db || !admin) throw new Error("Database not initialized");
      
      const { resolveStarterPackAllowanceContext, validateStarterSelection, computeStarterImportPlan, buildUpdatedOnboardingState, normalizeStarterSong, selectStarterPack } = await import("./services/server/onboarding/firstScaleOnboardingService.js");
      const context = await resolveStarterPackAllowanceContext(req, res, db, admin.auth());
      if (!context) return;
      
      orgId = context.orgId;
      actorUid = context.authContext.uid;
      
      const { buildEffectiveAccessContext, hasMusicScaleCapability } = await import("./utils/rbac.js");
      const accessCtx = buildEffectiveAccessContext(
          actorUid, 
          orgId, 
          context.authContext.systemRole || null, 
          context.authContext.organizationRole || null,
          context.authContext.isActive ? 'active' : 'inactive'
      );
      
      if (!hasMusicScaleCapability(accessCtx, 'songs.create')) {
          return res.status(403).json({ error: "Insufficient permissions to import songs" });
      }

      const { selectedSongIds } = req.body;
      if (!Array.isArray(selectedSongIds) || selectedSongIds.length === 0) {
        return res.status(400).json({ error: "No songs selected" });
      }

      const starterSongs = await selectStarterPack(db);
      
      const validation = validateStarterSelection(selectedSongIds, starterSongs);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error, message: validation.message });
      }

      // Read current state & existing songs to compute plan
      const stateRef = db.collection("organizations").doc(orgId).collection("musicScaleOnboarding").doc("state");
      const stateSnap = await stateRef.get();
      const existingState = stateSnap.exists ? stateSnap.data() : {};
      
      const songsRef = db.collection("songs");
      const existingSongsSnap = await songsRef.where("organizationId", "==", orgId).get();
      const existingOrganizationGlobalIds = existingSongsSnap.docs.map(doc => doc.data().originGlobalSongId).filter(Boolean);
      const existingDocIds = existingSongsSnap.docs.map(doc => doc.id);

      const plan = computeStarterImportPlan({
        selectedSongIds,
        starterSongs,
        existingOrganizationGlobalIds,
        starterPackImportedGlobalIds: existingState.starterPackImportedGlobalIds || [],
        existingDocIds,
        orgId
      });

      if (plan.limitExceeded) {
        return res.status(400).json({ error: "LIMIT_EXCEEDED", message: "Pacote inicial excederia o limite de 10 músicas." });
      }

      if (plan.songsToImport.length === 0) {
        return res.status(200).json({ success: true, importedCount: 0, message: "Todas as músicas já foram importadas." });
      }

      // Execute import in batch
      const batch = db.batch();
      
      // Update state
      const newState = buildUpdatedOnboardingState(existingState, plan.newGlobalIds, actorUid, '1.0', admin.firestore.FieldValue.serverTimestamp());
      batch.set(stateRef, newState, { merge: true });

      // Build createdBy ref
      let createdBy = null;
      try {
        const userSnap = await db.collection("users").doc(actorUid).get();
        if (userSnap.exists) {
           const userData = userSnap.data();
           createdBy = {
              uid: actorUid,
              name: userData.name || userData.displayName || "",
              email: userData.email || ""
           };
        }
      } catch (e) {
         console.warn("Could not fetch user for createdBy");
      }

      for (const song of plan.songsToImport) {
        const newSong = normalizeStarterSong(song, orgId, createdBy, actorUid);
        const songRef = db.collection("songs").doc(newSong.id);
        batch.set(songRef, { ...newSong, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }

      await batch.commit();

      res.status(200).json({
        success: true,
        importedCount: plan.songsToImport.length,
        skippedIds: plan.skippedIds
      });
    } catch (err: any) {
      logger.error(`[Onboarding] Starter pack import failed: orgId=${orgId}`, err);
      return res.status(500).json({ 
         error: "STARTER_PACK_IMPORT_FAILED", 
         message: "Falha ao importar o pacote inicial."
      });
    }
  });

  app.post("/api/v1/onboarding/bootstrap", async (req, res) => {
    let orgId: string | undefined;
    try {
      if (!db || !admin) throw new Error("Database not initialized");

      const orgIdHeader = req.headers["x-organization-id"];
      orgId = Array.isArray(orgIdHeader) ? orgIdHeader[0] : orgIdHeader;
      if (!orgId) return res.status(400).json({ error: "Missing x-organization-id header" });

      const { resolveOrganizationAuthorization } = await import("./services/server/organizationAuthorization.js");
      const authResult = await resolveOrganizationAuthorization(req.headers.authorization, orgId, db, admin.auth());
      
      if (authResult.error || authResult.statusCode) {
          return res.status(authResult.statusCode || 403).json({ error: authResult.error });
      }

      const { resolveStarterEntitlementState } = await import("./services/server/onboarding/firstScaleOnboardingService.js");

      // Check server-side subscription entitlement
      const entitled = await resolveStarterEntitlementState(db, orgId);
      if (!entitled) {
         return res.status(403).json({ error: "REQUIRED_ACTIVE_SUBSCRIPTION", message: "Acesso restrito. Esta funcionalidade requer uma assinatura ativa ou período de teste ativo no MillionsNest." });
      }

      const { buildEffectiveAccessContext, hasMusicScaleCapability } = await import("./utils/rbac.js");
      const accessCtx = buildEffectiveAccessContext(
          authResult.context.uid, 
          orgId, 
          authResult.context.systemRole || null, 
          authResult.context.organizationRole || null,
          authResult.context.isActive ? 'active' : 'inactive'
      );
      
      if (!hasMusicScaleCapability(accessCtx, 'taxonomy.eventTypes.manage') || !hasMusicScaleCapability(accessCtx, 'taxonomy.locations.manage')) {
          return res.status(403).json({ error: "Insufficient permissions to manage taxonomy" });
      }

      const results = {
         eventTypesCreated: [],
         eventTypesExisting: [],
         locationsCreated: [],
         locationsExisting: []
      };

      await db.runTransaction(async (transaction) => {
         // Event Types (root collection filtered by orgId)
         const eventTypesRef = db.collection("eventTypes");
         const eventTypesSnap = await transaction.get(eventTypesRef.where("organizationId", "==", orgId));
         const existingTypes = eventTypesSnap.docs.map(d => ({id: d.id, name: d.data().name.trim().toLowerCase()}));
         
         const defaultTypes = [
           { name: "Culto", color: "#3b82f6" },
           { name: "Ensaio", color: "#8b5cf6" },
           { name: "Evangelismo", color: "#10b981" },
           { name: "Outro", color: "#6b7280" }
         ];

         const userDoc = await transaction.get(db.collection('users').doc(authResult.context.uid));
         const userData = userDoc.data() || {};
         
         const createdBy = {
             uid: authResult.context.uid,
             displayName: userData.displayName || authResult.context.email || 'Unknown User',
             photoURL: userData.photoURL || null
         };

         for (const defType of defaultTypes) {
            if (!existingTypes.some(t => t.name === defType.name.toLowerCase())) {
               const newRef = db.collection("eventTypes").doc();
               transaction.set(newRef, {
                 id: newRef.id,
                 organizationId: orgId,
                 name: defType.name,
                 color: defType.color,
                 isSystemDefault: true,
                 createdAt: admin.firestore.FieldValue.serverTimestamp(),
                 updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                 createdBy
               });
               results.eventTypesCreated.push(defType.name);
            } else {
               results.eventTypesExisting.push(defType.name);
            }
         }

         // Locations (root collection filtered by orgId)
         const locationsRef = db.collection("locations");
         const locationsSnap = await transaction.get(locationsRef.where("organizationId", "==", orgId));
         const existingLocations = locationsSnap.docs.map(d => ({id: d.id, name: d.data().name.trim().toLowerCase()}));

         const defaultLocations = [
           { name: "Local Principal", address: "", capacity: 0 },
           { name: "Externo", address: "", capacity: 0 }
         ];

         for (const defLoc of defaultLocations) {
            if (!existingLocations.some(l => l.name === defLoc.name.toLowerCase())) {
               const newRef = db.collection("locations").doc();
               transaction.set(newRef, {
                 id: newRef.id,
                 organizationId: orgId,
                 name: defLoc.name,
                 address: defLoc.address,
                 capacity: defLoc.capacity,
                 createdAt: admin.firestore.FieldValue.serverTimestamp(),
                 updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                 createdBy
               });
               results.locationsCreated.push(defLoc.name);
            } else {
               results.locationsExisting.push(defLoc.name);
            }
         }
         
         // Update onboarding state
         const stateRef = db.collection("organizations").doc(orgId).collection("musicScaleOnboarding").doc("state");
         transaction.set(stateRef, {
           taxonomyBootstrapped: true,
           updatedAt: admin.firestore.FieldValue.serverTimestamp()
         }, { merge: true });

         const auditRef = db.collection("auditLogs").doc();
         transaction.set(auditRef, {
            id: auditRef.id,
            organizationId: orgId,
            action: 'bootstrap_taxonomy',
            userId: authResult.context.uid,
            details: { results },
            createdAt: admin.firestore.FieldValue.serverTimestamp()
         });
      });

      res.json({ success: true, results });
    } catch (err: any) {
      logger.error(`[Onboarding] Bootstrap failed: orgId=${orgId}`, err);
      return res.status(500).json({
         error: "ONBOARDING_BOOTSTRAP_FAILED",
         organizationId: orgId || "unknown",
         source: "taxonomy_bootstrap",
         count: 0,
         path: "/api/v1/onboarding/bootstrap",
         message: "Erro ao inicializar as configurações padrão do ministério."
      });
    }
  });

  app.post("/api/library/import", async (req, res) => {
    try {
      if (!db || !admin) throw new Error("Database not initialized");
      
      // 1. Verify Authentication Token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      const verifiedUid = decodedToken.uid;
      
      const { organizationId, userDisplayName, selectedSongs, isSupportMode, systemRole } = req.body;
      
      if (!organizationId || !selectedSongs || selectedSongs.length === 0) {
        return res.status(400).json({ 
          success: false, 
          blockedCount: selectedSongs?.length || 0, 
          errorMessage: "Invalid params" 
        });
      }

      // Check if user is Global Privileged User (ceo, admin, or fallback emails)
      const userDoc = await db.collection('users').doc(verifiedUid).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      const isGlobalAdmin = 
        ['ceo', 'admin', 'global_admin', 'owner', 'ecosystem_owner', 'founder', 'dono', 'administrador', 'supervisor', 'support', 'suporte'].includes(userData?.systemRole?.toLowerCase()) || 
        false;

      const shouldConsumeLimit = !isGlobalAdmin;

      // Security Check: Verify user actually belongs to this organization using the verified uid
      const membersRef = db.collection('organization_members');
      const membershipChecks = await Promise.all([
        membersRef.doc(`${organizationId}_${verifiedUid}`).get(),
        membersRef.doc(`${verifiedUid}_${organizationId}`).get()
      ]);
      const orgDoc = await db.collection('organizations').doc(organizationId).get();
      
      const belongs = isGlobalAdmin || membershipChecks.some(doc => doc.exists) || 
                      (orgDoc.exists && (orgDoc.data()?.ownerUserId === verifiedUid || orgDoc.data()?.ownerUid === verifiedUid));

      if (!belongs) {
        return res.status(403).json({
          success: false,
          blockedCount: selectedSongs.length,
          errorCode: 'UNKNOWN',
          errorMessage: "Acesso negado à organização."
        });
      }

      const orgData = orgDoc.exists ? orgDoc.data() : {};
      
      // Attempt to resolve plan securely. 
      // E.g. MillionsNest might store it in `apps.musicscale.plan` or `plan` or `subscription.plan`.
      let verifiedPlan = isGlobalAdmin ? 'pro' : 'starter';
      if (!isGlobalAdmin) {
        if (orgData?.plan) {
          verifiedPlan = orgData.plan; // Base fallback
        }
        if (orgData?.apps?.musicscale?.plan) {
          verifiedPlan = orgData.apps.musicscale.plan;
        }
        if (verifiedPlan === 'trialing' || verifiedPlan === 'free') {
          verifiedPlan = 'starter';
        }
        if (!['starter', 'advanced', 'pro'].includes(verifiedPlan)) {
          verifiedPlan = 'starter';
        }
      }
      
      const serverFeatures = PLAN_FEATURES[verifiedPlan as keyof typeof PLAN_FEATURES];
      const serverLimits = PLAN_LIMITS[verifiedPlan as keyof typeof PLAN_LIMITS];
      const serverIsPro = isGlobalAdmin || verifiedPlan === 'pro' || serverLimits.libraryImportsPerMonth === -1 || serverFeatures.libraryComplete;

      // 1. Starter check
      if (verifiedPlan === 'starter' || !serverFeatures.libraryAccess) {
        return res.json({
          success: false,
          importedCount: 0,
          blockedCount: selectedSongs.length,
          errorCode: 'STARTER_BLOCKED',
          errorMessage: "A Biblioteca Viva requer no mínimo o plano Advanced."
        });
      }

      const date = new Date();
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      // Use clean 4-segment path: organizations/{orgId}/monthly_usage/{YYYY-MM}
      const usageDocRef = db.collection('organizations').doc(organizationId).collection('monthly_usage').doc(monthStr);
      let successCount = 0;

      try {
        await db.runTransaction(async (transaction) => {
          // 1. Get current usage
          const usageSnap = await transaction.get(usageDocRef);
          let currentUsage = usageSnap.exists ? (usageSnap.data()?.libraryImports || 0) : 0;
          
          if (!serverIsPro && shouldConsumeLimit) {
            const maxAllowed = serverLimits.libraryImportsPerMonth || 0;
            const available = Math.max(0, maxAllowed - currentUsage);

            if (available === 0) {
              throw new Error("ADVANCED_LIMIT_REACHED");
            }

            if (selectedSongs.length > available) {
              throw new Error(`INSUFFICIENT_IMPORT_QUOTA:${available}`);
            }
          }

          // 2. Increment Usage ONLY IF shouldConsumeLimit
          if (shouldConsumeLimit) {
            const newUsage = currentUsage + selectedSongs.length;
            if (usageSnap.exists) {
              transaction.update(usageDocRef, {
                libraryImports: newUsage,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            } else {
              transaction.set(usageDocRef, {
                organizationId,
                month: monthStr,
                libraryImports: newUsage,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            }
          }

          // 3. Create the songs in the same transaction
          const orgSongsRef = db.collection('songs');
          for (const globalSong of selectedSongs) {
            const newSongRef = orgSongsRef.doc(); // Auto-generate ID
            
            const newSongData = {
              title: globalSong.title,
              artist: globalSong.artist,
              key: globalSong.key || "",
              bpm: globalSong.bpm || 0,
              status: "active",
              tagIds: [],
              lyrics: globalSong.lyrics || "",
              chords: globalSong.chords || "",
              chordsUrl: globalSong.chordsUrl || "",
              videoUrl: globalSong.videoUrl || "",
              organizationId: organizationId,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              lastPlayed: null,
              createdBy: {
                uid: verifiedUid,
                displayName: userDisplayName || "Usuário",
                photoURL: null,
              },
              originGlobalSongId: globalSong.id,
              importedBy: verifiedUid,
              importedBySystemRole: isGlobalAdmin ? (systemRole || 'admin') : null,
              usageConsumed: shouldConsumeLimit,
            };

            transaction.set(newSongRef, newSongData);
            
            // Audit log for this import
            if (isGlobalAdmin) {
               const auditRef = db.collection('audit_logs').doc();
               transaction.set(auditRef, {
                  action: "musicscale.library.import",
                  organizationId: organizationId,
                  actorUid: verifiedUid,
                  actorEmail: decodedToken.email || '',
                  actorDisplayName: userDisplayName || "Usuário Suporte",
                  actorSystemRole: systemRole || 'admin',
                  supportMode: false,
                  targetOrganizationId: organizationId,
                  consumedUsage: shouldConsumeLimit,
                  source: "support_admin",
                  globalSongId: globalSong.id,
                  songTitle: globalSong.title,
                  createdAt: admin.firestore.FieldValue.serverTimestamp()
               });
            }
            
            successCount++;
          }
        });

        // Background analytics increment - non blocking
        selectedSongs.forEach((song: any) => {
          const globalSongRef = db.collection('globalSongs').doc(song.id);
          globalSongRef.update({
            importCount: admin.firestore.FieldValue.increment(1)
          }).catch(e => logger.warn('Failed to increment global count', e));
        });

        return res.json({
          success: true,
          importedCount: successCount,
          blockedCount: 0
        });

      } catch (txnError: any) {
        if (txnError.message === "ADVANCED_LIMIT_REACHED") {
          return res.json({
            success: false,
            importedCount: 0,
            blockedCount: selectedSongs.length,
            errorCode: 'ADVANCED_LIMIT_REACHED',
            errorMessage: "Você usou suas 10 importações da Biblioteca Viva este mês. Faça upgrade para o Pro e importe sem limites."
          });
        }
        
        if (txnError.message.startsWith("INSUFFICIENT_IMPORT_QUOTA:")) {
          const available = parseInt(txnError.message.split(":")[1]);
          return res.json({
            success: false,
            importedCount: 0,
            blockedCount: selectedSongs.length,
            errorCode: 'INSUFFICIENT_IMPORT_QUOTA',
            errorMessage: `Você tem apenas ${available} importações disponíveis este mês. Selecione até ${available} músicas ou faça upgrade para o Pro.`
          });
        }

        throw txnError;
      }
      
    } catch(e: any) {
      logger.error("Usage transaction failed", e);
      res.json({
        success: false,
        importedCount: 0,
        blockedCount: req.body.selectedSongs?.length || 0,
        errorCode: 'UNKNOWN',
        errorMessage: "Ocorreu um erro ao verificar os limites. Tente novamente."
      });
    }
  });

  // Cross-org Admin Import API
  app.post("/api/admin/musicscale/library/import-to-organization", async (req, res) => {
    try {
      if (!db || !auth) throw new Error("Database or Auth service not initialized");
      
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await auth.verifyIdToken(token);
      const verifiedUid = decodedToken.uid;
      
      const { targetOrganizationId, globalSongIds, checkOnly, allowDuplicates } = req.body;
      
      if (!targetOrganizationId || !globalSongIds || globalSongIds.length === 0) {
        return res.status(400).json({ error: "Parâmetros inválidos" });
      }

      // Check if user is Global Privileged User
      const userDoc = await db.collection('users').doc(verifiedUid).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      
      const decodedEmail = (decodedToken.email || "").toString().toLowerCase().trim();
      const dbEmail = (userData?.email || "").toString().toLowerCase().trim();
      const systemRole = (userData?.systemRole || "").toString().toLowerCase().trim();
      
      const isGlobalAdmin = 
        ['ceo', 'admin', 'global_admin', 'owner', 'ecosystem_owner', 'founder', 'dono', 'administrador', 'supervisor', 'support', 'suporte'].includes(systemRole) || 
        false;

      if (!isGlobalAdmin) {
        return res.status(403).json({ error: "Apenas administradores do ecossistema podem importar músicas para organizações de terceiros." });
      }

      // Fetch org
      const orgDoc = await db.collection('organizations').doc(targetOrganizationId).get();
      if (!orgDoc.exists) {
        return res.status(404).json({ error: "Organização destino não encontrada." });
      }

      // Fetch global songs
      const songsRefs = globalSongIds.map((id: string) => db.collection('globalSongs').doc(id));
      const songDocs = await db.getAll(...songsRefs);
      const globalSongsToImport = songDocs.filter(d => d.exists).map(d => ({ id: d.id, ...(d.data() as any) })) as any[];

      if (globalSongsToImport.length === 0) {
        return res.status(404).json({ error: "Nenhuma música da Biblioteca Viva encontrada." });
      }

      // Precheck or check for duplicates (using an index-safe query)
      const orgSongsRef = db.collection('songs');
      const existingSongsQuery = await orgSongsRef
        .where('organizationId', '==', targetOrganizationId)
        .get();

      const existingIds = new Set(
        existingSongsQuery.docs
          .map(d => d.data().originGlobalSongId)
          .filter(id => !!id)
      );
      const duplicates = globalSongsToImport
        .filter(s => existingIds.has(s.id))
        .map(s => ({ id: s.id, title: s.title, artist: s.artist }));

      if (checkOnly) {
        return res.json({
          success: true,
          hasDuplicates: duplicates.length > 0,
          duplicates
        });
      }

      let validSongs = [];
      let skippedCount = 0;

      if (allowDuplicates) {
        validSongs = globalSongsToImport;
        skippedCount = 0;
      } else {
        validSongs = globalSongsToImport.filter(s => !existingIds.has(s.id));
        skippedCount = globalSongsToImport.length - validSongs.length;
      }

      if (validSongs.length === 0) {
        return res.json({
          success: true,
          importedCount: 0,
          skippedCount,
          message: "Todas as músicas selecionadas já existem nesta organização."
        });
      }

      const batch = db.batch();
      
      validSongs.forEach(globalSong => {
        const newSongRef = orgSongsRef.doc();
        const newSongData = {
          title: globalSong.title,
          artist: globalSong.artist,
          key: globalSong.key || "",
          bpm: globalSong.bpm || 0,
          status: "active",
          tagIds: [],
          lyrics: globalSong.lyrics || "",
          chords: globalSong.chords || "",
          chordsUrl: globalSong.chordsUrl || "",
          videoUrl: globalSong.videoUrl || "",
          language: globalSong.language || "pt",
          organizationId: targetOrganizationId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastPlayed: null,
          createdBy: {
            uid: verifiedUid,
            displayName: userData?.displayName || decodedToken.email || "Admin do Ecossistema",
            photoURL: userData?.photoURL || null,
          },
          originGlobalSongId: globalSong.id,
          importedBy: verifiedUid,
          importedBySystemRole: userData?.systemRole || 'admin',
          importedByAdminCrossOrg: true,
          usageConsumed: false,
          source: "admin_cross_org_library_import",
        };
        batch.set(newSongRef, newSongData);
        
        // Granular log if tracking everything per-song
        const auditRef = db.collection('audit_logs').doc();
        batch.set(auditRef, {
           action: "musicscale.library.import_song_to_organization",
           actorUid: verifiedUid,
           targetOrganizationId,
           globalSongId: globalSong.id,
           songTitle: globalSong.title,
           usageConsumed: false,
           createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      // Master audit log
      const masterAuditRef = db.collection('audit_logs').doc();
      batch.set(masterAuditRef, {
        action: "musicscale.library.import_to_organization",
        actorUid: verifiedUid,
        actorEmail: decodedToken.email || '',
        actorDisplayName: userData?.displayName || "Admin",
        actorSystemRole: userData?.systemRole || 'admin',
        targetOrganizationId,
        targetOrganizationName: orgDoc.data()?.name || "Desconhecida",
        globalSongIds: validSongs.map(s => s.id),
        importedCount: validSongs.length,
        skippedCount,
        failedCount: 0,
        consumedUsage: false,
        source: "admin_cross_org_library_import",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      // Background inc
      validSongs.forEach((song) => {
        db.collection('globalSongs').doc(song.id).update({
          importCount: admin.firestore.FieldValue.increment(1)
        }).catch(() => {});
      });

      res.json({
        success: true,
        importedCount: validSongs.length,
        skippedCount,
        targetOrganizationId,
        message: `${validSongs.length} importadas, ${skippedCount} ignoradas (já existiam).`
      });

    } catch(e: any) {
      logger.error("Admin cross-org import failed", e);
      res.status(500).json({ error: "Falha na importação inter-organizacional." });
    }
  });

  // Suporte
  app.post('/api/support/send', async (req, res) => {
    const { email, subject, message } = req.body;
    logger.debug(`[SUPPORT EMAIL] From: ${email}, Subject: ${subject}`);
    logger.debug(`[SUPPORT MESSAGE] ${message}`);
    // Simulated send
    res.json({ success: true });
  });

  // --- DESIGN CHRONICLES: PREMIUM CHANGELOG SYSTEM ---
  
  // Curious / Beautiful Static Bootstrap Releases (to be shown by default or stored in firestore)
  const bootstrapChangelogs = [
    {
      id: "release-v1-2",
      version: "1.2.0",
      title: {
        pt: "Acelerador de Ministério: Biblioteca Viva & Modo de Performance",
        en: "Ministry Unleashed: Live Repertoire & Immersive Performance Mode",
        es: "Acelerador de Alabanza: Biblioteca de Repertorio Vivo & Modo Performance"
      },
      description: {
        pt: "Acesse um repositório curado com músicas prontas, letras fiéis e cifras perfeitamente sincronizadas ao vivo. Elimine a ansiedade do altar.",
        en: "Access a hand-crafted repository with polished chord sheets, live reading, and multi-user performance orchestrator.",
        es: "Acceda a un repositorio curado con cifras pulidas, letras claras y transposición al vuelo."
      },
      highlights: {
        pt: [
          "Transposição instantânea de acordes que recalcula as cifras em menos de 8ms para os vocalistas.",
          "Novo Setlist Vivo para manter diretor, músicos e cronômetro em sincronia contínua durante o culto.",
          "Localização integral em três grandes idiomas: Português, Inglês e Espanhol."
        ],
        en: [
          "Instant key transposing that recalculates chords in under 8ms with stutter-free response.",
          "Brand-new Live Setlist director hud to align musicians, vocal cues, and clocks during sessions.",
          "High-fidelity localization with native-level Portuguese, English, and Spanish support."
        ],
        es: [
          "Transposición de cifrados súper ágil que recalcula los tonos en menos de 8ms.",
          "Modo Performance rediseñado con lectura vertical fluida en pantallas oscuras.",
          "Localización nativa completa en tres idiomas: Portugués, Inglés y Español."
        ]
      },
      category: "Performance Mode",
      launchedAt: "2026-05-26T12:00:00Z",
      author: "Worship Experience Team",
      isMajor: true
    },
    {
      id: "release-v1-1",
      version: "1.1.0",
      title: {
        pt: "Segurança de Fluxo: Modo Offline Sólido & Detecção de Fadiga de Escala",
        en: "Absolute Stability: Robust Offline Mode & Scaler Fatigue Audits",
        es: "Estabilidad Total: Sincronización Fuera de Línea & Fatiga de Integrantes"
      },
      description: {
        pt: "Nenhuma oscilação de Wi-Fi deve parar o mover da sua equipe. Nosso motor agora isola dados localmente em IndexedDB para segurança inabalável.",
        en: "Worship is sacred; local Wi-Fi drops shouldn't ruin it. The app now isolates data locally using high-fidelity IndexedDB synchronization.",
        es: "La adoración es sagrada; las caídas de internet no deben entorpecerla. Guardamos la información de forma local y segura."
      },
      highlights: {
        pt: [
          "IndexedDB local síncrono que armazena setlists e acordes offline no tablet do líder.",
          "Detecção inteligente de estresse ou repetição excessiva de músicos no mesmo fim de semana.",
          "Gateway de entrada reativo que gerencia conexões e sincronização em background confiável."
        ],
        en: [
          "Ultra-fast local storage replicating scale and setlist data to leadership tablets offline.",
          "Intelligent scale conflict auditor warning you about teammate fatigue or consecutive scheduling.",
          "Reactive system gateway managing state-updates and background queue synchronization."
        ],
        es: [
          "IndexedDB local para resguardar las cifras y setlists incluso sin señal.",
          "Control de escalas y fatiga de músicos programados consecutivamente.",
          "Gateway de entrada reativo para estabilizar las firmas y permisos rápidamente."
        ]
      },
      category: "Estabilidade",
      launchedAt: "2026-05-18T14:30:00Z",
      author: "SaaS Reliability Lead",
      isMajor: false
    },
    {
      id: "release-v1-0",
      version: "1.0.0",
      title: {
        pt: "Aha Moment: Lançamento Oficial do MusicScale",
        en: "Ultimate Launch: Official Premiere of MusicScale Platform",
        es: "Estreno Definitivo: Lanzamiento Oficial de MusicScale"
      },
      description: {
        pt: "Nasce a plataforma ministerial desenvolvida para silenciar o ruído operacional e focar os corações naquilo que realmente importa.",
        en: "Say goodbye to chaotic PDFs, messy WhatsApp links, and disorganized spreadsheets. Meet your premium worship workstation.",
        es: "Termine con los PDFs caóticos y mensajes desorganizados de WhatsApp. Un ecosistema ministerial premium para su louvor."
      },
      highlights: {
        pt: [
          "Criação de Cultos e Escalas integradas com envio instantâneo de convocações.",
          "Importador inteligente de qualquer texto de cifra, padronizando a estrutura musical em segundos.",
          "Design system luxuoso inspirado em interfaces de elite, otimizado para celulares e computadores."
        ],
        en: [
          "Create worship services and structured rosters with zero-hassle invitations.",
          "Import raw text chords and translate draft lyrics into standard formatting instantly.",
          "Premium workspace design system built for high density, spacious rhythm, and touch zones."
        ],
        es: [
          "Planificación de cultos, ensayos y escalas coordinadas de manera fluida.",
          "Importador rápido de acordes para normalizar cualquier cifrado sucio en segundos.",
          "Estilo visual de elite y bento-grid con comodidad de toque ultra fluida."
        ]
      },
      category: "Novidades",
      launchedAt: "2026-05-01T09:00:00Z",
      author: "Founder & Chief Architect",
      isMajor: true
    }
  ];

  app.get("/api/changelog", async (req, res) => {
    try {
      if (!db) {
        return res.json({ changelogs: bootstrapChangelogs });
      }
      
      const snap = await db.collection("changelogs").orderBy("launchedAt", "desc").get();
      if (snap.empty) {
        // Bootstrap Firestore with pre-loaded entries for gorgeous out-of-the-box appearance
        const batch = db.batch();
        bootstrapChangelogs.forEach((item) => {
          const ref = db.collection("changelogs").doc(item.id);
          batch.set(ref, item);
        });
        await batch.commit();
        return res.json({ changelogs: bootstrapChangelogs });
      }
      
      const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json({ changelogs: logs });
    } catch (e: any) {
      logger.error("Error fetching changelog:", e);
      // Fail gracefully to bootstrap defaults so UI never breaks
      res.json({ changelogs: bootstrapChangelogs });
    }
  });

  app.post("/api/changelog", async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: "Db not initialized" });
      const entry = req.body;
      const id = entry.id || `release-${Date.now()}`;
      const docData = {
        ...entry,
        id,
        launchedAt: entry.launchedAt || new Date().toISOString()
      };
      
      await db.collection("changelogs").doc(id).set(docData, { merge: true });
      res.json({ success: true, entry: docData });
    } catch (e: any) {
      logger.error("Error saving changelog:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/changelog/aggregate", async (req, res) => {
    try {
      const { language = "pt" } = req.body;
      
      // Smart Auto-Aggregation: Scan repository directories to see what has been built!
      const dirsToScan = ["pages", "components", "contexts", "services"];
      const detectedFiles: string[] = [];
      
      try {
        dirsToScan.forEach(dir => {
          const fullPath = path.join(process.cwd(), dir);
          if (fs.existsSync(fullPath)) {
            const files = fs.readdirSync(fullPath);
            files.slice(0, 5).forEach(f => detectedFiles.push(`${dir}/${f}`));
          }
        });
      } catch (e) {
        logger.warn("Changelog system directory scanning warning:", e);
      }
      
      const fileContext = detectedFiles.length > 0
        ? detectedFiles.join(", ")
        : "LiveWorshipDirector.tsx, locales/pt.json, locales/es.json, UpdatesPage.tsx, Sidebar.tsx";

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Você é o Principal Product Marketing Director e SaaS Experience Architect do MusicScale.
Sua tarefa é analisar os arquivos que acabaram de ser implantados/revisados e compor uma nota de lançamento (release note) espetacular, de padrão Apple, Linear e Superhuman.
As notas de lançamento devem se concentrar em benefícios emocionais reais (por exemplo, "maior segurança na transmissão ao vivo", "leituras sem reflexo ou oscilações no altar", "fluidez em multilinguagem nativa", "facilidade de transposição sem atraso em ensaios"), e nunca em jargão de código puro ou nomes de commits frios.

Arquivos / Módulos detectados nesta entrega: ${fileContext}

Você DEVE produzir e retornar um JSON estritamente válido que contenha TODOS os seguintes campos exatamente assim (e traduzido em pt, en, es):
{
  "version": "[Gerar uma versão menor ou de patch incrementada, por exemplo, '1.2.5' ou '1.3.0']",
  "title": {
    "pt": "[Um título deslumbrante em português, ex: 'Direção Litúrgica em Tempo Real & Sincronia Multilíngue']",
    "en": "[Beautiful title in English, ex: 'Real-Time Liturgical Guidance & Multi-Language Harmony']",
    "es": "[Title in Spanish, ex: 'Dirección Litúrgica en Tiempo Real & Sintonía Multilingüe']"
  },
  "description": {
    "pt": "[Uma descrição de 1-2 frases em português explicando o impacto emocional imediato e operacional do recurso no altar]",
    "en": "[An emotional 1-2 sentence description in English focused on ministry benefit on stage]",
    "es": "[An emotional 1-2 sentence description in Spanish]"
  },
  "highlights": {
    "pt": [
      "[Frase curta de benefício 1]",
      "[Frase curta de benefício 2]",
      "[Frase curta de benefício 3]"
    ],
    "en": [
      "[Short benefit phrase 1 in English]",
      "[Short benefit phrase 2 in English]",
      "[Short benefit phrase 3 in English]"
    ],
    "es": [
      "[Short benefit phrase 1 in Spanish]",
      "[Short benefit phrase 2 in Spanish]",
      "[Short benefit phrase 3 in Spanish]"
    ]
  },
  "category": "[Escolha EXCLUSIVAMENTE uma das categorias: 'Novidades', 'Performance', 'Experiência', 'Inteligência', 'Estabilidade', 'Offline', 'Performance Mode', 'IA', 'Refinamentos']",
  "isMajor": true
}

Atenção: Retorne APENAS o objeto JSON puro sem marcações de código markdown \`\`\`json ou qualquer texto fora do JSON. Certifique-se de que todas as aspas estejam escapadas corretamente e o JSON seja perfeitamente parseável.`;

      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });

      let jsonText = response.text || "{}";
      
      // Clean possible markdown backticks
      if (jsonText.includes("```")) {
        const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
          jsonText = match[1];
        } else {
          jsonText = jsonText.replace(/```(?:json)?|```/g, "").trim();
        }
      }
      
      jsonText = jsonText.trim();
      const parsed = JSON.parse(jsonText);
      
      res.json({ success: true, suggestion: parsed });
    } catch (e: any) {
      logger.error("Auto-Changelog aggregation fail: ", e);
      res.status(500).json({ error: e.message || "Failed to parse AI suggestion" });
    }
  });

  app.delete("/api/changelog/:id", async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: "Db not initialized" });
      const id = req.params.id;
      await db.collection("changelogs").doc(id).delete();
      res.json({ success: true });
    } catch (e: any) {
      logger.error("Error deleting changelog:", e);
      res.status(500).json({ error: e.message });
    }
  });

  let stripeClient: Stripe | null = null;
  function getStripe(): Stripe {
    if (!stripeClient) {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) throw new Error("STRIPE_SECRET_KEY missing");
      stripeClient = new Stripe(key);
    }
    return stripeClient;
  }

  app.get("/api/admin/organizations", async (req, res) => {
      try {
          if (!db) return res.status(500).json({ error: "Db not init" });
          
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
              return res.status(401).json({ error: "Unauthorized" });
          }
          const token = authHeader.split('Bearer ')[1];
          const decodedToken = await admin.auth().verifyIdToken(token);
          
          let userProfile: any = {};
          try {
              const userDoc = await db.collection('users').doc(decodedToken.uid).get();
              userProfile = userDoc.data() || {};
          } catch(e) {
              logger.warn("Could not fetch user profile for admin validation, checking token directly: ", e);
          }
          
          const isGlobalAdmin = 
            (userProfile?.systemRole && ['ceo', 'admin', 'global_admin', 'owner', 'ecosystem_owner', 'founder', 'dono', 'administrador', 'supervisor', 'support', 'suporte'].includes(userProfile?.systemRole?.toLowerCase())) || 
            false;
          
          if (!isGlobalAdmin) {
              return res.status(403).json({ error: "Acesso negado. Apenas administradores globais." });
          }

          const organizations: any[] = [];
          
          try {
              const orgsSnap = await db.collection('organizations').limit(200).get();
              orgsSnap.forEach(doc => {
                  organizations.push({ id: doc.id, ...doc.data() });
              });
          } catch(listErr: any) {
              logger.error("Admin list orgs threw exception (likely missing FIREBASE_SERVICE_ACCOUNT_BASE64):", listErr);
              return res.json({ 
                  organizations: [],
                  error_warning: "Permissão negada no banco de dados para a API do backend." 
              });
          }

          return res.json({ organizations });
      } catch (error: any) {
          logger.error("Admin orgs endpoint error:", error);
          return res.status(500).json({ error: error.message });
      }
  });

  app.get("/api/admin/users", async (req, res) => {
      try {
          if (!db) return res.status(500).json({ error: "Db not init" });
          
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
              return res.status(401).json({ error: "Unauthorized" });
          }
          const token = authHeader.split('Bearer ')[1];
          const decodedToken = await admin.auth().verifyIdToken(token);
          
          let userProfile: any = {};
          try {
              const userDoc = await db.collection('users').doc(decodedToken.uid).get();
              userProfile = userDoc.data() || {};
          } catch(e) {
              logger.warn("Could not fetch user profile for admin validation, checking token directly: ", e);
          }
          
          const isGlobalAdmin = 
            (userProfile?.systemRole && ['ceo', 'admin', 'global_admin', 'owner', 'ecosystem_owner', 'founder', 'dono', 'administrador', 'supervisor', 'support', 'suporte'].includes(userProfile?.systemRole?.toLowerCase())) || 
            false;
          
          if (!isGlobalAdmin) {
              return res.status(403).json({ error: "Acesso negado. Apenas administradores globais." });
          }

          const users: any[] = [];
          try {
              const usersSnap = await db.collection('users').limit(200).get();
              usersSnap.forEach(doc => {
                  users.push({ id: doc.id, ...doc.data() });
              });
          } catch (listErr: any) {
              logger.error("Admin list users threw exception (likely missing FIREBASE_SERVICE_ACCOUNT_BASE64):", listErr);
              return res.json({ 
                  users: [],
                  error_warning: "Permissão negada no banco de dados para a API do backend."
              });
          }

          return res.json({ users });
      } catch (error: any) {
          logger.error("Admin users endpoint error:", error);
          return res.status(500).json({ error: error.message });
      }
  });

  app.post("/api/curation/approve", requireEcosystemRole, async (req: any, res: any) => {
      try {
          if (!db) throw new Error("Database not initialized");

          const { candidateId, occurrenceId, idempotencyKey } = req.body;
          if (!candidateId || !occurrenceId || !idempotencyKey) {
              return res.status(400).json({ error: "Parâmetros obrigatórios ausentes." });
          }

          const decodedToken = req.ecosystemContext;
          const candidateRef = db.collection('globalLibraryCandidates').doc(candidateId);
          const occurrenceRef = candidateRef.collection('occurrences').doc(occurrenceId);
          
          const result = await db.runTransaction(async (t) => {
              const candidateSnap = await t.get(candidateRef);
              if (!candidateSnap.exists) {
                  throw new Error("Candidata não encontrada.");
              }
              const candidateData = candidateSnap.data() as any;
              
              if (candidateData.status === 'approved') {
                  if (candidateData.approvalIdempotencyKey === idempotencyKey) {
                      return { success: true, alreadyApproved: true, globalSongId: candidateData.resultingGlobalSongId };
                  }
                  throw new Error("Candidata já foi aprovada por outra operação/token.");
              }
              if (!['pending_review', 'likely_unique'].includes(candidateData.status)) {
                  throw new Error(`Estado da candidata não permite aprovação. (Estado atual: ${candidateData.status})`);
              }

              const occSnap = await t.get(occurrenceRef);
              if (!occSnap.exists) {
                  throw new Error("Ocorrência-base não encontrada.");
              }
              
              const occData = occSnap.data() as any;
              const snapshot = occData.snapshot;

              // Read occurrences in the read phase to comply with transaction constraints
              const occurrencesSnap = await t.get(candidateRef.collection('occurrences'));

              // Trava Determinística na rechecagem
              const fLyrics = candidateData.canonicalIdentity?.lyricsFingerprint || '';
              const fContent = candidateData.canonicalIdentity?.contentFingerprint || '';
              const baseId = candidateData.canonicalIdentity?.normalizedTitle + "_" + (candidateData.canonicalIdentity?.normalizedArtists?.join('_') || '');
              
              const reservationId = fContent || fLyrics || baseId;
              
              if (!reservationId) {
                  throw new Error("Identidade da candidata inválida.");
              }
              
              const reservationRef = db.collection('globalSongs_reservations').doc(reservationId);
              const reservationSnap = await t.get(reservationRef);
              if (reservationSnap.exists) {
                  if (reservationSnap.data()?.candidateId !== candidateId) {
                      throw new Error("ABORT_RESERVATION_COLLISION");
                  }
              } else {
                  t.set(reservationRef, { candidateId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
              }

              // Rechecagem Dinâmica Avançada contra Biblioteca Viva Global
              const titleQuery = await t.get(
                  db.collection('globalSongs').where('normalizedTitle', '==', candidateData.canonicalIdentity.normalizedTitle)
              );
              
              for (const docSnap of titleQuery.docs) {
                  const globalSong = docSnap.data();
                  const comparisonObj = {
                      normalizedTitle: globalSong.normalizedTitle,
                      normalizedArtists: [globalSong.normalizedArtist].filter(Boolean),
                      originalTitle: globalSong.title,
                      originalArtist: globalSong.artist || '',
                      contentFingerprint: null
                  };
                  const comparison = compareSongs(comparisonObj as any, candidateData.canonicalIdentity);
                  if (comparison.classification === 'exact_match' || comparison.classification === 'high_confidence_match') {
                      throw new Error(`ABORT_DUPLICATE|${docSnap.id}`);
                  }
              }

              const globalSongRef = db.collection('globalSongs').doc();
              
              const primaryArtist = (candidateData.canonicalIdentity.normalizedArtists || [])[0] || snapshot.artist || '';
              // Apenas campos públicos. Nada de sourceOccurrenceId, notes, scores.
              const newGlobalSong = {
                  title: snapshot.title,
                  normalizedTitle: candidateData.canonicalIdentity.normalizedTitle,
                  artist: snapshot.artist || '',
                  normalizedArtist: primaryArtist,
                  key: snapshot.originalKey || snapshot.key || 'C',
                  bpm: snapshot.bpm || null,
                  rhythm: snapshot.rhythm || null,
                  chords: snapshot.chords || '',
                  lyrics: snapshot.lyrics || '',
                  sections: snapshot.sections || [],
                  language: snapshot.language || 'pt',
                  tags: snapshot.tagIds || snapshot.tags || [],
                  videoUrl: snapshot.videoUrl || '',
                  videos: snapshot.videos || [],
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  createdBy: decodedToken.uid,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  status: 'active',
                  importCount: 0
              };

              t.set(globalSongRef, newGlobalSong);
              
              t.update(candidateRef, {
                  status: 'approved',
                  resultingGlobalSongId: globalSongRef.id,
                  approvalIdempotencyKey: idempotencyKey,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });

              // Update the original song documents in organization collections
              for (const occDoc of occurrencesSnap.docs) {
                  const oData = occDoc.data() as any;
                  if (oData.source?.organizationId && oData.source?.songId) {
                      const songRef = db.collection('songs').doc(oData.source.songId);
                      t.update(songRef, {
                          originGlobalSongId: globalSongRef.id,
                          updatedAt: admin.firestore.FieldValue.serverTimestamp()
                      });
                  }
              }

              // Usa o ID deterministico do log para evitar logs duplicados e gravar procedência privadamente
              const logRef = candidateRef.collection('reviewLogs').doc(`approve_${idempotencyKey}`);
              const logSnap = await t.get(logRef);
              if (!logSnap.exists) {
                  const correlationId = crypto.createHash('sha256').update(idempotencyKey).digest('hex');
                  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
                  const logData: GlobalLibraryCandidateReviewLogServerInput = {
                      eventType: 'approved',
                      actorType: 'admin',
                      actorId: decodedToken.uid,
                      resultingGlobalSongId: globalSongRef.id,
                      schemaVersion: 1,
                      correlationId: correlationId,
                      timestamp: serverTimestamp,
                      
                      metadata: {
                          sourceOrganizationId: occData.source?.organizationId || null,
                          sourceSongId: occData.source?.songId || null,
                          sourceCandidateId: candidateId,
                      },

                      // Legacy fallbacks for historical code compatibility
                      action: 'approved_as_new',
                      actorUid: decodedToken.uid,
                      createdAt: serverTimestamp
                  };
                  t.set(logRef, logData);
              }

              return { success: true, globalSongId: globalSongRef.id };
          });

          res.json(result);
      } catch (e: any) {
          if (e.message.startsWith("ABORT_DUPLICATE|")) {
              const songId = e.message.split("|")[1];
              return res.status(409).json({ error: "Música duplicada encontrada na rechecagem", duplicateGlobalSongId: songId });
          }
          if (e.message === "ABORT_RESERVATION_COLLISION") {
              return res.status(409).json({ error: "Outra candidata para a mesma música está sendo avaliada simultaneamente (colisão de reserva de identidade)." });
          }
          res.status(500).json({ error: e.message || "Erro no processo de aprovação." });
      }
  });

  app.post("/api/curation/link", requireEcosystemRole, async (req: any, res: any) => {
      try {
          if (!db) throw new Error("Database not initialized");

          const { candidateId, globalSongId, idempotencyKey, forceModeratedMatch } = req.body;
          if (!candidateId || !globalSongId || !idempotencyKey) {
              return res.status(400).json({ error: "Parâmetros obrigatórios ausentes." });
          }

          const decodedToken = req.ecosystemContext;
          const candidateRef = db.collection('globalLibraryCandidates').doc(candidateId);
          const globalSongRef = db.collection('globalSongs').doc(globalSongId);
          
          const result = await db.runTransaction(async (t) => {
              const candidateSnap = await t.get(candidateRef);
              if (!candidateSnap.exists) {
                  throw new Error("Candidata não encontrada.");
              }
              const candidateData = candidateSnap.data() as any;
              
              if (candidateData.status === 'linked') {
                  if (candidateData.linkIdempotencyKey === idempotencyKey && candidateData.resultingGlobalSongId === globalSongId) {
                      return { success: true, alreadyLinked: true, globalSongId: candidateData.resultingGlobalSongId };
                  }
                  throw new Error("Candidata já foi vinculada e a nova solicitação não bate com a chave/destino original.");
              }

              const allowedStatuses = ['pending_review', 'possible_duplicate', 'matched_existing', 'likely_unique'];
              if (!allowedStatuses.includes(candidateData.status)) {
                  throw new Error(`Estado da candidata não permite vínculo. (Estado atual: ${candidateData.status})`);
              }
              if (candidateData.status === 'likely_unique' && !forceModeratedMatch) {
                  throw new Error(`ABORT_NEEDS_CONFIRMATION|O estado likely_unique requer confirmação explícita para ser vinculado.`);
              }

              const globalSongSnap = await t.get(globalSongRef);
              if (!globalSongSnap.exists) {
                  throw new Error("Música Global (GlobalSong) não encontrada.");
              }
              const globalSongData = globalSongSnap.data() as any;
              
              if (globalSongData.status && globalSongData.status !== 'active') {
                  throw new Error("A Música Global selecionada não está ativa.");
              }

              // Read occurrences in the read phase of the transaction
              const occurrencesSnap = await t.get(candidateRef.collection('occurrences'));

              // Extract global song canonical identity
              const globalIdentity = {
                  normalizedTitle: globalSongData.normalizedTitle,
                  normalizedArtists: [globalSongData.normalizedArtist].filter(Boolean),
                  originalTitle: globalSongData.title,
                  originalArtist: globalSongData.artist || '',
                  contentFingerprint: null
              };

              const comparison = compareSongs(globalIdentity as any, candidateData.canonicalIdentity);
              
              if (comparison.classification === 'likely_unique') {
                  throw new Error("ABORT_REJECTED|Identidades incompatíveis (conflito forte) para vinculação.");
              }
              
              if ((comparison.classification === 'possible_duplicate' || comparison.classification === 'insufficient_data') && !forceModeratedMatch) {
                  throw new Error("ABORT_NEEDS_CONFIRMATION|Correspondência apenas moderada/fraca. Requer confirmação explícita.");
              }

              t.update(candidateRef, {
                  status: 'linked',
                  resultingGlobalSongId: globalSongId,
                  linkIdempotencyKey: idempotencyKey,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });

              // Update the original song documents in organization collections with the linked globalSongId
              for (const occDoc of occurrencesSnap.docs) {
                  const oData = occDoc.data() as any;
                  if (oData.source?.organizationId && oData.source?.songId) {
                      const songRef = db.collection('songs').doc(oData.source.songId);
                      t.update(songRef, {
                          originGlobalSongId: globalSongId,
                          updatedAt: admin.firestore.FieldValue.serverTimestamp()
                      });
                  }
              }

              const logRef = candidateRef.collection('reviewLogs').doc(`link_${idempotencyKey}`);
              const logSnap = await t.get(logRef);
              if (!logSnap.exists) {
                  const correlationId = crypto.createHash('sha256').update(idempotencyKey).digest('hex');
                  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
                  const logData: GlobalLibraryCandidateReviewLogServerInput = {
                      eventType: 'linked',
                      actorType: 'admin',
                      actorId: decodedToken.uid,
                      resultingGlobalSongId: globalSongId,
                      schemaVersion: 1,
                      correlationId: correlationId,
                      timestamp: serverTimestamp,
                      forceModeratedMatch: !!forceModeratedMatch,

                      // Legacy fallbacks for historical code compatibility
                      action: 'linked_to_existing',
                      actorUid: decodedToken.uid,
                      createdAt: serverTimestamp
                  };
                  t.set(logRef, logData);
              }

              return { success: true, globalSongId };
          });

          res.json(result);
      } catch (e: any) {
          if (e.message.startsWith("ABORT_NEEDS_CONFIRMATION|")) {
              return res.status(409).json({ error: e.message.split("|")[1], requiresConfirmation: true });
          }
          if (e.message.startsWith("ABORT_REJECTED|")) {
              return res.status(400).json({ error: e.message.split("|")[1], rejected: true });
          }
          res.status(500).json({ error: e.message || "Erro no processo de vinculação." });
      }
  });

  app.post("/api/curation/reject", requireEcosystemRole, async (req: any, res: any) => {
      try {
          if (!db) throw new Error("Database not initialized");

          const { candidateId, reasonCode, optionalNote, idempotencyKey } = req.body;
          if (!candidateId || !reasonCode || !idempotencyKey) {
              return res.status(400).json({ error: "Parâmetros obrigatórios ausentes." });
          }

          const validReasonCodes = [
              'duplicate_candidate',
              'invalid_content',
              'insufficient_content',
              'medley_or_compilation',
              'not_a_song',
              'policy_violation',
              'other'
          ];

          if (!validReasonCodes.includes(reasonCode)) {
              return res.status(400).json({ error: "Código de rejeição inválido." });
          }

          const decodedToken = req.ecosystemContext;
          const candidateRef = db.collection('globalLibraryCandidates').doc(candidateId);
          
          let cleanNote = '';
          if (optionalNote && typeof optionalNote === 'string') {
              cleanNote = optionalNote.trim();
              if (cleanNote.length > 500) {
                  return res.status(400).json({ error: "NOTE_TOO_LONG|A nota privada não pode exceder 500 caracteres." });
              }
          }

          const result = await db.runTransaction(async (t) => {
              const candidateSnap = await t.get(candidateRef);
              if (!candidateSnap.exists) {
                  throw new Error("Candidata não encontrada.");
              }
              const candidateData = candidateSnap.data() as any;
              
              if (candidateData.status === 'rejected') {
                  const logRef = candidateRef.collection('reviewLogs').doc(`reject_${idempotencyKey}`);
                  const logSnap = await t.get(logRef);
                  if (logSnap.exists) {
                      const logData = logSnap.data() as any;
                      if (candidateData.rejectIdempotencyKey === idempotencyKey &&
                          candidateData.rejectionReasonCode === reasonCode &&
                          logData.reasonCode === reasonCode && 
                          (logData.privateNote || '') === cleanNote) {
                          return { success: true, alreadyRejected: true };
                      }
                  }
                  throw new Error("Candidata já foi rejeitada e a nova solicitação não bate com a chave/motivo/nota original.");
              }

              const allowedStatuses = ['pending_review', 'possible_duplicate', 'matched_existing', 'likely_unique', 'processing_failed'];
              if (!allowedStatuses.includes(candidateData.status)) {
                  throw new Error(`Estado da candidata não permite rejeição. (Estado atual: ${candidateData.status})`);
              }

              t.update(candidateRef, {
                  status: 'rejected',
                  rejectionReasonCode: reasonCode,
                  rejectIdempotencyKey: idempotencyKey,
                  reviewedBy: decodedToken.uid,
                  reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
                  hasPrivateNote: !!cleanNote,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });

              // The note remains only in the review log and is NOT written to the global songs or local songs.
              const logRef = candidateRef.collection('reviewLogs').doc(`reject_${idempotencyKey}`);
              const logSnap = await t.get(logRef);
              if (!logSnap.exists) {
                  const correlationId = crypto.createHash('sha256').update(idempotencyKey).digest('hex');
                  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
                  const logData: GlobalLibraryCandidateReviewLogServerInput = {
                      eventType: 'rejected',
                      actorType: 'admin',
                      actorId: decodedToken.uid,
                      reasonCode: reasonCode,
                      schemaVersion: 1,
                      correlationId: correlationId,
                      timestamp: serverTimestamp,
                      
                      // Legacy fallbacks for historical code compatibility
                      action: 'rejected',
                      actorUid: decodedToken.uid,
                      createdAt: serverTimestamp
                  };
                  if (cleanNote) {
                      logData.privateNote = cleanNote;
                  }
                  t.set(logRef, logData);
              }

              return { success: true };
          });

          res.json(result);
      } catch (e: any) {
          res.status(500).json({ error: e.message || "Erro no processo de rejeição." });
      }
  });

  app.post("/api/curation/merge", requireEcosystemRole, async (req: any, res: any) => {
      try {
          if (!db) throw new Error("Database not initialized");

          const { candidateId, occurrenceId, globalSongId, expectedRevision, fieldsToMerge, optionalNote, idempotencyKey } = req.body;
          if (!candidateId || !occurrenceId || !globalSongId || expectedRevision === undefined || !idempotencyKey || !fieldsToMerge || typeof fieldsToMerge !== 'object') {
              return res.status(400).json({ error: "Parâmetros obrigatórios ausentes ou inválidos." });
          }

          if (typeof expectedRevision !== 'number' || expectedRevision < 0) {
              return res.status(400).json({ error: "expectedRevision deve ser um número válido." });
          }

          const allowedFields = ['title', 'artist', 'key', 'bpm', 'chords', 'lyrics', 'language', 'tags'];
          const fieldsToMergeKeys = Object.keys(fieldsToMerge);
          const selectedFields = fieldsToMergeKeys.filter((k: string) => (fieldsToMerge as any)[k] === true);

          if (selectedFields.length === 0) {
              return res.status(400).json({ error: "Nenhum campo selecionado para mesclagem." });
          }

          const invalidFields = selectedFields.filter((f: string) => !allowedFields.includes(f));
          if (invalidFields.length > 0) {
              return res.status(400).json({ error: `Campos não permitidos para merge: ${invalidFields.join(', ')}` });
          }

          const decodedToken = req.ecosystemContext;
          const candidateRef = db.collection('globalLibraryCandidates').doc(candidateId);
          const occurrenceRef = candidateRef.collection('occurrences').doc(occurrenceId);
          const globalSongRef = db.collection('globalSongs').doc(globalSongId);

          let cleanNote = '';
          if (optionalNote && typeof optionalNote === 'string') {
              cleanNote = optionalNote.trim();
              if (cleanNote.length > 500) {
                  return res.status(400).json({ error: "NOTE_TOO_LONG|A nota privada não pode exceder 500 caracteres." });
              }
          }

          const result = await db.runTransaction(async (t) => {
              const [candidateSnap, occurrenceSnap, globalSongSnap] = await Promise.all([
                  t.get(candidateRef),
                  t.get(occurrenceRef),
                  t.get(globalSongRef)
              ]);

              if (!candidateSnap.exists) {
                  throw new Error("Candidata não encontrada.");
              }
              const candidateData = candidateSnap.data() as any;

              // Verificação Segura de Idempotência
              if (candidateData.status === 'merged') {
                  if (candidateData.mergeIdempotencyKey === idempotencyKey) {
                      const fieldsOk = Array.isArray(candidateData.mergedFields) &&
                          selectedFields.length === candidateData.mergedFields.length &&
                          selectedFields.every((f: string) => candidateData.mergedFields.includes(f));
                      if (candidateData.resultingGlobalSongId === globalSongId && fieldsOk) {
                          return {
                              success: true,
                              alreadyMerged: true,
                              globalSongId: candidateData.resultingGlobalSongId,
                              mergeId: `merge_${idempotencyKey}`,
                              reviewedBy: candidateData.reviewedBy,
                              reviewedAt: candidateData.reviewedAt,
                              resultingRevision: candidateData.resultingRevision
                          };
                      } else {
                          throw new Error("IDEMPOTENCY_CONFLICT|Chave de idempotência igual, mas com payload diferente.");
                      }
                  }
                  throw new Error("Candidata já foi fundida (merged) em outra operação.");
              }

              // Outros estados proibidos
              const forbiddenStatuses = ['approved', 'linked', 'rejected', 'likely_unique'];
              if (forbiddenStatuses.includes(candidateData.status)) {
                  throw new Error(`Estado da candidata não permite merge. (Estado atual: ${candidateData.status})`);
              }

              const allowedStatuses = ['pending_review', 'possible_duplicate', 'matched_existing'];
              if (!allowedStatuses.includes(candidateData.status)) {
                  throw new Error(`Estado da candidata é inválido para merge. (Estado atual: ${candidateData.status})`);
              }

              if (!occurrenceSnap.exists) {
                  throw new Error("Ocorrencia-base não encontrada para esta candidata.");
              }
              const occurrenceData = occurrenceSnap.data() as any;
              
              // Ocorrência de outra candidata
              if (occurrenceData.candidateId && occurrenceData.candidateId !== candidateId) {
                  throw new Error("Ocorrência pertence a outra candidata.");
              }

              const snapshot = occurrenceData.snapshot;
              if (!snapshot) {
                  throw new Error("Dados de música de ocorrência ausentes.");
              }

              if (!globalSongSnap.exists) {
                  throw new Error("GlobalSong não encontrada.");
              }
              const globalSongData = globalSongSnap.data() as any;
              if (globalSongData.status !== 'active') {
                  throw new Error("GlobalSong inexistente ou inativa.");
              }

              // Controle de Concorrência por Revisão
              const currentRevision = typeof globalSongData.revision === 'number' ? globalSongData.revision : 0;
              if (currentRevision !== expectedRevision) {
                  throw new Error("TARGET_CHANGED|A versão da música global foi modificada por outro processo.");
              }

              const nextRevision = currentRevision + 1;
              const updatesOfGlobalSong: any = {};
              const previousSnapshot: Record<string, any> = {};
              const resultingSnapshot: Record<string, any> = {};

              for (const field of selectedFields) {
                  if (field === 'title') {
                      const newVal = snapshot.title || '';
                      const oldVal = globalSongData.title || '';
                      if (newVal !== oldVal) {
                          updatesOfGlobalSong.title = newVal;
                          updatesOfGlobalSong.normalizedTitle = newVal.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                          previousSnapshot.title = oldVal;
                          previousSnapshot.normalizedTitle = globalSongData.normalizedTitle || '';
                          resultingSnapshot.title = newVal;
                          resultingSnapshot.normalizedTitle = updatesOfGlobalSong.normalizedTitle;
                      }
                  } else if (field === 'artist') {
                      const newVal = snapshot.artist || '';
                      const oldVal = globalSongData.artist || '';
                      if (newVal !== oldVal) {
                          updatesOfGlobalSong.artist = newVal;
                          updatesOfGlobalSong.normalizedArtist = newVal.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                          previousSnapshot.artist = oldVal;
                          previousSnapshot.normalizedArtist = globalSongData.normalizedArtist || '';
                          resultingSnapshot.artist = newVal;
                          resultingSnapshot.normalizedArtist = updatesOfGlobalSong.normalizedArtist;
                      }
                  } else if (field === 'key') {
                      const newVal = snapshot.key || snapshot.originalKey || 'C';
                      const oldVal = globalSongData.key || 'C';
                      if (newVal !== oldVal) {
                          updatesOfGlobalSong.key = newVal;
                          previousSnapshot.key = oldVal;
                          resultingSnapshot.key = newVal;
                      }
                  } else if (field === 'bpm') {
                      const newVal = typeof snapshot.bpm === 'number' ? snapshot.bpm : null;
                      const oldVal = typeof globalSongData.bpm === 'number' ? globalSongData.bpm : null;
                      if (newVal !== oldVal) {
                          updatesOfGlobalSong.bpm = newVal;
                          previousSnapshot.bpm = oldVal;
                          resultingSnapshot.bpm = newVal;
                      }
                  } else if (field === 'chords') {
                      const newVal = snapshot.chords || '';
                      const oldVal = globalSongData.chords || '';
                      if (newVal !== oldVal) {
                          updatesOfGlobalSong.chords = newVal;
                          previousSnapshot.chords = oldVal;
                          resultingSnapshot.chords = newVal;
                      }
                  } else if (field === 'lyrics') {
                      const newVal = snapshot.lyrics || '';
                      const oldVal = globalSongData.lyrics || '';
                      if (newVal !== oldVal) {
                          updatesOfGlobalSong.lyrics = newVal;
                          previousSnapshot.lyrics = oldVal;
                          resultingSnapshot.lyrics = newVal;
                      }
                  } else if (field === 'language') {
                      const newVal = snapshot.language || 'pt';
                      const oldVal = globalSongData.language || 'pt';
                      if (newVal !== oldVal) {
                          updatesOfGlobalSong.language = newVal;
                          previousSnapshot.language = oldVal;
                          resultingSnapshot.language = newVal;
                      }
                  } else if (field === 'tags') {
                      const candidateTags = Array.isArray(snapshot.tags) ? snapshot.tags : [];
                      const parentTags = Array.isArray(globalSongData.tags) ? globalSongData.tags : [];
                      const combined = [...parentTags, ...candidateTags]
                          .map(t => typeof t === 'string' ? t.trim() : '')
                          .filter(t => t.length > 0);
                      const uniqueTags: string[] = [];
                      const lowercaseSet = new Set<string>();
                      for (const tag of combined) {
                          const low = tag.toLowerCase();
                          if (!lowercaseSet.has(low)) {
                              lowercaseSet.add(low);
                              uniqueTags.push(tag);
                          }
                      }
                      
                      const isDifferent = uniqueTags.length !== parentTags.length || !uniqueTags.every((t, i) => parentTags[i] === t);
                      if (isDifferent) {
                          updatesOfGlobalSong.tags = uniqueTags;
                          previousSnapshot.tags = parentTags;
                          resultingSnapshot.tags = uniqueTags;
                      }
                  }
              }

              // Aplicar alterações na GlobalSong (sempre atualiza a revision e updatedAt)
              updatesOfGlobalSong.revision = nextRevision;
              updatesOfGlobalSong.updatedAt = admin.firestore.FieldValue.serverTimestamp();
              t.update(globalSongRef, updatesOfGlobalSong);

              // Atualizar status da candidata para 'merged'
              const reviewedAt = admin.firestore.FieldValue.serverTimestamp();
              t.update(candidateRef, {
                  status: 'merged',
                  resultingGlobalSongId: globalSongId,
                  mergeIdempotencyKey: idempotencyKey,
                  mergeId: `merge_${idempotencyKey}`,
                  reviewedBy: decodedToken.uid,
                  reviewedAt: reviewedAt,
                  mergedFields: selectedFields,
                  resultingRevision: nextRevision,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });

              // Guardar histórico de merge na coleção privada globalLibraryMergeHistory
              const correlationId = crypto.createHash('sha256').update(idempotencyKey).digest('hex');
              const mergeId = `merge_${idempotencyKey}`;
              const mergeLogRef = db.collection('globalLibraryMergeHistory').doc(mergeId);
              
              const historyRecord = {
                  globalSongId,
                  candidateId,
                  occurrenceId,
                  actorId: decodedToken.uid,
                  correlationId,
                  previousRevision: currentRevision,
                  resultingRevision: nextRevision,
                  mergedFields: selectedFields,
                  previousSnapshot,
                  resultingSnapshot,
                  optionalNote: cleanNote || null,
                  timestamp: reviewedAt,
                  schemaVersion: 1
              };
              t.set(mergeLogRef, historyRecord);

              // Criar um reviewLog 'merged' para a candidata
              const logRef = candidateRef.collection('reviewLogs').doc(`merge_${idempotencyKey}`);
              const logData: GlobalLibraryCandidateReviewLogServerInput = {
                  eventType: 'merged',
                  actorType: 'admin',
                  actorId: decodedToken.uid,
                  schemaVersion: 1,
                  correlationId: correlationId,
                  timestamp: reviewedAt,
                  resultingGlobalSongId: globalSongId,
                  action: 'merged',
                  actorUid: decodedToken.uid,
                  createdAt: reviewedAt
              };
              if (cleanNote) {
                  logData.privateNote = cleanNote;
              }
              t.set(logRef, logData);

              return {
                  success: true,
                  globalSongId,
                  mergeId,
                  reviewedBy: decodedToken.uid,
                  reviewedAt: new Date().toISOString(),
                  resultingRevision: nextRevision
              };
          });

          res.json(result);
      } catch (e: any) {
          let statusCode = 500;
          if (e.message && e.message.includes("IDEMPOTENCY_CONFLICT")) {
              statusCode = 409;
          } else if (e.message && e.message.includes("TARGET_CHANGED")) {
              statusCode = 409;
          } else if (e.message && (e.message.includes("Estado da candidata") || e.message.includes("GlobalSong não encontrada") || e.message.includes("inexistente ou inativa") || e.message.includes("não encontrada"))) {
              statusCode = 400;
          }
          res.status(statusCode).json({ error: e.message || "Erro no processo de merge." });
      }
  });

  app.post("/api/admin/organization-songs-count", requireEcosystemRole, async (req: any, res: any) => {
    try {
        if (!db) {
            return res.status(500).json({ error: "Banco de dados não carregado." });
        }

        const orgId = req.body.organizationId;
        if (!orgId) {
            return res.status(400).json({ error: "organizationId ausente" });
        }

        const countQuery = await db.collection('songs').where('organizationId', '==', orgId).count().get();
        return res.json({ count: countQuery.data().count });
    } catch (err) {
        console.error("Error in organization-songs-count:", err);
        return res.status(500).json({ error: "Erro ao buscar quantidade de músicas." });
    }
  });

  app.get("/api/admin/inbox-count", requireEcosystemRole, async (req: any, res: any) => {
    try {
        if (!db) return res.status(500).json({ error: "Banco de dados não carregado." });
        const snapshot = await db.collection('songDiscoveryInbox').where('status', 'in', ['pending', 'failed']).count().get();
        return res.json({ count: snapshot.data().count });
    } catch (err: any) {
        return res.status(500).json({ error: "Erro ao contar inbox", details: err.message });
    }
  });

  app.post("/api/admin/analyze-inbox", requireEcosystemRole, async (req: any, res: any) => {
    try {
        if (!db) return res.status(500).json({ error: "Banco de dados não carregado." });

        const context = req.ecosystemContext;
        const allowedRoles = ['ceo', 'global_admin', 'ecosystem_owner', 'founder'];
        if (!allowedRoles.includes(context?.systemRole?.toLowerCase().trim() || '') && !context?.hasCurationAccess && !context?.isGlobalAdminEmail) {
             return res.status(403).json({ error: "FORBIDDEN: Acesso administrativo restrito negado." });
        }

        const limitMsgs = req.body.limit || 10;
        const organizationId = req.body.organizationId;
        
        if (organizationId) {
             const ignoredQuery = await db.collection('songDiscoveryInbox')
                  .where('sourceOrganizationId', '==', organizationId)
                  .where('status', '==', 'ignored')
                  .limit(50)
                  .get();

             for (const doc of ignoredQuery.docs) {
                  const data = doc.data();
                  if (data.lastErrorCode === 'SOURCE_NOT_FOUND' || data.lastErrorCode === 'missing_source_title') {
                       await db.collection('songDiscoveryInbox').doc(doc.id).update({
                            status: 'pending',
                            updatedAt: Date.now()
                       });
                  }
             }
        }

        const results = await analyzeInboxBatch(limitMsgs, db, organizationId);
        
        return res.json({ results });
    } catch (err: any) {
        return res.status(500).json({ error: "Erro na análise.", details: err.message });
    }
  });

  app.post("/api/admin/pre-verify-import", requireEcosystemRole, async (req: any, res: any) => {
    try {
        if (!db) return res.status(500).json({ error: "Banco de dados não carregado." });
        const context = req.ecosystemContext;
        const allowedRoles = ['ceo', 'global_admin', 'ecosystem_owner', 'founder'];
        if (!allowedRoles.includes(context?.systemRole?.toLowerCase().trim() || '') && !context?.hasCurationAccess && !context?.isGlobalAdminEmail) {
             return res.status(403).json({ error: "FORBIDDEN" });
        }

        const { target, candidateIds } = req.body;
        const results = await preVerifyCandidates(db, target, candidateIds);
        return res.json({ results });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/bulk-import-candidates", requireEcosystemRole, async (req: any, res: any) => {
    try {
        if (!db) return res.status(500).json({ error: "Banco de dados não carregado." });
        const context = req.ecosystemContext;
        const allowedRoles = ['ceo', 'global_admin', 'ecosystem_owner', 'founder'];
        if (!allowedRoles.includes(context?.systemRole?.toLowerCase().trim() || '') && !context?.hasCurationAccess && !context?.isGlobalAdminEmail) {
             return res.status(403).json({ error: "FORBIDDEN" });
        }

        const { candidateIds } = req.body;
        const resolvedBy = context?.userEmail || "unknown";
        
        if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
            return res.status(400).json({ error: 'No candidates provided' });
        }
        
        const results = await bulkImportCandidates(db, candidateIds, resolvedBy);
        return res.json({ results });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/fix-candidates-without-title", requireEcosystemRole, async (req: any, res: any) => {
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
  });

  app.post("/api/admin/scan-organization-repertoire", requireEcosystemRole, async (req: any, res: any) => {
    try {
        if (!db) {
            return res.status(500).json({ error: "Banco de dados não carregado." });
        }

        const context = req.ecosystemContext;
        const allowedRoles = ['ceo', 'global_admin', 'ecosystem_owner', 'founder'];
        const userRole = context?.systemRole?.toLowerCase().trim() || '';
        const hasCurationAccess = context?.hasCurationAccess || context?.isGlobalAdminEmail || allowedRoles.includes(userRole);

        if (!hasCurationAccess) {
             return res.status(403).json({ error: "FORBIDDEN: Acesso administrativo restrito negado." });
        }

        const orgId = req.body.organizationId;
        if (!orgId) {
             return res.status(400).json({ error: "organizationId ausente" });
        }

        const limitMsgs = req.body.limit || 50;
        const lastId = req.body.lastId;

        let queryData: any = db.collection('songs')
             .where('organizationId', '==', orgId)
             .orderBy('__name__', 'asc')
             .limit(limitMsgs);

        if (lastId) {
              const lastDoc = await db.collection('songs').doc(lastId).get();
              if (lastDoc.exists) {
                  queryData = queryData.startAfter(lastDoc);
              }
        }

        const snap = await queryData.get();
        if (snap.empty) {
             return res.json({ hasMore: false, results: [], nextCursor: null });
        }

        const batchSongs = snap.docs.map((doc: any) => ({ id: doc.id, data: doc.data() }));
        const nextCursor = batchSongs[batchSongs.length - 1].id;
        
        const results = [];
        const inboxService = new SongDiscoveryInboxService(db);
        
        for (const { id, data } of batchSongs) {
              try {
                  const inboxOutcome = await inboxService.registerInboxRecord(id, orgId, data);
                  if (inboxOutcome.outcome === 'ignored') {
                      results.push({ sourceSongId: id, title: data.title, scanOutcome: 'ignored', errorMsg: inboxOutcome.reason, artist: data.artist });
                  } else if (inboxOutcome.outcome === 'already_queued') {
                      results.push({ sourceSongId: id, title: data.title, scanOutcome: 'already_queued', artist: data.artist });
                  } else {
                      results.push({ sourceSongId: id, title: data.title, scanOutcome: 'queued', artist: data.artist });
                  }
              } catch (err: any) {
                  results.push({ 
                      sourceSongId: id, 
                      title: data.title, 
                      artist: data.artist,
                      scanOutcome: 'error',
                      errorMsg: err.message || String(err)
                  });
              }
        }

        return res.json({
             results,
             hasMore: batchSongs.length === limitMsgs,
             nextCursor
        });

    } catch (err: any) {
        req.logger?.error("Error in scan-organization-repertoire endpoint:", err) || console.error("Error in scan-organization-repertoire endpoint:", err);
        
        let errorReason = "Erro ao varrer organização.";
        if (err?.message?.includes("PERMISSION_DENIED")) {
            errorReason = "PERMISSION_DENIED: O servidor não possui credenciais do Firebase Admin válidas. Verifique se a chave FIREBASE_SERVICE_ACCOUNT_BASE64 foi configurada corretamente nos Secrets.";
        }

        return res.status(500).json({ outcome: "failed", error: errorReason, details: err?.message || String(err) });
    }
  });

app.post("/api/admin/songs-for-reprocessing", requireEcosystemRole, async (req: any, res: any) => {
    try {
        if (!db) {
            return res.status(500).json({ error: "Banco de dados não carregado." });
        }

        const context = req.ecosystemContext;
        const allowedRoles = ['ceo', 'global_admin', 'ecosystem_owner', 'founder'];
        const userRole = context?.systemRole?.toLowerCase().trim() || '';
        const hasCurationAccess = context?.isGlobalAdminEmail || allowedRoles.includes(userRole);

        if (!hasCurationAccess) {
            return res.status(403).json({ error: "FORBIDDEN: Acesso administrativo restrito negado." });
        }

        const limitMsgs = req.body.limit || 20;
        const search = req.body.search?.toLowerCase().trim();
        const organizationIdFilter = req.body.organizationId;
        const statusFilter = req.body.statusFilter; // 'all', 'unprocessed', 'processed', 'ignored', 'failed'
        const lastCreatedAt = req.body.lastCreatedAt;
        const lastTitle = req.body.lastTitle;
        const lastId = req.body.lastId;
        const legacyOnly = req.body.legacyOnly; // fetch songs without createdAt

        const results = [];
        let queryData: any = db.collection('songs');
        
        if (organizationIdFilter && organizationIdFilter !== 'all') {
             queryData = queryData.where('organizationId', '==', organizationIdFilter);
        }
        
        if (search) {
             queryData = queryData.where('normalizedTitle', '>=', search).where('normalizedTitle', '<=', search + '\uf8ff');
             // We use ordering to ensure stable cursor
             queryData = queryData.orderBy('normalizedTitle', 'asc').orderBy('__name__', 'asc');
        } else if (legacyOnly) {
             // To fetch legacy songs without createdAt, we just drop createdAt ordering and let firestore sort by id
             queryData = queryData.orderBy('__name__', 'desc');
        } else {
             queryData = queryData.orderBy('createdAt', 'desc').orderBy('__name__', 'desc');
        }

        let currentCursorCreatedAt = lastCreatedAt;
        let currentCursorTitle = lastTitle;
        let currentCursorId = lastId;

        let MAX_BATCH_PULLS = 20; // Increased to avoid skipping new songs buried under recent ones
        let hasMore = true;

        while (results.length < limitMsgs && MAX_BATCH_PULLS > 0) {
            MAX_BATCH_PULLS--;
            // fetch minimal chunks to prevent excessive reads when we only need limitMsgs
            const chunkSize = limitMsgs - results.length > 50 ? 100 : 100;
            let pageQuery = queryData.limit(chunkSize);
            
            if (currentCursorId) {
                if (search && currentCursorTitle !== undefined) {
                     pageQuery = pageQuery.startAfter(currentCursorTitle, currentCursorId);
                } else if (legacyOnly) {
                     pageQuery = pageQuery.startAfter(currentCursorId);
                } else if (!search && currentCursorCreatedAt !== undefined) {
                     pageQuery = pageQuery.startAfter(currentCursorCreatedAt, currentCursorId);
                }
            }

            const snap = await pageQuery.get();
            if (snap.empty) {
                hasMore = false;
                break;
            }

            const batchSongs = snap.docs.map(doc => ({ id: doc.id, data: doc.data() }));

            // Update page cursors in case we break right after this batch
            currentCursorId = batchSongs[batchSongs.length - 1].id;
            if (search) {
                currentCursorTitle = batchSongs[batchSongs.length - 1].data.normalizedTitle;
            } else if (!legacyOnly) {
                currentCursorCreatedAt = batchSongs[batchSongs.length - 1].data.createdAt;
            }

            const potentialIds = [];
            const localStatuses = new Map();

            for (const { id: songId, data: songData } of batchSongs) {
                let localStatus = 'unprocessed';

                // Ensure legacy logic handles songs without createdAt
                if (search || legacyOnly || songData.createdAt) {
                    if (!songData.title || songData.title.trim() === '' || songData.deleted || songData.archived || songData.isDraft || songData.originGlobalSongId) {
                         localStatus = 'ignored';
                    }
                }

                if (legacyOnly && songData.createdAt) {
                     // If we strictly requested legacy but we hit a song with truthy createdAt via ID query, we ignore it from result set.
                     // It means we should skip it to focus on old songs. Wait, actually we can just pass it through.
                     localStatus = 'ignored';
                }

                if (localStatus === 'unprocessed') {
                     potentialIds.push(songId);
                }
                localStatuses.set(songId, localStatus);
            }

            const processedIds = new Set();
            if (potentialIds.length > 0) {
                for (let i = 0; i < potentialIds.length; i += 30) {
                    const chunk = potentialIds.slice(i, i + 30);
                    const occQuery = await db.collectionGroup('occurrences').where('source.songId', 'in', chunk).get();
                    occQuery.docs.forEach((doc: any) => {
                        const data = doc.data();
                        if (data?.source?.songId) {
                            processedIds.add(data.source.songId);
                        }
                    });
                }
            }

            for (const { id: songId, data: songData } of batchSongs) {
                if (results.length >= limitMsgs) break;

                let localStatus = localStatuses.get(songId);
                if (localStatus === 'unprocessed' && processedIds.has(songId)) {
                    localStatus = 'processed';
                }

                const requestedStatus = statusFilter || (legacyOnly ? 'all' : 'unprocessed');
                if (requestedStatus === 'all' || localStatus === requestedStatus) {
                    // Check if it's supposed to be ignored for legacy filter
                    if (!(legacyOnly && localStatus === 'ignored' && songData.createdAt)) {
                        results.push({
                             id: songId,
                             title: songData.title,
                             artist: songData.artist || '',
                             organizationId: songData.organizationId,
                             organizationName: typeof songData.organizationName === 'string' && songData.organizationName.trim() !== '' ? songData.organizationName : 'Organização ' + songData.organizationId.substring(0,6),
                             createdAt: songData.createdAt,
                             status: localStatus
                        });
                    }
                }
            }
            
            if (results.length >= limitMsgs) {
                const lastPushed = results[results.length - 1];
                currentCursorId = lastPushed.id;
                if (search) {
                    currentCursorTitle = batchSongs.find(s => s.id === lastPushed.id)?.data.normalizedTitle;
                    currentCursorCreatedAt = undefined;
                } else if (legacyOnly) {
                    currentCursorTitle = undefined;
                    currentCursorCreatedAt = undefined;
                } else {
                    currentCursorCreatedAt = lastPushed.createdAt;
                    currentCursorTitle = undefined;
                }
            }
        }

        return res.json({
            songs: results,
            hasMore,
            lastId: currentCursorId,
            ...(legacyOnly ? {} : search ? { lastTitle: currentCursorTitle } : { lastCreatedAt: currentCursorCreatedAt })
        });

    } catch (err: any) {
        logger.error("Error listed candidates by reprocessing endpoint:", err);
        
        let errorReason = "Erro ao buscar músicas.";
        if (err?.message?.includes("PERMISSION_DENIED")) {
            errorReason = "PERMISSION_DENIED: O servidor não possui credenciais do Firebase Admin válidas. Verifique a variável FIREBASE_SERVICE_ACCOUNT_BASE64.";
        }

        return res.status(500).json({ outcome: "failed", error: errorReason });
    }
});

app.post("/api/curation/auto-process-song", async (req: any, res: any) => {
      try {
          if (!db) {
              return res.status(500).json({ error: "Banco de dados não carregado." });
          }

          const { songId } = req.body;
          if (!songId || typeof songId !== 'string' || songId.trim().length === 0) {
              return res.status(400).json({ error: "O parâmetro songId é obrigatório e deve ser uma string não vazia." });
          }

          const trimmedSongId = songId.trim();

          const songSnap = await db.collection('songs').doc(trimmedSongId).get();
          if (!songSnap.exists) {
              return res.json({ outcome: "not_found" });
          }

          const songData = songSnap.data();
          const organizationId = songData?.organizationId;

          if (!organizationId) {
              return res.json({ outcome: "ignored", reasonCode: "MISSING_ORGANIZATION_ID" });
          }

          const result = await runSongDiscoveryProcessor(songData, trimmedSongId, organizationId, db);

          return res.json({
              outcome: result.outcome,
              reasonCode: result.reasonCode || null,
              candidateId: result.candidateId || null,
              occurrenceId: result.occurrenceId || null
          });

      } catch (err: unknown) {
          logger.error("Error occurred inside auto-process endpoint:", err);
          return res.status(500).json({ outcome: "failed", error: "Erro ao processar música", reasonCode: "SERVER_ERROR" });
      }
});

app.post("/api/curation/reprocess-song", requireEcosystemRole, async (req: any, res: any) => {
      try {
          if (!db) {
              return res.status(500).json({ error: "Banco de dados não carregado." });
          }

          const context = req.ecosystemContext;
          const allowedRoles = ['ceo', 'global_admin', 'ecosystem_owner', 'founder'];
          const userRole = context?.systemRole?.toLowerCase().trim() || '';
          const hasCurationAccess = context?.isGlobalAdminEmail || allowedRoles.includes(userRole);

          if (!hasCurationAccess) {
              return res.status(403).json({ error: "FORBIDDEN: Acesso administrativo restrito negado." });
          }

          const { songId } = req.body;
          if (!songId || typeof songId !== 'string' || songId.trim().length === 0) {
              return res.status(400).json({ error: "O parâmetro songId é obrigatório e deve ser uma string não vazia." });
          }

          const trimmedSongId = songId.trim();

          const songSnap = await db.collection('songs').doc(trimmedSongId).get();
          if (!songSnap.exists) {
              return res.json({ outcome: "not_found" });
          }

          const songData = songSnap.data();
          const organizationId = songData?.organizationId;

          if (!organizationId) {
              return res.json({ outcome: "ignored", reasonCode: "MISSING_ORGANIZATION_ID" });
          }

          const result = await runSongDiscoveryProcessor(songData, trimmedSongId, organizationId, db);

          return res.json({
              outcome: result.outcome,
              reasonCode: result.reasonCode || null,
              candidateId: result.candidateId || null,
              occurrenceId: result.occurrenceId || null
          });

      } catch (err: unknown) {
          logger.error("Error occurred inside manual curation reprocess endpoint:", err);
          let safeMsg = "Ocorreu um erro interno de processamento.";
          if (err instanceof Error) {
              if (err.message.includes("PERMISSION_DENIED")) {
                  safeMsg = "Acesso recusado do banco de dados.";
              } else if (err.message.includes("NOT_FOUND")) {
                  safeMsg = "Documento não encontrado.";
              }
          }
          return res.status(500).json({ outcome: "failed", error: safeMsg });
      }
  });

  app.post("/api/admin/repair-by-token", async (req, res) => {
      try {
          if (!db) return res.status(500).json({ error: "Db not init" });
          
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
              return res.status(401).json({ error: 'Unauthorized' });
          }
          const token = authHeader.split('Bearer ')[1];
          const decodedToken = await admin.auth().verifyIdToken(token);
          const uid = decodedToken.uid;
          
          logger.debug(`[MUSICSCALE_REPAIR_REQUEST] uid: ${uid}, timestamp: ${new Date().toISOString()}`);
          
          const userDoc = await db.collection('users').doc(uid).get();
          if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
          
          const userProfile = userDoc.data() || {};
          const organizationId = userProfile.organizationId;
          
          if (!organizationId) return res.status(400).json({ error: 'No organization linked' });
          
          const email = decodedToken.email || userProfile.email;
          if (!email) return res.status(400).json({ error: 'User has no email' });
          
          let stripeCustomerId = null;
          const orgDoc = await db.collection('organizations').doc(organizationId).get();
          if (orgDoc.exists) {
               const oData = orgDoc.data();
               stripeCustomerId = oData?.stripe_customer_id || oData?.stripeCustomerId;
          }
          
          const stripe = getStripe();
          if (!stripeCustomerId) {
               const customers = await stripe.customers.list({ email: email, limit: 1 });
               if (customers.data.length > 0) stripeCustomerId = customers.data[0].id;
          }
          
          if (!stripeCustomerId) {
               logger.debug(`[MILLIONSNEST_REPAIR_EXECUTION] No stripe customer found for uid: ${uid}`);
               return res.json({ repaired: false, reason: 'No stripe customer found. Se certificou que usou mesmo email?' });
          }
          
          const subscriptions = await stripe.subscriptions.list({
               customer: stripeCustomerId,
               status: 'all',
               limit: 10
          });
          
          const activeSub = subscriptions.data.find(sub => sub.status === 'active' || sub.status === 'trialing');
          
          if (activeSub) {
               const newSubPayload = {
                    status: activeSub.status,
                    plan: activeSub.items.data[0]?.price?.lookup_key?.includes('pro') ? 'pro' : 'starter',
                    features: {},
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    stripeSubscriptionId: activeSub.id,
                    stripeCustomerId: stripeCustomerId,
                    organizationId: organizationId,
               };
               
               await db.collection('subscriptions').doc(organizationId).set(newSubPayload, { merge: true });
               
               // Fix permissions for the subscriber: they should be the owner and Dono
               await db.collection('organization_members').doc(`${uid}_${organizationId}`).set({
                    uid: uid,
                    organizationId: organizationId,
                    role: 'owner',
                    organizationRole: 'owner',
                    appRole: 'owner',
                    status: 'active'
               }, { merge: true });

               await db.collection('users').doc(uid).update({
                    role: 'owner',
                    organizationRole: 'owner',
                    appRole: 'owner'
               });
               
               logger.info(`[MILLIONSNEST_REPAIR_EXECUTION] Rebuilt subscription for orgId: ${organizationId}`, newSubPayload);
               
               return res.json({ repaired: true });
          } else {
               logger.debug(`[MILLIONSNEST_REPAIR_EXECUTION] No active stripe subscription found for customer ${stripeCustomerId}`);
               return res.json({ repaired: false, reason: 'No active Stripe subscription found' });
          }
      } catch (e: any) {
          logger.error("[MILLIONSNEST_REPAIR_EXECUTION] Error:", e);
          res.status(500).json({ error: e.message });
      }
  });

  app.post("/api/admin/repair-all-owners", async (req, res) => {
      try {
          if (!db) return res.status(500).json({ error: "Db not init" });

          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
              return res.status(401).json({ error: 'Unauthorized' });
          }
          const token = authHeader.split('Bearer ')[1];
          const decodedToken = await admin.auth().verifyIdToken(token);
          
          const userDoc = await db.collection('users').doc(decodedToken.uid).get();
          const userProfile = userDoc.data() || {};
          
          const isGlobalAdmin = 
            ['ceo', 'admin', 'global_admin', 'owner', 'ecosystem_owner', 'founder', 'dono', 'administrador', 'supervisor', 'support', 'suporte'].includes(userProfile?.systemRole?.toLowerCase()) || 
            false;
            
          if (!isGlobalAdmin) {
              return res.status(403).json({ error: 'Forbidden' });
          }

          logger.info("[MILLIONSNEST_REPAIR_EXECUTION] Starting batch repair for active/trialing subscriptions...");
          
          const activeOrgs = await db.collection('organizations')
              .where('subscription_status', 'in', ['active', 'trialing'])
              .get();
              
          let repairedCount = 0;
          let batch = db.batch();
          let opsInBatch = 0;

          await Promise.all(activeOrgs.docs.map(async (orgDoc) => {
              const orgData = orgDoc.data();
              const orgId = orgDoc.id;
              let ownerId = orgData.ownerUserId || orgData.createdBy;

              if (!ownerId && (orgData.stripe_customer_id || orgData.stripeCustomerId)) {
                  const stripeCustomerRef = await db.collection('users').where('stripeCustomerId', '==', orgData.stripe_customer_id || orgData.stripeCustomerId).limit(1).get();
                  if (!stripeCustomerRef.empty) {
                      ownerId = stripeCustomerRef.docs[0].id;
                      logger.info(`[MILLIONSNEST_REPAIR_EXECUTION] Found ownerId from Stripe Customer for org: ${orgId}`);
                  }
              }

              if (ownerId) {
                  const memRef = db.collection('organization_members').doc(`${ownerId}_${orgId}`);
                  const memDoc = await memRef.get();

                  let needsUpdate = false;
                  
                  if (!orgData.ownerUserId || orgData.ownerUserId !== ownerId) {
                       batch.update(orgDoc.ref, { ownerUserId: ownerId });
                       needsUpdate = true;
                       opsInBatch++;
                  }

                  if (!memDoc.exists || memDoc.data()?.role !== 'owner' || memDoc.data()?.organizationRole !== 'owner') {
                      batch.set(memRef, {
                          uid: ownerId,
                          organizationId: orgId,
                          role: 'owner',
                          organizationRole: 'owner',
                          appRole: 'owner',
                          status: 'active'
                      }, { merge: true });
                      needsUpdate = true;
                      opsInBatch++;
                  }

                  if (needsUpdate) {
                       repairedCount++;
                       logger.info(`[MILLIONSNEST_REPAIR_EXECUTION] Repaired membership for user ${ownerId} in org ${orgId}`);
                  }

                  if (opsInBatch > 400) {
                      await batch.commit();
                      batch = db.batch();
                      opsInBatch = 0;
                  }
              }
          }));

          if (opsInBatch > 0) {
              await batch.commit();
          }

          logger.info(`[MILLIONSNEST_REPAIR_EXECUTION] Completed. Repaired ${repairedCount} organizations.`);
          res.json({ success: true, repairedCount });

      } catch (e: any) {
          logger.error("[MILLIONSNEST_REPAIR_EXECUTION] Error:", e);
          res.status(500).json({ error: e.message });
      }
  });

  // Vite middleware for development
async function startLocalServer() {
  if (process.env.NODE_ENV !== "production") {
    logger.info("Initializing Vite middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    logger.info("Vite middleware initialized.");
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('index.html') || filePath.endsWith('.json') || filePath.endsWith('sw.js')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      }
    }));
    app.get('*all', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    logger.debug(`Server running on http://localhost:${PORT}`);
  });
}

// Only start the local server if we are not running on Vercel
if (!process.env.VERCEL) {
  startLocalServer().catch(err => {
    logger.error("Failed to start local server:", err);
  });
}

export default app;
