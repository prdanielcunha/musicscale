import React, { ReactElement } from "react";
import { DashboardIcon } from "../icons/DashboardIcon";
import { RepertoireIcon } from "../icons/RepertoireIcon";
import { CalendarIcon } from "../icons/CalendarIcon";
import { DatabaseIcon } from "../icons/DatabaseIcon";
import { UsersIcon } from "../icons/UsersIcon";
import { SparklesIcon } from "../icons/SparklesIcon";
import { BookOpenIcon } from "../icons/BookOpenIcon";
import { TagIcon } from "../icons/TagIcon";
import { MusicNoteIcon } from "../icons/MusicNoteIcon";
import { SuggestionIcon } from "../icons/SuggestionIcon";
import { ClipboardListIcon } from "../icons/ClipboardListIcon";
import { StoreIcon } from "../icons/StoreIcon";
import { SettingsIcon } from "../icons/SettingsIcon";
import { UserIcon } from "../icons/UserIcon";
import { KeyPermissionsIcon } from "../icons/KeyPermissionsIcon";
import { CloudArrowUpIcon } from "../icons/CloudArrowUpIcon";
import { BugIcon } from "../icons/BugIcon";
import { BookTextIcon } from "../icons/BookTextIcon";
import { MessageSquareQuestionIcon } from "../icons/MessageSquareQuestionIcon";
import { ShieldAlert } from "lucide-react";

export interface NavigationItem {
  id: string;
  type: "link" | "group_trigger" | "action";
  icon: ReactElement | null;
  labelKey: string;
  defaultLabel: string;
  path?: string;
  permissionRequired: string | null;
  section: "primary" | "admin" | "help";
  group: string | null;
}

export const navigationRegistry: NavigationItem[] = [
  // --- SEÇÃO PRINCIPAL ---
  {
    id: "dashboard",
    type: "link",
    icon: <DashboardIcon />,
    labelKey: "nav.dashboard",
    defaultLabel: "Painel",
    path: "/",
    permissionRequired: "musicscale.performance.use",
    section: "primary",
    group: null,
  },
  {
    id: "repertoire",
    type: "link",
    icon: <RepertoireIcon />,
    labelKey: "nav.repertoire",
    defaultLabel: "Repertório",
    path: "/songs",
    permissionRequired: "musicscale.performance.use",
    section: "primary",
    group: null,
  },
  {
    id: "scales",
    type: "link",
    icon: <CalendarIcon />,
    labelKey: "nav.scales",
    defaultLabel: "Escalas",
    path: "/scales",
    permissionRequired: "musicscale.performance.use",
    section: "primary",
    group: null,
  },
  {
    id: "library",
    type: "link",
    icon: <BookOpenIcon />,
    labelKey: "nav.library",
    defaultLabel: "Biblioteca Viva",
    path: "/library",
    permissionRequired: "musicscale.performance.use",
    section: "primary",
    group: null,
  },
  {
    id: "curation_queue",
    type: "link",
    icon: <ClipboardListIcon />,
    labelKey: "nav.curation_queue",
    defaultLabel: "Curadoria",
    path: "/curation",
    permissionRequired: "musicscale.performance.use",
    section: "primary",
    group: null,
  },
  {
    id: "band",
    type: "link",
    icon: <UsersIcon />,
    labelKey: "nav.band",
    defaultLabel: "Integrantes",
    path: "/band",
    permissionRequired: "musicscale.members.manage",
    section: "primary",
    group: null,
  },
  {
    id: "updates",
    type: "link",
    icon: <SparklesIcon />,
    labelKey: "nav.updates",
    defaultLabel: "Novidades",
    path: "action:whatsnew",
    permissionRequired: "musicscale.performance.use",
    section: "primary",
    group: null,
  },
  {
    id: "database",
    type: "group_trigger",
    icon: <DatabaseIcon />,
    labelKey: "nav.database",
    defaultLabel: "Banco de Dados",
    path: "/database",
    permissionRequired: "manageOrganization",
    section: "primary",
    group: null,
  },
  // Subitens de Banco de Dados
  {
    id: "overview",
    type: "link",
    icon: <DatabaseIcon />,
    labelKey: "nav.overview",
    defaultLabel: "Visão geral",
    path: "/database",
    permissionRequired: "manageOrganization",
    section: "primary",
    group: "database",
  },
  {
    id: "types_events",
    type: "link",
    icon: <CalendarIcon />,
    labelKey: "nav.types_events",
    defaultLabel: "Tipos de culto e evento",
    path: "/database#types",
    permissionRequired: "manageOrganization",
    section: "primary",
    group: "database",
  },
  {
    id: "locations",
    type: "link",
    icon: <TagIcon />,
    labelKey: "nav.locations_title",
    defaultLabel: "Locais",
    path: "/database#locations",
    permissionRequired: "manageOrganization",
    section: "primary",
    group: "database",
  },
  {
    id: "event_names",
    type: "link",
    icon: <TagIcon />,
    labelKey: "nav.event_names_title",
    defaultLabel: "Nomes de evento",
    path: "/database#event-names",
    permissionRequired: "manageOrganization",
    section: "primary",
    group: "database",
  },
  {
    id: "tags_categories",
    type: "link",
    icon: <TagIcon />,
    labelKey: "nav.tags_categories",
    defaultLabel: "Tags de músicas",
    path: "/database#tags",
    permissionRequired: "manageOrganization",
    section: "primary",
    group: "database",
  },
  {
    id: "skills",
    type: "link",
    icon: <MusicNoteIcon />,
    labelKey: "nav.skills",
    defaultLabel: "Funções e instrumentos",
    path: "/database#skills",
    permissionRequired: "manageOrganization",
    section: "primary",
    group: "database",
  },

  // --- SEÇÃO ADMINISTRAÇÃO ---
  {
    id: "suggestions",
    type: "group_trigger",
    icon: <SuggestionIcon />,
    labelKey: "nav.suggestions",
    defaultLabel: "Indicações",
    path: "/suggestions",
    permissionRequired: "musicscale.performance.use",
    section: "admin",
    group: null,
  },
  // Subitens de Indicações
  {
    id: "suggest_song",
    type: "link",
    icon: <ClipboardListIcon />,
    labelKey: "nav.suggest_song",
    defaultLabel: "Indicar Música",
    path: "indicate",
    permissionRequired: "musicscale.performance.use",
    section: "admin",
    group: "suggestions",
  },
  {
    id: "analyze_suggestions",
    type: "link",
    icon: <SuggestionIcon />,
    labelKey: "nav.analyze_suggestions",
    defaultLabel: "Analisar Indicações",
    path: "/suggestions",
    permissionRequired: "musicscale.songs.edit",
    section: "admin",
    group: "suggestions",
  },
  {
    id: "plans",
    type: "link",
    icon: <StoreIcon />,
    labelKey: "nav.plans",
    defaultLabel: "Planos & Loja",
    path: "/plans",
    permissionRequired: "manageOrganization",
    section: "admin",
    group: null,
  },
  {
    id: "settings",
    type: "group_trigger",
    icon: <SettingsIcon />,
    labelKey: "nav.settings",
    defaultLabel: "Configurações",
    path: "/profile",
    permissionRequired: "musicscale.performance.use",
    section: "admin",
    group: null,
  },
  // Subitens de Configurações
  {
    id: "my_profile",
    type: "link",
    icon: <UserIcon />,
    labelKey: "nav.my_profile",
    defaultLabel: "Meu Perfil",
    path: "/profile",
    permissionRequired: "musicscale.performance.use",
    section: "admin",
    group: "settings",
  },
  {
    id: "members",
    type: "link",
    icon: <UsersIcon />,
    labelKey: "nav.members",
    defaultLabel: "Usuários",
    path: "/users",
    permissionRequired: "manageMembers",
    section: "admin",
    group: "settings",
  },
  {
    id: "roles",
    type: "link",
    icon: <KeyPermissionsIcon />,
    labelKey: "nav.roles",
    defaultLabel: "Funções e Permissões",
    path: "/roles",
    permissionRequired: "manageMembers",
    section: "admin",
    group: "settings",
  },
  {
    id: "backup",
    type: "link",
    icon: <CloudArrowUpIcon />,
    labelKey: "nav.backup",
    defaultLabel: "Backup & Dados",
    path: "/backup",
    permissionRequired: "manageOrganization",
    section: "admin",
    group: "settings",
  },
  {
    id: "plan_usage",
    type: "link",
    icon: <StoreIcon />,
    labelKey: "nav.plan_usage",
    defaultLabel: "Uso do Plano",
    path: "/plan-usage",
    permissionRequired: "manageOrganization",
    section: "admin",
    group: "settings",
  },
  {
    id: "debug_session",
    type: "link",
    icon: <BugIcon />,
    labelKey: "nav.debug_session",
    defaultLabel: "Diagnóstico de Sessão",
    path: "/debug/session",
    permissionRequired: "manageOrganization",
    section: "admin",
    group: "settings",
  },
  {
    id: "finops_diagnostics",
    type: "link",
    icon: <ShieldAlert className="w-4 h-4 text-amber-500" />,
    labelKey: "nav.finops_diagnostics",
    defaultLabel: "Diagnóstico FinOps",
    path: "/admin/finops-diagnostics",
    permissionRequired: "manageOrganization",
    section: "admin",
    group: "settings",
  },

  // --- SEÇÃO AJUDA ---
  {
    id: "faq",
    type: "action",
    icon: <BookTextIcon />,
    labelKey: "nav.faq",
    defaultLabel: "Central de Ajuda",
    path: "action:faq",
    permissionRequired: "musicscale.performance.use",
    section: "help",
    group: null,
  },
  {
    id: "team_feedback",
    type: "action",
    icon: <MessageSquareQuestionIcon />,
    labelKey: "nav.team_feedback",
    defaultLabel: "Falar com a equipe",
    path: "action:feedback",
    permissionRequired: "musicscale.performance.use",
    section: "help",
    group: null,
  },
];
