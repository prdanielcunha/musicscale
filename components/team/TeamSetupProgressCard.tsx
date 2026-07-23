import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TeamSetupSummary } from "../../utils/teamSetup";
import { CheckCircle2, ChevronRight, Settings } from "lucide-react";
import { useSearchParams } from "react-router-dom";

interface TeamSetupProgressCardProps {
  summary: TeamSetupSummary;
}

export const TeamSetupProgressCard: React.FC<TeamSetupProgressCardProps> = ({ summary }) => {
  const { t } = useTranslation();
  const [, setSearchParams] = useSearchParams();

  const handleOpenGuide = () => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set("setup", "team");
      return next;
    });
  };

  const hasPeople = summary.additionalMembers > 0;
  
  return (
    <Card className="mb-8 border-primary/20 dark:border-primary/20 bg-primary/5 dark:bg-primary/5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            {summary.isTeamConfigured && summary.incompleteMemberIds.length === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-primary" />
            ) : (
              <Settings className="w-5 h-5 text-primary" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">
              {t("teamSetup.progress.title", "Configure sua equipe")}
            </h3>
            <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">
              {!hasPeople 
                ? t("teamSetup.progress.membersAdded_zero", "Nenhuma pessoa adicionada")
                : summary.additionalMembers === 1
                  ? t("teamSetup.progress.membersAdded_one", "1 pessoa adicionada")
                  : t("teamSetup.progress.membersAdded", { count: summary.additionalMembers }, "{{count}} pessoas adicionadas")}
              {hasPeople && summary.incompleteMemberIds.length > 0 && (
                <>
                  <span className="mx-2">•</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    {summary.additionalMembers - summary.membersWithAccessProfile > 0
                      ? summary.additionalMembers - summary.membersWithAccessProfile === 1
                        ? t("teamSetup.progress.missingAccess_one", "1 ainda precisa de um perfil de acesso")
                        : t("teamSetup.progress.missingAccess", { count: summary.additionalMembers - summary.membersWithAccessProfile }, "{{count}} ainda precisa de um perfil de acesso")
                      : summary.additionalMembers - summary.membersWithMinistryFunctions === 1
                        ? t("teamSetup.progress.missingFunctions_one", "1 ainda precisa de uma função na equipe")
                        : t("teamSetup.progress.missingFunctions", { count: summary.additionalMembers - summary.membersWithMinistryFunctions }, "{{count}} ainda precisa de uma função na equipe")}
                  </span>
                </>
              )}
              {hasPeople && summary.incompleteMemberIds.length === 0 && (
                <>
                  <span className="mx-2">•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {t("teamSetup.progress.configured", "Todos os integrantes estão configurados")}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
        <Button 
          onClick={handleOpenGuide}
          variant={summary.isTeamConfigured && summary.incompleteMemberIds.length === 0 ? "outline" : "primary"}
          rightIcon={<ChevronRight className="w-4 h-4" />}
          className="shrink-0"
        >
          {summary.isTeamConfigured && summary.incompleteMemberIds.length === 0 
            ? t("teamSetup.progress.reviewAction", "Revisar equipe")
            : t("teamSetup.progress.continueAction", "Continuar configuração")}
        </Button>
      </div>
    </Card>
  );
};
