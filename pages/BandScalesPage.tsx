import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Card from "../components/common/Card";
import OperationalWorkspaceSkeleton from "../components/common/OperationalWorkspaceSkeleton";
import FixedBandScaleManager from "../components/database/FixedBandScaleManager";
import { useMusic } from "../contexts/MusicDataContext";
import { useModals } from "../contexts/ModalContext";
import { logger } from "../lib/logger";

const BandScalesPage: React.FC = () => {
  const { t } = useTranslation();
  const { fixedBandScales, populatedBandScales, loading, error } = useMusic();
  const { openBandScaleDetail } = useModals();
  const { scaleId } = useParams<{ scaleId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialCreateOpen = searchParams.get("intent") === "create";
  const hasHandledDeepLink = useRef(false);

  useEffect(() => {
    hasHandledDeepLink.current = false;
  }, [scaleId]);

  // Backward compatibility for old event-specific BandScale links. New band
  // creation is fixed/reusable; published event history still resolves safely.
  useEffect(() => {
    if (
      !scaleId ||
      loading ||
      hasHandledDeepLink.current
    ) {
      return;
    }

    const expectedPath = `/band-scales/${scaleId}`;
    if (location.pathname !== expectedPath) {
      return;
    }

    const legacyBandScale = populatedBandScales.find((scale) => scale.id === scaleId);
    hasHandledDeepLink.current = true;

    if (!legacyBandScale) {
      logger.warn(`Band Scale with ID ${scaleId} not found, redirecting.`);
      navigate("/band-scales", { replace: true });
      return;
    }

    if (legacyBandScale.musicScaleId) {
      navigate(`/scales/${legacyBandScale.musicScaleId}`, { replace: true });
      return;
    }

    // Old records without a Music Scale remain readable until migrated.
    openBandScaleDetail(legacyBandScale);
  }, [
    scaleId,
    loading,
    populatedBandScales,
    openBandScaleDetail,
    navigate,
    location.pathname,
  ]);

  if (loading) {
    return <OperationalWorkspaceSkeleton variant="scales" />;
  }

  if (error) {
    return (
      <div className="ms-band-scales-page mx-auto max-w-3xl px-4 py-16 text-center text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="ms-band-scales-page w-full max-w-5xl mx-auto py-8 lg:py-12 px-4 sm:px-6 lg:px-8 pb-32 space-y-8">
      <header className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-primary/80">
              {t("bandScalesPage.fixedBadge", "Formações reutilizáveis")}
            </p>
            <h1 className="mt-2 text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              {t("bandScalesPage.title", "Escalas Fixas da Banda")}
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-500 dark:text-white/60">
              {t(
                "bandScalesPage.subtitle",
                "Cadastre formações fixas e reutilizáveis. Os eventos, notificações e confirmações de presença ficam na Escala de Músicas.",
              )}
            </p>
          </div>

          <div className="shrink-0 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
            {t("bandScalesPage.fixedCount", { count: fixedBandScales.length })}
          </div>
        </div>
      </header>

      <Card className="p-5 sm:p-6 lg:p-7 dark:bg-[#1A1A1C]/80 border-slate-200/50 dark:border-white/[0.08] shadow-sm">
        <FixedBandScaleManager initialCreateOpen={initialCreateOpen} />
      </Card>

      <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] px-5 py-4">
        <p className="text-sm font-bold text-slate-900 dark:text-white">
          {t("bandScalesPage.howItWorksTitle", "Como funciona")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {t(
            "bandScalesPage.howItWorksDescription",
            "Defina aqui quem normalmente ministra, canta e toca. Ao criar uma Escala de Músicas, selecione uma dessas formações. Cada integrante recebe o evento e confirma presença na própria Escala de Músicas.",
          )}
        </p>
      </div>
    </div>
  );
};

export default BandScalesPage;
