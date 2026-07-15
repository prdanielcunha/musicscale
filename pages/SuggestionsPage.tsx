import { logger } from "../lib/logger";

import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSuggestionsContext } from "../contexts/SuggestionContext";
import * as suggestionApi from "../services/suggestionsService";
import Spinner from "../components/common/Spinner";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import EmptyState from "../components/common/EmptyState";
import SuggestionItem from "../components/suggestions/SuggestionItem";
import { SuggestionIcon } from "../components/icons/SuggestionIcon";
import ConfirmationModal from "../components/common/ConfirmationModal";
import { TrashIcon } from "../components/icons/TrashIcon";
import { ArchiveIcon } from "../components/icons/ArchiveIcon";
import { CheckIcon } from "../components/icons/CheckIcon";

const SuggestionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { suggestions, loading, error, refreshSuggestions } =
    useSuggestionsContext();
  const [filter, setFilter] = useState<"unread" | "read" | "archived">(
    "unread",
  );
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isConfirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);

  const filteredSuggestions = useMemo(() => {
    if (filter === "unread") {
      return suggestions.filter((s) => !s.isRead && !s.isArchived);
    }
    if (filter === "read") {
      return suggestions.filter((s) => s.isRead && !s.isArchived);
    }
    if (filter === "archived") {
      return suggestions.filter((s) => s.isArchived);
    }
    return suggestions;
  }, [suggestions, filter]);

  const handleToggleSelectionMode = () => {
    setIsSelectionMode((prev) => !prev);
    setSelectedIds([]);
  };

  const handleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  // Bulk Actions
  const handleMarkAsRead = async () => {
    if (selectedIds.length === 0) return;
    setIsProcessing(true);
    try {
      await suggestionApi.markSuggestionsAsRead(selectedIds);
      await refreshSuggestions();
      setIsSelectionMode(false);
    } catch (e) {
      logger.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleArchive = async () => {
    if (selectedIds.length === 0) return;
    setIsProcessing(true);
    try {
      await suggestionApi.markSuggestionsAsArchived(selectedIds);
      await refreshSuggestions();
      setIsSelectionMode(false);
    } catch (e) {
      logger.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    const idsToDelete = singleDeleteId ? [singleDeleteId] : selectedIds;
    if (idsToDelete.length === 0) return;

    setIsProcessing(true);
    try {
      await suggestionApi.deleteSuggestions(idsToDelete);
      await refreshSuggestions();
      setIsSelectionMode(false);
      setSingleDeleteId(null);
    } catch (e) {
      logger.error(e);
    } finally {
      setIsProcessing(false);
      setConfirmDeleteOpen(false);
    }
  };

  // Single Actions
  const handleSingleMarkAsRead = async (id: string) => {
    try {
      await suggestionApi.markSuggestionsAsRead([id]);
      await refreshSuggestions();
    } catch (e) {
      logger.error(e);
    }
  };

  const handleSingleArchive = async (id: string) => {
    try {
      await suggestionApi.markSuggestionsAsArchived([id]);
      await refreshSuggestions();
    } catch (e) {
      logger.error(e);
    }
  };

  const handleSingleDelete = (id: string) => {
    setSingleDeleteId(id);
    setConfirmDeleteOpen(true);
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner size="lg" />
      </div>
    );
  if (error) return <div className="text-red-500 text-center">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
          <div className="inline-flex rounded-md shadow-sm bg-white dark:bg-gray-900/50 border border-slate-200 dark:border-gray-700 p-1">
            <button
              onClick={() => setFilter("unread")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${filter === "unread" ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800"}`}
            >
              {t("suggestions.unread_tab")}
            </button>
            <button
              onClick={() => setFilter("read")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${filter === "read" ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800"}`}
            >
              {t("suggestions.read_tab")}
            </button>
            <button
              onClick={() => setFilter("archived")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${filter === "archived" ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800"}`}
            >
              {t("suggestions.archived_tab")}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
          {isSelectionMode ? (
            <>
              <Button
                onClick={handleToggleSelectionMode}
                variant="secondary"
                size="sm"
              >
                {t("suggestions.cancel")}
              </Button>

              {filter !== "archived" && (
                <Button
                  onClick={handleArchive}
                  disabled={selectedIds.length === 0 || isProcessing}
                  variant="secondary"
                  size="sm"
                  leftIcon={<ArchiveIcon className="w-4 h-4" />}
                >
                  {isProcessing ? (
                    <Spinner size="sm" />
                  ) : (
                    t("suggestions.archive_bulk", { count: selectedIds.length })
                  )}
                </Button>
              )}

              {filter === "unread" && (
                <Button
                  onClick={handleMarkAsRead}
                  disabled={selectedIds.length === 0 || isProcessing}
                  size="sm"
                  leftIcon={<CheckIcon className="w-4 h-4" />}
                >
                  {isProcessing ? (
                    <Spinner size="sm" />
                  ) : (
                    t("suggestions.read_bulk", { count: selectedIds.length })
                  )}
                </Button>
              )}

              <Button
                variant="danger"
                onClick={() => {
                  setSingleDeleteId(null);
                  setConfirmDeleteOpen(true);
                }}
                disabled={selectedIds.length === 0}
                size="sm"
                leftIcon={<TrashIcon />}
              >
                {t("suggestions.delete_bulk", { count: selectedIds.length })}
              </Button>
            </>
          ) : (
            <Button
              onClick={handleToggleSelectionMode}
              variant="secondary"
              size="sm"
            >
              {t("suggestions.select_items")}
            </Button>
          )}
        </div>
      </div>

      {filteredSuggestions.length > 0 ? (
        <div className="space-y-4">
          {filteredSuggestions.map((suggestion) => (
            <SuggestionItem
              key={suggestion.id}
              suggestion={suggestion}
              isSelectionMode={isSelectionMode}
              isSelected={selectedIds.includes(suggestion.id)}
              onSelectToggle={handleSelect}
              onMarkAsRead={handleSingleMarkAsRead}
              onArchive={handleSingleArchive}
              onDelete={handleSingleDelete}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={
            filter === "archived" ? (
              <ArchiveIcon className="h-8 w-8 text-slate-400" />
            ) : (
              <SuggestionIcon className="h-8 w-8 text-slate-400 opacity-50" />
            )
          }
          title={
            filter === "unread"
              ? t("suggestions.empty_unread_title")
              : filter === "read"
                ? t("suggestions.empty_read_title")
                : t("suggestions.empty_archived_title")
          }
          description={
            filter === "unread"
              ? t("suggestions.empty_unread_desc")
              : filter === "read"
                ? t("suggestions.empty_read_desc")
                : t("suggestions.empty_archived_desc")
          }
        />
      )}

      <ConfirmationModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => {
          setConfirmDeleteOpen(false);
          setSingleDeleteId(null);
        }}
        onConfirm={handleDelete}
        title={t("suggestions.delete_title")}
        message={
          singleDeleteId
            ? t("suggestions.delete_confirm_single")
            : t("suggestions.delete_confirm_bulk", { count: selectedIds.length })
        }
        isLoading={isProcessing}
        confirmText={t("suggestions.delete_btn")}
      />
    </div>
  );
};

export default SuggestionsPage;
