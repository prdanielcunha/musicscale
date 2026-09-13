import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { useNotifications } from "../../contexts/NotificationContext";
import { Bell } from "lucide-react";

const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const { t } = useTranslation();

  if (!user) return null;

  return (
    <button
      onClick={() => navigate("/notifications")}
      className="premium-interactive relative flex h-10 w-10 items-center justify-center rounded-[13px] border border-white/[0.07] bg-white/[0.035] text-white/50 hover:border-white/[0.11] hover:bg-white/[0.055] hover:text-white/90"
      aria-label={`${t("nav.notifications", "Notificações")} (${unreadCount})`}
    >
      <Bell className="h-[19px] w-[19px]" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[#08080b] bg-red-500 px-1 text-[9px] font-bold leading-none text-white shadow-[0_4px_12px_rgba(239,68,68,0.35)]">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
};

export default NotificationBell;