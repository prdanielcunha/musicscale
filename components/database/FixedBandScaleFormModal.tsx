import React, { useState, useEffect, useMemo } from "react";
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
}

const FixedBandScaleFormModal: React.FC<FixedBandScaleFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  scaleToEdit,
  isSubmitting,
}) => {
  const { allUsers, instruments } = useMusic();
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalData = scaleToEdit ? { ...scaleToEdit, ...formData } : formData;
    onSave(finalData);
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
        Cancelar
      </Button>
      <Button
        type="submit"
        form="fixed-scale-form"
        disabled={isSubmitting || !formData.name}
      >
        {isSubmitting ? <Spinner size="sm" /> : "Salvar"}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={scaleToEdit ? "Editar Escala Fixa" : "Nova Escala Fixa"}
      footer={footer}
      maxWidth="max-w-4xl"
      zIndexClass="z-[120]"
    >
      <form id="fixed-scale-form" onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className={formLabelClass}>
            Nome da Escala
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
            placeholder="Ex: Escala 1, Banda Principal..."
          />
        </div>

        <div className="flex flex-col">
          <BandBuilder
            formData={formData}
            setFormData={setFormData as any}
            instrumentsByCat={instrumentsByCat}
            allUsers={allUsers}
            populatedBandScales={[]}
            musicScales={[]}
          />
        </div>
      </form>
    </Modal>
  );
};

export default FixedBandScaleFormModal;
