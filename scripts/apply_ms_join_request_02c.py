from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one exact match, got {count}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{label}: expected one regex match, got {count}")
    return updated

# server.ts: import adapter and replace the entire legacy local-authority join route.
p = Path('server.ts')
s = p.read_text()
s = replace_once(
    s,
    'import { createInvitationCompatibilityHandlers } from "./services/server/musicScaleInvitationCompatibility.js";\n',
    'import { createInvitationCompatibilityHandlers } from "./services/server/musicScaleInvitationCompatibility.js";\nimport { createJoinRequestCompatibilityHandlers } from "./services/server/musicScaleJoinRequestCompatibility.js";\n',
    'server import'
)
legacy_route_pattern = r'  app\.post\("/api/orgs/join", async \(req, res\) => \{.*?\n  \}\);\n\n  app\.post\("/api/orgs/check-access"'
legacy_route_replacement = '''  const joinRequestCompatibilityHandlers = createJoinRequestCompatibilityHandlers({ db, auth, logger });
  app.post("/api/orgs/join", joinRequestCompatibilityHandlers.create);
  app.post("/api/orgs/:organizationId/join-requests/:requestId/approve", joinRequestCompatibilityHandlers.approve);
  app.post("/api/orgs/:organizationId/join-requests/:requestId/reject", joinRequestCompatibilityHandlers.reject);

  app.post("/api/orgs/check-access"'''
s = regex_once(s, legacy_route_pattern, legacy_route_replacement, 'legacy /api/orgs/join route')
p.write_text(s)

# TenantOnboarding: owner email remains discovery input; caller uid is never body authority.
p = Path('pages/TenantOnboarding.tsx')
s = p.read_text()
s = replace_once(
    s,
    '''        body: JSON.stringify({
          userId: user.uid,
          ownerEmail: joinEmail,
        }),''',
    '''        body: JSON.stringify({
          ownerEmail: joinEmail,
        }),''',
    'TenantOnboarding join body'
)
p.write_text(s)

# UsersPage: read canonical nested requests, resolve exclusively through backend -> Hub.
p = Path('pages/UsersPage.tsx')
s = p.read_text()
fetch_pattern = r'''  const fetchJoinRequests = async \(\) => \{.*?\n  \};\n\n  const handleProcessRequest = async \(req: any, approve: boolean\) => \{.*?\n  \};\n\n  const fetchUsers = async \(\) => \{'''
fetch_replacement = '''  const fetchJoinRequests = async () => {
    const organizationId = userProfile?.activeOrganizationId || userProfile?.primaryOrganizationId || userProfile?.organizationId;
    if (!organizationId) return;
    try {
      const q = query(
        collection(db, 'organizations', organizationId, 'join_requests'),
        where('status', '==', 'pending')
      );
      const snap = await getDocs(q);
      setJoinRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      logger.error("Failed to load canonical join requests", e);
      setJoinRequests([]);
    }
  };

  const handleProcessRequest = async (req: any, approve: boolean) => {
    try {
      if (!currentUser) throw new Error(t("users.auth_error", "Usuário não autenticado."));
      const organizationId = userProfile?.activeOrganizationId || userProfile?.primaryOrganizationId || userProfile?.organizationId;
      const requestId = typeof req?.requestId === 'string' ? req.requestId : req?.id;
      if (!organizationId || typeof requestId !== 'string' || !requestId) {
        throw new Error(t("users.join_request_invalid", "Solicitação inválida."));
      }
      const idToken = await currentUser.getIdToken();
      const action = approve ? 'approve' : 'reject';
      const response = await fetch(`/api/orgs/${encodeURIComponent(organizationId)}/join-requests/${encodeURIComponent(requestId)}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success !== true) {
        throw new Error(data?.reasonCode || data?.error || t("users.join_request_error", "Erro ao processar solicitação."));
      }
      await fetchJoinRequests();
      await fetchUsers();
      toastSuccess(approve
        ? t("users.join_request_approved", "Solicitação aprovada com sucesso.")
        : t("users.join_request_rejected", "Solicitação rejeitada."));
    } catch (e: any) {
      logger.error("Failed to process canonical join request", e);
      toastError(e?.message || t("users.join_request_error", "Erro ao processar solicitação."));
    }
  };

  const fetchUsers = async () => {'''
s = regex_once(s, fetch_pattern, fetch_replacement, 'UsersPage join request flow')
p.write_text(s)

# Firestore Rules: exact canonical read authority, no client writes, no generic catch-all reopening.
p = Path('firestore.rules')
s = p.read_text()
helper_marker = '''    // ==========================================\n    // 1. DADOS DOS USUÁRIOS\n    // ==========================================\n'''
helper = '''    function hasCanonicalJoinRequestReadAccess(orgId) {
      return isAuthenticated() && (
        hasCanonicalGlobalRole() ||
        (
          exists(/databases/$(database)/documents/organizations/$(orgId)) &&
          (
            get(/databases/$(database)/documents/organizations/$(orgId)).data.get('ownerUid', '') == request.auth.uid ||
            get(/databases/$(database)/documents/organizations/$(orgId)).data.get('ownerId', '') == request.auth.uid ||
            get(/databases/$(database)/documents/organizations/$(orgId)).data.get('owner_user_id', '') == request.auth.uid ||
            get(/databases/$(database)/documents/organizations/$(orgId)).data.get('ownerUserId', '') == request.auth.uid ||
            (
              exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)) &&
              get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)).data.get('status', '') in ['active', 'ativo'] &&
              (
                get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)).data.get('role', '') in ['owner', 'admin'] ||
                get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)).data.get('organizationRole', '') in ['owner', 'admin']
              )
            )
          )
        )
      );
    }

''' + helper_marker
s = replace_once(s, helper_marker, helper, 'Rules canonical join helper')
role_intent_block = '''      match /musicscale_invite_role_intents/{intentId} {
        allow read, create, update, delete: if false;
      }
'''
join_block = role_intent_block + '''
      match /join_requests/{requestId} {
        allow read, list: if hasCanonicalJoinRequestReadAccess(orgId);
        allow create, update, delete: if false;
      }
'''
s = replace_once(s, role_intent_block, join_block, 'Rules join_requests block')
s = s.replace("app != 'musicscale_invite_role_intents' && isAuthenticated()", "app != 'musicscale_invite_role_intents' && app != 'join_requests' && isAuthenticated()")
if s.count("app != 'join_requests'") != 3:
    raise SystemExit(f"Rules catch-all exclusion: expected three exclusions, got {s.count(\"app != 'join_requests'\")}")
p.write_text(s)

print('02C guarded patch applied successfully')
