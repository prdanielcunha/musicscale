const fs = require('fs');

let file = fs.readFileSync('server.ts', 'utf8');

const regex = /app\.get\("\/api\/v1\/ecosystem\/access-context", async \(req, res\) => \{[\s\S]*?\n  \}\);\n/s;

const newContent = `  app.get("/api/v1/ecosystem/runtime-health", async (req, res) => {
      const correlationId = "hlth_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
      try {
          const authHeader = req.headers.authorization || "";
          if (!authHeader || !authHeader.startsWith("Bearer ")) {
              return res.status(401).json({ error: "Unauthorized: Missing Bearer Token", correlationId, safeErrorCode: "MISSING_TOKEN" });
          }
          const token = authHeader.split(" ")[1];
          if (!admin.apps.length || !adminAuth) {
              return res.status(503).json({ error: "Service Unavailable", safeErrorCode: "FIREBASE_ADMIN_CREDENTIAL_MISSING", correlationId });
          }
          
          try {
              await adminAuth.verifyIdToken(token);
          } catch(e) {
              return res.status(401).json({ error: "Unauthorized: Invalid Token", correlationId, safeErrorCode: "INVALID_TOKEN" });
          }

          const { getFirebaseAdminRuntimeStatus } = await import("./services/firebaseAdmin.js");
          const status = await getFirebaseAdminRuntimeStatus();
          
          if (!status.configurationValid) {
              return res.status(503).json({
                  ok: false,
                  safeErrorCode: status.safeErrorCode,
                  correlationId
              });
          }

          res.json({
              ok: true,
              environment: process.env.NODE_ENV || "unknown",
              projectId: status.projectId,
              firebaseAdminInitialized: status.initialized,
              firebaseAuthAvailable: status.authAvailable,
              firestoreAvailable: status.firestoreAvailable,
              credentialSource: status.credentialSource,
              accessContextEndpointReady: true,
              correlationId
          });
      } catch (e) {
          res.status(500).json({ error: "Internal Server Error", correlationId, safeErrorCode: "INTERNAL_ERROR" });
      }
  });

  app.get("/api/v1/ecosystem/access-context", async (req, res) => {
      const startTime = performance.now();
      const correlationId = "ctx_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
      try {
          if (!db) {
              return res.status(503).json({ error: "Database not initialized", correlationId, safeErrorCode: "FIRESTORE_UNAVAILABLE" });
          }
          const orgId = req.query.organizationId;
          if (!orgId) return res.status(400).json({ error: "Missing organizationId parameter", correlationId });
          const authHeader = req.headers.authorization || "";
          if (!authHeader || !authHeader.startsWith("Bearer ")) {
              return res.status(401).json({ error: "Unauthorized: Missing Bearer Token", correlationId, safeErrorCode: "MISSING_TOKEN" });
          }
          const token = authHeader.split(" ")[1];
          
          let decodedToken;
          try {
              decodedToken = await admin.auth().verifyIdToken(token);
          } catch(e) {
              return res.status(401).json({ error: "Unauthorized: Invalid Token", correlationId, safeErrorCode: "INVALID_TOKEN" });
          }
          const authUid = decodedToken.uid;
          if (!authUid) {
              return res.status(401).json({ error: "Unauthorized: Invalid Token", correlationId, safeErrorCode: "INVALID_TOKEN" });
          }
          const authTime = performance.now();
          
          let userSnap, orgSnap, orgMemberSnap, rbacModule, resolverModule;
          try {
              [userSnap, orgSnap, orgMemberSnap, rbacModule, resolverModule] = await Promise.all([
                  db.collection("users").doc(authUid).get(),
                  db.collection("organizations").doc(orgId).get(),
                  db.collection("organizations").doc(orgId).collection("members").doc(authUid).get(),
                  import("./utils/rbac.js"),
                  import("./services/ecosystem/accessContextResolver.js")
              ]);
          } catch(e) {
              return res.status(503).json({ error: "Firestore unavailable", correlationId, safeErrorCode: "FIRESTORE_UNAVAILABLE" });
          }
          
          const primaryReadsTime = performance.now();
          if (!userSnap.exists) {
              return res.status(404).json({ error: "User profile not found", correlationId, safeErrorCode: "USER_NOT_FOUND" });
          }
          if (!orgSnap.exists) {
              return res.status(404).json({ error: "Organization not found", correlationId, safeErrorCode: "ORGANIZATION_NOT_FOUND" });
          }
          
          const userData = userSnap.data() || {};
          const orgData = orgSnap.data() || {};
          const systemRole = userData.systemRole || userData.role || userData.appRole || userData.globalRole || userData.ecosystemRole || null;
          
          const directMemberData = orgMemberSnap.exists ? orgMemberSnap.data() : null;
          let crossMemberData1 = null;
          let crossMemberData2 = null;
          
          let hasDirectRole = false;
          if (directMemberData && (directMemberData.role || directMemberData.organizationRole)) {
              hasDirectRole = true;
          }
          if (!hasDirectRole) {
              const [cross1, cross2] = await Promise.all([
                  db.collection("organization_members").doc(\`\${orgId}_\${authUid}\`).get(),
                  db.collection("organization_members").doc(\`\${authUid}_\${orgId}\`).get()
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
          
          const musicScaleProfile = userData.musicScaleProfile || {
              ministryRoles: userData.ministryRoles || userData.roles || [],
              instrumentIds: userData.instrumentIds || userData.instruments || [],
              skillIds: userData.skillIds || userData.skills || []
          };
          
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
          
          if (accessCtx.resolutionStatus !== 'resolved' && accessCtx.resolutionStatus !== 'incomplete') {
               return res.status(403).json({ error: "Access Denied", correlationId, safeErrorCode: "ACCESS_DENIED" });
          }
          if (accessCtx.accessSource === 'none' && !accessCtx.isGlobalAccess) {
               return res.status(403).json({ error: "Access Denied", correlationId, safeErrorCode: "ACCESS_DENIED" });
          }
          if (membershipStatus !== 'active' && !accessCtx.isGlobalAccess) {
               return res.status(403).json({ error: "Membership Inactive", correlationId, safeErrorCode: "MEMBERSHIP_INACTIVE" });
          }

          console.log(\`[Correlation: \${correlationId}] Resolved access context for uid hash: \${authUid.substring(0, 5)}... in org: \${orgId}. Source: \${accessCtx.accessSource}, Caps: \${accessCtx.effectiveCapabilities.length}\`);
          
          const totalTime = performance.now();
          const durAuth = Math.round(authTime - startTime);
          const durPrimary = Math.round(primaryReadsTime - authTime);
          const durFallback = Math.round(fallbackTime - primaryReadsTime);
          const durResolve = Math.round(resolveTime - fallbackTime);
          const durTotal = Math.round(totalTime - startTime);
          
          const sanitizeDuration = (value) => Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
          const timingValue = [
            \`auth;dur=\${sanitizeDuration(durAuth)}\`,
            \`primary_reads;dur=\${sanitizeDuration(durPrimary)}\`,
            \`membership_fallback;dur=\${sanitizeDuration(durFallback)}\`,
            \`access_resolution;dur=\${sanitizeDuration(durResolve)}\`,
            \`total;dur=\${sanitizeDuration(durTotal)}\`
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
      } catch (e) {
          console.error(\`[Correlation: \${correlationId}] Error resolving access context: \${e.code || e.message}\`);
          res.status(500).json({ error: "Internal Server Error", correlationId, safeErrorCode: "INTERNAL_ERROR" });
      }
  });
`;

file = file.replace(regex, newContent);
fs.writeFileSync('server.ts', file);
