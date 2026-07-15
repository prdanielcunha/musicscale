import React, { useState, useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type {
  Scale,
  BandScale,
  Instrument,
  PopulatedSong,
  UserProfile,
  BandMember,
  InstrumentCategory,
  Tag,
  FixedBandScale,
} from "../../types";
import PremiumSheetModal from "../common/PremiumSheetModal";
import Button from "../common/Button";
import Spinner from "../common/Spinner";
import { useMusic } from "../../contexts/MusicDataContext";
import { useAuth } from "../../contexts/AuthContext";
import { useSafeAction } from "../../hooks/useSafeAction";
import { useCapability } from "../../hooks/useCapability";
import { useApi } from "../../contexts/ApiContext";
import { useTranslation } from "react-i18next";
import { useToast } from "../../contexts/ToastContext";
import { UserIcon } from "../icons/UserIcon";
import { PlusCircleIcon } from "../icons/PlusCircleIcon";
import { XCircleIcon } from "../icons/XCircleIcon";
import { MusicNoteIcon } from "../icons/MusicNoteIcon";
import { UsersIcon } from "../icons/UsersIcon";
import BandBuilder from "./BandBuilder";
import MusicBuilder from "./MusicBuilder";
import { AiContextualSuggestions } from "./AiContextualSuggestions";
import { resolveScaleDurationMinutes } from "../../utils/calendar";

const GripVerticalIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="9" cy="12" r="1"></circle>
    <circle cx="9" cy="5" r="1"></circle>
    <circle cx="9" cy="19" r="1"></circle>
    <circle cx="15" cy="12" r="1"></circle>
    <circle cx="15" cy="5" r="1"></circle>
    <circle cx="15" cy="19" r="1"></circle>
  </svg>
);

const ArrowUpIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2}
    stroke="currentColor"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4.5 15.75l7.5-7.5 7.5 7.5"
    />
  </svg>
);

const ArrowDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2}
    stroke="currentColor"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 8.25l-7.5 7.5-7.5-7.5"
    />
  </svg>
);

interface ModernScaleFormProps {
  isOpen: boolean;
  scaleType: "music" | "band";
  scaleToEdit: Partial<Scale | BandScale> | null;
  preselectedSongIds: string[];
  onSave: (
    scaleData:
      | Omit<Scale, "id" | "createdBy" | "createdAt">
      | Scale
      | Omit<BandScale, "id" | "createdBy" | "createdAt">
      | BandScale,
    idempotencyKey?: string
  ) => Promise<void>;
  onClose: () => void;
  isSubmitting: boolean;
  zIndexClass?: string;
}

import { useFeatureFlag } from "../../hooks/useFeatureFlag";

const formInputClass = "mt-1 input-base";
const formOptionClass = "bg-white dark:bg-[#151515] text-slate-900 dark:text-white";
const formLabelClass =
  "block text-[11px] font-black tracking-widest text-slate-400 uppercase dark:text-slate-500 mb-2 ml-1";

const ModernScaleForm: React.FC<ModernScaleFormProps> = ({
  isOpen,
  scaleType,
  scaleToEdit,
  preselectedSongIds,
  onSave,
  onClose,
  isSubmitting,
  zIndexClass,
}) => {
  const { t, i18n } = useTranslation();
  const {
    songs,
    eventTypes,
    locations,
    eventNames,
    instruments,
    tags,
    fixedBandScales,
    allUsers,
    populatedBandScales,
    populatedScales,
    refreshData,
  } = useMusic();

  const { userProfile, user, organization } = useAuth();
  const { executeSafeAction } = useSafeAction();
  const { hasCapability } = useCapability();
  const api = useApi();
  const { toast } = useToast();
  const isCommandApiV1Enabled = useFeatureFlag('musicscale.bandScaleCommandApiV1');

  const [formData, setFormData] = useState<Partial<Scale & BandScale>>({});
  
  // Nested Band Scale Creation State
  const [isCreatingNestedBandScale, setIsCreatingNestedBandScale] = useState(false);
  const [isCreatingNestedMusicScale, setIsCreatingNestedMusicScale] = useState(false);

  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const handleExplicitBootstrap = async () => {
    if (!organization?.id) return;
    setIsBootstrapping(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/v1/onboarding/bootstrap', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-organization-id': organization.id
         }
      });
      if (res.ok) {
        await refreshData(); // reload eventTypes and locations
      }
    } catch (e) {
      console.error("Failed to explicitly bootstrap taxonomy", e);
    } finally {
      setIsBootstrapping(false);
    }
  };

  const [isSubmittingNested, setIsSubmittingNested] = useState(false);
  
  const [selectedFixedBandScaleId, setSelectedFixedBandScaleId] = useState<string>("");

  const idempotencyKeyRef = useRef<string>("");
  const lastPayloadFingerprintRef = useRef<string>("");
  const isInitializedRef = useRef<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      idempotencyKeyRef.current = crypto.randomUUID();
      lastPayloadFingerprintRef.current = "";
      setSelectedFixedBandScaleId("");
    } else {
      isInitializedRef.current = false;
    }
  }, [isOpen]);

  const instrumentsByCat = useMemo(() => {
    const categoryOrder: InstrumentCategory[] = [
      "Ministro",
      "Voz",
      "Instrumento",
    ];
    const grouped: Record<InstrumentCategory, Instrument[]> = {
      Ministro: [],
      Voz: [],
      Instrumento: [],
    };
    const seenNames = new Set<string>();
    instruments.forEach((inst) => {
      const key = `${inst.category}-${inst.name.trim().toLowerCase()}`;
      if (!seenNames.has(key)) {
        seenNames.add(key);
        grouped[inst.category]?.push(inst);
      }
    });
    return categoryOrder.map((cat) => ({
      name: cat === "Voz" ? "Vozes" : cat,
      instruments: grouped[cat].sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [instruments]);

  useEffect(() => {
    if (!isOpen || isInitializedRef.current) {
      return;
    }

    const cultoType = eventTypes.find(e => e.name.toLowerCase() === 'culto');
    const mainLocation = locations.find(l => l.name.toLowerCase() === 'templo principal' || l.name.toLowerCase() === 'main sanctuary');
    
    const baseData = {
      date: scaleToEdit?.date || new Date().toISOString().split("T")[0],
      time: scaleToEdit?.time || "",
      eventTypeId: scaleToEdit?.eventTypeId || (scaleToEdit && "id" in scaleToEdit && scaleToEdit.id !== "CLONE" ? "" : (cultoType?.id || "")),
      locationId: scaleToEdit?.locationId || (scaleToEdit && "id" in scaleToEdit && scaleToEdit.id !== "CLONE" ? "" : (mainLocation?.id || "")),
      eventNameId: scaleToEdit?.eventNameId || "",
      observations: scaleToEdit?.observations || "",
    };

    if (scaleType === "music") {
      const musicScale = scaleToEdit as Scale;
      setFormData({
        ...baseData,
        songIds: musicScale?.songIds || preselectedSongIds || [],
        bandScaleId: musicScale?.bandScaleId || null,
        durationMinutes: resolveScaleDurationMinutes(musicScale?.durationMinutes),
      });
    } else {
      const bandScale = scaleToEdit as BandScale;
      setFormData({
        ...baseData,
        assignments: bandScale?.assignments || [],
        musicScaleId: bandScale?.musicScaleId || null,
      });
    }

    isInitializedRef.current = true;
  }, [isOpen, scaleToEdit, preselectedSongIds, scaleType, eventTypes, locations]);

  useEffect(() => {
    if (!isOpen) return;

    // Do not pre-fill for existing scales that may intentionally have optional empty fields
    const isExistingScale = scaleToEdit && "id" in scaleToEdit && scaleToEdit.id !== "CLONE";
    if (isExistingScale) return;

    setFormData(prev => {
      const next = { ...prev };

      if (!next.eventTypeId && eventTypes.length > 0) {
        next.eventTypeId =
          eventTypes.find(t => t.name.toLowerCase().includes('culto'))?.id ||
          eventTypes[0].id;
      }

      if (!next.locationId && locations.length > 0) {
        next.locationId =
          locations.find(l => l.name.toLowerCase().includes('templo principal') || l.name.toLowerCase().includes('main sanctuary'))?.id ||
          locations[0].id;
      }

      return next;
    });
  }, [isOpen, eventTypes, locations, scaleToEdit]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSongToggle = (songId: string) => {
    setFormData((prev) => {
      const currentSongIds = prev.songIds || [];
      const newSongIds = currentSongIds.includes(songId)
        ? currentSongIds.filter((id: string) => id !== songId)
        : [...currentSongIds, songId];
      return { ...prev, songIds: newSongIds };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const commonData = {
      date: formData.date,
      time: formData.time || null,
      eventTypeId: formData.eventTypeId,
      locationId: formData.locationId,
      eventNameId: formData.eventNameId || null,
      observations: formData.observations,
    };

    let finalData;
    if (scaleType === "music") {
      const selectedSongs = formData.songIds || [];
      if (selectedSongs.length === 0) {
        toast({ type: 'error', message: t('scaleModal.minimumOneSong', 'Selecione pelo menos uma música para a escala de músicas.') });
        return;
      }
      const duration = Number(formData.durationMinutes);
      if (isNaN(duration) || duration < 1 || !Number.isInteger(duration)) {
        toast({ type: 'error', message: t('scaleModal.invalidDuration', 'Informe uma duração válida para o evento.') });
        return;
      }
      finalData = { 
        ...commonData, 
        songIds: selectedSongs, 
        bandScaleId: formData.bandScaleId || null,
        durationMinutes: duration,
      };
    } else {
      const validAssignments = formData.assignments ? formData.assignments.filter(
        (a: BandMember) => a.userId && a.instrumentId,
      ) : [];
      if (validAssignments.length === 0) {
        toast({ type: 'error', message: t('scaleModal.minimumOneMember', 'Adicione pelo menos um integrante à escala da banda.') });
        return;
      }
      finalData = {
        ...commonData,
        assignments: validAssignments,
        musicScaleId: formData.musicScaleId || null,
      };
    }

    const payloadFingerprint = JSON.stringify(finalData);
    if (payloadFingerprint !== lastPayloadFingerprintRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
      lastPayloadFingerprintRef.current = payloadFingerprint;
    }

    if (scaleToEdit && "id" in scaleToEdit && scaleToEdit.id !== "CLONE") {
      await onSave({ ...(scaleToEdit as Scale | BandScale), ...finalData }, idempotencyKeyRef.current);
    } else {
      await onSave(finalData as any, idempotencyKeyRef.current);
    }
  };

  const stepsMusic = [
    { id: 'event', label: t('scaleModal.stepEvent', 'Evento') },
    { id: 'link', label: t('scaleModal.stepLinkBand', 'Banda') },
    { id: 'build', label: t('scaleModal.stepSetlist', 'Repertório') },
    { id: 'review', label: t('scaleModal.stepReview', 'Revisão') }
  ];
  
  const stepsBand = [
    { id: 'link', label: t('scaleModal.stepLinkMusic', 'Músicas') },
    { id: 'build', label: t('scaleModal.stepFormation', 'Formação') },
    { id: 'review', label: t('scaleModal.stepReview', 'Revisão') }
  ];

  const steps = scaleType === "music" ? stepsMusic : stepsBand;
  const [currentStep, setCurrentStep] = useState(0);

  const availableBandScales = useMemo(() => {
    if (!populatedBandScales) return [];
    const today = new Date();
    today.setHours(0,0,0,0);
    return [...populatedBandScales]
      .filter(bs => {
          const dateObj = new Date(bs.date + "T00:00:00");
          return dateObj >= today || bs.id === formData.bandScaleId;
      })
      .sort((a,b) => a.date.localeCompare(b.date));
  }, [populatedBandScales, formData.bandScaleId]);

  const availableMusicScales = useMemo(() => {
    if (!populatedScales) return [];
    const today = new Date();
    today.setHours(0,0,0,0);
    return [...populatedScales]
      .filter(ms => {
          const dateObj = new Date(ms.date + "T00:00:00");
          return dateObj >= today || ms.id === formData.musicScaleId;
      })
      .sort((a,b) => a.date.localeCompare(b.date));
  }, [populatedScales, formData.musicScaleId]);

  const handleApplyFixedScale = (scaleId: string) => {
    const selectedScale = fixedBandScales.find((s) => s.id === scaleId);
    if (!selectedScale) return;

    setSelectedFixedBandScaleId(scaleId);
    setFormData((prev) => ({
      ...prev,
      // Deep copy to prevent mutating the original fixed scale's assignments
      assignments: JSON.parse(JSON.stringify(selectedScale.assignments || [])),
    }));
  };

  const handleNext = () => {
     if (steps[currentStep]?.id === 'event') {
       if (scaleType === "music") {
         if (!formData.date || !formData.time || !formData.eventTypeId || !formData.locationId) {
           toast({ type: 'error', message: t('scaleModal.requiredFields', 'Preencha Data, Horário, Culto e Local antes de avançar.') });
           return;
         }
       } else {
         if (!formData.date || !formData.eventTypeId || !formData.locationId) {
           toast({ type: 'error', message: t('scaleModal.requiredFields', 'Preencha Data, Culto e Local antes de avançar.') });
           return;
         }
       }
     }
     if (currentStep < steps.length - 1) setCurrentStep(s => s + 1);
  };
  const handleBack = () => {
     if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  const footer = (
    <div className="flex flex-col-reverse sm:flex-row items-center justify-between w-full gap-3 sm:gap-4">
      <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-4 w-full sm:w-auto items-center">
        <div className="text-[12px] font-medium text-slate-500 w-full text-center sm:text-left mt-2 sm:mt-0">
          {scaleType === "music" ? (
             `${t('scaleModal.musicCount', { count: formData.songIds?.length || 0 })} · ${formData.bandScaleId ? t('scaleModal.bandLinked') : t('scaleModal.bandNotLinked')}`
          ) : (
             `${t('scaleModal.memberCount', { count: formData.assignments?.length || 0 })} · ${formData.musicScaleId ? t('scaleModal.musicLinked') : t('scaleModal.musicNotLinked')}`
          )}
        </div>
      </div>
      
      <div className="flex gap-2.5 w-full sm:w-auto ml-auto sm:min-w-[280px]">
        <Button 
          type="button" 
          variant="secondary" 
          onClick={currentStep > 0 ? handleBack : onClose} 
          className="flex-1 sm:flex-none h-12 rounded-xl text-[14px]"
        >
          {currentStep > 0 ? t('scaleModal.back', 'Voltar') : t('scaleModal.cancel', 'Cancelar')}
        </Button>
        {currentStep < steps.length - 1 ? (
          <Button 
            key="btn-next"
            type="button" 
            onClick={(e) => {
              e.preventDefault();
              handleNext();
            }} 
            className="flex-1 sm:flex-none h-12 rounded-xl text-[14px]"
          >
            {t('scaleModal.next', 'Avançar')}
          </Button>
        ) : (
          <Button 
            key="btn-submit"
            type="button" 
            onClick={(e) => handleSubmit(e as any)}
            disabled={isSubmitting} 
            className="flex-1 sm:flex-none h-12 rounded-xl text-[14px] bg-primary text-white hover:bg-primary-dark shadow-[0_0_20px_rgba(59,130,246,0.3)] border-none"
          >
            {isSubmitting ? <Spinner size="sm" /> : t('scaleModal.save', 'Salvar')}
          </Button>
        )}
      </div>
    </div>
  );

  const getSubtitle = () => {
    const parts = [];
    if (formData.date) {
      const d = new Date(formData.date + "T12:00:00");
      parts.push(d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }));
    }
    
    if (formData.eventTypeId) {
      const et = eventTypes.find(e => e.id === formData.eventTypeId);
      if (et) parts.push(et.name);
    }
    
    if (formData.locationId) {
      const loc = locations.find(l => l.id === formData.locationId);
      if (loc) parts.push(loc.name);
    }
    
    if (scaleType === "music") {
      parts.push(t('scaleModal.musicCount', { count: formData.songIds?.length || 0 }));
      parts.push(formData.bandScaleId ? t('scaleModal.bandLinked') : t('scaleModal.bandNotLinked'));
    } else {
      parts.push(t('scaleModal.memberCount', { count: formData.assignments?.length || 0 }));
      parts.push(formData.musicScaleId ? t('scaleModal.musicLinked') : t('scaleModal.musicNotLinked'));
    }
    
    return parts.join(" · ");
  };

  const titleText = scaleToEdit?.id && scaleToEdit.id !== "CLONE"
    ? (scaleType === "music" ? t('scaleModal.musicScaleTitleEdit') : t('scaleModal.bandScaleTitleEdit'))
    : (scaleType === "music" ? t('scaleModal.musicScaleTitleNew') : t('scaleModal.bandScaleTitleNew'));

  const subtitleText = scaleType === "music" ? t('scaleModal.scaleModalSubtitleMusic') : t('scaleModal.scaleModalSubtitleBand');

  const modalTitle = (
    <div className="flex flex-col gap-1.5 mb-2">
      <span className="text-[22px] font-black tracking-tight text-slate-900 dark:text-white leading-tight">{titleText}</span>
      <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400 max-w-lg">{subtitleText}</span>
      <div className="flex items-center mt-2.5">
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary-dark/70 dark:text-primary-light/70 bg-primary/10 px-2 py-1 rounded-md">{getSubtitle()}</span>
      </div>
    </div>
  );

  return (
    <>
      <PremiumSheetModal
        isOpen={isOpen}
        onClose={onClose}
        title={modalTitle}
        maxWidth="max-w-5xl"
        footer={footer}
        zIndexClass={zIndexClass}
      >
        <form id="scale-form" onSubmit={handleSubmit} className="flex flex-col flex-1">
          <div className="flex w-full mb-6 border-b border-slate-200 dark:border-white/10 overflow-x-auto custom-scrollbar -mx-2 px-2 sm:mx-0 sm:px-0 shrink-0 sticky -top-4 sm:-top-5 md:-top-6 bg-white/95 dark:bg-[#05070D]/90 backdrop-blur-md z-20 pb-1 pt-4 sm:pt-5 md:pt-6 -mt-4 sm:-mt-5 md:-mt-6">
              {steps.map((step, idx) => (
                  <button
                      key={step.id}
                      type="button"
                      onClick={() => setCurrentStep(idx)}
                      className={`px-4 py-3 text-[13px] font-bold tracking-wide whitespace-nowrap border-b-2 transition-colors ${currentStep === idx ? 'text-primary border-primary' : 'text-slate-500 border-transparent hover:text-slate-800 dark:hover:text-slate-300'}`}
                  >
                      {step.label}
                  </button>
              ))}
          </div>

        {/* Step 0: Evento */}
        <div className={steps[currentStep]?.id === 'event' ? "flex flex-col space-y-6 animate-fade-in p-1" : "hidden"}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label htmlFor="date" className={formLabelClass}>
                {t('scaleModal.date')} {scaleType === "band" && <span className="text-white/40 text-[11px] font-normal tracking-normal ml-1">(Opcional)</span>}
              </label>
              <div className="flex gap-3">
                <input
                  type="date"
                  name="date"
                  id="date"
                  value={formData.date || ""}
                  onChange={handleChange}
                  className={formInputClass}
                />
                <input
                  type="time"
                  name="time"
                  id="time"
                  value={formData.time || ""}
                  onChange={handleChange}
                  className={`${formInputClass} w-32`}
                />
              </div>
            </div>
            <div>
              <label htmlFor="eventTypeId" className={formLabelClass}>
                {t('scaleModal.eventType')} {scaleType === "band" && <span className="text-white/40 text-[11px] font-normal tracking-normal ml-1">(Opcional)</span>}
              </label>
              <select
                name="eventTypeId"
                id="eventTypeId"
                value={formData.eventTypeId || ""}
                onChange={handleChange}
                className={formInputClass}
              >
                <option value="" disabled={scaleType === "music"} className={formOptionClass}>
                  {t('scaleModal.selectPlaceholder')}
                </option>
                {eventTypes.map((et) => (
                  <option key={et.id} value={et.id} className={formOptionClass}>
                    {et.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="locationId" className={formLabelClass}>
                {t('scaleModal.location')} {scaleType === "band" && <span className="text-white/40 text-[11px] font-normal tracking-normal ml-1">(Opcional)</span>}
              </label>
              <select
                name="locationId"
                id="locationId"
                value={formData.locationId || ""}
                onChange={handleChange}
                className={formInputClass}
              >
                <option value="" disabled={scaleType === "music"} className={formOptionClass}>
                  {t('scaleModal.selectPlaceholder')}
                </option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id} className={formOptionClass}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(eventTypes.length === 0 || locations.length === 0) && userProfile?.organizationId && (
            <div className="p-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="text-sm font-semibold text-zinc-200">
                  Configuração inicial recomendada
                </h4>
                <p className="text-xs text-zinc-400">
                  Seu ministério ainda não possui tipos de evento ou locais cadastrados. Podemos criar o padrão para você de forma instantânea.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExplicitBootstrap}
                disabled={isBootstrapping}
                className="px-4 py-2 text-xs font-bold bg-white text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50 shrink-0 flex items-center gap-2 cursor-pointer"
              >
                {isBootstrapping && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isBootstrapping ? "Configurando..." : "Preparar automaticamente"}
              </button>
            </div>
          )}

          <div className={scaleType === "music" ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "block"}>
            <div>
              <label htmlFor="eventNameId" className={formLabelClass}>
                {t('scaleModal.eventName')}
              </label>
              <select
                name="eventNameId"
                id="eventNameId"
                value={formData.eventNameId || ""}
                onChange={handleChange}
                className={formInputClass}
              >
                <option value="" className={formOptionClass}>{t('scaleModal.none')}</option>
                {eventNames.map((en) => (
                  <option key={en.id} value={en.id} className={formOptionClass}>
                    {en.name}
                  </option>
                ))}
              </select>
            </div>

            {scaleType === "music" && (
              <div>
                <label htmlFor="durationSelect" className={formLabelClass}>
                  Tempo do evento
                </label>
                <div className="flex gap-3">
                  <select
                    name="durationSelect"
                    id="durationSelect"
                    value={
                      [30, 60, 90, 120, 150, 180, 240].includes(Number(formData.durationMinutes))
                        ? String(formData.durationMinutes)
                        : "custom"
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "custom") {
                        setFormData((prev) => ({ ...prev, durationMinutes: prev.durationMinutes || 120 }));
                      } else {
                        setFormData((prev) => ({ ...prev, durationMinutes: Number(val) }));
                      }
                    }}
                    className={formInputClass}
                  >
                    <option value="30" className={formOptionClass}>30 minutos</option>
                    <option value="60" className={formOptionClass}>1 hora</option>
                    <option value="90" className={formOptionClass}>1h 30m</option>
                    <option value="120" className={formOptionClass}>2 horas (Padrão)</option>
                    <option value="150" className={formOptionClass}>2h 30m</option>
                    <option value="180" className={formOptionClass}>3 horas</option>
                    <option value="240" className={formOptionClass}>4 horas</option>
                    <option value="custom" className={formOptionClass}>Outra duração...</option>
                  </select>
                  
                  {![30, 60, 90, 120, 150, 180, 240].includes(Number(formData.durationMinutes)) && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        name="durationMinutes"
                        id="durationMinutes"
                        value={formData.durationMinutes || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((prev) => ({ ...prev, durationMinutes: val === "" ? "" as any : Number(val) }));
                        }}
                        placeholder="Minutos"
                        min="1"
                        className={`${formInputClass} w-32`}
                      />
                      <span className="text-xs text-slate-400 mt-1 whitespace-nowrap">minutos</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 1: Vínculo */}
        <div className={steps[currentStep]?.id === 'link' ? "flex flex-col animate-fade-in p-1" : "hidden"}>
          {scaleType === "music" && (
          <div className="bg-slate-50 dark:bg-[#1C1C1E]/50 border border-slate-200 dark:border-white/5 rounded-2xl p-5 sm:p-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
               <div>
                  <h3 className="text-[15px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
                     {t('scaleModal.linkBandScale')}
                     <span className="bg-primary/10 text-primary text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full">{t('scaleModal.optional')}</span>
                  </h3>
                  <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">{t('scaleModal.linkBandDesc')}</p>
               </div>
               {hasCapability('musicscale.scales.manage') && (
                 <Button type="button" variant="secondary" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsCreatingNestedBandScale(true); }} className="sm:w-auto w-full text-[13px] whitespace-nowrap">
                    {t('scaleModal.createNew')}
                 </Button>
               )}
            </div>
            
            {availableBandScales.length === 0 ? (
               <div className="flex flex-col items-center justify-center p-6 border border-dashed border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20">
                  <span className="text-[14px] font-medium text-slate-600 dark:text-slate-300">{t('scaleModal.noBandScales')}</span>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 text-center">
                    {hasCapability('musicscale.scales.manage') 
                        ? t('scaleModal.noBandScalesDesc')
                        : t('scaleModal.noBandScalesNoPerm')}
                  </p>
                  {hasCapability('musicscale.scales.manage') && (
                      <Button type="button" variant="secondary" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsCreatingNestedBandScale(true); }} className="mt-4 text-[13px]">
                        {t('scaleModal.createBandScaleBtn')}
                      </Button>
                  )}
               </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                {availableBandScales.map(bs => {
                   const isSelected = formData.bandScaleId === bs.id;
                   const dateObj = new Date(bs.date + "T00:00:00");
                   const day = dateObj.getDate().toString().padStart(2, "0");
                   const month = dateObj.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
                   
                   return (
                      <div 
                         key={bs.id} 
                         onClick={() => setFormData(prev => ({...prev, bandScaleId: isSelected ? null : bs.id}))}
                         className={`flex cursor-pointer border rounded-xl overflow-hidden transition-all duration-300 ${isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-slate-200 dark:border-white/5 bg-white dark:bg-[#252528] hover:border-primary/50 hover:shadow-md"}`}
                      >
                         <div className={`w-12 flex-shrink-0 flex flex-col items-center justify-center p-2 border-r ${isSelected ? "border-primary/20 bg-primary/10" : "border-slate-200 dark:border-white/5 dark:bg-black/20"}`}>
                            <span className={`text-[9px] font-black uppercase tracking-widest ${isSelected ? "text-primary": "text-slate-400"}`}>{month}</span>
                            <span className={`text-lg font-black leading-none mt-1 ${isSelected ? "text-primary": "text-slate-700 dark:text-slate-300"}`}>{day}</span>
                         </div>
                         <div className="p-3 flex-1 min-w-0 flex flex-col justify-center">
                             <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[13px] font-bold truncate ${isSelected ? "text-primary" : "text-slate-800 dark:text-gray-100"}`}>{bs.eventType.name}</span>
                                {isSelected && <span className="text-[9px] uppercase tracking-widest font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded ml-auto">{t('scaleModal.selected')}</span>}
                             </div>
                             {bs.eventName && <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate mb-1">{bs.eventName.name}</span>}
                             <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium">
                                 <span className="flex items-center gap-1"><UsersIcon className="w-3 h-3" /> {t('scaleModal.memberCount', { count: bs.assignments.length })}</span>
                                 {bs.musicScaleId && !isSelected && <span className="text-amber-500 opacity-80 truncate">{t('scaleModal.alreadyLinked')}</span>}
                             </div>
                         </div>
                      </div>
                   )
                })}
              </div>
            )}
          </div>
        )}

        {scaleType === "band" && (
          <div className="bg-slate-50 dark:bg-[#1C1C1E]/50 border border-slate-200 dark:border-white/5 rounded-2xl p-5 sm:p-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
               <div>
                  <h3 className="text-[15px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
                     {t('scaleModal.linkMusicScale')}
                     <span className="bg-primary/10 text-primary text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full">{t('scaleModal.optional')}</span>
                  </h3>
                  <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">{t('scaleModal.linkMusicDesc')}</p>
               </div>
               {hasCapability('musicscale.scales.manage') && (
                 <Button type="button" variant="secondary" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsCreatingNestedMusicScale(true); }} className="sm:w-auto w-full text-[13px] whitespace-nowrap">
                    {t('scaleModal.createNew')}
                 </Button>
               )}
            </div>
            
            {availableMusicScales.length === 0 ? (
               <div className="flex flex-col items-center justify-center p-6 border border-dashed border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20">
                  <span className="text-[14px] font-medium text-slate-600 dark:text-slate-300">{t('bandScaleModal.noMusicScaleLinked')}</span>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 text-center">
                    {hasCapability('musicscale.scales.manage') 
                        ? t('scaleModal.noMusicScalesDesc')
                        : t('scaleModal.noMusicScalesNoPerm')}
                  </p>
                  {hasCapability('musicscale.scales.manage') && (
                      <Button type="button" variant="secondary" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsCreatingNestedMusicScale(true); }} className="mt-4 text-[13px]">
                        {t('bandScaleModal.createMusicScale')}
                      </Button>
                  )}
               </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                {availableMusicScales.map(ms => {
                   const isSelected = formData.musicScaleId === ms.id;
                   const dateObj = new Date(ms.date + "T00:00:00");
                   const day = dateObj.getDate().toString().padStart(2, "0");
                   const month = dateObj.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
                   
                   return (
                      <div 
                         key={ms.id} 
                         onClick={() => setFormData(prev => ({...prev, musicScaleId: isSelected ? null : ms.id}))}
                         className={`flex cursor-pointer border rounded-xl overflow-hidden transition-all duration-300 ${isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-slate-200 dark:border-white/5 bg-white dark:bg-[#252528] hover:border-primary/50 hover:shadow-md"}`}
                      >
                         <div className={`w-12 flex-shrink-0 flex flex-col items-center justify-center p-2 border-r ${isSelected ? "border-primary/20 bg-primary/10" : "border-slate-200 dark:border-white/5 dark:bg-black/20"}`}>
                            <span className={`text-[9px] font-black uppercase tracking-widest ${isSelected ? "text-primary": "text-slate-400"}`}>{month}</span>
                            <span className={`text-lg font-black leading-none mt-1 ${isSelected ? "text-primary": "text-slate-700 dark:text-slate-300"}`}>{day}</span>
                         </div>
                         <div className="p-3 flex-1 min-w-0 flex flex-col justify-center">
                             <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[13px] font-bold truncate ${isSelected ? "text-primary" : "text-slate-800 dark:text-gray-100"}`}>{ms.eventType.name}</span>
                                {isSelected && <span className="text-[9px] uppercase tracking-widest font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded ml-auto">{t('scaleModal.selected')}</span>}
                             </div>
                             {ms.eventName && <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate mb-1">{ms.eventName.name}</span>}
                             <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium">
                                 <span className="flex items-center gap-1"><MusicNoteIcon className="w-3 h-3" /> {t('scaleModal.musicCount', { count: ms.songs.length })}</span>
                                 {ms.bandScaleId && !isSelected && <span className="text-amber-500 opacity-80 truncate">{t('scaleModal.alreadyLinked')}</span>}
                             </div>
                         </div>
                      </div>
                   )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Montagem */}
        <div className={steps[currentStep]?.id === 'build' ? "flex flex-col animate-fade-in gap-4" : "hidden"}>
          {scaleType === "music" && (
            <MusicBuilder
              formData={formData}
              setFormData={setFormData}
              songs={songs}
              tags={tags}
            />
          )}

          {scaleType === "band" && (
            <div className="flex flex-col space-y-6 pt-1">
              <div className="shrink-0 bg-slate-50 dark:bg-[#1C1C1E]/50 border border-slate-200 dark:border-white/5 rounded-2xl p-5 sm:p-6 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                   <div>
                      <h3 className="text-[15px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
                         {t('bandScaleModal.useSavedFormation')}
                      </h3>
                   </div>
                   <div className="w-full sm:w-auto">
                      <select
                        id="fixed-scale-select"
                        value={selectedFixedBandScaleId}
                        onChange={(e) => handleApplyFixedScale(e.target.value)}
                        className="block w-full sm:w-64 rounded-xl bg-white dark:bg-[#252528] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white px-4 py-2.5 shadow-sm outline-none hover:border-primary/40 focus:ring-[3px] focus:ring-primary/10 transition-all font-medium text-xs"
                      >
                        <option value="" disabled className={formOptionClass}>
                          {t('scaleModal.fixedScalePlaceholder')}
                        </option>
                        {fixedBandScales.map((fs) => (
                          <option key={fs.id} value={fs.id} className={formOptionClass}>
                            {fs.name}
                          </option>
                        ))}
                      </select>
                   </div>
                </div>
              </div>
              
              <div className="flex flex-col">
                <BandBuilder
                  formData={formData}
                  setFormData={setFormData}
                  instrumentsByCat={instrumentsByCat}
                  allUsers={allUsers}
                  populatedBandScales={populatedBandScales}
                  musicScales={populatedScales}
                />
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Revisão e Observações */}
        <div className={steps[currentStep]?.id === 'review' ? "flex flex-col animate-fade-in space-y-6 p-1" : "hidden"}>
          {steps[currentStep]?.id === 'review' && (
            <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl p-5 sm:p-6 mb-2">
              <h4 className="text-[13px] font-black text-slate-800 dark:text-slate-200 mb-4 tracking-wider uppercase">
                {t('scaleModal.reviewSummary', 'Resumo da Escala')}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm font-medium">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] sm:text-xs uppercase font-bold tracking-widest mb-1">{t('scaleModal.date')}</span>
                  <span className="text-slate-900 dark:text-white font-bold">
                    {formData.date ? new Date(formData.date + "T12:00:00").toLocaleDateString(
                      i18n.language === "es" ? "es-ES" : i18n.language === "en" ? "en-US" : "pt-BR", 
                      { day: "2-digit", month: "2-digit", year: "numeric" }
                    ) : "-"}
                    {formData.time ? ` ${t('notifications.atTime', 'às')} ${formData.time}` : ""}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] sm:text-xs uppercase font-bold tracking-widest mb-1">{t('scaleModal.eventType')} / {t('scaleModal.location')}</span>
                  <span className="text-slate-900 dark:text-white font-bold">
                    {eventTypes.find((e) => e.id === formData.eventTypeId)?.name || "-"}
                    {' • '}
                    {locations.find((l) => l.id === formData.locationId)?.name || "-"}
                  </span>
                </div>
                
                {formData.eventNameId && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px] sm:text-xs uppercase font-bold tracking-widest mb-1">{t('scaleModal.eventName')}</span>
                    <span className="text-slate-900 dark:text-white font-bold">
                      {eventNames.find((e) => e.id === formData.eventNameId)?.name || "-"}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-5 border-t border-slate-200 dark:border-white/10">
                {scaleType === "music" ? (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px] sm:text-xs uppercase font-bold tracking-widest mb-3">{t('scaleModal.repertoire', 'Repertório')}</span>
                    {formData.songIds && formData.songIds.length > 0 ? (
                      <ol className="list-decimal pl-5 space-y-1.5 text-slate-900 dark:text-white">
                        {formData.songIds.map(id => {
                          const song = songs.find(s => s.id === id);
                          return <li key={id} className="text-sm font-semibold">{song ? song.title : "..."}</li>;
                        })}
                      </ol>
                    ) : (
                      <span className="text-sm text-slate-400 italic">Nenhuma música selecionada</span>
                    )}
                  </div>
                ) : (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px] sm:text-xs uppercase font-bold tracking-widest mb-3">{t('scaleModal.team', 'Formação da Equipe')}</span>
                    {formData.assignments && formData.assignments.length > 0 ? (
                      <ul className="space-y-2 text-slate-900 dark:text-white">
                        {formData.assignments.filter(a => a.userId && a.instrumentId).map((a, i) => {
                          const user = allUsers.find(u => u.uid === a.userId);
                          const inst = instruments.find(ins => ins.id === a.instrumentId);
                          return (
                            <li key={i} className="text-sm flex items-center gap-2.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary/60"></span>
                              <span className="font-bold truncate">{user ? user.displayName : "..."}</span>
                              <span className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">({inst ? inst.name : "..."})</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <span className="text-sm text-slate-400 italic">Nenhum integrante selecionado</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div>
            <label htmlFor="observations" className={formLabelClass}>
              {t('scaleModal.observations')}
            </label>
            <textarea
              name="observations"
            id="observations"
            rows={3}
            value={formData.observations || ""}
            placeholder={t('scaleModal.observationsPlaceholder')}
            onChange={handleChange}
            className={`${formInputClass} min-h-[60px]`}
          ></textarea>
        </div>
      </div>
      </form>
      </PremiumSheetModal>

      {isCreatingNestedBandScale && (
        <ModernScaleForm
          isOpen={true}
          scaleType="band"
          preselectedSongIds={[]}
          scaleToEdit={{
            date: formData.date || new Date().toISOString().split("T")[0],
            time: formData.time || "",
            eventTypeId: formData.eventTypeId || "",
            locationId: formData.locationId || "",
            eventNameId: formData.eventNameId || "",
            observations: ""
          }}
          onSave={async (nestedData, idempotencyKey) => {
            if (!api) return;
            setIsSubmittingNested(true);
            try {
              let bandScaleId: string;
              
              console.info('[BandScale Save Path] => ' + JSON.stringify({
                organizationId: api.bandScales['orgId'] || 'unknown',
                featureFlagEnabled: isCommandApiV1Enabled,
                selectedWriter: isCommandApiV1Enabled ? 'command_api' : 'legacy_repository'
              }));

              if (isCommandApiV1Enabled) {
                  const result = await api.bandScaleCommands.create(nestedData, idempotencyKey || crypto.randomUUID());
                  bandScaleId = result.scaleId;
              } else {
                  bandScaleId = await api.bandScales.create(nestedData as any);
              }
              setFormData(prev => ({...prev, bandScaleId}));
              setIsCreatingNestedBandScale(false);
              await refreshData();
              toast({ type: 'success', message: t('scaleModal.bandScaleCreated', 'Escala da banda criada e vinculada com sucesso.') });
            } catch (e: any) {
              console.error(e);
              toast({ type: 'error', message: t('common.error', 'Erro'), description: `${e?.message || t('common.errorCreatingScale', 'Erro ao criar escala')} (${e?.code || ''})` });
            } finally {
              setIsSubmittingNested(false);
            }
          }}
          onClose={() => setIsCreatingNestedBandScale(false)}
          isSubmitting={isSubmittingNested}
          zIndexClass="z-[9999]"
        />
      )}

      {isCreatingNestedMusicScale && (
        <ModernScaleForm
          isOpen={true}
          scaleType="music"
          preselectedSongIds={[]}
          scaleToEdit={{
            date: formData.date || new Date().toISOString().split("T")[0],
            time: formData.time || "",
            eventTypeId: formData.eventTypeId || "",
            locationId: formData.locationId || "",
            eventNameId: formData.eventNameId || "",
            observations: "",
            songIds: []
          }}
          onSave={async (nestedData) => {
            if (!api) return;
            setIsSubmittingNested(true);
            try {
              const musicScaleId = await api.scales.create(nestedData as any);
              setFormData(prev => ({...prev, musicScaleId}));
              setIsCreatingNestedMusicScale(false);
              await refreshData();
              toast({ type: 'success', message: t('scaleModal.musicScaleCreated', 'Escala de músicas criada e vinculada com sucesso.') });
            } catch (e: any) {
              console.error(e);
              toast({ type: 'error', message: t('common.error', 'Erro'), description: `${e?.message || t('common.errorCreatingScale', 'Erro ao criar escala')} (${e?.code || ''})` });
            } finally {
              setIsSubmittingNested(false);
            }
          }}
          onClose={() => setIsCreatingNestedMusicScale(false)}
          isSubmitting={isSubmittingNested}
          zIndexClass="z-[9999]"
        />
      )}
    </>
  );
};

export default ModernScaleForm;
