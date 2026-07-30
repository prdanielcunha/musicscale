const fs = require('fs');
const file = 'utils/calendar.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
`export function downloadCalendarICS(event: CalendarEventData) {
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/-|:|\\.\\d\\d\\d/g, "");
  };
  
  const stableId = event.id ? event.id : getStableId(\`\${event.title}_\${event.start.getTime()}\`);
  
  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MusicScale//Calendar Event//PT",
    "BEGIN:VEVENT",
    \`UID:scale_\${stableId}@musicscale.com\`,
    \`DTSTAMP:\${formatDate(new Date())}\`,
    \`DTSTART:\${formatDate(event.start)}\`,
    \`DTEND:\${formatDate(event.end)}\`,
    \`SUMMARY:\${escapeIcsText(event.title)}\`,
    \`DESCRIPTION:\${escapeIcsText(event.description)}\`,
    \`LOCATION:\${escapeIcsText(event.location)}\`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\\r\\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });`,
`export function generateCalendarICS(event: CalendarEventData): string {
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/-|:|\\.\\d\\d\\d/g, "");
  };
  
  const stableId = event.id ? event.id : getStableId(\`\${event.title}_\${event.start.getTime()}\`);
  
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MusicScale//Calendar Event//PT",
    "BEGIN:VEVENT",
    \`UID:scale_\${stableId}@musicscale.com\`,
    \`DTSTAMP:\${formatDate(new Date())}\`,
    \`DTSTART:\${formatDate(event.start)}\`,
    \`DTEND:\${formatDate(event.end)}\`,
    \`SUMMARY:\${escapeIcsText(event.title)}\`,
    \`DESCRIPTION:\${escapeIcsText(event.description)}\`,
    \`LOCATION:\${escapeIcsText(event.location)}\`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\\r\\n");
}

export function downloadCalendarICS(event: CalendarEventData) {
  const icsContent = generateCalendarICS(event);
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });`
);

fs.writeFileSync(file, content);
