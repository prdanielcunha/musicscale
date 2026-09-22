import React from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import Card from "../components/common/Card";
import FixedBandScaleManager from "../components/database/FixedBandScaleManager";
import { useMusic } from "../contexts/MusicDataContext";

const BandScalesPage: React.FC = () => {
  const { t } = useTranslation();
  const { fixedBandScales } = useMusic();
  const [searchParams] = useSearchParams();
  const initialCreateOpen = searchParams.get("intent") === "create";

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
                "bandScalesPage.description",
                "Cadastre a formação padrão da banda uma vez e reutilize em qualquer Escala de Músicas. Aqui você define pessoas e funções, não presença por evento.",
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
            "Ao criar ou publicar uma Escala de Músicas, escolha uma destas formações fixas. É nessa escala de músicas que a equipe recebe a notificação do evento e confirma se poderá participar.",
          )}
        </p>
      </div>
    </div>
  );
};

export default BandScalesPage;
