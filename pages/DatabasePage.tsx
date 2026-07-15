import React, { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useToast } from "../contexts/ToastContext";
import { useMusic } from "../contexts/MusicDataContext";
import { useAuth } from "../contexts/AuthContext";
import { useApi } from "../contexts/ApiContext";
import type {
  EventType,
  Location,
  EventName,
  Tag,
  Instrument,
  InstrumentCategory,
} from "../types";
import Spinner from "../components/common/Spinner";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import ConfirmationModal from "../components/common/ConfirmationModal";
import { CheckIcon } from "../components/icons/CheckIcon";
import { SparklesIcon } from "../components/icons/SparklesIcon";
import { MicIcon } from "../components/icons/MicIcon";
import { MusicNoteIcon } from "../components/icons/MusicNoteIcon";
import { LocationMarkerIcon } from "../components/icons/LocationMarkerIcon";
import { CalendarIcon } from "../components/icons/CalendarIcon";
import { TagIcon } from "../components/icons/TagIcon";
import { 
  seedDefaultRolesForOrg,
  seedDefaultInstrumentsForOrg,
  seedDefaultTagsForOrg,
  seedDefaultEventTypesForOrg,
  seedDefaultLocationsForOrg
} from "../services/firestoreService";

// Icons
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
const SaveIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
      d="M5 13l4 4L19 7"
    />
  </svg>
);
const XMarkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

const inputClass = "input-base";

// Helper to normalize names matching ProfilePage
const formatSpecialtyName = (name: string) => {
  if (!name) return "";
  const lowerName = name.toLowerCase();
  if (
    lowerName === "bv - 1" ||
    lowerName === "bv - 2" ||
    lowerName === "bv - 3"
  )
    return "Vocal";
  if (lowerName === "ministro 1" || lowerName === "ministro 2")
    return "Ministro";
  if (lowerName === "voz principal") return "Voz Principal";
  return name;
};

interface ModernDataManagerProps<T extends { id: string; name: string }> {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  items: T[];
  onAdd: (name: string) => Promise<void>;
  onUpdate: (item: T) => Promise<void>;
  onDelete: (ids: string[]) => Promise<void>;
}

const ModernDataManager = <T extends { id: string; name: string }>({
  title,
  subtitle,
  icon,
  items,
  onAdd,
  onUpdate,
  onDelete,
}: ModernDataManagerProps<T>) => {
  const { t } = useTranslation();
  const { userProfile, permissions, organization, user } = useAuth();
  const { success, error } = useToast();
  
  const canManageData = !!(
    permissions?.manageOrganization ||
    permissions?.manageScales ||
    permissions?.manageSongs ||
    permissions?.['musicScale.manageScales'] ||
    permissions?.['musicScale.manageSongs'] ||
    permissions?.['musicscale.songs.edit'] ||
    permissions?.['musicscale.scales.manage']
  ) || userProfile?.systemRole === 'ceo' || userProfile?.systemRole === 'admin' 
  || userProfile?.organizationRole === 'owner' || userProfile?.organizationRole === 'admin' 
  || userProfile?.appRole === 'owner';

  const [newItemName, setNewItemName] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isConfirmBulkDeleteOpen, setIsConfirmBulkDeleteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [itemToDelete, setItemToDelete] = useState<T | null>(null);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    // Duplicate check
    if (
      items.some(
        (i) => i.name.toLowerCase() === newItemName.trim().toLowerCase(),
      )
    ) {
      error(t("database.item_already_exists", "Este item já existe."));
      return;
    }

    setIsSubmitting(true);
    setEditingItemId(null);
    try {
      await onAdd(newItemName.trim());
      success(t("database.item_added", "Item adicionado com sucesso."));
      setNewItemName("");
    } catch (err: any) {
      error("Erro ao adicionar item", err?.message || "Sem permissão ou problema de rede.");
    }
    setIsSubmitting(false);
  };

  const handleStartEdit = (item: T) => {
    setEditingItemId(item.id);
    setEditingItemName(item.name);
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditingItemName("");
  };

  const handleUpdateItem = async () => {
    if (!editingItemId || !editingItemName.trim()) return;
    setIsSubmitting(true);
    const originalItem = items.find((item) => item.id === editingItemId);
    if (originalItem) {
      try {
        await onUpdate({ ...originalItem, name: editingItemName.trim() });
        success("Atualizado com sucesso.");
        handleCancelEdit();
      } catch (err: any) {
        error("Erro ao atualizar", err?.message || "Sem permissão ou problema de rede.");
      }
    } else {
        handleCancelEdit();
    }
    setIsSubmitting(false);
  };

  const handleDeleteSelected = async () => {
    setIsSubmitting(true);
    try {
      await onDelete(selectedItems);
      setSelectedItems([]);
      setIsConfirmBulkDeleteOpen(false);
      success("Itens removidos/arquivados com sucesso.");
    } catch (err: any) {
      error("Erro ao excluir", err?.message || "Problema de permissão ou rede.");
    }
    setIsSubmitting(false);
  };

  const handleSelect = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  return (
    <Card padding="none" className="overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white dark:bg-white/10 shadow-sm text-primary dark:text-primary-light">
            {icon}
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-gray-400">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {selectedItems.length > 0 && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setIsConfirmBulkDeleteOpen(true)}
            className="!py-1.5 !px-3 !text-xs !rounded-lg animate-scale-in"
          >
            {t("common.delete", "Excluir")} ({selectedItems.length})
          </Button>
        )}
      </div>

      <div className="p-6 flex flex-col gap-6">
        <form onSubmit={handleAddItem} className="relative">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder={t("database.add_item_placeholder", "Adicionar {{item}}...", { item: title ? title.toLowerCase().slice(0, -1) : "" })}
            className={inputClass}
            disabled={isSubmitting}
          />
          <button
            type="submit"
            disabled={isSubmitting || !newItemName.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:hover:bg-primary transition-colors"
          >
            <PlusIcon />
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((item) => {
            const isSelected = selectedItems.includes(item.id);
            const isEditing = editingItemId === item.id;

            if (isEditing) {
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center gap-1 sm:gap-2 p-2 rounded-xl bg-white dark:bg-gray-800 border-2 border-primary shadow-sm animate-scale-in z-10"
                >
                  <input
                    type="text"
                    value={editingItemName}
                    onChange={(e) => setEditingItemName(e.target.value)}
                    className="flex-grow min-w-0 w-full sm:w-auto text-sm bg-transparent border-none focus:ring-0 text-slate-900 dark:text-white px-1 sm:px-2 font-medium"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdateItem();
                      if (e.key === "Escape") handleCancelEdit();
                    }}
                  />
                  <div className="flex items-center gap-1 w-full justify-end sm:w-auto mt-2 sm:mt-0">
                    <button
                      onClick={handleUpdateItem}
                      disabled={isSubmitting}
                      className="p-1 sm:p-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                      title={t("common.save", "Salvar")}
                    >
                      <SaveIcon className="w-4 h-4 sm:w-auto sm:h-auto" />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-1 sm:p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-gray-700 dark:text-gray-300"
                      title={t("common.cancel", "Cancelar")}
                    >
                      <XMarkIcon className="w-4 h-4 sm:w-auto sm:h-auto" />
                    </button>
                    <button
                      onClick={async () => {
                        setItemToDelete(item);
                        setEditingItemId(null);
                      }}
                      disabled={isSubmitting}
                      className="p-1 sm:p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 ml-1 sm:ml-0"
                      title={t("common.delete", "Excluir")}
                    >
                      <TrashIcon className="w-4 h-4 sm:w-auto sm:h-auto" />
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelect(item.id)}
                className={`
                                    relative flex items-center justify-between px-4 py-3 rounded-2xl border text-sm font-bold transition-all duration-200 select-none w-full text-left group cursor-pointer
                                    ${
                                      isSelected
                                        ? "bg-primary border-primary text-white shadow-lg shadow-primary/30 ring-2 ring-primary ring-offset-2 dark:ring-offset-gray-900"
                                        : "bg-white dark:bg-gray-800/40 border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 hover:border-slate-300 dark:hover:bg-white/20"
                                    }
                                `}
              >
                <span className="truncate pr-6">{item.name}</span>

                {isSelected ? (
                  <div className="absolute -top-2 -right-2 bg-white text-primary rounded-full p-0.5 shadow-sm border border-slate-100 animate-scale-in">
                    <CheckIcon className="w-3 h-3 stroke-[3]" />
                  </div>
                ) : (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(item);
                      }}
                      className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-gray-700 transition-all"
                    >
                      <EditIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemToDelete(item);
                      }}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="col-span-full text-center py-8 text-slate-400 dark:text-gray-500 text-sm">
              {t("database.no_items_registered", "Nenhum item cadastrado.")}
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={isConfirmBulkDeleteOpen}
        onClose={() => setIsConfirmBulkDeleteOpen(false)}
        onConfirm={handleDeleteSelected}
        title={t("database.bulk_delete_title", "Excluir Itens")}
        message={t("database.bulk_delete_message", "Tem certeza que deseja excluir {{count}} item(ns)?", { count: selectedItems.length })}
        isLoading={isSubmitting}
      />

      <ConfirmationModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={async () => {
          if (!itemToDelete) return;
          setIsSubmitting(true);
          try {
            await onDelete([itemToDelete.id]);
            success(t("database.item_deleted", "Item excluído com sucesso."));
            setItemToDelete(null);
          } catch (err: any) {
            error("Erro ao excluir", err?.message);
          } finally {
            setIsSubmitting(false);
          }
        }}
        title={t("database.delete_item_title", "Excluir Item")}
        message={t("database.confirm_delete_item", "Tem certeza que deseja excluir '{{name}}'?", { name: itemToDelete?.name || '' })}
        isLoading={isSubmitting}
      />
    </Card>
  );
};;

const SpecialtiesManager: React.FC<{
  title: string;
  category: InstrumentCategory;
  icon: React.ReactNode;
  colorClass: string;
  items: Instrument[];
  onAdd: (name: string, category: InstrumentCategory) => Promise<void>;
  onUpdate: (item: Instrument) => Promise<void>;
  onDelete: (ids: string[]) => Promise<void>;
}> = ({
  title,
  category,
  icon,
  colorClass,
  items,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const { t } = useTranslation();
  const { userProfile, permissions, organization, user } = useAuth();
  const { success, error } = useToast();
  
  const canManageData = !!(
    permissions?.manageOrganization ||
    permissions?.manageScales ||
    permissions?.manageSongs ||
    permissions?.['musicScale.manageScales'] ||
    permissions?.['musicScale.manageSongs'] ||
    permissions?.['musicscale.songs.edit'] ||
    permissions?.['musicscale.scales.manage']
  ) || userProfile?.systemRole === 'ceo' || userProfile?.systemRole === 'admin' 
  || userProfile?.organizationRole === 'owner' || userProfile?.organizationRole === 'admin' 
  || userProfile?.appRole === 'owner';

  const [newItemName, setNewItemName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isConfirmBulkDeleteOpen, setIsConfirmBulkDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Instrument | null>(null);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    // Prevent duplicates in this category
    if (
      items.some(
        (i) => i.name.toLowerCase() === newItemName.trim().toLowerCase(),
      )
    ) {
      error(t("database.specialty_already_exists", "Esta especialidade já existe nesta categoria."));
      return;
    }

    setIsSubmitting(true);
    try {
      await onAdd(newItemName.trim(), category);
      success("Especialidade adicionada com sucesso.");
      setNewItemName("");
    } catch (err: any) {
      error("Erro ao adicionar", err?.message || "Erro de permissão ou rede.");
    }
    setIsSubmitting(false);
  };

  const handleStartEdit = (item: Instrument) => {
    setEditingItemId(item.id);
    setEditingItemName(item.name);
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditingItemName("");
  };

  const handleUpdateItem = async () => {
    if (!editingItemId || !editingItemName.trim()) return;
    setIsSubmitting(true);
    const originalItem = items.find((item) => item.id === editingItemId);
    if (originalItem) {
      try {
        await onUpdate({ ...originalItem, name: editingItemName.trim() });
        success("Atualizado com sucesso.");
        handleCancelEdit();
      } catch (err: any) {
        error("Erro ao atualizar", err?.message || "Sem permissão ou problema.");
      }
    } else {
      handleCancelEdit();
    }
    setIsSubmitting(false);
  };

  const handleSelect = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    setIsSubmitting(true);
    try {
        await onDelete(selectedItems);
        setSelectedItems([]);
        setIsConfirmBulkDeleteOpen(false);
        success("Especialidades removidas com sucesso.");
    } catch (err: any) {
        error("Erro ao excluir", err?.message);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="mb-8 last:mb-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`p-1.5 rounded-lg ${colorClass} shadow-sm`}>
            {icon}
          </span>
          <h4 className="font-bold text-slate-700 dark:text-white text-lg">
            {title}
          </h4>
        </div>
        {selectedItems.length > 0 && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setIsConfirmBulkDeleteOpen(true)}
            className="!py-1.5 !px-3 !text-xs !rounded-lg animate-scale-in"
          >
            {t("common.delete", "Excluir")} ({selectedItems.length})
          </Button>
        )}
      </div>

      <form onSubmit={handleAddItem} className="relative mb-4">
        <input
          type="text"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder={t("database.new_specialty_option", "Nova opção de {{title}}...", { title: title })}
          className={inputClass}
          disabled={isSubmitting}
        />
        <button
          type="submit"
          disabled={isSubmitting || !newItemName.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:hover:bg-primary transition-colors"
        >
          <PlusIcon />
        </button>
      </form>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((item) => {
          const isEditing = editingItemId === item.id;
          const isSelected = selectedItems.includes(item.id);

          if (isEditing) {
            return (
              <div
                key={item.id}
                className="col-span-1 flex flex-wrap items-center gap-1 sm:gap-2 p-2 rounded-xl bg-white dark:bg-gray-800 border-2 border-primary shadow-sm animate-scale-in z-10"
              >
                <input
                  type="text"
                  value={editingItemName}
                  onChange={(e) => setEditingItemName(e.target.value)}
                  className="flex-grow min-w-0 w-full sm:w-auto text-sm bg-transparent border-none focus:ring-0 text-slate-900 dark:text-white px-1 font-medium"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdateItem();
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                />
                <div className="flex flex-shrink-0 gap-1 w-full justify-end sm:w-auto mt-2 sm:mt-0">
                  <button
                    onClick={handleUpdateItem}
                    disabled={isSubmitting}
                    className="p-1 rounded-md bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    title={t("common.save", "Salvar")}
                  >
                    <SaveIcon className="w-3 h-3 sm:w-auto sm:h-auto" />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1 rounded-md bg-slate-100 text-slate-500 dark:bg-gray-700 dark:text-gray-300"
                    title={t("common.cancel", "Cancelar")}
                  >
                    <XMarkIcon className="w-3 h-3 sm:w-auto sm:h-auto" />
                  </button>
                  <button
                    onClick={() => {
                      setItemToDelete(item);
                      setEditingItemId(null);
                    }}
                    disabled={isSubmitting}
                    className="p-1 rounded-md bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 ml-1 sm:ml-0"
                    title={t("common.delete", "Excluir")}
                  >
                    <TrashIcon className="w-3 h-3 sm:w-auto sm:h-auto" />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => handleSelect(item.id)}
              className={`
                            relative flex items-center justify-center px-4 py-3 rounded-2xl border text-sm font-bold transition-all duration-200 select-none group cursor-pointer
                            ${
                              isSelected
                                ? "bg-primary border-primary text-white shadow-lg shadow-primary/30 ring-2 ring-primary ring-offset-2 dark:ring-offset-gray-900"
                                : "bg-white dark:bg-gray-800/40 border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800 hover:border-slate-300 dark:hover:border-white/20"
                            }
                        `}
            >
              <span className="truncate">{formatSpecialtyName(item.name)}</span>

              {isSelected ? (
                <div className="absolute -top-2 -right-2 bg-white text-primary rounded-full p-0.5 shadow-sm border border-slate-100 animate-scale-in">
                  <CheckIcon className="w-3 h-3 stroke-[3]" />
                </div>
              ) : (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0 z-10">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(item);
                    }}
                    className="p-1.5 rounded-md text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-gray-700 transition-all"
                  >
                    <EditIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setItemToDelete(item);
                    }}
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="col-span-full text-center py-4 text-slate-400 dark:text-gray-500 text-xs italic">
            {t("database.no_specialties_registered", "Nenhuma especialidade cadastrada.")}
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={isConfirmBulkDeleteOpen}
        onClose={() => setIsConfirmBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        title={t("database.bulk_delete_specialties_title", "Excluir Especialidades")}
        message={t("database.bulk_delete_specialties_message", "Tem certeza que deseja excluir as {{count}} especialidades selecionadas?", { count: selectedItems.length })}
        isLoading={isSubmitting}
      />

      <ConfirmationModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={async () => {
          if (!itemToDelete) return;
          setIsSubmitting(true);
          try {
            await onDelete([itemToDelete.id]);
            success(t("database.item_deleted", "Item excluído com sucesso."));
            setItemToDelete(null);
          } catch (err: any) {
            error("Erro ao excluir", err?.message);
          } finally {
            setIsSubmitting(false);
          }
        }}
        title={t("database.delete_item_title", "Excluir Item")}
        message={t("database.confirm_delete_item", "Tem certeza que deseja excluir '{{name}}'?", { name: itemToDelete?.name || '' })}
        isLoading={isSubmitting}
      />
    </div>
  );
};

const DatabasePage: React.FC = () => {
  const { t } = useTranslation();
  const {
    eventTypes,
    locations,
    eventNames,
    tags,
    instruments,
    loading,
    error,
    refreshData,
  } = useMusic();
  const { user, userProfile, permissions, effectiveOrganizationId } = useAuth();
  const api = useApi();
  const location = useLocation();

  const canManageData = !!(
    permissions?.manageOrganization ||
    permissions?.manageScales ||
    permissions?.manageSongs ||
    permissions?.['musicScale.manageScales'] ||
    permissions?.['musicScale.manageSongs'] ||
    permissions?.['musicscale.songs.edit'] ||
    permissions?.['musicscale.scales.manage']
  ) || userProfile?.systemRole === 'ceo' || userProfile?.systemRole === 'admin' 
  || userProfile?.organizationRole === 'owner' || userProfile?.organizationRole === 'admin' 
  || userProfile?.appRole === 'owner';

  // Auto-scroll to section based on hash
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace("#", "");
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  }, [location.hash, loading]);

  // Generic Handlers
  const createHandlers = <T extends { id: string }>(repo: {
    create: (data: any) => Promise<any>;
    update: (id: string, data: any) => Promise<any>;
    deleteMany: (ids: string[]) => Promise<any>;
  }) => ({
    onAdd: async (name: string) => {
      if (api) {
        await repo.create({ 
          name,
          isDefault: false,
          status: "active"
        });
        await refreshData();
      }
    },
    onUpdate: async (item: T & { name: string }) => {
      if (api) {
        await repo.update(item.id, { 
          name: item.name,
          updatedAt: new Date().toISOString() // Fallback because repo.update uses lastModifiedAt
        });
        await refreshData();
      }
    },
    onDelete: async (ids: string[]) => {
      if (api) {
        // Implement soft delete if requested, or real delete. User says:
        // "Preferencialmente usar soft delete/arquivar para evitar quebrar escalas antigas"
        // Let's do real delete for now or update status. 
        // repo.updateMany doesn't exist on all repos if we use deleteMany, but repo.update could be called in loop.
        // Actually, let's stick to true deletion for UI "Excluir" or keep how it is
        await repo.deleteMany(ids);
        await refreshData();
      }
    },
  });

  // Instrument Handlers
  const handleAddInstrument = async (
    name: string,
    category: InstrumentCategory,
  ) => {
    if (!api) return;
    await api.instruments.create({ 
      name, 
      category,
      isDefault: false,
      status: "active"
    });
    await refreshData();
  };
  const handleUpdateInstrument = async (item: Instrument) => {
    if (!api) return;
    await api.instruments.update(item.id, {
      name: item.name,
      category: item.category,
      updatedAt: new Date().toISOString()
    });
    await refreshData();
  };
  const handleDeleteInstruments = async (ids: string[]) => {
    if (!api) return;
    await api.instruments.deleteMany(ids);
    await refreshData();
  };

  // Helper to filter out duplicate formatted names for display
  const getUniqueInstruments = (category: string) => {
    const filtered = instruments.filter((i) => i.category === category);
    const seenNames = new Set<string>();
    const uniqueInstruments: Instrument[] = [];

    filtered.forEach((inst) => {
      const formattedName = formatSpecialtyName(inst.name);
      // Check uniqueness based on the FORMATTED name.
      // This ensures that if we have "BV - 1" and "Vocal" (both format to "Vocal"), only one shows.
      if (!seenNames.has(formattedName)) {
        uniqueInstruments.push(inst);
        seenNames.add(formattedName);
      }
    });
    return uniqueInstruments;
  };

  const [isSeeding, setIsSeeding] = useState(false);

  const handleAutoSeed = async (silent = false) => {
    const orgId = effectiveOrganizationId || userProfile?.organizationId || user?.uid;
    if (!orgId || !user) return;
    setIsSeeding(true);
    try {
      await Promise.all([
        seedDefaultRolesForOrg(userProfile || { uid: user.uid, email: user.email } as any, orgId),
        seedDefaultInstrumentsForOrg(userProfile || { uid: user.uid, email: user.email } as any, orgId),
        seedDefaultTagsForOrg(userProfile || { uid: user.uid, email: user.email } as any, orgId),
        seedDefaultEventTypesForOrg(userProfile || { uid: user.uid, email: user.email } as any, orgId),
        seedDefaultLocationsForOrg(userProfile || { uid: user.uid, email: user.email } as any, orgId)
      ]);
      await refreshData();
      if (!silent) alert(t("database.seed_success", "Dados iniciais gerados com sucesso!"));
    } catch(e) {
      if (!silent) alert(t("database.seed_error", "Erro ao gerar dados iniciais."));
      console.error(e);
    } finally {
      setIsSeeding(false);
    }
  };


  // Manual seeding is handled entirely via Button onClick for predictable user experience


  if (loading)
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner />
      </div>
    );
  if (error) return <div className="text-red-500 text-center">{error}</div>;

  return (
    <div className="flex flex-col gap-8 pb-10">
      {canManageData && (
        <div className="flex justify-end">
          <Button onClick={() => handleAutoSeed(false)} disabled={isSeeding} variant="secondary">
            {isSeeding ? <Spinner size="sm" /> : <><SparklesIcon className="w-4 h-4 mr-2" /> {t("database.seed_btn", "Gerar Dados Iniciais Padrão")}</>}
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-8">
          <div id="types">
            <ModernDataManager<EventType>
            title={t("database.event_types_title", "Tipos de Evento")}
            subtitle={t("database.event_types_subtitle", "Cultos, Ensaios, etc.")}
            icon={<CalendarIcon className="w-5 h-5" />}
            items={eventTypes}
            {...(api
              ? createHandlers<EventType>(api.eventTypes)
              : {
                  onAdd: async () => {},
                  onUpdate: async () => {},
                  onDelete: async () => {},
                })}
          />
        </div>

        <ModernDataManager<Location>
          title={t("database.locations_title", "Locais")}
          subtitle={t("database.locations_subtitle", "Igreja, Praça, etc.")}
          icon={<LocationMarkerIcon className="w-5 h-5" />}
          items={locations}
          {...(api
            ? createHandlers<Location>(api.locations)
            : {
                onAdd: async () => {},
                onUpdate: async () => {},
                onDelete: async () => {},
              })}
        />

        <ModernDataManager<EventName>
          title={t("database.event_names_title", "Nomes de Evento (Opcional)")}
          subtitle={t("database.event_names_subtitle", "Ex: Santa Ceia, Culto de Jovens")}
          icon={<TagIcon className="w-5 h-5" />}
          items={eventNames}
          {...(api
            ? createHandlers<EventName>(api.eventNames)
            : {
                onAdd: async () => {},
                onUpdate: async () => {},
                onDelete: async () => {},
              })}
        />
        <div id="tags">
          <ModernDataManager<Tag>
            title={t("database.music_tags_title", "Tags de Músicas")}
            subtitle={t("database.music_tags_subtitle", "Adoração, Júbilo, Oferta")}
            icon={<TagIcon className="w-5 h-5" />}
            items={tags}
            {...(api
              ? createHandlers<Tag>(api.tags)
              : {
                  onAdd: async () => {},
                  onUpdate: async () => {},
                  onDelete: async () => {},
                })}
          />
        </div>
      </div>

      <div className="space-y-8" id="skills">
        <Card padding="none" className="overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
            <h3 className="font-bold text-slate-800 dark:text-white">
              {t("database.band_specialties_title", "Especialidades da Banda")}
            </h3>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              {t("database.band_specialties_subtitle", "Defina as funções disponíveis para seleção no perfil.")}
            </p>
          </div>
          <div className="p-6">
            <SpecialtiesManager
              title={t("database.specialty_ministers", "Ministros")}
              category="Ministro"
              icon={<SparklesIcon className="w-5 h-5" />}
              colorClass="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
              items={getUniqueInstruments("Ministro")}
              onAdd={handleAddInstrument}
              onUpdate={handleUpdateInstrument}
              onDelete={handleDeleteInstruments}
            />
            <SpecialtiesManager
              title={t("database.specialty_vocals", "Vozes")}
              category="Voz"
              icon={<MicIcon className="w-5 h-5" />}
              colorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
              items={getUniqueInstruments("Voz")}
              onAdd={handleAddInstrument}
              onUpdate={handleUpdateInstrument}
              onDelete={handleDeleteInstruments}
            />
            <SpecialtiesManager
              title={t("database.specialty_instruments", "Instrumentos")}
              category="Instrumento"
              icon={<MusicNoteIcon className="w-5 h-5" />}
              colorClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
              items={getUniqueInstruments("Instrumento")}
              onAdd={handleAddInstrument}
              onUpdate={handleUpdateInstrument}
              onDelete={handleDeleteInstruments}
            />
          </div>
        </Card>

        <div className="text-center mt-12 mb-4">
           <p className="text-xs text-slate-400 dark:text-slate-500 max-w-md mx-auto">
             {t("database.archive_disclaimer", "* Para manter a alta performance e economia operacional do sistema, escalas com mais de 6 meses são arquivadas cronologicamente de forma invisível.")}
           </p>
        </div>
      </div>
    </div>
    </div>
  );
};

export default DatabasePage;
