import React, { useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, Loader2, Mail, MessageCircle, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import Modal from "../common/Modal";
import type { Role } from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import { isGlobalPrivilegedUser } from "../../hooks/useEcosystemAdmin";

type InviteMode = "email" | "link";
type OrganizationInviteRole = "admin" | "manager" | "member" | "viewer";

interface CanonicalHubInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  musicScaleRole?: Role | null;
}

interface CreatedInvite {
  id: string;
  url: string;
  mode: InviteMode;
}

const roleOrder: OrganizationInviteRole[] = ["admin", "manager", "member", "viewer"];

export const CanonicalHubInviteModal: React.FC<CanonicalHubInviteModalProps> = ({
  isOpen,
  onClose,
  musicScaleRole = null,
}) => {
  const { t } = useTranslation();
  const {
    user: currentUser,
    userProfile,
    organization,
    isOwner: canonicalIsOwner,
    isAdmin: canonicalIsAdmin,
    isGlobalAdmin,
    permissions,
  } = useAuth();
  const [inviteMode, setInviteMode] = useState<InviteMode>("email");
  const [email, setEmail] = useState("");
  const [organizationRole, setOrganizationRole] = useState<OrganizationInviteRole>("member");
  const [createdInvite, setCreatedInvite] = useState<CreatedInvite | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeOrganizationId =
    userProfile?.activeOrganizationId ||
    userProfile?.primaryOrganizationId ||
    userProfile?.organizationId;

  const inviteableRoles = useMemo<OrganizationInviteRole[]>(() => {
    const isGlobal = isGlobalAdmin || isGlobalPrivilegedUser(currentUser, userProfile);
    const ownerUserId =
      (organization as any)?.ownerUserId ||
      (organization as any)?.ownerUid ||
      (organization as any)?.ownerId;
    const isOwner = canonicalIsOwner || (!!currentUser?.uid && ownerUserId === currentUser.uid);
    const actorRole = String((userProfile as any)?.organizationRole || "").trim().toLowerCase();

    if (isGlobal || isOwner || actorRole === "owner") return [...roleOrder];
    if (canonicalIsAdmin || actorRole === "admin") return ["manager", "member", "viewer"];
    if (actorRole === "manager" || actorRole === "secretary") return ["member", "viewer"];
    // If the canonical context grants member management but an older profile does
    // not expose its organization role yet, fail to the least-privileged invite set.
    if (permissions?.manageMembers) return ["member", "viewer"];
    return [];
  }, [
    canonicalIsAdmin,
    canonicalIsOwner,
    currentUser,
    isGlobalAdmin,
    organization,
    permissions?.manageMembers,
    userProfile,
  ]);

  useEffect(() => {
    if (!isOpen) {
      setInviteMode("email");
      setEmail("");
      setOrganizationRole("member");
      setCreatedInvite(null);
      setIsLoading(false);
      setCopied(false);
      setError("");
      setSuccess("");
      return;
    }

    if (!inviteableRoles.includes(organizationRole)) {
      setOrganizationRole(inviteableRoles.includes("member") ? "member" : inviteableRoles[0] || "member");
    }
  }, [isOpen, inviteableRoles, organizationRole]);

  const roleLabel = (role: OrganizationInviteRole) => {
    if (role === "admin") return t("users.invite.role_admin", "Administrador");
    if (role === "manager") return t("users.invite.role_manager", "Gestor");
    if (role === "member") return t("users.invite.role_member", "Membro");
    return t("users.invite.role_viewer", "Visualizador");
  };

  const roleDescription = (role: OrganizationInviteRole) => {
    if (role === "admin") {
      return t(
        "users.invite.role_admin_desc",
        "Pode gerenciar configurações, integrantes, convites e funções da organização. Não controla cobrança ou propriedade.",
      );
    }
    if (role === "manager") {
      return t(
        "users.invite.role_manager_desc",
        "Pode organizar a equipe e convidar membros, sem acesso a cobrança, aplicativos ou propriedade.",
      );
    }
    if (role === "member") {
      return t(
        "users.invite.role_member_desc",
        "Participa da organização e usa os aplicativos que forem liberados para ele.",
      );
    }
    return t(
      "users.invite.role_viewer_desc",
      "Pode consultar informações liberadas, sem fazer alterações.",
    );
  };

  const resetCreatedInvite = () => {
    setCreatedInvite(null);
    setCopied(false);
    setError("");
    setSuccess("");
  };

  const mapError = (code: string) => {
    if (code === "MEMBER_LIMIT_REACHED") return t("users.invite.member_limit", "O limite de usuários do plano foi atingido.");
    if (code === "MEMBER_LIMIT_UNAVAILABLE" || code === "MEMBER_LIMIT_INVALID") {
      return t("users.invite.member_limit_unavailable", "Não foi possível confirmar o limite de usuários da organização. Tente novamente em instantes.");
    }
    if (code === "INVITE_ALREADY_PENDING") return t("users.invite.already_pending", "Já existe um convite pendente para este e-mail.");
    if (
      code === "PERMISSION_DENIED" ||
      code === "FORBIDDEN" ||
      code === "ACTOR_MEMBERSHIP_REQUIRED" ||
      code === "ACTOR_MEMBERSHIP_INACTIVE" ||
      code === "ACTOR_MEMBERSHIP_STATE_INCONSISTENT"
    ) {
      return t("users.invite.permission_denied", "Você não tem permissão para criar este convite.");
    }
    if (code === "ORGANIZATION_INACTIVE" || code === "ORGANIZATION_STATE_INCONSISTENT") {
      return t("users.invite.organization_unavailable", "A organização não está disponível para novos convites agora.");
    }
    if (code === "INVALID_EMAIL" || code === "INVALID_INVITE_EMAIL") return t("users.invite.invalid_email", "Informe um e-mail válido.");
    if (code === "INVALID_INVITE_ROLE") return t("users.invite.invalid_role", "Esse nível de acesso não pode ser usado neste convite.");
    if (code === "HUB_UNAVAILABLE" || code === "HUB_NOT_CONFIGURED" || code === "INTERNAL_ERROR") {
      return t("users.invite.hub_unavailable", "O MillionsNest está temporariamente indisponível. Tente novamente.");
    }
    return t("users.invite.create_error", "Não foi possível criar o convite. Tente novamente.");
  };

  const createInvite = async (): Promise<CreatedInvite | null> => {
    if (createdInvite) return createdInvite;
    if (!currentUser || !activeOrganizationId) {
      setError(t("users.invite.no_org", "Nenhuma organização ativa encontrada."));
      return null;
    }
    if (!inviteableRoles.includes(organizationRole)) {
      setError(t("users.invite.permission_denied", "Você não tem permissão para criar este convite."));
      return null;
    }
    if (inviteMode === "email" && !email.trim()) {
      setError(t("users.invite.email_required", "Informe o e-mail da pessoa."));
      return null;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch("/api/orgs/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          organizationId: activeOrganizationId,
          mode: inviteMode,
          organizationRole,
          ...(inviteMode === "email" ? { email: email.trim() } : {}),
          ...(musicScaleRole?.id ? { roleId: musicScaleRole.id } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success !== true) {
        throw new Error(data?.reasonCode || data?.error || "INVITE_CREATE_FAILED");
      }

      const url = typeof data.inviteUrl === "string" ? data.inviteUrl : "";
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        throw new Error("INVALID_HUB_RESPONSE");
      }
      if (
        !data?.invitation?.id ||
        data?.invitation?.targetAppId !== "musicscale" ||
        parsedUrl.protocol !== "https:" ||
        parsedUrl.hostname !== "musicscale.millionsnest.com" ||
        !parsedUrl.pathname.startsWith("/join/") ||
        !parsedUrl.searchParams.get("token")
      ) {
        throw new Error("INVALID_HUB_RESPONSE");
      }

      const invite: CreatedInvite = {
        id: data.invitation.id,
        url: parsedUrl.toString(),
        mode: inviteMode,
      };
      setCreatedInvite(invite);

      if (inviteMode === "link") {
        setSuccess(
          data.musicScaleRoleBound
            ? t(
                "users.invite.link_created_role_bound",
                "Link criado! O nível de acesso e a função musical escolhidos serão aplicados automaticamente ao aceitar o convite.",
              )
            : t("users.invite.link_created", "Link de uso único criado. Ele expira em 7 dias."),
        );
      }

      return invite;
    } catch (err: any) {
      const reasonCode = String(err?.message || "");
      console.error("[CanonicalHubInviteModal] invitation creation failed", { reasonCode, inviteMode, organizationRole });
      setError(mapError(reasonCode));
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const sendByEmail = async () => {
    const invite = await createInvite();
    if (!invite || !currentUser || !activeOrganizationId) return;

    setIsLoading(true);
    setError("");
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch("/api/orgs/invite/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          organizationId: activeOrganizationId,
          invitationId: invite.id,
          inviteUrl: invite.url,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success !== true) {
        setSuccess(
          t(
            "users.invite.email_fallback",
            "O convite foi criado, mas o envio automático não ficou disponível. Copie o link abaixo para enviar manualmente.",
          ),
        );
        return;
      }
      setSuccess(
        musicScaleRole
          ? t(
              "users.invite.email_sent_with_role",
              "Convite enviado. Ao aceitar com este e-mail, a pessoa também será adicionada à função {{role}} no MusicScale.",
              { role: musicScaleRole.name },
            )
          : t("users.invite.email_sent", "Convite enviado por e-mail."),
      );
    } catch {
      setSuccess(
        t(
          "users.invite.email_fallback",
          "O convite foi criado, mas o envio automático não ficou disponível. Copie o link abaixo para enviar manualmente.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const copyInvite = async () => {
    const invite = await createInvite();
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      setSuccess(t("users.invite.link_copied", "Link copiado."));
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(t("users.invite.copy_error", "Não foi possível copiar automaticamente. Selecione o link e copie manualmente."));
    }
  };

  const shareWhatsApp = async () => {
    const popup = window.open("about:blank", "_blank");
    const invite = await createInvite();
    if (!invite) {
      popup?.close();
      return;
    }
    const organizationName = (organization as any)?.name || t("users.invite.organization_fallback", "sua organização");
    const message = encodeURIComponent(
      t(
        "users.invite.whatsapp_message",
        "Você foi convidado para participar da equipe {{organization}} no MusicScale.\n\nEntre e aceite o convite: {{url}}",
        { organization: organizationName, url: invite.url },
      ),
    );
    if (popup) popup.location.href = `https://wa.me/?text=${message}`;
    else window.location.href = `https://wa.me/?text=${message}`;
  };

  const nativeShare = async () => {
    if (typeof navigator.share !== "function") return copyInvite();
    const invite = await createInvite();
    if (!invite) return;
    try {
      await navigator.share({
        title: t("users.invite.share_title", "Convite MusicScale"),
        text: t("users.invite.share_text", "Você recebeu um convite para participar de uma organização no MusicScale."),
        url: invite.url,
      });
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError(t("users.invite.share_error", "Não foi possível abrir o compartilhamento."));
      }
    }
  };

  const title = t("users.invite.title", "Convidar para {{organization}}", {
    organization: (organization as any)?.name || t("users.invite.organization", "organização"),
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-6">
        <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
          {t(
            "users.invite.subtitle",
            "Informe quem vai entrar, escolha o acesso e envie o convite pelo canal que preferir.",
          )}
        </p>

        {error && (
          <div aria-live="polite" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        {success && !error && (
          <div aria-live="polite" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            {success}
          </div>
        )}

        {inviteableRoles.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
            <p className="font-semibold text-white">{t("users.invite.access_denied", "Acesso não permitido")}</p>
            <p className="mt-2 text-sm text-slate-400">
              {t(
                "users.invite.access_denied_desc",
                "Os convites da organização são administrados pelo MillionsNest e exigem permissão de proprietário, administrador ou gestor.",
              )}
            </p>
          </div>
        ) : (
          <>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-400">
                {t("users.invite.method_label", "Como deseja convidar?")}
              </label>
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/20 p-1">
                <button
                  type="button"
                  disabled={isLoading || !!createdInvite}
                  onClick={() => {
                    setInviteMode("email");
                    resetCreatedInvite();
                  }}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 ${inviteMode === "email" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  <Mail className="h-4 w-4" />
                  {t("users.invite.method_email", "Por e-mail")}
                </button>
                <button
                  type="button"
                  disabled={isLoading || !!createdInvite}
                  onClick={() => {
                    setInviteMode("link");
                    resetCreatedInvite();
                  }}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 ${inviteMode === "link" ? "bg-primary/15 text-primary" : "text-slate-400 hover:text-white"}`}
                >
                  <Link2 className="h-4 w-4" />
                  {t("users.invite.method_link", "Por link")}
                </button>
              </div>
              {inviteMode === "link" && (
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {t(
                    "users.invite.link_hint",
                    "Selecione a função e gere um link de uso único. A pessoa que usar o link entrará automaticamente com esse nível de acesso. O link expira em 7 dias.",
                  )}
                </p>
              )}
            </div>

            {inviteMode === "email" && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-400">
                  {t("users.invite.email_label", "E-mail da pessoa")}
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  disabled={isLoading || !!createdInvite}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError("");
                  }}
                  placeholder={t("users.invite.email_placeholder", "email@exemplo.com")}
                  className="input-base"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {t(
                    "users.invite.email_hint",
                    "Use o e-mail que a pessoa usará para entrar. O convite ficará protegido para essa conta.",
                  )}
                </p>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-400">
                {t("users.invite.role_label", "Qual será o nível de acesso desta pessoa?")}
              </label>
              <div className="space-y-2">
                {inviteableRoles.map((role) => {
                  const selected = role === organizationRole;
                  return (
                    <button
                      key={role}
                      type="button"
                      disabled={isLoading || !!createdInvite}
                      onClick={() => {
                        setOrganizationRole(role);
                        setError("");
                      }}
                      className={`w-full rounded-xl border p-4 text-left transition-all disabled:opacity-50 ${selected ? "border-primary bg-primary/10" : "border-white/10 bg-black/20 hover:border-white/20"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className={`font-semibold ${selected ? "text-primary" : "text-white"}`}>{roleLabel(role)}</span>
                        {selected && <Check className="h-5 w-5 text-primary" />}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{roleDescription(role)}</p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                <h4 className="text-sm font-semibold text-white">
                  {t("users.invite.musicscale_role_title", "Função no MusicScale")}
                </h4>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {musicScaleRole
                    ? inviteMode === "email"
                      ? t(
                          "users.invite.musicscale_role_email",
                          "Este convite também está ligado à função {{role}}. Ela será aplicada no MusicScale quando a pessoa aceitar usando este e-mail.",
                          { role: musicScaleRole.name },
                        )
                      : t(
                          "users.invite.musicscale_role_link",
                          "O convite registra o nível de acesso e a função {{role}}. Ambos serão aplicados automaticamente quando a pessoa aceitar.",
                          { role: musicScaleRole.name },
                        )
                    : t(
                        "users.invite.musicscale_role_default",
                        "Líder, Ministro, Músico, Vocal e outras funções são definidas dentro do MusicScale depois que a pessoa entrar.",
                      )}
                </p>
              </div>
            </div>

            {createdInvite && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-400">
                  {t("users.invite.link_label", "Link do convite")}
                </label>
                <input
                  type="text"
                  readOnly
                  value={createdInvite.url}
                  onClick={(event) => event.currentTarget.select()}
                  className="input-base text-xs"
                />
              </div>
            )}

            {inviteMode === "link" && !createdInvite && (
              <button
                type="button"
                onClick={() => void createInvite()}
                disabled={isLoading}
                className="premium-interactive flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Link2 className="h-5 w-5" />}
                {t("users.invite.generate_link", "Gerar link desta função")}
              </button>
            )}

            {(inviteMode === "email" || createdInvite) && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-400">
                  {t("users.invite.share_label", "Como deseja enviar?")}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {inviteMode === "email" && (
                    <button
                      type="button"
                      onClick={() => void sendByEmail()}
                      disabled={isLoading}
                      className="premium-interactive flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 p-4 text-primary disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Mail className="h-6 w-6" />}
                      <span className="text-sm font-semibold">{t("users.invite.send_email", "Enviar por e-mail")}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void shareWhatsApp()}
                    disabled={isLoading}
                    className="premium-interactive flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-400 disabled:opacity-50"
                  >
                    <MessageCircle className="h-6 w-6" />
                    <span className="text-sm font-semibold">{t("users.invite.whatsapp", "Enviar pelo WhatsApp")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyInvite()}
                    disabled={isLoading}
                    className="premium-interactive flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-white disabled:opacity-50"
                  >
                    {copied ? <Check className="h-6 w-6 text-emerald-400" /> : <Copy className="h-6 w-6" />}
                    <span className="text-sm font-semibold">
                      {copied ? t("users.invite.copied", "Link copiado") : t("users.invite.copy", "Copiar link")}
                    </span>
                  </button>
                  {typeof navigator.share === "function" && (
                    <button
                      type="button"
                      onClick={() => void nativeShare()}
                      disabled={isLoading}
                      className="premium-interactive flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-white disabled:opacity-50"
                    >
                      <Share2 className="h-6 w-6" />
                      <span className="text-sm font-semibold">{t("users.invite.share", "Compartilhar")}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default CanonicalHubInviteModal;
