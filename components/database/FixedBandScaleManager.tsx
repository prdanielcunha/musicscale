import { logger } from "../../lib/logger";
import React, { useState, useMemo } from "react";
import { useMusic } from "../../contexts/MusicDataContext";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../contexts/ApiContext";
import type { FixedBandScale, UserProfile, Instrument } from "../../types";
import Card from "../common/Card";
import Button from "../common/Button";
import ConfirmationModal from "../common/ConfirmationModal";
import FixedBandScaleFormModal from "./FixedBandScaleFormModal";
import { UsersIcon } from "../icons/UsersIcon";

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
const TrashIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);
const EditIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z"
    />
  </svg>
);

const FixedBandScaleManager: React.FC = () => {
  const { user, userProfile } = useAuth();
  const { fixedBandScales, allUsers, instruments, refreshData } = useMusic();
  const api = useApi();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [scaleToEdit, setScaleToEdit] = useState<FixedBandScale | null>(null);
  const [scaleToDelete, setScaleToDelete] = useState<FixedBandScale | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userMap = useMemo(
    () => new Map(allUsers.map((u) => [u.uid, u])),
    [allUsers],
  );

  const handleOpenForm = (scale?: FixedBandScale) => {
    setScaleToEdit(scale || null);
    setIsFormOpen(true);
  };

  const handleSave = async (
    data:
      | Omit<FixedBandScale, "id" | "createdBy" | "createdAt">
      | FixedBandScale,
  ) => {
    if (!user || !userProfile || !api) return;
    setIsSubmitting(true);
    try {
      if ("id" in data) {
        await api.fixedBandScales.update(data.id, data);
      } else {
        await api.fixedBandScales.create(data);
      }
      await refreshData();
      setIsFormOpen(false);
    } catch (e) {
      logger.error("Failed to save fixed band scale", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!scaleToDelete || !api) return;
    setIsSubmitting(true);
    try {
      await api.fixedBandScales.delete(scaleToDelete.id);
      await refreshData();
      setScaleToDelete(null);
    } catch (e) {
      logger.error("Failed to delete fixed band scale", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">
          Modelos Salvos
        </h3>
        <Button
          onClick={() => handleOpenForm()}
          size="sm"
          leftIcon={<PlusIcon />}
        >
          Novo Modelo
        </Button>
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {fixedBandScales.map((scale) => (
          <div
            key={scale.id}
            className="p-3 bg-slate-100 dark:bg-gray-700/50 rounded-lg"
          >
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-bold text-slate-800 dark:text-white">
                {scale.name}
              </h4>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleOpenForm(scale)}
                  className="!p-2"
                >
                  <EditIcon />
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setScaleToDelete(scale)}
                  className="!p-2"
                >
                  <TrashIcon />
                </Button>
              </div>
            </div>
            <div className="text-sm text-slate-600 dark:text-gray-300 flex items-center gap-1">
              <UsersIcon className="w-4 h-4" />
              <span>{scale.assignments.length} integrante(s): </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400 pl-5 truncate">
              {scale.assignments
                .map((a) => userMap.get(a.userId)?.displayName)
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
        ))}
      </div>

      <FixedBandScaleFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSave}
        scaleToEdit={scaleToEdit}
        isSubmitting={isSubmitting}
      />

      <ConfirmationModal
        isOpen={!!scaleToDelete}
        onClose={() => setScaleToDelete(null)}
        onConfirm={handleDelete}
        title={`Excluir Escala Fixa "${scaleToDelete?.name}"?`}
        message="Tem certeza que deseja excluir esta escala fixa? Esta ação não pode ser desfeita."
        isLoading={isSubmitting}
        zIndexClass="z-[130]"
      />
    </div>
  );
};

export default FixedBandScaleManager;
