import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import type {
  FixedBandScale,
  BandMember,
  Instrument,
  UserProfile,
  InstrumentCategory,
} from "../../types";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Spinner from "../common/Spinner";
import { useMusic } from "../../contexts/MusicDataContext";
import BandBuilder from "../scales/BandBuilder";

const formInputClass = "mt-1 input-base";
const formLabelClass = "block text-[11px] font-black tracking-widest text-slate-400 uppercase dark:text-slate-500 mb-2 ml-1";

interface FixedBandScaleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    data:
      | Omit<FixedBandScale, "id" | "createdBy" | "createdAt">
      | FixedBandScale,
  ) => Promise<void>;
  scaleToEdit: FixedBandScale | null;
  isSubmitting: boolean;
  saveError?: string | null;
}

const FixedBandScaleFormModal: React.FC<FixedBandScaleFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  scaleToEdit,
  isSubmitting,
  saveError,
}) => {
  const { t } = useTranslation();
  const { allUsers, instruments, usersStatus, refreshData } = useMusic();
  const { user, effectiveOrganizationId } = useAuth();
  const [verifiedMembers, setVerifiedMembers] = useState<UserProfile[] | null>(null);
  const [verifiedStatus, setVerifiedStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [retryDirectory, setRetryDirectory] = useState(0);

  // Resolve current tenant membership when this critical form opens.
  // First-login owners may open it before the background roster loads.
  useEffect(() => {
    setVerifiedMembers(null);
    if (!isOpen || !user || !effectiveOrganizationId) return;
    const controller = new AbortController();
    let cancelled = false;
    setVerifiedStatus('loading');
    void (async () => {
      try {
        const token = await user.getIdToken();
        if (cancelled) return;
        const response = await fetch(
          '/api/orgs/' + encodeURIComponent(effectiveOrganizationId) + '/member-directory',
          { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', 'Cache-Control': 'no-store' }, signal: controller.signal },
        );
        if (!response.ok) throw new Error('MEMBER_DIRECTORY_UNAVAILABLE');
        const payload = await response.json();
        if (!payload?.success || payload.organizationId !== effectiveOrganizationId || !Array.isArray(payload.members)) {
          throw new Error('INVALID_TENANT_DIRECTORY_RESPONSE');
        }
        const members = payload.members
          .filter((member: any) => member?.organizationId === effectiveOrganizationId && typeof member.uid === 'string' && member.uid.trim())
          .map((member: any) => ({ ...member, id: member.uid, uid: member.uid })) as UserProfile[];
        if (!cancelled) {
          setVerifiedMembers(members);
          setVerifiedStatus('ready');
        }
      } catch {
        if (!cancelled) setVerifiedStatus('error');
      }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [isOpen, user?.uid, effectiveOrganizationId, retryDirectory]);

  // Only verified members of the active tenant can be assigned. The already
  // scoped MusicData directory remains visible while refresh is pending.
  const eligibleUsers = verifiedMembers ?? allUsers.filter(
    member => member.organizationId === effectiveOrganizationId,
  );
  const [formData, setFormData] = useState<{
    name: string;
    assignments: BandMember[];
  }>({ name: "", assignments: [] });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: scaleToEdit?.name || "",
        assignments: scaleToEdit?.assignments || [],
      });
    }
  }, [isOpen, scaleToEdit]);

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

  const validAssignments = formData.assignments.filter(
    (assignment) => assignment.userId && assignment.instrumentId,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = formData.name.trim();
    if (!name || validAssignments.length === 0) return;

    const normalizedFormData = {
      name,
      assignments: validAssignments.map((assignment) => ({ ...assignment })),
    };
    const finalData = scaleToEdit
      ? { ...scaleToEdit, ...normalizedFormData }
      : normalizedFormData;
    onSave(finalData);
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
        {t("common.cancel", "Cancelar")}
      </Button>
      {(!formData.name.trim() || validAssignments.length === 0) && (
        <span className="w-full text-right text-[11px] text-white/55" aria-live="polite">
          {t('bandScalesPage.saveRequiresNameAndMember', 'Para salvar, informe o nome e escolha ao menos um integrante para uma função.')}
        </span>
      )}
      <Button
        type="submit"
        form="fixed-scale-form"
        disabled={isSubmitting || !formData.name.trim() || validAssignments.length === 0}
      >
        {isSubmitting ? <Spinner size="sm" /> : t("common.save", "Salvar")}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={scaleToEdit
        ? t("bandScalesPage.editFixedScaleTitle", "Editar Escala Fixa")
        : t("bandScalesPage.newFixedScaleTitle", "Nova Escala Fixa")}
      footer={footer}
      maxWidth="max-w-4xl"
      zIndexClass="z-[10040]"
    >
      <form id="fixed-scale-form" onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className={formLabelClass}>
            {t("bandScalesPage.fixedScaleName", "Nome da Escala")}
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) =>
              setFormData((p) => ({ ...p, name: e.target.value }))
            }
            className={formInputClass}
            required
            placeholder={t("bandScalesPage.fixedScaleNamePlaceholder", "Ex.: Banda Principal, Equipe A...")}
          />
        </div>

        {saveError && (
          <div role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {saveError}
          </div>
        )}
        <div className="flex flex-col">
          <div className="mb-4 rounded-xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 text-xs leading-relaxed text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
            {t("bandScalesPage.fixedScaleMembersHint", "Monte a formação fixa. A presença de cada integrante será confirmada depois, dentro de cada Escala de Músicas.")}
          </div>
          <BandBuilder
            compactDesktopLayout
            memberDirectoryState={verifiedMembers ? verifiedStatus : verifiedStatus === 'loading' && eligibleUsers.length === 0 ? 'loading' : verifiedStatus === 'error' && eligibleUsers.length === 0 ? 'error' : usersStatus}
            onRetryMemberDirectory={() => { setRetryDirectory(n => n + 1); void refreshData(); }}
            formData={formData}
            setFormData={setFormData as any}
            instrumentsByCat={instrumentsByCat}
            allUsers={eligibleUsers}
            populatedBandScales={[]}
            musicScales={[]}
          />
        </div>
      </form>
    </Modal>
  );
};

export default FixedBandScaleFormModal;
