import React from "react";
import { useTranslation } from "react-i18next";
import { Role, Instrument, UserProfile } from "../../types";

interface TeamMemberReviewProps {
  user: UserProfile;
  selectedRole: Role | undefined;
  selectedFunctions: Instrument[];
  isDeferred: boolean;
}

export const TeamMemberReview: React.FC<TeamMemberReviewProps> = ({
  user,
  selectedRole,
  selectedFunctions,
  isDeferred
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center gap-4">
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
            {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-bold text-slate-900 dark:text-white">{user.displayName || user.email}</p>
          {user.displayName && <p className="text-sm text-slate-500">{user.email}</p>}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
            {t("teamSetup.review.access", "Perfil de acesso")}
          </h4>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10">
            <p className="font-bold text-slate-900 dark:text-white">{selectedRole?.name || "—"}</p>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
            {t("teamSetup.review.functions", "Funções ministeriais")}
          </h4>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10">
            {isDeferred ? (
              <p className="text-amber-600 dark:text-amber-400 font-medium">
                {t("teamSetup.review.deferredFunctions", "Serão definidas depois")}
              </p>
            ) : selectedFunctions.length > 0 ? (
              <ul className="space-y-2">
                {selectedFunctions.map(f => (
                  <li key={f.id} className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                    {f.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500">—</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
