import { logger } from "../lib/logger";
import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { useMusic } from "../contexts/MusicDataContext";
// FIX: Removed firestoreService import in favor of useMusic
import type {
  UserProfile,
  Instrument,
  Role,
  InstrumentCategory,
} from "../types";
import Spinner from "../components/common/Spinner";
import Card from "../components/common/Card";
import Tag from "../components/common/Tag";
import { UserIcon } from "../components/icons/UserIcon";
import { UsersIcon } from "../components/icons/UsersIcon";
import { XCircleIcon } from "../components/icons/XCircleIcon";

const getRoleBadgeStyle = (roleName?: string) => {
  switch (roleName) {
    case "Administrador":
      return "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400";
    case "Líder":
      return "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400";
    case "Ministro":
      return "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400";
    case "Músico":
      return "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400";
    case "Vocal":
      return "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400";
    default:
      return "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400";
  }
};

const UserCard: React.FC<{
  user: UserProfile;
  specialties: Instrument[];
  role?: Role;
}> = ({ user, specialties, role }) => {
  const { t } = useTranslation();
  const roleStyle = getRoleBadgeStyle(role?.name);

  return (
    <Card
      className="flex flex-col p-5 group transition-all duration-300 hover:border-slate-300 dark:hover:border-white/10 hover:shadow-sm active:scale-[0.99] cursor-pointer"
      padding="none"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || "User"}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <UserIcon className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div className="min-w-0 pr-2">
            <p className="font-bold text-[15px] text-slate-900 dark:text-white truncate tracking-tight">
              {user.displayName || t("common.unnamed_user", "Usuário sem Nome")}
            </p>
            <p className="text-[13px] text-slate-500 mt-0.5">
              {role?.name || t("roles.no_role", "Sem função")}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-3">
        <div className="flex flex-wrap gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
          {specialties.length > 0 ? (
            specialties.map((spec) => (
              <span
                key={spec.id}
                className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5"
              >
                {spec.name}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-slate-400 italic">...</span>
          )}
        </div>
      </div>
    </Card>
  );
};

const BandPage: React.FC = () => {
  const { t } = useTranslation();
  const { instruments, roles, allUsers, loading, error } = useMusic();
  const { organization } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [specialtyFilterIds, setSpecialtyFilterIds] = useState<string[]>([]);

  const selectedFilterSpecialties = useMemo(() => {
    return specialtyFilterIds
      .map((id) => instruments.find((i) => i.id === id))
      .filter(Boolean) as Instrument[];
  }, [specialtyFilterIds, instruments]);

  const availableFilterSpecialties = useMemo(() => {
    const categoryOrder: InstrumentCategory[] = [
      "Ministro",
      "Voz",
      "Instrumento",
    ];
    return instruments
      .filter((i) => !specialtyFilterIds.includes(i.id))
      .sort((a, b) => {
        const indexA = categoryOrder.indexOf(a.category);
        const indexB = categoryOrder.indexOf(b.category);
        if (indexA !== indexB) {
          return indexA - indexB;
        }
        return a.name.localeCompare(b.name);
      });
  }, [specialtyFilterIds, instruments]);

  const processedUsers = useMemo(() => {
    const instrumentMap = new Map<string, Instrument>(
      instruments.map((i) => [i.id, i]),
    );
    const roleMap = new Map<string, Role>(roles.map((r) => [r.id, r]));

    return allUsers
      .map((user) => {
        const userSpecialties = (user.specialtyIds || [])
          .map((id) => instrumentMap.get(id))
          .filter((i): i is Instrument => !!i)
          .sort((a, b) => a.name.localeCompare(b.name));

        return {
          user,
          specialties: userSpecialties,
          role: user.roleId ? roleMap.get(user.roleId) : undefined,
        };
      })
      .sort((a, b) =>
        (a.user.displayName || "").localeCompare(b.user.displayName || ""),
      );
  }, [allUsers, instruments, roles]);

  const filteredUsers = useMemo(() => {
    return processedUsers.filter((item) => {
      const user = item.user;
      const searchMatch =
        searchTerm === "" ||
        user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase());

      const specialtyMatch =
        specialtyFilterIds.length === 0 ||
        specialtyFilterIds.some((specId) =>
          item.specialties.some((s) => s.id === specId),
        );

      return searchMatch && specialtyMatch;
    });
  }, [processedUsers, searchTerm, specialtyFilterIds]);

  if (loading)
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner size="lg" />
      </div>
    );
  if (error) return <div className="text-red-500 text-center">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-slate-500 dark:text-gray-400 max-w-3xl">
          {t("band.subtitle", "Veja todos os músicos, vocais e ministros cadastrados no sistema.")}
        </p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="search-user"
              className="block text-sm font-medium text-slate-500 dark:text-gray-400 mb-1"
            >
              {t("band.search_label", "Buscar por Nome/E-mail")}
            </label>
            <input
              id="search-user"
              type="search"
              placeholder={t("band.search_placeholder", "Digite para buscar...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-base px-3 py-2 text-[14px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-gray-400 mb-1">
              {t("band.filter_specialty", "Filtrar por Especialidade")}
            </label>
            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white dark:bg-gray-700/50 border border-slate-300 dark:border-gray-600 rounded-lg min-h-[44px]">
              {selectedFilterSpecialties.map((spec) => (
                <div
                  key={spec.id}
                  className="flex items-center gap-1 bg-primary/10 text-primary-dark dark:text-primary-light text-xs font-semibold px-2 py-1 rounded-full"
                >
                  <span>{spec.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSpecialtyFilterIds((prev) =>
                        prev.filter((id) => id !== spec.id),
                      )
                    }
                    className="hover:bg-primary/20 rounded-full"
                    aria-label={`Remover especialidade ${spec.name}`}
                  >
                    <XCircleIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="relative flex-grow min-w-[120px]">
                <select
                  value=""
                  onChange={(e) => {
                    const newId = e.target.value;
                    if (newId && !specialtyFilterIds.includes(newId)) {
                      setSpecialtyFilterIds((prev) => [...prev, newId]);
                    }
                  }}
                  className="w-full h-full appearance-none bg-transparent border-none focus:ring-0 text-sm text-slate-500 dark:text-gray-400 p-1 cursor-pointer"
                  disabled={availableFilterSpecialties.length === 0}
                >
                  <option value="" disabled>
                    {availableFilterSpecialties.length > 0
                      ? t("band.add_filter", "Adicionar filtro...")
                      : t("band.none", "Nenhuma")}
                  </option>
                  {availableFilterSpecialties.map((spec) => (
                    <option key={spec.id} value={spec.id}>
                      {spec.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {filteredUsers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredUsers.map(({ user, specialties, role }) => (
            <UserCard
              key={user.uid}
              user={user}
              specialties={specialties}
              role={role}
            />
          ))}
        </div>
      ) : (
        <div className="max-w-4xl mx-auto py-12 md:py-20 px-4 text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-indigo-600 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-indigo-500/10 relative">
            <div className="absolute inset-0 bg-white/40 dark:bg-[#111111]/40 backdrop-blur-xl rounded-[2rem] -z-10"></div>
            <UsersIcon className="w-12 h-12 relative z-10" />
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter mb-4">
            {t("band.no_member_found", "Nenhum integrante encontrado")}
          </h2>
          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
             {t("band.no_member_desc", "Parece que você ainda não adicionou ninguém à equipe ou sua busca não encontrou resultados. Ajuste os filtros ou convide novos voluntários para o seu ministério.")}
          </p>
        </div>
      )}
    </div>
  );
};

export default BandPage;
