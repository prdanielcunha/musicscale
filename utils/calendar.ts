import { getScaleTitle } from "./scaleHelper";

export interface CalendarEventData {
  id?: string;
  title: string;
  start: Date;
  end: Date;
  description: string;
  location: string;
}

export function generateGoogleCalendarUrl(event: CalendarEventData): string {
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/-|:|\.\d\d\d/g, "");
  };
  const dates = `${formatDate(event.start)}/${formatDate(event.end)}`;
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    event.title
  )}&dates=${dates}&details=${encodeURIComponent(
    event.description
  )}&location=${encodeURIComponent(event.location)}`;
}

function escapeIcsText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\r?\n/g, "\\n");
}

function getStableId(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

export function downloadCalendarICS(event: CalendarEventData) {
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/-|:|\.\d\d\d/g, "");
  };
  
  const stableId = event.id ? event.id : getStableId(`${event.title}_${event.start.getTime()}`);
  
  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MusicScale//Calendar Event//PT",
    "BEGIN:VEVENT",
    `UID:scale_${stableId}@musicscale.com`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(event.start)}`,
    `DTEND:${formatDate(event.end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    `LOCATION:${escapeIcsText(event.location)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${event.title.toLowerCase().replace(/\s+/g, "_")}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function resolveScaleDurationMinutes(value: unknown): number {
  if (value === undefined || value === null) {
    return 120;
  }
  let num: number;
  if (typeof value === "number") {
    num = value;
  } else if (typeof value === "string") {
    num = Number(value);
  } else {
    return 120;
  }
  if (isNaN(num) || !Number.isInteger(num) || num <= 0) {
    return 120;
  }
  return num;
}

export function convertScaleToCalendarEvent(scale: any): CalendarEventData | null {
  if (!scale) return null;
  
  const dateStr = scale.date;
  if (!dateStr) return null;
  
  const timeStr = scale.time || "00:00";
  
  // Parse date and time
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  
  const start = new Date(year, month - 1, day, hours, minutes || 0);
  const durationMinutes = resolveScaleDurationMinutes(scale.durationMinutes);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  
  // Build Title
  const title = getScaleTitle(scale);
  
  // Build Location
  const locationName = scale.location?.name || scale.locationName || scale.location || "Não especificado";
  
  // Build Description
  let description = `Escala do Ministério de Música.\n\nLocal: ${locationName}`;
  if (scale.observations) {
    description += `\nObservações: ${scale.observations}`;
  }
  
  if (scale.songs && Array.isArray(scale.songs) && scale.songs.length > 0) {
    description += `\n\nMúsicas agendadas:\n` + scale.songs.map((s: any, idx: number) => `${idx + 1}. ${s.title} (${s.artist || "Artista desconhecido"})`).join("\n");
  } else if (scale.songIds && Array.isArray(scale.songIds) && scale.songIds.length > 0) {
    description += `\n\n${scale.songIds.length} música(s) agendada(s).`;
  }
  
  if (scale.bandScale?.assignments && Array.isArray(scale.bandScale.assignments)) {
    description += `\n\nIntegrantes da Banda:\n` + scale.bandScale.assignments.map((a: any) => `- ${a.user?.displayName || a.user?.name || "Integrante"}: ${a.instrument?.name || "Instrumento"}`).join("\n");
  } else if (scale.assignments && Array.isArray(scale.assignments)) {
    description += `\n\nIntegrantes da Banda:\n` + scale.assignments.map((a: any) => `- ${a.user?.displayName || a.user?.name || "Integrante"}: ${a.instrument?.name || "Instrumento"}`).join("\n");
  }
  
  return {
    id: scale.organizationId && scale.id ? `${scale.organizationId}_${scale.id}` : undefined,
    title,
    start,
    end,
    description,
    location: locationName
  };
}
