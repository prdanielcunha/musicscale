import { logger } from "../lib/logger";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../services/firebase";
import {
  collection,
  doc,
  setDoc,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import Spinner from "../components/common/Spinner";
import {
  seedDefaultRolesForOrg,
  seedDefaultInstrumentsForOrg,
  seedDefaultTagsForOrg,
  seedDefaultEventTypesForOrg,
  seedDefaultLocationsForOrg
} from "../services/firestoreService";
import { ArrowRight, SparklesIcon } from "lucide-react";

const TenantOnboarding: React.FC = () => {
  const { user, userProfile, organization, subscription, refreshAuthData, isSupportMode } = useAuth();
  const navigate = useNavigate();

  // If support mode is active, prevent onboarding screen display
  useEffect(() => {
    if (isSupportMode) {
      logger.debug("[TenantOnboarding] Support mode active, redirecting away from onboarding.");
      navigate("/");
    }
  }, [isSupportMode, navigate]);

  // Evaluate Subscription Status
  const hasActiveSub = subscription?.status === "active" || subscription?.status === "trialing" || subscription?.status === "trial" || subscription?.status === "pro";
  const needsProfileCompletion = organization?.onboardingState === "pending_profile";

  // If organization is already complete, don't show onboarding
  useEffect(() => {
    if (organization && organization.slug && !needsProfileCompletion) {
      logger.debug(
        "[TenantOnboarding] Organization already complete, redirecting to home.",
      );
      navigate("/");
    }
  }, [organization, needsProfileCompletion, navigate]);

  const [loading, setLoading] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [slug, setSlug] = useState("");
  const [joinEmail, setJoinEmail] = useState("");
  
  // Default mode depends on subscription status
  const [mode, setMode] = useState<"select" | "create" | "join" | "premium_join">(hasActiveSub ? "create" : "premium_join");

  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const slugTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (slugTimeoutRef.current) clearTimeout(slugTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (organization && (!organization.slug || needsProfileCompletion)) {
      setMode("create");

      const existingName = organization.name === "My Workspace"
        ? ""
        : (organization.name || "");

      setOrgName(existingName);
      setCity(organization.city || "");
      setState(organization.state || "");

      if (existingName) {
        const generated = generateSlug(existingName);
        setSlug(generated);
        void checkSlugAvailability(generated);
      } else {
        setSlug("");
        setSlugAvailable(null);
      }
    } else if (!hasActiveSub && !organization) {
      setMode("premium_join");
    } else if (hasActiveSub && !organization) {
      setMode("create");
    }
  }, [organization, hasActiveSub, needsProfileCompletion]);

  const checkSlugAvailability = async (currentSlug: string) => {
    if (!currentSlug) {
      setSlugAvailable(null);
      return;
    }
    setSlugChecking(true);
    try {
      const response = await fetch(`/api/orgs/check-slug?slug=${currentSlug}`);
      const data = await response.json();
      setSlugAvailable(data.available);
    } catch (e) {
      logger.error(e);
      setSlugAvailable(null);
    } finally {
      setSlugChecking(false);
    }
  };

  if (!user || !userProfile) return null;

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  };

  const scheduleSlugAvailabilityCheck = (value: string) => {
    if (slugTimeoutRef.current) clearTimeout(slugTimeoutRef.current);
    if (!value) {
      setSlugAvailable(null);
      setSlugChecking(false);
      return;
    }
    slugTimeoutRef.current = setTimeout(() => {
      void checkSlugAvailability(value);
    }, 400);
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(val);
    scheduleSlugAvailabilityCheck(val);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setOrgName(newName);
    const autoSlug = generateSlug(newName);
    setSlug(autoSlug);
    scheduleSlugAvailabilityCheck(autoSlug);
  };

  const handleCreateOrg = async () => {
    if (!orgName.trim() || !slug.trim()) return;
    setLoading(true);
    try {
      const isUpdate = !!organization && !!organization.id;
      const endpoint = isUpdate ? "/api/orgs/update" : "/api/orgs/create";
      logger.debug(`[TenantOnboarding] using endpoint ${endpoint}`);
      
      const idToken = await user.getIdToken();

      const payload: any = {
        userId: user.uid,
        organizationName: orgName,
        city,
        state,
        slug,
      };

      if (isUpdate) {
        payload.organizationId = organization.id;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify(payload),
      });

      const textData = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(textData);
      } catch (err) {
        logger.error("Failed to parse JSON response:", textData);
        throw new Error(
          `Resposta inválida do servidor: ${textData.substring(0, 100)}`,
        );
      }

      if (!response.ok)
        throw new Error(data.error || "Erro ao configurar organização");

      // Always ensure roles are seeded for this org
      const orgId = organization?.id || data.organization_id;
      await seedDefaultRolesForOrg(userProfile, orgId);
      await seedDefaultInstrumentsForOrg(userProfile, orgId);
      await seedDefaultTagsForOrg(userProfile, orgId);
      await seedDefaultEventTypesForOrg(userProfile, orgId);
      await seedDefaultLocationsForOrg(userProfile, orgId);

      if (isUpdate) {
        logger.debug(
          "[TenantOnboarding] Onboarding completed (profile updated).",
        );
      }

      await refreshAuthData();
    } catch (e: any) {
      logger.error("ONBOARDING ERROR STACK:", e.stack);
      logger.error("ONBOARDING ERROR MESSAGE:", e.message);
      alert(
        `Erro: ${e.message || "Erro ao configurar organização."}\n\nSe o erro persistir, tire um print dessa tela.`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleJoinOrg = async () => {
    if (!joinEmail.trim())
      return alert("Digite o e-mail do dono da organização.");
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/orgs/join", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          ownerEmail: joinEmail,
        }),
      });

      const textData = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(textData);
      } catch (err) {
        throw new Error(
          `Resposta inválida do servidor: ${textData.substring(0, 100)}`,
        );
      }

      if (!response.ok)
        throw new Error(data.error || "Erro ao entrar na organização");

      alert(data.message || "Solicitação enviada com sucesso!");
      setJoinEmail("");
    } catch (e: any) {
      logger.error(e);
      alert(e.message || "Erro ao entrar na organização.");
    } finally {
      setLoading(false);
    }
  };

  if (mode === "premium_join") {
    return (
      <div className="min-h-screen bg-[#0A0A0E] flex flex-col items-center justify-center p-4 sm:p-6 text-center overflow-hidden relative">
        <div className="absolute inset-0 z-0 pointer-events-none mix-blend-screen">
          <div className="absolute -top-[20%] right-[-10%] w-[60%] h-[100%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/20 via-indigo-900/10 to-transparent md:blur-[100px] blur-[25px]"></div>
          <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[100%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-600/10 via-transparent to-transparent md:blur-[100px] blur-[25px]"></div>
        </div>
        <div className="absolute inset-x-0 inset-y-0 z-0 bg-transparent pointer-events-none"></div>

        <div className="max-w-[460px] w-full relative z-10 transition-all">
          <div className="w-16 h-16 bg-gradient-to-br from-[#1c1c1e] to-[#0A0A0E] border border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <svg
              className="w-8 h-8 text-white/80"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold mb-3 text-white tracking-tight">
            Bem-vindo ao MusicScale
          </h2>
          <p className="text-slate-400 font-medium mb-10 text-[15px] leading-relaxed px-4">
            Você ainda não possui uma assinatura ou vínculo com uma equipe. Escolha como deseja continuar:
          </p>

          <div className="flex flex-col gap-6 text-left">
            {/* Join Existing Org Box */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-6 sm:p-8 rounded-[24px] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[40px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <h3 className="text-[17px] font-bold text-white mb-2 relative z-10">Já faz parte de uma equipe?</h3>
                <p className="text-[13px] text-slate-400 mb-5 relative z-10 leading-relaxed">
                  Insira o e-mail do administrador para solicitar o vínculo à organização.
                </p>
                <div className="relative z-10 space-y-3">
                  <input
                    type="email"
                    className="w-full px-5 py-[16px] bg-[#0A0A0E] border border-white/10 focus:border-blue-500/50 rounded-2xl outline-none transition-all text-white placeholder-slate-600 text-[14px]"
                    placeholder="email@do-administrador.com"
                    value={joinEmail}
                    onChange={(e) => setJoinEmail(e.target.value)}
                  />
                  <Button
                    onClick={handleJoinOrg}
                    disabled={loading || !joinEmail.trim()}
                    className="w-full h-[52px] bg-white text-black hover:bg-white/90 rounded-2xl font-bold text-[14px] shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all"
                  >
                    {loading ? <Spinner size="sm" /> : "Solicitar Vínculo"}
                  </Button>
                </div>
            </div>

            {/* Premium Create Org Box */}
            <div className="bg-gradient-to-b from-[#1c1c24] to-[#121215] border border-white/[0.08] p-6 sm:p-8 rounded-[24px] shadow-2xl relative overflow-hidden group hover:border-blue-500/30 transition-all duration-500">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-4 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px] font-bold tracking-[0.1em] uppercase backdrop-blur-md relative z-10">
                  <SparklesIcon className="w-3 h-3 text-blue-400" />
                  Premium
                </div>
                <h3 className="text-[17px] font-bold text-white mb-2 relative z-10 tracking-tight">Quer criar sua própria organização e acervo?</h3>
                <p className="text-[13px] text-slate-400 mb-6 relative z-10 leading-relaxed">
                  Assine para desbloquear a Biblioteca Viva e gerenciar sua própria equipe de louvor com excelência.
                </p>
                <div className="relative z-10">
                  <Button
                    onClick={() => window.location.href = "https://millionsnest.com/dashboard/musicscale/plans"}
                    variant="primary"
                    className="w-full h-[52px] rounded-2xl font-bold text-[14px] shadow-[0_0_20px_rgba(59,130,246,0.15)] group-hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] transition-all gap-2"
                  >
                    Comprar Assinatura
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#FBFBFD] dark:bg-black p-6 font-sans">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-blue-100/50 dark:bg-blue-900/10 md:blur-[120px] blur-[25px]"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-purple-100/50 dark:bg-purple-900/10 md:blur-[120px] blur-[25px]"></div>
      </div>

      <Card className="w-full max-w-[480px] p-10 relative z-10 bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-3xl border border-[#F2F2F7] dark:border-[#2C2C2E] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.08)] rounded-[32px]">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-4 bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-2xl mb-6">
            <svg
              className="w-8 h-8 text-[#007AFF]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-[#1D1D1F] dark:text-white tracking-tight mb-2">
            {organization && (!organization.slug || needsProfileCompletion)
              ? "Complete seu Cadastro"
              : "Configure sua Igreja"}
          </h1>
          <p className="text-[#86868B] font-medium">
            {organization && (!organization.slug || needsProfileCompletion)
              ? "Informe os dados da sua igreja para preparar o MusicScale."
              : "Crie ou conecte-se a uma organização MusicScale."}
          </p>
        </div>

        {mode === "select" && (
          <div className="space-y-4">
            <Button
              onClick={() => setMode("create")}
              size="lg"
              className="w-full text-[17px]"
              leftIcon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              }
            >
              Criar Nova Organização
            </Button>
            <Button
              onClick={() => setMode("join")}
              variant="secondary"
              size="lg"
              className="w-full text-[17px]"
              leftIcon={
                <svg
                  className="w-5 h-5 opacity-60"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              }
            >
              Vincular-se a uma Existente
            </Button>
          </div>
        )}

        {mode === "create" && (
          <div className="space-y-6">
            {/* Status da Assinatura MillionsNest */}
            <div className="p-4 rounded-2xl bg-[#F2F2F7] dark:bg-[#2C2C2E]/40 border border-slate-200/50 dark:border-white/5 flex items-center justify-between text-xs transition-all">
              <span className="font-semibold text-slate-500 dark:text-zinc-400">Assinatura MillionsNest:</span>
              {hasActiveSub ? (
                <span className="px-2.5 py-1 rounded-full text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                  Ativa ({subscription?.plan || 'Starter/Pro'})
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-amber-600 dark:text-amber-400 bg-amber-500/10 font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse"></span>
                  Nenhuma assinatura ativa
                </span>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-[13px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] px-1">
                Nome da Organização
              </label>
              <input
                type="text"
                className="w-full px-5 py-[18px] bg-[#F5F5F7] dark:bg-[#2C2C2E] border-2 border-transparent focus:border-[#007AFF] rounded-[18px] outline-none transition-all text-[#1D1D1F] dark:text-white placeholder-[#86868B]"
                placeholder="Ex: Igreja Central / Banda Viva"
                value={orgName}
                onChange={handleNameChange}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="block text-[13px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Link do Workspace (Slug)
                </label>
                <span className="text-[11px] font-bold text-[#007AFF] tracking-wider uppercase">
                  Editável
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  className="w-full pl-5 pr-5 py-[18px] bg-[#F5F5F7] dark:bg-[#2C2C2E] border-2 border-transparent focus:border-[#007AFF] rounded-[18px] outline-none transition-all text-[#1D1D1F] dark:text-white"
                  value={slug}
                  onChange={handleSlugChange}
                />
                {slug && slugChecking ? (
                  <p className="text-[11px] text-[#86868B] mt-2 px-1">
                    Verificando disponibilidade...
                  </p>
                ) : slug && slugAvailable === false ? (
                  <p className="text-[11px] text-red-500 mt-2 px-1 font-semibold">
                    Esse link já está em uso, tente outro.
                  </p>
                ) : (
                  <p className="text-[11px] text-[#86868B] mt-2 px-1">
                    Seu acesso será: musicscale.millionsnest.com/
                    <span className="text-[#007AFF] font-bold">
                      {slug || "..."}
                    </span>
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[13px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] px-1">
                  Cidade
                </label>
                <input
                  type="text"
                  className="w-full px-5 py-[18px] bg-[#F5F5F7] dark:bg-[#2C2C2E] border-2 border-transparent focus:border-[#007AFF] rounded-[18px] outline-none transition-all text-[#1D1D1F] dark:text-white"
                  placeholder="Ex: São Paulo"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[13px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] px-1">
                  Estado
                </label>
                <input
                  type="text"
                  className="w-full px-5 py-[18px] bg-[#F5F5F7] dark:bg-[#2C2C2E] border-2 border-transparent focus:border-[#007AFF] rounded-[18px] outline-none transition-all text-[#1D1D1F] dark:text-white"
                  placeholder="UF"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  maxLength={2}
                />
              </div>
            </div>

            <div className="pt-4 space-y-4">
              <Button
                onClick={handleCreateOrg}
                disabled={loading || !orgName.trim() || !slug.trim() || slugChecking || slugAvailable === false}
                size="lg"
                className="w-full h-16 text-lg"
              >
                {loading ? (
                  <Spinner size="sm" />
                ) : organization && (!organization.slug || needsProfileCompletion) ? (
                  "Salvar Configuração"
                ) : (
                  "Começar Agora"
                )}
              </Button>
              {(!organization || (organization.slug && !needsProfileCompletion)) && (
                <button
                  onClick={() => setMode("select")}
                  className="w-full py-2 text-[15px] font-semibold text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white transition-colors"
                >
                  Voltar
                </button>
              )}
            </div>
          </div>
        )}

        {mode === "join" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[13px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] px-1">
                Email do Proprietário
              </label>
              <p className="text-[13px] text-[#86868B] px-1 mb-4">
                Insira o e-mail de quem criou a organização para solicitar
                acesso.
              </p>
              <input
                type="email"
                className="w-full px-5 py-[18px] bg-[#F5F5F7] dark:bg-[#2C2C2E] border-2 border-transparent focus:border-[#007AFF] rounded-[18px] outline-none transition-all text-[#1D1D1F] dark:text-white"
                placeholder="email@exemplo.com"
                value={joinEmail}
                onChange={(e) => setJoinEmail(e.target.value)}
              />
            </div>
            <div className="pt-4 space-y-4">
              <Button
                onClick={handleJoinOrg}
                disabled={loading}
                size="lg"
                className="w-full h-16 text-lg"
              >
                {loading ? <Spinner size="sm" /> : "Solicitar Vínculo"}
              </Button>
              <button
                onClick={() => setMode("select")}
                className="w-full py-2 text-[15px] font-semibold text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default TenantOnboarding;

