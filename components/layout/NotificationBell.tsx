import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useNotifications } from "../../contexts/NotificationContext";
import { Bell } from "lucide-react";

const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();

  if (!user) return null;

  return (
    <button
      onClick={() => navigate("/notifications")}
      className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-200 bg-[#18181b]/60 border border-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] backdrop-blur-md premium-interactive"
      aria-label={`View notifications (${unreadCount} unread)`}
    >
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute top-0 right-0 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-red-500 text-white text-[9px] sm:text-[10px] font-bold flex items-center justify-center ring-2 ring-[#18181b]">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
};

export default NotificationBell;
