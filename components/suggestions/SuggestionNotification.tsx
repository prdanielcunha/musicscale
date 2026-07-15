import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useSuggestionsContext } from "../../contexts/SuggestionContext";
import { SuggestionIcon } from "../icons/SuggestionIcon";

const SuggestionNotification: React.FC = () => {
  const { permissions } = useAuth();
  const { suggestions } = useSuggestionsContext();
  const navigate = useNavigate();

  const canViewSuggestions = useMemo(() => {
    return !!permissions?.manageSongs;
  }, [permissions]);

  const unreadCount = useMemo(() => {
    // Only count suggestions that are NOT read AND NOT archived
    return suggestions.filter((s) => !s.isRead && !s.isArchived).length;
  }, [suggestions]);

  if (!canViewSuggestions) {
    return null;
  }

  return (
    <button
      onClick={() => navigate("/suggestions")}
      className="relative p-2 rounded-full text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
      aria-label={`View suggestions (${unreadCount} new)`}
    >
      <SuggestionIcon className="w-6 h-6" />
      {unreadCount > 0 && (
        <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-gray-900">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
};

export default SuggestionNotification;
