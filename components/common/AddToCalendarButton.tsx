import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CalendarPlus, Calendar, Download } from "lucide-react";
import { convertScaleToCalendarEvent, generateGoogleCalendarUrl, downloadCalendarICS } from "../../utils/calendar";
import { useToast } from "../../contexts/ToastContext";

interface AddToCalendarButtonProps {
  scale: any;
  className?: string;
  iconOnly?: boolean;
  alignY?: "top" | "bottom";
  children?: React.ReactNode;
}

const AddToCalendarButton: React.FC<AddToCalendarButtonProps> = ({ scale, className = "", iconOnly = false, alignY = "bottom", children }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const eventData = convertScaleToCalendarEvent(scale);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (!eventData) return null;

  const handleGoogleCalendar = () => {
    const url = generateGoogleCalendarUrl(eventData);
    window.open(url, "_blank", "noopener,noreferrer");
    setIsOpen(false);
    toast({ title: t('notifications.scaleDetail.calendarOpened', 'Agenda aberta') });
  };

  const handleIcsDownload = () => {
    downloadCalendarICS(eventData);
    setIsOpen(false);
    toast({ title: t('notifications.scaleDetail.calendarFileCreated', 'Arquivo de calendário criado') });
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {iconOnly ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={className || "p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors"}
          title={t('calendar.addToCalendar', 'Adicionar à Agenda')}
        >
          <CalendarPlus className={className ? "w-5 h-5 sm:w-4 sm:h-4" : "w-4 h-4"} />
        </button>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={className || `flex items-center gap-2 px-3 py-1.5 bg-[#18181b]/60 border border-white/[0.06] hover:border-white/10 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] backdrop-blur-md`}
        >
          {children ? children : (
            <>
              <CalendarPlus className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t('calendar.addToCalendar', 'Adicionar à Agenda')}</span>
            </>
          )}
        </button>
      )}

      {isOpen && (
        <div className={`absolute right-0 ${alignY === "top" ? "bottom-full mb-2" : "mt-2"} w-56 rounded-xl bg-[#18181b]/95 border border-white/[0.08] shadow-2xl backdrop-blur-md z-50 py-1 overflow-hidden animate-in fade-in ${alignY === "top" ? "slide-in-from-bottom-1" : "slide-in-from-top-1"} duration-100`}>
          <button
            onClick={handleGoogleCalendar}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.04] transition-all"
          >
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>{t('calendar.googleCalendar', 'Google Agenda')}</span>
          </button>
          <button
            onClick={handleIcsDownload}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.04] transition-all border-t border-white/[0.03]"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            <span>{t('calendar.appleOutlookCalendar', 'Calendário Apple / Outlook (.ics)')}</span>
          </button>
          <div className="px-4 py-2 text-[10px] text-slate-500 border-t border-white/[0.04] select-none text-center leading-normal">
            {t('calendar.staticExportNote', 'Exportação estática (não sincroniza mudanças futuras automaticamente)')}
          </div>
        </div>
      )}
    </div>
  );
};

export default AddToCalendarButton;
