from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one exact match, got {count}")
    return text.replace(old, new, 1)

# server.ts: register compatibility handler beside existing Hub membership adapters.
p = Path('server.ts')
s = p.read_text()
old_import = 'import { createJoinRequestCompatibilityHandlers } from "./services/server/musicScaleJoinRequestCompatibility.js";\n'
new_import = old_import + 'import { createMemberRemovalCompatibilityHandler } from "./services/server/musicScaleMemberRemovalCompatibility.js";\n'
s = replace_once(s, old_import, new_import, 'server member removal import')
old_routes = '''  const joinRequestCompatibilityHandlers = createJoinRequestCompatibilityHandlers({ db, auth, logger });
  app.post("/api/orgs/join", joinRequestCompatibilityHandlers.create);
  app.post("/api/orgs/:organizationId/join-requests/:requestId/approve", joinRequestCompatibilityHandlers.approve);
  app.post("/api/orgs/:organizationId/join-requests/:requestId/reject", joinRequestCompatibilityHandlers.reject);
'''
new_routes = old_routes + '''
  const memberRemovalCompatibilityHandler = createMemberRemovalCompatibilityHandler({ db, auth, logger });
  app.delete("/api/orgs/:organizationId/members/:memberId", memberRemovalCompatibilityHandler);
'''
s = replace_once(s, old_routes, new_routes, 'server member removal route')
p.write_text(s)

# UsersPage: remove direct client delete primitive from imports.
p = Path('pages/UsersPage.tsx')
s = p.read_text()
s = replace_once(
    s,
    'import { doc, updateDoc, deleteDoc, collection, setDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";\n',
    'import { doc, updateDoc, collection, setDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";\n',
    'UsersPage deleteDoc import'
)

old_remove = '''  const handleRemoveMember = async (memberId: string) => {
    if (memberId === currentUser?.uid || !api) return;
    
    // Validate hierarchy before removing member
    const targetUser = allUsers.find(u => u.uid === memberId);
    if (targetUser) {
      const targetRoleKey = getRoleKeyFromId(targetUser.roleId || "", allRoles);
      const actorRoleKey = isGlobal ? "owner" : getRoleKeyFromName(userProfile?.role || "");
      const otherOwnersActiveCount = allUsers.filter(u => u.organizationId === userProfile?.organizationId && u.uid !== memberId && (u.role === 'owner' || u.role === 'Dono' || u.uid === organization?.ownerUserId)).length;
      
      const roleCtx = {
        isGlobalPrivilegedUser: isGlobal,
        actorSystemRole: userProfile?.systemRole,
        actorOrganizationRole: actorRoleKey,
        targetOrganizationRole: targetRoleKey,
        isSelfChange: memberId === currentUser?.uid,
        otherOwnersActiveCount
      };

      const checkChange = canChangeOrganizationRole(actorRoleKey, targetRoleKey, "viewer", roleCtx);
      if (!checkChange.canChange) {
        toastError(checkChange.error || "Você não tem autorização para remover este usuário.");
        return;
      }
    }

    setIsSaving(true);
    try {
      const orgId = userProfile?.organizationId || currentUser?.uid;
      try {
          // Official Source of Truth delete
          await deleteDoc(doc(db, "organizations", orgId, "members", memberId));
          
          // Legacy deletes
          const docRef1 = doc(db, "organization_members", `${memberId}_${orgId}`);
          await deleteDoc(docRef1);
      } catch (e) {}
      try {
          const docRef2 = doc(db, "organization_members", `${orgId}_${memberId}`);
          await deleteDoc(docRef2);
      } catch (e) {}
      
      setUsers((prev) => prev.filter((u) => u.uid !== memberId));
      if (allUsers) {
         // Should realistically refresh all users, but refreshUsers handles it.
         refreshUsers();
      }
      toastSuccess("Membro removido da organização.");
    } catch (error) {
      logger.error("Failed to remove user", error);
      toastError("Erro ao remover o usuário.");
    } finally {
      setIsSaving(false);
    }
  };
'''
new_remove = '''  const removeMemberViaHub = async (memberId: string) => {
    if (!currentUser) throw new Error(t("users.auth_error", "Usuário não autenticado."));
    if (memberId === currentUser.uid) throw new Error("SELF_REMOVAL_REQUIRES_LEAVE_COMMAND");
    const organizationId = userProfile?.activeOrganizationId || userProfile?.primaryOrganizationId || userProfile?.organizationId;
    if (!organizationId) throw new Error("ORGANIZATION_CONTEXT_REQUIRED");

    const idToken = await currentUser.getIdToken();
    const response = await fetch(`/api/orgs/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(memberId)}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${idToken}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success !== true || !["MEMBER_REMOVED", "ALREADY_REMOVED"].includes(data?.reasonCode)) {
      throw new Error(data?.reasonCode || data?.error || "MEMBER_REMOVAL_FAILED");
    }
    return data;
  };

  const handleRemoveMember = async (memberId: string) => {
    if (memberId === currentUser?.uid || !api) return;
    setIsSaving(true);
    try {
      await removeMemberViaHub(memberId);
      setUsers((prev) => prev.filter((u) => u.uid !== memberId));
      refreshUsers();
      toastSuccess("Membro removido da organização.");
    } catch (error: any) {
      logger.error("Failed to remove user", error);
      toastError(error?.message || "Erro ao remover o usuário.");
    } finally {
      setIsSaving(false);
    }
  };
'''
s = replace_once(s, old_remove, new_remove, 'UsersPage individual removal')

old_bulk = '''      if (bulkAction === "delete") {
        await Promise.all(selectedUserIds.map((uid) => {
            const orgId = userProfile?.organizationId || currentUser?.uid;
            return Promise.all([
               deleteDoc(doc(db, "organizations", orgId, "members", uid)).catch(e => null),
               deleteDoc(doc(db, "organization_members", `${uid}_${orgId}`)).catch(e => null),
               deleteDoc(doc(db, "organization_members", `${orgId}_${uid}`)).catch(e => null)
            ]);
        }));
      } else if (bulkAction === "changeRole" && newRoleId) {
'''
new_bulk = '''      if (bulkAction === "delete") {
        await Promise.all(selectedUserIds.map((uid) => removeMemberViaHub(uid)));
      } else if (bulkAction === "changeRole" && newRoleId) {
'''
s = replace_once(s, old_bulk, new_bulk, 'UsersPage bulk removal')
p.write_text(s)

# Postconditions: no direct membership-delete primitive remains in reachable UsersPage.
final_users = p.read_text()
if 'deleteDoc(' in final_users:
    raise SystemExit('UsersPage still contains deleteDoc after member-removal migration')
if 'organization_members' in final_users[final_users.index('const removeMemberViaHub'):final_users.index('const hasChanges')]:
    raise SystemExit('Removal/bulk block still references legacy membership projection')

print('02D guarded member-removal migration applied')
