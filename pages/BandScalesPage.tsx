import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useMusic } from "../contexts/MusicDataContext";
import { useModals } from "../contexts/ModalContext";
import { logger } from "../lib/logger";
import Card from "../components/common/Card";
import OperationalWorkspaceSkeleton from "../components/common/OperationalWorkspaceSkeleton";
import FixedBandScaleManager from "../components/database/FixedBandScaleManager";

const BandScalesPage: React.FC = () => {
  const { t } = useTranslation();
  const { populatedBandScales, loading, error } = useMusic();
  const { openBandScaleDetail } = useModals();
  const { scaleId } = useParams<{ scaleId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const hasHandledDeepLink = useRef(false);

  useEffect(() => {
    hasHandledDeepLink.current = false;
  }, [scaleId]);

  // Backward compatibility for old /band-scales/:id links. New events live in
  // Music Scales, but old links must never redirect after the user navigates away.
  useEffect(() => {
    if (
      scaleId &&
      !loading &&
      populatedBandScales.length > 0 &&
      !hasHandledDeepLink.current
    ) {
      const expectedPath = `/band-scales/${scaleId}`;
      if (location.pathname !== expectedPath) {
        return;
      }

      const legacyBandScale = populatedBandScales.find((scale) => scale.id === scaleId);
      if (legacyBandScale) {
        hasHandledDeepLink.current = true;
        if (legacyBandScale.musicScaleId) {
          navigate(`/scales/${legacyBandScale.musicScaleId}`, { replace: true });
          return;
        }

        // Legacy records without a Music Scale remain readable until migrated.
        openBandScaleDetail(legacyBandScale);
      } else {
        logger.warn(`Band Scale with ID ${scaleId} not found, redirecting.`);
        navigate("/band-scales", { replace: true });
      }
    }
  }, [scaleId, loading, populatedBandScales, openBandScaleDetail, navigate, location.pathname]);

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
        <div className="inline-flex items-center rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
          {t("bandScalesPage.fixedBadge", "Formações reutilizáveis")}
        </div>
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
            {t("bandScalesPage.title", "Escalas da Banda")}
          </h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-500 dark:text-white/60">
            {t(
              "bandScalesPage.subtitle",
              "Cadastre formações fixas e reutilizáveis. Os eventos, notificações e confirmações de presença ficam na Escala de Músicas.",
            )}
          </p>
        </div>
      </header>

      <Card className="overflow-hidden border-slate-200/60 dark:border-white/[0.08] bg-white dark:bg-[#121214] shadow-sm">
        <div className="border-b border-slate-200/60 dark:border-white/[0.06] bg-slate-50/70 dark:bg-white/[0.02] p-5 sm:p-6">
          <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
            {t("bandScalesPage.howItWorksTitle", "Como funciona")}
          </h2>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t(
              "bandScalesPage.howItWorksDescription",
              "Defina aqui quem normalmente ministra, canta e toca. Ao criar uma Escala de Músicas, selecione uma dessas formações. Cada integrante recebe o evento e confirma presença na própria Escala de Músicas.",
            )}
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <FixedBandScaleManager />
        </div>
      </Card>
    </div>
  );
};

export default BandScalesPage;
