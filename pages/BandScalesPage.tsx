import React from "react";
import { useTranslation } from "react-i18next";
import Card from "../components/common/Card";
import FixedBandScaleManager from "../components/database/FixedBandScaleManager";

const BandScalesPage: React.FC = () => {
  const { t } = useTranslation();

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
