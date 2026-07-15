import { logger } from "../lib/logger";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { PopulatedBandScale, PopulatedScale } from "../types";
import { useMusic } from "../contexts/MusicDataContext";
import { useModals } from "../contexts/ModalContext";
import Spinner from "../components/common/Spinner";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import { LocationMarkerIcon } from "../components/icons/LocationMarkerIcon";
import { UsersIcon } from "../components/icons/UsersIcon";
import { CalendarIcon } from "../components/icons/CalendarIcon";
import { UserIcon } from "../components/icons/UserIcon";
import { LinkIcon } from "../components/icons/LinkIcon";
import FixedBandScaleManagerModal from "../components/scales/FixedBandScaleManagerModal";
import { useAuth, useLimits } from "../contexts/AuthContext";
import { Lock } from "lucide-react";
import { getScaleTitle as getScaleTitleHelper } from "../utils/scaleHelper";

// Local icon
const PlusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 20 20"
    fill="currentColor"
    {...props}
  >
    <path
      fillRule="evenodd"
      d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
      clipRule="evenodd"
    />
  </svg>
);

export const getBandScaleDate = (s: PopulatedBandScale, musicScales?: PopulatedScale[]) => {
  if (s.musicScaleId && musicScales) {
     const ms = musicScales.find(m => m.id === s.musicScaleId);
     if (ms && ms.date) return ms.date;
  }
  return s.date || "1970-01-01";
};

export const getBandScaleTime = (s: PopulatedBandScale, musicScales?: PopulatedScale[]) => {
  if (s.musicScaleId && musicScales) {
     const ms = musicScales.find(m => m.id === s.musicScaleId);
     if (ms && ms.time) return ms.time;
  }
  return s.time || "00:00";
};

import { Trash2, Copy, Edit2 } from "lucide-react";
import { Can } from "../components/auth/Can";

const BandScaleCard: React.FC<{
  scale: PopulatedBandScale;
  musicScales?: PopulatedScale[];
  onView: (scale: PopulatedBandScale) => void;
  onEdit?: (scale: PopulatedBandScale) => void;
  onDelete?: (scale: PopulatedBandScale) => void;
  onClone?: (scale: PopulatedBandScale) => void;
}> = ({ scale, musicScales, onView, onEdit, onDelete, onClone }) => {
  const getScaleTitle = (s: PopulatedBandScale) => {
    if (s.musicScaleId && musicScales) {
       const ms = musicScales.find(m => m.id === s.musicScaleId);
       if (ms) return getScaleTitleHelper(ms);
    }
    return getScaleTitleHelper(s);
  };

  const scaleDate = getBandScaleDate(scale, musicScales);
  const isNoDate = scaleDate === "1970-01-01";
  const date = new Date(scaleDate + "T00:00:00");
  const month = isNoDate ? "---" : date
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "")
    .toUpperCase();
  const day = isNoDate ? "--" : date.getDate().toString().padStart(2, "0");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = !isNoDate && date < today;

  const locationName = (() => {
    if (scale.musicScaleId && musicScales) {
      const ms = musicScales.find(m => m.id === scale.musicScaleId);
      if (ms) return ms.location.name;
    }
    return scale.location?.name || "Sem local";
  })();

  return (
    <Card
      className={`group relative outline-none flex flex-col p-0 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] border rounded-[24px] shadow-sm min-h-[140px] ${
        isPast 
        ? "bg-white/50 dark:bg-[#0A0A0C]/50 border-black/[0.03] dark:border-white/[0.04]" 
        : "bg-white/90 dark:bg-[#1A1A1C]/60 backdrop-blur-2xl border-black/[0.04] dark:border-white/[0.06] hover:border-black/[0.1] dark:hover:border-white/[0.1] hover:bg-white dark:hover:bg-[#1A1A1C]/80 hover:shadow-lg dark:hover:shadow-2xl dark:hover:shadow-black/40 hover:-translate-y-[2px]"
      }`}
      padding="none"
    >
      <div className="p-5 flex-grow cursor-pointer" onClick={() => onView(scale)}>
        <div className="flex items-center gap-4">
          <div
            className={`flex-shrink-0 w-16 h-16 flex flex-col items-center justify-center rounded-[14px] ${isPast ? "bg-slate-100 dark:bg-white/5" : "bg-primary/10 shadow-sm"}`}
          >
            <span
              className={`text-[10px] font-bold tracking-[0.2em] mb-0.5 ${isPast ? "text-slate-500 dark:text-white/40" : "text-primary"}`}
            >
              {month}
            </span>
            <span
              className={`text-[26px] font-extrabold tracking-tighter leading-none ${isPast ? "text-slate-500 dark:text-white/50" : "text-slate-900 dark:text-white drop-shadow-sm dark:drop-shadow-none"}`}
            >
              {day}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className={`font-bold text-[18px] sm:text-[20px] truncate mb-1 tracking-tight transition-colors ${isPast ? "text-slate-700 dark:text-white/60" : "text-slate-900 dark:text-white group-hover:text-primary drop-shadow-sm dark:drop-shadow-none"}`}
              title={getScaleTitle(scale)}
            >
              {getScaleTitle(scale)}
            </h3>
            <div className={`flex items-center gap-1.5 text-sm font-medium ${isPast ? "text-slate-500 dark:text-white/40" : "text-slate-500 dark:text-white/60"} mt-0.5`}>
              <LocationMarkerIcon className="w-4 h-4 opacity-70" />
              <span className="truncate">{locationName}</span>
              {scale.time && <span className="ml-1 opacity-70 font-semibold">• {scale.time}</span>}
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-black/[0.04] dark:border-white/[0.06] pt-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-widest">
              Equipe
            </h4>
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 dark:text-white/60">
              <UsersIcon className="w-3.5 h-3.5 opacity-70" />
              <span>{scale.assignments.length} Músicos</span>
            </div>
          </div>
          <div className="flex -space-x-2">
            {scale.assignments.slice(0, 6).map(({ user }) => (
              <div
                key={user.uid}
                className={`relative inline-block h-[34px] w-[34px] rounded-full border-2 ${isPast ? "border-slate-50 dark:border-[#0A0A0C]" : "border-white dark:border-[#1A1A1C]"}`}
                title={user.displayName || user.email || ""}
              >
                {user.photoURL ? (
                  <img
                    className="h-full w-full rounded-full object-cover"
                    src={user.photoURL}
                    alt={user.displayName || ""}
                  />
                ) : (
                  <div className="h-full w-full rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-slate-500 dark:text-white/50" />
                  </div>
                )}
              </div>
            ))}
            {scale.assignments.length > 6 && (
              <div className={`relative flex h-[34px] w-[34px] items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 text-[11px] font-bold border-2 ${isPast ? "border-slate-50 dark:border-[#0A0A0C] text-slate-500 dark:text-white/50" : "border-white dark:border-[#1A1A1C] text-slate-600 dark:text-white/70"}`}>
                +{scale.assignments.length - 6}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-black/[0.04] dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
        <div className="flex items-center px-2 py-1">
          <Can I="musicscale.scales.manage">
            {onEdit && (
               <button onClick={(e) => { e.stopPropagation(); onEdit(scale); }} className="p-2 text-slate-400 hover:text-primary transition-colors rounded-lg" title="Editar">
                 <Edit2 className="w-4 h-4" />
               </button>
            )}
            {onClone && (
               <button onClick={(e) => { e.stopPropagation(); onClone(scale); }} className="p-2 text-slate-400 hover:text-primary transition-colors rounded-lg" title="Clonar">
                 <Copy className="w-4 h-4" />
               </button>
            )}
            {onDelete && (
               <button onClick={(e) => { e.stopPropagation(); onDelete(scale); }} className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-lg" title="Excluir">
                 <Trash2 className="w-4 h-4" />
               </button>
            )}
          </Can>
        </div>
        {scale.musicScaleId && (
          <div className="px-4 py-2.5 text-right flex-1 flex justify-end items-center">
            <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase text-green-600/90 dark:text-green-400">
              <LinkIcon className="w-3 h-3" />
              Repertório
            </span>
          </div>
        )}
      </div>
    </Card>
  );
};

const formSelectClass = "input-base pl-3 pr-8 py-2 md:py-2.5 text-sm";
const searchInputClass = "input-base pl-3 pr-4 py-2 md:py-2.5 text-sm";

import { UpgradePlanModal } from "../components/premium/EntitlementGates";

const BandScalesPage: React.FC = () => {
  const { bandScales, populatedBandScales, populatedScales, loading, error, eventTypes, locations } =
    useMusic();
  const { openBandScaleForm, openBandScaleDetail } = useModals();
  const { limits } = useLimits();
  const isOverLimit = populatedBandScales.length >= limits.maxBandScales;
  const { scaleId } = useParams<{ scaleId: string }>();
  const navigate = useNavigate();
  const [showLimitModal, setShowLimitModal] = useState(false);

  const [filter, setFilter] = useState<"upcoming" | "past">("upcoming");
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");

  const hasHandledDeepLink = useRef(false);

  useEffect(() => {
    hasHandledDeepLink.current = false;
  }, [scaleId]);

  useEffect(() => {
    if (
      scaleId &&
      !loading &&
      populatedBandScales.length > 0 &&
      !hasHandledDeepLink.current
    ) {
      const scale = populatedBandScales.find((s) => s.id === scaleId);
      if (scale) {
        openBandScaleDetail(scale);
        hasHandledDeepLink.current = true;
      } else {
        logger.warn(`Band Scale with ID ${scaleId} not found, redirecting.`);
        navigate("/band-scales", { replace: true });
      }
    }
  }, [scaleId, loading, populatedBandScales, openBandScaleDetail, navigate]);

  const sortedScales = useMemo(() => {
    return [...populatedBandScales].sort((a, b) => {
      const dateA = getBandScaleDate(a, populatedScales);
      const dateB = getBandScaleDate(b, populatedScales);
      const timeA = getBandScaleTime(a, populatedScales);
      const timeB = getBandScaleTime(b, populatedScales);
      return `${dateB}T${timeB}`.localeCompare(`${dateA}T${timeA}`);
    });
  }, [populatedBandScales, populatedScales]);

  const { upcomingScalesCount, pastScalesCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let upcoming = 0;
    let past = 0;
    sortedScales.forEach((s) => {
      if (new Date(getBandScaleDate(s, populatedScales) + "T00:00:00") >= today) upcoming++;
      else past++;
    });
    return { upcomingScalesCount: upcoming, pastScalesCount: past };
  }, [sortedScales, populatedScales]);

  const filteredScales = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let scalesToFilter = sortedScales;

    // Filter by upcoming/past
    if (filter === "upcoming") {
      scalesToFilter = scalesToFilter
        .filter((s) => new Date(getBandScaleDate(s, populatedScales) + "T00:00:00") >= today)
        .reverse();
    } else {
      scalesToFilter = scalesToFilter.filter(
        (s) => new Date(getBandScaleDate(s, populatedScales) + "T00:00:00") < today,
      );
    }

    // Filter by search term
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      scalesToFilter = scalesToFilter.filter(
        (s) =>
          s.eventType.name.toLowerCase().includes(lowerSearchTerm) ||
          (s.eventName &&
            s.eventName.name.toLowerCase().includes(lowerSearchTerm)) ||
          s.location.name.toLowerCase().includes(lowerSearchTerm),
      );
    }

    // Filter by event type
    if (eventTypeFilter !== "all") {
      scalesToFilter = scalesToFilter.filter(
        (s) => s.eventType.id === eventTypeFilter,
      );
    }

    // Filter by location
    if (locationFilter !== "all") {
      scalesToFilter = scalesToFilter.filter(
        (s) => s.location.id === locationFilter,
      );
    }

    return scalesToFilter;
  }, [sortedScales, filter, searchTerm, eventTypeFilter, locationFilter]);

  if (loading)
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner />
      </div>
    );
  if (error) return <div className="text-red-500 text-center">{error}</div>;

  const isCompletelyEmpty = populatedBandScales.length === 0;

  if (isCompletelyEmpty) {
    return (
      <div className="max-w-3xl mx-auto py-16 lg:py-24 px-4 text-center">
        <div className="w-24 h-24 bg-white dark:bg-[#1A1A1C] border border-black/[0.04] dark:border-white/[0.06] rounded-[24px] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-black/5 dark:shadow-black/50">
          <UsersIcon className="w-10 h-10 text-primary opacity-80" />
        </div>
        <h2 className="text-[32px] sm:text-[40px] font-extrabold text-slate-900 dark:text-white tracking-tight mb-4 drop-shadow-sm dark:drop-shadow-none">
          Escale sua equipe
        </h2>
        <p className="text-[16px] text-slate-500 dark:text-white/60 max-w-xl mx-auto mb-12 leading-relaxed tracking-wide">
          Comece a delegar os eventos e ensaios. Seus músicos serão notificados
          e terão acesso direto a todos os acordes e letras necessários.
        </p>

        <div className="flex justify-center">
          <Card
            onClick={() => openBandScaleForm()}
            className="p-8 cursor-pointer border border-primary/20 dark:border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all duration-500 group relative overflow-hidden max-w-md w-full rounded-[32px] shadow-sm hover:shadow-xl hover:shadow-primary/10 dark:hover:shadow-primary/5 hover:-translate-y-1"
          >
            <div className="absolute top-0 right-0 p-6 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500">
              <PlusIcon className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-primary transition-colors text-left tracking-tight">
              Criar Escala da Banda
            </h3>
            <p className="text-slate-500 dark:text-white/60 font-medium text-[15px] text-left mb-8 leading-relaxed">
              Aloque quem vai tocar, cantar e operar o som no próximo evento.
            </p>
            <div className="inline-flex items-center text-[14px] px-5 py-2.5 rounded-full bg-primary/10 text-primary font-bold group-hover:bg-primary group-hover:text-white transition-all duration-500 w-auto float-left">
              Começar escalação
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 ml-2 rtl:rotate-180 group-hover:translate-x-1 transition-transform"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto py-8 lg:py-12 px-4 sm:px-6 lg:px-8 pb-32 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-2">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-none">Escalas da Banda</h1>
          <p className="text-slate-500 dark:text-white/60 mt-2 text-[15px] max-w-xl leading-relaxed tracking-wide">
            Faça a escalação da equipe musical, confirme as presenças e defina as funções de cada integrante.
          </p>
        </div>
      </div>
      
      <Card className="p-5 space-y-6 dark:bg-[#1A1A1C]/80 border-slate-200/50 dark:border-white/[0.08] shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="w-full md:w-auto">
            <div className="inline-flex rounded-xl shadow-sm bg-slate-100 dark:bg-white/5 p-1">
              <button
                onClick={() => setFilter("upcoming")}
                className={`px-6 py-2.5 text-[13px] font-semibold tracking-wide rounded-lg transition-all ${filter === "upcoming" ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm dark:shadow-black/50" : "text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white"}`}
              >
                Próximas ({upcomingScalesCount})
              </button>
              <button
                onClick={() => setFilter("past")}
                className={`px-6 py-2.5 text-[13px] font-semibold tracking-wide rounded-lg transition-all ${filter === "past" ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm dark:shadow-black/50" : "text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white"}`}
              >
                Passadas ({pastScalesCount})
              </button>
            </div>
          </div>
          <div className="w-full md:w-auto flex flex-col sm:flex-row items-center gap-3">
            <Button
              onClick={() => setIsManagerOpen(true)}
              variant="secondary"
              className="w-full sm:w-auto h-[44px] px-5 rounded-xl font-bold tracking-wide shadow-sm"
            >
              Escalas Fixas
            </Button>
            <Button
              onClick={
                isOverLimit
                  ? () => setShowLimitModal(true)
                  : () => openBandScaleForm()
              }
              leftIcon={isOverLimit ? <Lock className="w-4 h-4 text-amber-500" /> : <PlusIcon />}
              className="w-full sm:w-auto h-[44px] px-6 rounded-xl font-bold tracking-wide shadow-md"
              variant={isOverLimit ? "secondary" : "primary"}
            >
              Nova Escala
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-t border-slate-200/50 dark:border-white/5 pt-5">
          <div className="md:col-span-1">
            <label
              htmlFor="search"
              className="block text-[11px] font-bold text-slate-500/80 dark:text-white/40 uppercase tracking-widest pl-1 mb-2"
            >
              Buscar
            </label>
            <input
              id="search"
              type="search"
              placeholder="Por evento, nome ou local..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 px-4 text-[13px] font-medium rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#1A1A1C] text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-white/30 hover:border-slate-300 dark:hover:border-white/20"
            />
          </div>
          <div>
            <label
              htmlFor="eventTypeFilter"
              className="block text-[11px] font-bold text-slate-500/80 dark:text-white/40 uppercase tracking-widest pl-1 mb-2"
            >
              Tipo de Evento
            </label>
            <select
              id="eventTypeFilter"
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="w-full h-11 px-4 text-[13px] font-medium rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#1A1A1C] text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all hover:border-slate-300 dark:hover:border-white/20 appearance-none cursor-pointer"
            >
              <option value="all">Todos os tipos</option>
              {eventTypes.map((et) => (
                <option key={et.id} value={et.id}>
                  {et.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="locationFilter"
              className="block text-[11px] font-bold text-slate-500/80 dark:text-white/40 uppercase tracking-widest pl-1 mb-2"
            >
              Local
            </label>
            <select
              id="locationFilter"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full h-11 px-4 text-[13px] font-medium rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#1A1A1C] text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all hover:border-slate-300 dark:hover:border-white/20 appearance-none cursor-pointer"
            >
              <option value="all">Todos os locais</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {filteredScales.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredScales.map((scale) => (
            <BandScaleCard
              key={scale.id}
              scale={scale}
              musicScales={populatedScales}
              onView={openBandScaleDetail}
              onEdit={(s) => {
                const raw = bandScales.find(r => r.id === s.id);
                if (raw) openBandScaleForm(raw);
              }}
              onClone={(s) => {
                const raw = bandScales.find(r => r.id === s.id);
                if (raw) openBandScaleForm({ ...raw, id: 'CLONE', date: '' });
              }}
              onDelete={(s) => {
                openBandScaleDetail(s, 'delete');
              }}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.05] rounded-3xl mt-6 shadow-sm">
          <CalendarIcon className="mx-auto h-12 w-12 text-slate-300 dark:text-white/20 mb-4" />
          <h3 className="text-[16px] font-bold text-slate-800 dark:text-white mb-1">
            Nenhuma escala encontrada
          </h3>
          <p className="text-[14px] text-slate-500 dark:text-white/50">
            {filter === "upcoming"
              ? "Não há escalas futuras agendadas correspondentes à busca."
              : "Não há histórico de escalas passadas correspondentes à busca."}
          </p>
        </div>
      )}
      <FixedBandScaleManagerModal
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
      />
      <UpgradePlanModal 
        isOpen={showLimitModal} 
        onClose={() => setShowLimitModal(false)}
        featureKey={"bandScalesLimit" as any} 
      />
    </div>
  );
};

export default BandScalesPage;
