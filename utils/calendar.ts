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

export function generateCalendarICS(event: CalendarEventData | CalendarEventData[]): string {
  const events = Array.isArray(event) ? event : [event];
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/-|:|\.\d\d\d/g, "");
  };
  
  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MusicScale//Calendar Event//PT"
  ];
  
  events.forEach((evt) => {
    const stableId = evt.id ? evt.id : getStableId(`${evt.title}_${evt.start.getTime()}`);
    icsLines.push(
      "BEGIN:VEVENT",
      `UID:scale_${stableId}@musicscale.com`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(evt.start)}`,
      `DTEND:${formatDate(evt.end)}`,
      `SUMMARY:${escapeIcsText(evt.title)}`,
      `DESCRIPTION:${escapeIcsText(evt.description)}`,
      `LOCATION:${escapeIcsText(evt.location)}`,
      "END:VEVENT"
    );
  });
  
  icsLines.push("END:VCALENDAR");
  return icsLines.join("\r\n");
}

export function downloadCalendarICS(event: CalendarEventData) {
  const icsContent = generateCalendarICS(event);
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

export interface CalendarScaleSong {
  title: string;
  artist?: string | null;
}

export interface CalendarScaleAssignment {
  user?: {
    displayName?: string | null;
    name?: string | null;
  } | null;
  instrument?: {
    name?: string | null;
  } | null;
}

export interface CalendarScaleData {
  id?: string;
  organizationId?: string;
  date?: string;
  time?: string | null;
  durationMinutes?: unknown;
  eventType?: { name: string } | string | null;
  eventName?: { name: string } | string | null;
  eventTypeName?: string | null;
  eventNameName?: string | null;
  location?: { name?: string | null } | null;
  locationName?: string | null;
  observations?: string | null;
  songs?: CalendarScaleSong[] | null;
  songIds?: string[] | null;
  bandScale?: {
    assignments?: CalendarScaleAssignment[] | null;
  } | null;
  assignments?: CalendarScaleAssignment[] | null;
}

export function getUtcDateInTimezone(
  dateStr: string,
  timeStr: string = "00:00",
  timeZone: string = "America/Sao_Paulo"
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = (timeStr || "00:00").split(":").map(Number);
  
  // Construct a Date object from the target timezone representation as if it were UTC
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes || 0));
  
  // Format the date in the target timezone to get the timezone representation components
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false
  });
  
  const parts = formatter.formatToParts(utcDate);
  const partVal = (type: string) => Number(parts.find(p => p.type === type)?.value);
  
  const tzYear = partVal("year");
  const tzMonth = partVal("month");
  const tzDay = partVal("day");
  let tzHour = partVal("hour");
  if (tzHour === 24) tzHour = 0;
  const tzMin = partVal("minute");
  
  const tzAsUtc = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMin);
  const offsetMs = tzAsUtc - utcDate.getTime();
  
  const localUtcTimestamp = Date.UTC(year, month - 1, day, hours, minutes || 0);
  const correctUtcTimestamp = localUtcTimestamp - offsetMs;
  
  const result = new Date(correctUtcTimestamp);
  
  console.log(`[Timezone Logs] Organization Timezone: ${timeZone} | Local Scale Date/Time: ${dateStr} ${timeStr} | Parsed UTC Date: ${result.toISOString()} | Offset: ${offsetMs / 60000} mins`);
  
  return result;
}

export function convertScaleToCalendarEvent(scale: CalendarScaleData): CalendarEventData | null {
  if (!scale) return null;
  
  const dateStr = scale.date;
  if (!dateStr) return null;
  
  const timeStr = scale.time || "00:00";
  
  // Parse date and time using explicit IANA timezone (America/Sao_Paulo by default)
  const start = getUtcDateInTimezone(dateStr, timeStr, "America/Sao_Paulo");
  const durationMinutes = resolveScaleDurationMinutes(scale.durationMinutes);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  
  // Build Title
  const title = getScaleTitle(scale);
  
  // Build Location
  const locationName = scale.location?.name || scale.locationName || "Não especificado";
  
  // Build Description
  let description = `Escala do Ministério de Música.\n\nLocal: ${locationName}`;
  if (scale.observations) {
    description += `\nObservações: ${scale.observations}`;
  }
  
  if (scale.songs && Array.isArray(scale.songs) && scale.songs.length > 0) {
    description += `\n\nMúsicas agendadas:\n` + scale.songs.map((s: CalendarScaleSong, idx: number) => `${idx + 1}. ${s.title} (${s.artist || "Artista desconhecido"})`).join("\n");
  } else if (scale.songIds && Array.isArray(scale.songIds) && scale.songIds.length > 0) {
    description += `\n\n${scale.songIds.length} música(s) agendada(s).`;
  }
  
  if (scale.bandScale?.assignments && Array.isArray(scale.bandScale.assignments)) {
    description += `\n\nIntegrantes da Banda:\n` + scale.bandScale.assignments.map((a: CalendarScaleAssignment) => `- ${a.user?.displayName || a.user?.name || "Integrante"}: ${a.instrument?.name || "Instrumento"}`).join("\n");
  } else if (scale.assignments && Array.isArray(scale.assignments)) {
    description += `\n\nIntegrantes da Banda:\n` + scale.assignments.map((a: CalendarScaleAssignment) => `- ${a.user?.displayName || a.user?.name || "Integrante"}: ${a.instrument?.name || "Instrumento"}`).join("\n");
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
