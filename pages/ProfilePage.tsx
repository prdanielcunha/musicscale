import { logger } from "../lib/logger";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { runLocaleDiagnostics, getSessionMissingKeys, clearMissingKeys } from "../utils/languageDiagnostics";
import { getPrimaryDisplayRole, getRoleBadgeStyles } from '../utils/roleResolver';
import { useApi } from "../contexts/ApiContext";
import { useAuth } from "../contexts/AuthContext";
import { useEcosystem } from "../contexts/EcosystemContext";
import { useToast } from "../contexts/ToastContext";
import { useMusic } from "../contexts/MusicDataContext";
import {
  updateUserProfile,
  changePassword,
  getFirebaseErrorMessage,
  reauthenticateCurrentUser,
  deleteAuthUser,
} from "../services/authService";
// FIX: Removed firestoreService import in favor of useApi
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Spinner from "../components/common/Spinner";
import { UserIcon } from "../components/icons/UserIcon";
import { SunIcon } from "../components/icons/SunIcon";
import { MoonIcon } from "../components/icons/MoonIcon";
import { UserPlusIcon } from "../components/icons/UserPlusIcon";
import { StoreIcon } from "../components/icons/StoreIcon";
import type { AuthError } from "firebase/auth";
import type { Instrument, InstrumentCategory } from "../types";
import { doc, updateDoc, serverTimestamp, setDoc, query, where, getDocs, collection, deleteDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import DeleteAccountModal from "../components/common/DeleteAccountModal";
import { AlertTriangleIcon } from "../components/icons/AlertTriangleIcon";
import { KeyPermissionsIcon } from "../components/icons/KeyPermissionsIcon";
import { MusicNoteIcon } from "../components/icons/MusicNoteIcon";
import { SparklesIcon } from "../components/icons/SparklesIcon";
import { MicIcon } from "../components/icons/MicIcon";
import { CheckIcon } from "../components/icons/CheckIcon";

const formInputClass = "mt-1 input-base";
const formLabelClass =
  "block text-[12px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1";

const PaintBrushIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M18.375 2.625a3.875 3.875 0 0 0-5.48 0l-9.563 9.563a1.875 1.875 0 0 0 0 2.652l.928.928a1.875 1.875 0 0 0 2.652 0l9.563-9.564a3.875 3.875 0 0 0 0-5.479v0Z"></path>
    <path d="M14.25 7.125 16.875 9.75"></path>
    <path d="M4.5 16.875v1.688a1.688 1.688 0 0 0 1.688 1.688h1.687"></path>
    <path d="M10.5 20.25h.01"></path>
    <path d="M13.5 20.25h.01"></path>
    <path d="M16.5 20.25h.01"></path>
    <path d="M19.5 20.25h.01"></path>
  </svg>
);

const CameraIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
    <path d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
  </svg>
);

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "Ministro":
      return <SparklesIcon className="w-5 h-5" />;
    case "Voz":
      return <MicIcon className="w-5 h-5" />;
    case "Instrumento":
      return <MusicNoteIcon className="w-5 h-5" />;
    default:
      return <MusicNoteIcon className="w-5 h-5" />;
  }
};

// Helper to visually clean up names if they match legacy patterns
const formatSpecialtyName = (name: string) => {
  if (
    name.toLowerCase() === "bv - 1" ||
    name.toLowerCase() === "bv - 2" ||
    name.toLowerCase() === "bv - 3"
  )
    return "Vocal";
  if (
    name.toLowerCase() === "ministro 1" ||
    name.toLowerCase() === "ministro 2"
  )
    return "Ministro";
  if (name.toLowerCase() === "voz principal") return "Voz Principal";
  return name;
};


const resizeImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const maxSize = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(file.type));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

const ProfilePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [diagnosticsResult, setDiagnosticsResult] = useState<any>(null);
  const [missingRuntimeKeys, setMissingRuntimeKeys] = useState<string[]>([]);

  useEffect(() => {
    // Run diagnostics check on load
    const results = runLocaleDiagnostics();
    setDiagnosticsResult(results);
    setMissingRuntimeKeys(getSessionMissingKeys());
  }, []);

  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
    setTimeout(() => {
      setDiagnosticsResult(runLocaleDiagnostics());
      setMissingRuntimeKeys(getSessionMissingKeys());
    }, 100);
  };

  const triggerDiagnostics = () => {
    setDiagnosticsResult(runLocaleDiagnostics());
    setMissingRuntimeKeys(getSessionMissingKeys());
  };

  const handleClearMissing = () => {
    clearMissingKeys();
    setMissingRuntimeKeys([]);
  };

  const { user, userProfile, refreshAuthData, organization, permissions, isSupportMode, isOwner } =
    useAuth();
  const ecosystem = useEcosystem();
  const availableOrgs = ecosystem?.context?.organizationsAvailable || [];

  const handleSwitchOrg = async (orgId: string) => {
    localStorage.setItem('activeOrganizationId', orgId);
    
    if (user?.uid) {
        try {
            const { doc, updateDoc } = await import('firebase/firestore');
            const { db } = await import('../services/firebase');
            await updateDoc(doc(db, 'users', user.uid), {
                activeOrganizationId: orgId,
                organizationId: orgId // update legacy field too
            });
        } catch(e) {
            console.error("Failed to persist organization switch to Firestore", e);
        }
    }

    window.location.href = '/start';
  };

  const { instruments, allUsers, roles, refreshData } = useMusic();
  const api = useApi();

  // Support Mode Creation states
  const [supportNewOrgName, setSupportNewOrgName] = useState("");
  const [supportNewOrgSlug, setSupportNewOrgSlug] = useState("");
  const [supportCreateLoading, setSupportCreateLoading] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState<string | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);

  // Profile state
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [specialtyIds, setSpecialtyIds] = useState<string[]>([]);
  const [address, setAddress] = useState({
    street: "",
    city: "",
    state: "",
    zip: "",
  });
  const [isProfileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: "", text: "" });

  // Org state
  const [orgName, setOrgName] = useState("");
  const [isOrgSaving, setIsOrgSaving] = useState(false);
  const [orgMessage, setOrgMessage] = useState({ type: "", text: "" });


  // Manage members states and actions in profile page
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const canManageMembers = isOwner || !!permissions?.manageMembers;

  useEffect(() => {
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

  const handleProcessJoinRequest = async (req: any, approve: boolean) => {
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

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    try {
      const getRoleKeyFromName = (roleName: string): string => {
        const name = (roleName || "").toLowerCase();
        if (name.includes("dono") || name === "owner" || name === "ceo" || name.includes("founder")) return "owner";
        if (name.includes("administrador") || name === "admin") return "admin";
        if (name.includes("líder") || name.includes("lider") || name.includes("ministro") || name === "leader") return "leader";
        if (name.includes("músico") || name.includes("musico") || name.includes("vocal") || name === "musician") return "musician";
        return "viewer"; // Default mapping for 'member' or 'viewer'
      };

      const getRoleKeyFromId = (roleId: string, availableRoles: any[]): string => {
        const roleName = availableRoles.find(r => r.id === roleId)?.name || "";
        return getRoleKeyFromName(roleName);
      };

      let finalRoleName = newRole;
      if (newRole.startsWith("role_")) {
          const newTargetRoleKey = getRoleKeyFromId(newRole, roles);
          finalRoleName = {
              owner: "owner",
              admin: "admin",
              leader: "leader",
              musician: "musician",
              viewer: "viewer"
          }[newTargetRoleKey] || newTargetRoleKey;
      }
      
      const matchingRole = roles.find(r => r.id === newRole || getRoleKeyFromName(r.name) === finalRoleName);
      const roleIdToSave = matchingRole ? matchingRole.id : newRole;

      await api.users.update(memberId, {
        roleId: roleIdToSave,
        musicscaleRole: finalRoleName
      });

      showToast('Cargo atualizado com sucesso!', 'success');
      refreshData();
    } catch (err: any) {
      logger.error("[ProfilePage] Failed to update role:", err);
      showToast('Erro ao atualizar cargo.', 'error');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
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

  // Password state
  const [passwords, setPasswords] = useState({
    current: "",
    newPass: "",
    confirmPass: "",
  });
  const [isPasswordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({
    type: "",
    text: "",
  });

  // Deletion state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [isInitialLoading, setInitialLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (organization) {
      setOrgName(organization.name || "");
    }
  }, [organization]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        // Prefer userProfile (Firestore) for data, specifically photoURL which might be a large Base64 string
        // not synced to Auth due to size limits.
        setDisplayName(userProfile?.displayName || user.displayName || "");
        setPhotoURL(userProfile?.photoURL || user.photoURL || "");

        if (userProfile) {
          setAddress(
            userProfile.address || { street: "", city: "", state: "", zip: "" },
          );
          setSpecialtyIds(userProfile.specialtyIds || []);
        }
        setInitialLoading(false);
      }
    };
    fetchProfile();
  }, [user, userProfile]);

  const instrumentsByCategory = useMemo(() => {
    const categoryOrder: InstrumentCategory[] = [
      "Ministro",
      "Voz",
      "Instrumento",
    ];
    const grouped: Record<string, Instrument[]> = {
      Ministro: [],
      Voz: [],
      Instrumento: [],
    };

    // Use a Set to track unique formatted names per category to avoid visual duplicates
    const seenNames = new Set<string>();

    instruments.forEach((inst) => {
      if (grouped[inst.category]) {
        const formattedName = formatSpecialtyName(inst.name);
        // Create a unique key for checking duplicates (category + formatted name)
        const uniqueKey = `${inst.category}-${formattedName}`;

        if (!seenNames.has(uniqueKey)) {
          grouped[inst.category].push(inst);
          seenNames.add(uniqueKey);
        }
      }
    });

    // Return an array of tuples to preserve order
    return categoryOrder.map((cat) => [
      cat,
      grouped[cat].sort((a, b) =>
        formatSpecialtyName(a.name).localeCompare(formatSpecialtyName(b.name)),
      ),
    ]);
  }, [instruments]);

  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !organization) return;

    setIsOrgSaving(true);
    setOrgMessage({ type: "", text: "" });

    try {
      const currentSlug =
        organization.slug ||
        (orgName
          ? orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-")
          : `org-${Date.now()}`);

      let safeOrgName = String(orgName || "").trim();
      if (safeOrgName.length === 0) safeOrgName = "Organização";

      const orgRef = doc(db, "organizations", organization.id);
      await updateDoc(orgRef, {
        name: safeOrgName,
        displayName: safeOrgName,
        slug: currentSlug,
        updated_at: serverTimestamp()
      });

      // Important: refresh user data to get the absolute latest from the DB
      await refreshAuthData();

      setOrgMessage({
        type: "success",
        text: "Organização atualizada com sucesso!",
      });
      setTimeout(() => setOrgMessage({ type: "", text: "" }), 4000);
    } catch (error: any) {
      logger.error("[ProfilePage] Org update error:", error);
      setOrgMessage({
        type: "error",
        text: error.message || "Erro ao atualizar.",
      });
    } finally {
      setIsOrgSaving(false);
    }
  };

  const handleSupportCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupportSuccess(null);
    setSupportCreateLoading(false);
    setSupportError("A criação e vinculação de organizações foi movida para o MillionsNest Hub para preservar a autoridade canônica.");
  };

  const handleSpecialtyChange = (specialtyId: string) => {
    setSpecialtyIds((prev) =>
      prev.includes(specialtyId)
        ? prev.filter((id) => id !== specialtyId)
        : [...prev, specialtyId],
    );
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const resizedBase64 = await resizeImage(file);
      setPhotoURL(resizedBase64);
    } catch (error) {
      logger.error("Error processing image", error);
      setProfileMessage({ type: "error", text: "Erro ao processar a imagem." });
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setProfileMessage({ type: "", text: "" });
    setPasswordMessage({ type: "", text: "" });
    setProfileSaving(true);

    try {
      if (!api) return;
      
      const safeDisplayName = displayName.trim() || "Usuário";

      if (safeDisplayName !== user.displayName) {
        await updateUserProfile({ displayName: safeDisplayName });
      }

      await api.users.update(user.uid, {
        displayName: safeDisplayName,
        photoURL,
        address,
        specialtyIds,
      });

      await refreshAuthData(); // Refresh auth context to get new profile data
      setProfileMessage({
        type: "success",
        text: "Perfil atualizado com sucesso!",
      });
      setTimeout(() => setProfileMessage({ type: "", text: "" }), 4000);
    } catch (error) {
      logger.error(error);
      setProfileMessage({
        type: "error",
        text: "Ocorreu um erro ao atualizar o perfil.",
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage({ type: "", text: "" });
    setProfileMessage({ type: "", text: "" });

    if (passwords.newPass !== passwords.confirmPass) {
      setPasswordMessage({
        type: "error",
        text: "As novas senhas não coincidem.",
      });
      return;
    }
    if (passwords.newPass.length < 6) {
      setPasswordMessage({
        type: "error",
        text: "A nova senha deve ter pelo menos 6 caracteres.",
      });
      return;
    }

    setPasswordSaving(true);
    try {
      await changePassword(passwords.current, passwords.newPass);
      setPasswordMessage({
        type: "success",
        text: "Senha alterada com sucesso!",
      });
      setPasswords({ current: "", newPass: "", confirmPass: "" });
      setTimeout(() => setPasswordMessage({ type: "", text: "" }), 4000);
    } catch (error) {
      setPasswordMessage({
        type: "error",
        text: getFirebaseErrorMessage(error as AuthError),
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAddress((prev) => ({ ...prev, [name]: value }));
  };

  const handleAccountDeletion = async (password: string) => {
    if (!user) return;

    setIsDeleting(true);
    setDeleteError(null);

    const uid = user.uid;

    try {
      await reauthenticateCurrentUser(password);
      if (api) {
        await api.users.delete(uid);
      }
      await deleteAuthUser();

      setIsDeleteModalOpen(false);
    } catch (error) {
      logger.error("Failed to delete account:", error);
      setDeleteError(getFirebaseErrorMessage(error as AuthError));
    } finally {
      setIsDeleting(false);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 pt-4 md:pt-0">
      <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-6">
        <div className="flex flex-col md:flex-row items-center gap-6 w-full md:w-auto">
          <div className="relative group cursor-pointer">
            <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-gray-800 dark:to-gray-700 p-[2px] shadow-2xl shadow-black/10 relative overflow-hidden">
              <div className="w-full h-full rounded-[22px] overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center relative">
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt="User"
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                  />
                ) : (
                  <UserIcon className="w-12 h-12 text-slate-300 dark:text-gray-600" />
                )}
                <label
                  htmlFor="photo-upload"
                  className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                >
                  <CameraIcon className="w-8 h-8 text-white drop-shadow-md" />
                </label>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                  ref={fileInputRef}
                />
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-white dark:bg-black p-1.5 rounded-xl shadow-sm border border-slate-100 dark:border-gray-800 pointer-events-none">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                <KeyPermissionsIcon className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {displayName || t("profile.my_profile", "Meu Perfil")}
            </h1>
            <p className="text-slate-500 dark:text-gray-400 font-medium">
              {user?.email}
            </p>
            <div className="mt-2 flex items-center justify-center md:justify-start gap-2">
              {(() => {
                const displayRole = getPrimaryDisplayRole(userProfile, organization);
                const tagClass = getRoleBadgeStyles(displayRole.badgeVariant);

                return (
                  <span className={`px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wide ${tagClass}`}>
                    {displayRole.label}
                  </span>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile & Address */}
        <div className="lg:col-span-2 space-y-8">
          <form id="profile-form" onSubmit={handleProfileSubmit}>
            <Card padding="none" className="overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/50">
                <h3 className="font-bold text-slate-800 dark:text-white">
                  {t("profile.personal_info", "Informações Pessoais")}
                </h3>
              </div>
              <div className="p-6 md:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label htmlFor="displayName" className={formLabelClass}>
                      {t("profile.display_name", "Nome de Exibição")}
                    </label>
                    <input
                      type="text"
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className={formInputClass}
                      placeholder={t("profile.full_name", "Seu nome completo")}
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="email" className={formLabelClass}>
                      {t("profile.email_immutable", "E-mail (Imutável)")}
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={user?.email || ""}
                      className={`${formInputClass} bg-slate-100 dark:bg-gray-800/80 border-transparent text-slate-500`}
                      disabled
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={formLabelClass}>{t("profile.address", "Endereço")}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      name="street"
                      value={address.street}
                      onChange={handleAddressChange}
                      className={formInputClass}
                      placeholder={t("profile.street", "Rua, Número")}
                    />
                    <input
                      type="text"
                      name="city"
                      value={address.city}
                      onChange={handleAddressChange}
                      className={formInputClass}
                      placeholder={t("profile.city", "Cidade")}
                    />
                    <input
                      type="text"
                      name="state"
                      value={address.state}
                      onChange={handleAddressChange}
                      className={formInputClass}
                      placeholder={t("profile.state", "Estado (UF)")}
                    />
                    <input
                      type="text"
                      name="zip"
                      value={address.zip}
                      onChange={handleAddressChange}
                      className={formInputClass}
                      placeholder={t("profile.zip", "CEP")}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card padding="none" className="mt-8 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/50 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 dark:text-white">
                  {t("profile.specialties", "Especialidades")}
                </h3>
                <span className="text-xs text-primary font-bold bg-primary/10 px-2 py-1 rounded-full uppercase">
                  {t("profile.role_question", "Qual sua função?")}
                </span>
              </div>
              <div className="p-6 md:p-8">
                <div className="space-y-8">
                  {instrumentsByCategory.map(([category, instrumentList]) => (
                    <div key={category as string}>
                      <div className="flex items-center gap-2 mb-4">
                        <span
                          className={`p-1.5 rounded-lg ${category === "Ministro" ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" : category === "Voz" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"}`}
                        >
                          {getCategoryIcon(category as string)}
                        </span>
                        <h4 className="font-bold text-slate-700 dark:text-gray-200">
                          {category === "Ministro" ? t("database.specialty_ministers", "Ministros") : category === "Voz" ? t("database.specialty_vocals", "Vozes") : t("database.specialty_instruments", "Instrumentos")}
                        </h4>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {(instrumentList as Instrument[]).map((inst) => {
                          const isSelected = specialtyIds.includes(inst.id);
                          return (
                            <button
                              key={inst.id}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                handleSpecialtyChange(inst.id);
                              }}
                              className={`
                                                                relative flex items-center justify-center px-4 py-3 rounded-2xl border text-sm font-bold transition-all duration-200 cursor-pointer select-none
                                                                ${
                                                                  isSelected
                                                                    ? "bg-primary border-primary text-white shadow-lg shadow-primary/30 ring-2 ring-primary ring-offset-2 dark:ring-offset-gray-900 scale-105 active:scale-95"
                                                                    : "bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700 hover:border-slate-300 dark:hover:border-gray-600 active:scale-95"
                                                                }
                                                            `}
                            >
                              <span className="truncate">
                                {formatSpecialtyName(inst.name)}
                              </span>
                              {isSelected && (
                                <div className="absolute -top-2 -right-2 bg-white text-primary rounded-full p-0.5 shadow-sm border border-slate-100 animate-scale-in">
                                  <CheckIcon className="w-3 h-3 stroke-[3]" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 dark:bg-gray-900/30 border-t border-slate-100 dark:border-gray-800 flex justify-end items-center gap-4">
                <div className="text-sm font-medium">
                  {profileMessage.text && (
                    <span
                      className={
                        profileMessage.type === "success"
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-500"
                      }
                    >
                      {profileMessage.text}
                    </span>
                  )}
                </div>
                <Button type="submit" disabled={isProfileSaving}>
                  {isProfileSaving ? (
                    <Spinner size="sm" />
                  ) : (
                    t("common.save_changes", "Salvar Alterações")
                  )}
                </Button>
              </div>
            </Card>
          </form>
        </div>

        {/* Right Column: Settings & Danger Zone */}
        <div className="space-y-8">
          {availableOrgs.length > 1 && (
            <Card padding="none" className="overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StoreIcon className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-slate-800 dark:text-white">
                      Alternar Organização
                    </h3>
                  </div>
                </div>
                <div className="p-6">
                   <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
                     Você faz parte de múltiplas organizações. Escolha qual você quer acessar agora:
                   </p>
                   <div className="space-y-2">
                     {availableOrgs.map((org) => (
                        <div key={org.id} onClick={() => handleSwitchOrg(org.id)} className={`p-3 rounded-lg border ${org.id === organization?.id ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer'} flex items-center justify-between transition-colors`}>
                           <div>
                              <p className="font-semibold text-slate-800 dark:text-white">{org.name}</p>
                              <p className="text-xs text-slate-500">{org.role === 'owner' ? 'Dono' : org.role === 'admin' ? 'Administrador' : 'Membro'}</p>
                           </div>
                           {org.id === organization?.id && (
                              <div className="w-3 h-3 rounded-full bg-primary" />
                           )}
                        </div>
                     ))}
                   </div>
                </div>
            </Card>
          )}

          {organization && (
            <Card padding="none" className="overflow-hidden">
              <form onSubmit={handleOrgSubmit}>
                <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StoreIcon className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-slate-800 dark:text-white">
                      {t("profile.my_organization", "Minha Organização")}
                    </h3>
                  </div>
                  {organization.plan === "pro" && (
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full uppercase">
                      PRO
                    </span>
                  )}
                </div>
                <div className="p-6 space-y-6">
                  <div className="space-y-1">
                    <label className={formLabelClass}>
                      {t("profile.org_name", "Nome da Organização")}
                    </label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      disabled={!permissions?.manageOrganization}
                      className={formInputClass}
                      placeholder={t("profile.org_name_placeholder", "Nome da igreja / banda")}
                    />
                  </div>

                  <div className="pt-2">
                    <label className={formLabelClass}>{t("profile.invite_members", "Convidar Membros")}</label>
                    <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
                      {t("profile.invite_members_desc", "Use o fluxo seguro com e-mail e função para convidar uma pessoa.")}
                    </p>

                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full justify-center gap-2 py-3"
                      onClick={() => { window.location.href = '/users?intent=add-member'; }}
                    >
                      <UserPlusIcon className="w-4 h-4" />
                      {t("profile.invite_person", "Convidar pessoa")}
                    </Button>
                  </div>

                  {permissions?.manageOrganization && (
                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        disabled={
                          isOrgSaving ||
                          !orgName.trim() ||
                          orgName === organization.name
                        }
                      >
                        {isOrgSaving ? <Spinner size="sm" /> : t("profile.save_name", "Salvar Nome")}
                      </Button>
                    </div>
                  )}

                  {/* Member List Section */}
                  <div className="border-t border-slate-100 dark:border-gray-800 pt-6">
                    {/* Solicitações Pendentes (Join Requests) */}
                    {canManageMembers && joinRequests.length > 0 && (
                      <div className="mb-6 rounded-xl border border-amber-200 dark:border-amber-900/50 overflow-hidden bg-amber-500/5">
                        <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-900/50 bg-amber-500/10 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          <span className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                            Solicitações de Entrada Pendentes
                          </span>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-gray-800">
                          {joinRequests.map(req => (
                            <div key={req.id} className="p-3 flex items-center justify-between gap-3 bg-white dark:bg-gray-800/20">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 dark:bg-gray-700">
                                  {req.photoURL ? (
                                    <img src={req.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                                      <UserIcon className="w-4 h-4" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-slate-800 dark:text-white leading-tight">
                                    {req.displayName || "Usuário"}
                                  </p>
                                  <p className="text-[10px] text-slate-500 truncate max-w-[150px]">
                                    {req.email || "Sem e-mail"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleProcessJoinRequest(req, true)}
                                  className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                                >
                                  Aceitar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleProcessJoinRequest(req, false)}
                                  className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                                >
                                  Rejeitar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-4">
                      <h4 className={formLabelClass}>
                        {t("profile.team_members", "Membros da Equipe")}
                      </h4>
                      <span className="text-[10px] font-bold bg-slate-100 dark:bg-gray-800 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-widest">
                        {t("dashboard.member_count", "{{count}} membro", { count: allUsers.filter(u => u.organizationId === organization?.id).length })}
                      </span>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2 scrollbar-thin">
                      {allUsers
                        .filter((u) => u.organizationId === organization?.id)
                        .map((member) => {
                          const displayRole = getPrimaryDisplayRole(member, organization);
                          const tagStyleClass = getRoleBadgeStyles(displayRole.badgeVariant);
                          const roleDisplay = displayRole.label;
                          const isSelf = member.uid === user?.uid;

                          return (
                            <div
                              key={member.uid}
                              className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-gray-800/80 border border-slate-100 dark:border-gray-700 transition-all hover:border-primary/30 hover:shadow-md group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-gray-700 border-2 border-white dark:border-gray-800">
                                  {member.photoURL ? (
                                    <img
                                      src={member.photoURL}
                                      alt={member.displayName || ""}
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                                      <UserIcon className="w-5 h-5" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-800 dark:text-white leading-tight flex items-center gap-1 flex-wrap">
                                    <span className="truncate">{member.displayName || t("profile.no_name", "Sem nome")}</span>
                                    {isSelf && (
                                      <span className="text-[10px] text-primary shrink-0">
                                        {t("profile.you_label", "(Você)")}
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium truncate max-w-[150px]">
                                    {member.email}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {canManageMembers && !isSelf ? (
                                  <div className="flex items-center gap-2">
                                    <select
                                      value={member.role || 'viewer'}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => handleUpdateMemberRole(member.uid, e.target.value)}
                                      className="input-base px-2 py-1 h-8 text-xs cursor-pointer select-none shrink-0"
                                    >
                                      <option value="owner">{t("roles.owner", "Dono")}</option>
                                      <option value="admin">{t("roles.admin", "Administrador")}</option>
                                      <option value="leader">{t("roles.leader", "Líder")}</option>
                                      <option value="musician">{t("roles.musician", "Músico")}</option>
                                      <option value="viewer">{t("roles.viewer", "Visualizador")}</option>
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (window.confirm("Deseja realmente remover este usuário da equipe?")) {
                                          handleRemoveMember(member.uid);
                                        }
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors shrink-0"
                                      title="Remover membro"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                      </svg>
                                    </button>
                                  </div>
                                ) : (
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${tagStyleClass}`}>
                                    {roleDisplay}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>

                {orgMessage.text && (
                  <div
                    className={`px-6 py-3 text-center text-xs font-bold uppercase tracking-wider border-t border-slate-100 dark:border-gray-800
                                        ${orgMessage.type === "success" ? "bg-green-50 text-green-600 dark:bg-green-900/10 dark:text-green-400" : "bg-red-50 text-red-600 dark:bg-red-900/10 dark:text-red-400"}
                                    `}
                  >
                    {orgMessage.text}
                  </div>
                )}
              </form>
            </Card>
          )}

          {!organization && isSupportMode && (
            <Card padding="none" className="overflow-hidden border border-amber-500/30">
              <form onSubmit={handleSupportCreateOrg}>
                <div className="px-6 py-4 border-b border-amber-100 dark:border-amber-950 bg-amber-500/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StoreIcon className="w-5 h-5 text-amber-500" />
                    <h3 className="font-bold text-slate-800 dark:text-white">
                      Assistência: Criar Organização
                    </h3>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full">
                    Suporte Modo Ativo
                  </span>
                </div>
                <div className="p-6 space-y-4">
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    O usuário atual (sendo diagnosticado) não possui nenhuma organização ativa. Crie e vincule uma nova abaixo para restabelecer o acesso dele imediatamente.
                  </p>
                  
                  {supportSuccess && (
                    <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                      {supportSuccess}
                    </div>
                  )}

                  {supportError && (
                    <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-lg">
                      {supportError}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className={formLabelClass}>
                      Nome da Organização
                    </label>
                    <input
                      type="text"
                      value={supportNewOrgName}
                      onChange={(e) => setSupportNewOrgName(e.target.value)}
                      className={formInputClass}
                      placeholder="Ex: Igreja Central / Ministério de Louvor"
                      required
                      disabled={supportCreateLoading}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={formLabelClass}>
                      Link do Workspace / Slug (Opcional)
                    </label>
                    <input
                      type="text"
                      value={supportNewOrgSlug}
                      onChange={(e) => setSupportNewOrgSlug(e.target.value)}
                      className={formInputClass}
                      placeholder="Ex: igreja-central"
                      disabled={supportCreateLoading}
                    />
                  </div>

                  <Button type="submit" className="w-full flex justify-center mt-2" disabled={supportCreateLoading}>
                    {supportCreateLoading ? <Spinner size="sm" /> : "Criar & Vincular Organização"}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Card: Idioma e Integridade Global (UX) */}
          <Card padding="none" className="overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-white">
                {t('settings.language') || "Idioma & Integridade UX"}
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400">
                PRO Engine
              </span>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Manual Selection */}
              <div>
                <p className="text-xs font-bold text-slate-400 dark:text-gray-500 uppercase mb-3 tracking-wider">
                  {t('settings.language') || "Selecionar Idioma"}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { code: 'pt', label: t('settings.language_pt') || "Português", flag: "🇧🇷" },
                    { code: 'en', label: t('settings.language_en') || "Inglês", flag: "🇺🇸" },
                    { code: 'es', label: t('settings.language_es') || "Espanhol", flag: "🇪🇸" }
                  ].map((locale) => (
                    <button
                      key={locale.code}
                      type="button"
                      onClick={() => handleLanguageChange(locale.code)}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300 gap-2 ${
                        i18n.language === locale.code
                          ? "bg-primary/5 hover:bg-primary/10 border-primary text-primary dark:text-primary-light shadow-sm"
                          : "bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700 hover:border-slate-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <span className="text-3xl leading-none drop-shadow-sm select-none">{locale.flag}</span>
                      <span className="font-bold text-xs mt-1 uppercase tracking-wider">{locale.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <hr className="border-slate-100 dark:border-gray-800" />

              {/* Integrity Diagnostic Core */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                      {t('diagnostics.title') || "Diagnósticos de Idioma & Sincronia"}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {t('diagnostics.status') || "Varredura automática de integridade global da interface."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs font-bold"
                    onClick={triggerDiagnostics}
                  >
                    {t('diagnostics.check_integrity') || "Verificar Integridade"}
                  </Button>
                </div>

                {diagnosticsResult && (
                  <div className="p-4 bg-slate-50 dark:bg-gray-900/30 rounded-2xl border border-slate-100 dark:border-gray-800/60 text-xs space-y-3 animate-fade-in-up">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Sincronia Estrutural:</span>
                      <span className={`font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${diagnosticsResult.healthy ? 'bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400'}`}>
                        {diagnosticsResult.healthy ? t('diagnostics.healthy') || "Perfeito" : t('diagnostics.warnings') || "Avisos Detectados"}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 py-1 text-center bg-white dark:bg-gray-900/50 p-3 rounded-xl border border-black/[0.02] dark:border-white/[0.02]">
                      <div>
                        <div className="font-black text-slate-700 dark:text-slate-300">{diagnosticsResult.keyCounts.pt}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">PT Keys</div>
                      </div>
                      <div>
                        <div className="font-black text-slate-700 dark:text-slate-300">{diagnosticsResult.keyCounts.en}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">EN Keys</div>
                      </div>
                      <div>
                        <div className="font-black text-slate-700 dark:text-slate-300">{diagnosticsResult.keyCounts.es}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ES Keys</div>
                      </div>
                    </div>

                    {/* Warnings list if any */}
                    {diagnosticsResult.warnings.length > 0 && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-500/5 border border-amber-200/50 dark:border-amber-500/10 rounded-xl space-y-1 text-amber-800 dark:text-amber-400 font-medium max-h-32 overflow-y-auto">
                        {diagnosticsResult.warnings.map((w: string, index: number) => (
                          <div key={index} className="flex gap-1">
                            <span>•</span>
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Runtime Missing translation logger */}
                    <div className="pt-2 border-t border-slate-100 dark:border-gray-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium flex items-center gap-1.5">
                          {t('diagnostics.missing_keys') || "Traduções ausentes registradas na sessão:"}
                        </span>
                        {missingRuntimeKeys.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearMissing}
                            className="text-red-500 hover:text-red-600 font-bold text-[10px] uppercase tracking-wider"
                          >
                            {t("diagnostics.clear_history", "Limpar Histórico")}
                          </button>
                        )}
                      </div>
                      
                      {missingRuntimeKeys.length === 0 ? (
                        <div className="p-3 text-center text-slate-400 font-medium italic bg-white dark:bg-gray-900/30 rounded-xl border border-black/[0.01]">
                          {t("diagnostics.no_missing_keys", "Nenhuma tradução ausente detectada nesta sessão. Interface perfeitamente íntegra!")}
                        </div>
                      ) : (
                        <div className="p-3 bg-red-50 dark:bg-red-500/5 border border-red-200/40 dark:border-red-500/10 rounded-xl space-y-1 font-mono text-[10px] text-red-600 dark:text-red-400 max-h-36 overflow-y-auto block w-full text-left">
                          {missingRuntimeKeys.map((k) => (
                            <div key={k} className="flex justify-between items-center bg-white dark:bg-slate-900/50 p-1 px-2 rounded-lg border border-red-200/20 mb-1">
                              <span>{k}</span>
                              <span className="text-[8px] bg-red-100 text-red-800 dark:bg-red-500/20 px-1 py-0.5 rounded font-sans uppercase">{t("common.attention", "Atenção")}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          <form id="password-form" onSubmit={handlePasswordSubmit}>
            <Card padding="none" className="overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/50">
                <h3 className="font-bold text-slate-800 dark:text-white">
                  {t("profile.security", "Segurança")}
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label htmlFor="current" className={formLabelClass}>
                    {t("profile.current_password", "Senha Atual")}
                  </label>
                  <input
                    type="password"
                    id="current"
                    value={passwords.current}
                    onChange={(e) =>
                      setPasswords((p) => ({ ...p, current: e.target.value }))
                    }
                    className={formInputClass}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="newPass" className={formLabelClass}>
                    {t("profile.new_password", "Nova Senha")}
                  </label>
                  <input
                    type="password"
                    id="newPass"
                    value={passwords.newPass}
                    onChange={(e) =>
                      setPasswords((p) => ({ ...p, newPass: e.target.value }))
                    }
                    className={formInputClass}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="confirmPass" className={formLabelClass}>
                    {t("profile.confirm_password", "Confirmar Senha")}
                  </label>
                  <input
                    type="password"
                    id="confirmPass"
                    value={passwords.confirmPass}
                    onChange={(e) =>
                      setPasswords((p) => ({
                        ...p,
                        confirmPass: e.target.value,
                      }))
                    }
                    className={formInputClass}
                    required
                  />
                </div>

                {passwordMessage.text && (
                  <p
                    className={`text-sm font-medium ${passwordMessage.type === "success" ? "text-green-600" : "text-red-500"}`}
                  >
                    {passwordMessage.text}
                  </p>
                )}

                <Button
                  type="submit"
                  variant="secondary"
                  disabled={isPasswordSaving}
                  className="w-full mt-2"
                >
                  {isPasswordSaving ? <Spinner size="sm" /> : t("profile.change_password", "Alterar Senha")}
                </Button>
              </div>
            </Card>
          </form>

          <Card className="border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400">
                <AlertTriangleIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-red-700 dark:text-red-400">
                  {t("profile.danger_zone", "Zona de Perigo")}
                </h3>
                <p className="mt-1 text-xs text-red-600/80 dark:text-red-400/70 mb-3">
                  {t("profile.danger_zone_desc", "A exclusão da conta é permanente. Todos os dados serão perdidos.")}
                </p>
                <button
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="text-sm font-bold text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline"
                >
                  {t("profile.delete_account", "Excluir minha conta")}
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleAccountDeletion}
        isLoading={isDeleting}
        error={deleteError}
      />
    </div>
  );
};

export default ProfilePage;
