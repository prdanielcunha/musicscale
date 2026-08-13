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
        raise SystemExit(f"{label}: expected one structural match, got {count}")
    return updated

# -----------------------------------------------------------------------------
# UsersPage: remove obsolete client-side legacy-role migration authority.
# -----------------------------------------------------------------------------
p = Path('pages/UsersPage.tsx')
s = p.read_text()
s = replace_once(s, '  const [migrating, setMigrating] = useState(false);\n', '', 'UsersPage migrating state')
s = regex_once(
    s,
    r'\n  const handleMigrateRoles = async \(\) => \{.*?\n  \};\n\n  return \(',
    '\n  return (',
    'UsersPage migration function'
)
s = regex_once(
    s,
    r'''\n          \{isGlobal && \(\n            <Button\n              variant="outline"\n              size="sm"\n              onClick=\{handleMigrateRoles\}\n              disabled=\{migrating\}\n            >\n              \{migrating \? <Spinner size="sm" /> : "Migrar Estrutura de Papéis \(Admin\)"\}\n            </Button>\n          \)\}''',
    '',
    'UsersPage migration button'
)
p.write_text(s)

# -----------------------------------------------------------------------------
# ProfilePage: migrate duplicated join/remove UX to canonical Hub-backed routes,
# and disable satellite-side support organization/owner creation authority.
# -----------------------------------------------------------------------------
p = Path('pages/ProfilePage.tsx')
s = p.read_text()
old_join_effect = '''  useEffect(() => {
    if (organization?.id && canManageMembers) {
      const q = query(
        collection(db, 'organization_join_requests'),
        where('organizationId', '==', organization.id),
        where('status', '==', 'pending')
      );
      getDocs(q).then(snap => {
        setJoinRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }).catch(err => {
        logger.error("[ProfilePage] Failed loading join requests: ", err);
      });
    }
  }, [organization?.id, canManageMembers]);
'''
new_join_effect = '''  useEffect(() => {
    if (organization?.id && canManageMembers) {
      const q = query(
        collection(db, 'organizations', organization.id, 'join_requests'),
        where('status', '==', 'pending')
      );
      getDocs(q).then(snap => {
        setJoinRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }).catch(err => {
        logger.error("[ProfilePage] Failed loading canonical join requests: ", err);
        setJoinRequests([]);
      });
    } else {
      setJoinRequests([]);
    }
  }, [organization?.id, canManageMembers]);
'''
s = replace_once(s, old_join_effect, new_join_effect, 'ProfilePage join request query')

s = regex_once(
    s,
    r'  const handleProcessJoinRequest = async \(req: any, approve: boolean\) => \{.*?\n  \};\n\n  const handleUpdateMemberRole',
    '''  const handleProcessJoinRequest = async (req: any, approve: boolean) => {
    try {
      if (!user || !organization?.id) throw new Error("AUTH_OR_ORGANIZATION_REQUIRED");
      const requestId = typeof req?.requestId === 'string' ? req.requestId : req?.id;
      if (typeof requestId !== 'string' || !requestId) throw new Error("INVALID_JOIN_REQUEST");
      const idToken = await user.getIdToken();
      const action = approve ? 'approve' : 'reject';
      const response = await fetch(`/api/orgs/${encodeURIComponent(organization.id)}/join-requests/${encodeURIComponent(requestId)}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success !== true) {
        throw new Error(data?.reasonCode || data?.error || 'JOIN_REQUEST_COMMAND_FAILED');
      }
      setJoinRequests(prev => prev.filter(r => r.id !== requestId));
      showToast(approve ? 'Solicitação aceita com sucesso!' : 'Solicitação rejeitada com sucesso.', 'success');
      refreshData();
    } catch (err: any) {
      logger.error("[ProfilePage] Failed to process canonical join request:", err);
      showToast(err?.message || 'Erro ao processar solicitação.', 'error');
    }
  };

  const handleUpdateMemberRole''',
    'ProfilePage join request mutation'
)

old_remove = '''  const handleRemoveMember = async (memberId: string) => {
    if (memberId === user?.uid) {
      showToast('Você não pode remover a si mesmo.', 'error');
      return;
    }
    try {
      const orgId = organization?.id;
      if (orgId) {
        await deleteDoc(doc(db, "organizations", orgId, "members", memberId)).catch(() => {});
        await deleteDoc(doc(db, "organization_members", `${memberId}_${orgId}`)).catch(() => {});
        await deleteDoc(doc(db, "organization_members", `${orgId}_${memberId}`)).catch(() => {});
        
        await updateDoc(doc(db, "users", memberId), {
          organizationId: "",
          activeOrganizationId: ""
        }).catch(() => {});
      }
      showToast('Membro removido com sucesso!', 'success');
      refreshData();
    } catch (err: any) {
      logger.error("[ProfilePage] Failed to remove member:", err);
      showToast('Erro ao remover o membro.', 'error');
    }
  };
'''
new_remove = '''  const handleRemoveMember = async (memberId: string) => {
    if (memberId === user?.uid) {
      showToast('Você não pode remover a si mesmo.', 'error');
      return;
    }
    try {
      if (!user || !organization?.id) throw new Error("AUTH_OR_ORGANIZATION_REQUIRED");
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/orgs/${encodeURIComponent(organization.id)}/members/${encodeURIComponent(memberId)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success !== true || !['MEMBER_REMOVED', 'ALREADY_REMOVED'].includes(data?.reasonCode)) {
        throw new Error(data?.reasonCode || data?.error || 'MEMBER_REMOVAL_FAILED');
      }
      showToast('Membro removido com sucesso!', 'success');
      refreshData();
    } catch (err: any) {
      logger.error("[ProfilePage] Failed to remove member through Hub:", err);
      showToast(err?.message || 'Erro ao remover o membro.', 'error');
    }
  };
'''
s = replace_once(s, old_remove, new_remove, 'ProfilePage member removal')

s = regex_once(
    s,
    r'  const handleSupportCreateOrg = async \(e: React\.FormEvent\) => \{.*?\n  \};\n\n  const handleDeleteAccount',
    '''  const handleSupportCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupportSuccess(null);
    setSupportCreateLoading(false);
    setSupportError("A criação e vinculação de organizações foi movida para o MillionsNest Hub para preservar a autoridade canônica.");
  };

  const handleDeleteAccount''',
    'ProfilePage support org creation authority'
)
p.write_text(s)

# -----------------------------------------------------------------------------
# EcosystemDiagnostics: diagnostics remain read/preview capable, but owner/org
# authority repair must occur in Hub, not as browser Firestore mutations.
# -----------------------------------------------------------------------------
p = Path('components/admin/EcosystemDiagnostics.tsx')
s = p.read_text()
s = regex_once(
    s,
    r'''          else if \(previewAction\.type === "LINK_OWNER"\) \{.*?\n          \}\n          else if \(previewAction\.type === "CREATE_MUSICSCALE"\)''',
    '''          else if (previewAction.type === "LINK_OWNER") {
              throw new Error("OWNER_LINK_REQUIRES_MILLIONSNEST_HUB");
          }
          else if (previewAction.type === "CREATE_MUSICSCALE")''',
    'EcosystemDiagnostics LINK_OWNER mutation'
)
s = regex_once(
    s,
    r'''            if \(previewAction\.type === "CREATE_ORG"\) \{.*?\n            \}\n            else if \(previewAction\.type === "ENABLE_MUSICSCALE"\)''',
    '''            if (previewAction.type === "CREATE_ORG") {
                throw new Error("ORGANIZATION_CREATION_REQUIRES_MILLIONSNEST_HUB");
            }
            else if (previewAction.type === "ENABLE_MUSICSCALE")''',
    'EcosystemDiagnostics CREATE_ORG mutation'
)
p.write_text(s)

# -----------------------------------------------------------------------------
# Firestore Rules: membership authority is backend-only. Explicitly exclude the
# `members` subcollection from generic nested rules because Firestore rules OR.
# -----------------------------------------------------------------------------
p = Path('firestore.rules')
s = p.read_text()
old_members = '''      match /members/{uid} {
        allow read: if isAuthenticated() && (
          uid == request.auth.uid || checkOrgAccess(orgId) || isSystemAdmin()
        );
        allow list: if isAuthenticated() && (checkOrgAccess(orgId) || isSystemAdmin());
        allow create: if isAuthenticated() && (
          uid == request.auth.uid || isOrgAdmin(orgId) || isSystemAdmin()
        );
        allow update, delete: if isAuthenticated() && (
          isOrgAdmin(orgId) || isSystemAdmin()
        );
      }
'''
new_members = '''      match /members/{uid} {
        allow read: if isAuthenticated() && (
          uid == request.auth.uid || checkOrgAccess(orgId) || isSystemAdmin()
        );
        allow list: if isAuthenticated() && (checkOrgAccess(orgId) || isSystemAdmin());
        allow create, update, delete: if false;
      }
'''
s = replace_once(s, old_members, new_members, 'canonical membership Rules')

old_legacy = '''    match /organization_members/{id} {
      allow read: if isAuthenticated() && (isSystemAdmin() || id.split('_')[0] == request.auth.uid || id.split('_')[1] == request.auth.uid || checkOrgAccess(resource.data.get('organizationId', '')));
      allow list: if isAuthenticated() && (isSystemAdmin() || resource.data.get('userId', '') == request.auth.uid || resource.data.get('uid', '') == request.auth.uid || checkOrgAccess(resource.data.get('organizationId', '')));
      allow create: if isAuthenticated() && (id.split('_')[0] == request.auth.uid || id.split('_')[1] == request.auth.uid || isOrgAdmin(incoming().get('organizationId', '')) || isSystemAdmin());
      allow update: if isAuthenticated() && (isOrgAdmin(resource.data.get('organizationId', '')) || isSystemAdmin() || (resource.data.get('userId', '') == request.auth.uid && (!('role' in incoming()) || incoming().get('role', '') == resource.data.get('role', ''))));
      allow delete: if isAuthenticated() && (isOrgAdmin(resource.data.get('organizationId', '')) || isSystemAdmin() || id.split('_')[0] == request.auth.uid || id.split('_')[1] == request.auth.uid);
    }
'''
new_legacy = '''    match /organization_members/{id} {
      allow read: if isAuthenticated() && (isSystemAdmin() || id.split('_')[0] == request.auth.uid || id.split('_')[1] == request.auth.uid || checkOrgAccess(resource.data.get('organizationId', '')));
      allow list: if isAuthenticated() && (isSystemAdmin() || resource.data.get('userId', '') == request.auth.uid || resource.data.get('uid', '') == request.auth.uid || checkOrgAccess(resource.data.get('organizationId', '')));
      allow create, update, delete: if false;
    }
'''
s = replace_once(s, old_legacy, new_legacy, 'legacy membership Rules')

for old in [
    "app != 'musicscale_members' && app != 'invites' && app != 'musicscale_invite_role_intents' && app != 'join_requests' && isAuthenticated()"
]:
    count = s.count(old)
    if count != 3:
        raise SystemExit(f'generic nested rules expected 3 protected expressions, got {count}')
    s = s.replace(old, "app != 'members' && app != 'musicscale_members' && app != 'invites' && app != 'musicscale_invite_role_intents' && app != 'join_requests' && isAuthenticated()")

p.write_text(s)

# Guardrails over reachable client files.
for file_name in ['pages/UsersPage.tsx', 'pages/ProfilePage.tsx']:
    text = Path(file_name).read_text()
    if 'organization_join_requests' in text:
        raise SystemExit(f'{file_name}: legacy join request authority remains')
    if 'handleMigrateRoles' in text:
        raise SystemExit(f'{file_name}: legacy role migration remains')

profile = Path('pages/ProfilePage.tsx').read_text()
for forbidden in [
    "doc(db, 'organizations', req.organizationId, 'members', req.uid)",
    'doc(db, "organizations", orgId, "members", memberId)',
    "doc(db, 'organization_members'",
    'doc(db, "organization_members"'
]:
    if forbidden in profile:
        raise SystemExit(f'ProfilePage: direct membership authority remains: {forbidden}')

diagnostics = Path('components/admin/EcosystemDiagnostics.tsx').read_text()
if 'organizationRole: "owner"' in diagnostics:
    raise SystemExit('EcosystemDiagnostics still contains owner membership mutation')

print('02E final membership authority hardening applied')
