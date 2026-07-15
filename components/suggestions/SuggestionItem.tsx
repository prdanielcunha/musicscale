import React from "react";
import { useTranslation } from "react-i18next";
import type { Suggestion } from "../../types";
import Card from "../common/Card";
import { UserIcon } from "../icons/UserIcon";
import { LinkIcon } from "../icons/LinkIcon";
import { CheckIcon } from "../icons/CheckIcon";
import { ArchiveIcon } from "../icons/ArchiveIcon";
import { TrashIcon } from "../icons/TrashIcon";

interface SuggestionItemProps {
  suggestion: Suggestion;
  isSelectionMode: boolean;
  isSelected: boolean;
  onSelectToggle: (id: string) => void;
  onMarkAsRead: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

const SuggestionItem: React.FC<SuggestionItemProps> = ({
  suggestion,
  isSelectionMode,
  isSelected,
  onSelectToggle,
  onMarkAsRead,
  onArchive,
  onDelete,
}) => {
  const { t, i18n } = useTranslation();
  const handleClick = () => {
    if (isSelectionMode) {
      onSelectToggle(suggestion.id);
    }
  };

  return (
    <Card
      onClick={handleClick}
      className={`group relative overflow-hidden transition-all duration-300 border ${
        isSelected
          ? "ring-2 ring-primary border-primary bg-primary/5"
          : "border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 hover:shadow-md"
      } ${isSelectionMode ? "cursor-pointer" : ""}`}
    >
      <div className="p-5">
        {/* Header Section */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            {isSelectionMode && (
              <div className="flex items-center justify-center mr-1">
                <input
                  type="checkbox"
                  checked={isSelected}
                  readOnly
                  className="h-5 w-5 rounded-md bg-slate-200 dark:bg-gray-700 border-slate-300 dark:border-gray-600 text-primary focus:ring-0 cursor-pointer"
                />
              </div>
            )}

            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-gray-700 dark:to-gray-600 p-[1px]">
              <div className="h-full w-full rounded-full bg-white dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                {suggestion.createdBy.photoURL ? (
                  <img
                    src={suggestion.createdBy.photoURL}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserIcon className="h-5 w-5 text-slate-400" />
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  {suggestion.createdBy.displayName || t("suggestions.unknown_user")}
                </h3>
                {!suggestion.isRead && !suggestion.isArchived && (
                  <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm shadow-blue-500/30 animate-pulse">
                    {t("suggestions.new_badge")}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">
                {new Date(suggestion.createdAt).toLocaleString(i18n.language === "es" ? "es-ES" : i18n.language === "en" ? "en-US" : "pt-BR", {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Songs List */}
        <div className="space-y-2 mb-4">
          {suggestion.songs.map((song) => (
            <div
              key={song.id}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 transition-colors hover:bg-slate-100 dark:hover:bg-white/10 group/song"
            >
              <div className="min-w-0 flex-1 pr-3">
                <p className="text-sm font-bold text-slate-800 dark:text-gray-200 truncate">
                  {song.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-gray-400 truncate">
                  {song.artist}
                </p>
              </div>
              {song.link && (
                <a
                  href={song.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex-shrink-0 p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/20 transition-colors"
                  title={t("suggestions.open_link_tooltip")}
                >
                  <LinkIcon className="w-4 h-4" />
                </a>
              )}
            </div>
          ))}
        </div>

        {/* Action Footer */}
        {!isSelectionMode && (
          <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-gray-800">
            {!suggestion.isRead && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAsRead(suggestion.id);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors border border-emerald-200 dark:border-emerald-500/20"
              >
                <CheckIcon className="w-3.5 h-3.5" />
                {t("suggestions.mark_as_read_btn")}
              </button>
            )}
            {!suggestion.isArchived && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive(suggestion.id);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors border border-amber-200 dark:border-amber-500/20"
              >
                <ArchiveIcon className="w-3.5 h-3.5" />
                {t("suggestions.archive_btn")}
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(suggestion.id);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors ml-auto"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              {t("suggestions.delete_btn_action")}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
};

export default SuggestionItem;
