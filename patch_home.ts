import fs from 'fs';

const path = 'utils/homeExperience.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Update HomeEventSummary
const summaryRegex = /export interface HomeEventSummary \{[\s\S]*?\}/;
const newSummary = `export interface HomeEventSummary {
  id: string;
  type: 'music' | 'band';
  title: string;
  date: string;
  time?: string | null;
  locationName?: string | null;
  songCount: number;
  teamCount: number;
  status?: string | null;
  userFunctionNames: string[];
  isUserAssigned: boolean;
  songs?: HomeEventSongSummary[];
  durationMinutes?: number | null;
  startAtMillis?: number | null;
  endAtMillis?: number | null;
  eventTemporalState?: 'upcoming' | 'in-progress' | 'ended' | 'unscheduled';
}`;
code = code.replace(summaryRegex, newSummary);

// 2. Add Pure Helpers
const helpersCode = `export const DEFAULT_EVENT_DURATION_MINUTES = 120;

export function parseLocalEventStart(date: string, time: string | null | undefined): Date | null {
  if (!isValidDateOnlyKey(date)) return null;
  if (!time) return null;

  const [yearStr, monthStr, dayStr] = date.split('-');
  const [hourStr, minStr] = time.split(':');

  if (!hourStr || !minStr) return null;

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const min = parseInt(minStr, 10);

  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(min)) return null;

  return new Date(year, month - 1, day, hour, min, 0, 0);
}

export function resolveEventDurationMinutes(durationMinutes: number | null | undefined): number {
  if (typeof durationMinutes === 'number' && isFinite(durationMinutes) && durationMinutes > 0) {
    return durationMinutes;
  }
  return DEFAULT_EVENT_DURATION_MINUTES;
}

export function getEventEndMillis(startAtMillis: number | null | undefined, durationMinutes: number): number | null {
  if (typeof startAtMillis !== 'number') return null;
  return startAtMillis + durationMinutes * 60 * 1000;
}

export function getEventTemporalState(
  event: Pick<HomeEventSummary, 'startAtMillis' | 'endAtMillis'>,
  nowMillis: number
): 'upcoming' | 'in-progress' | 'ended' | 'unscheduled' {
  if (typeof event.startAtMillis !== 'number' || typeof event.endAtMillis !== 'number') {
    return 'unscheduled';
  }

  if (nowMillis >= event.endAtMillis) {
    return 'ended';
  }
  if (nowMillis >= event.startAtMillis) {
    return 'in-progress';
  }

  return 'upcoming';
}

export function isEventVisibleOnHome(
  event: Pick<HomeEventSummary, 'startAtMillis' | 'endAtMillis'>,
  nowMillis: number
): boolean {
  const state = getEventTemporalState(event, nowMillis);
  return state !== 'ended';
}

`;

code = code.replace('// Helpers puros (REQUISITO 9)', '// Helpers puros (REQUISITO 9)\n' + helpersCode);

// 3. Update buildHomeEventSummaries signature and implementation
const buildHomeOriginal = `export function buildHomeEventSummaries(
  musicScales: PopulatedScaleWithAssignmentsAndStatus[],
  bandScales: PopulatedBandScaleWithStatus[],
  currentUserId?: string,
  todayKey: string = getLocalDateKey()
): HomeEventSummary[] {
  const summaries: HomeEventSummary[] = [];
  const validTodayKey = isValidDateOnlyKey(todayKey) ? todayKey : getLocalDateKey();`;

const buildHomeNew = `export function buildHomeEventSummaries(
  musicScales: PopulatedScaleWithAssignmentsAndStatus[],
  bandScales: PopulatedBandScaleWithStatus[],
  currentUserId?: string,
  todayKey?: string,
  nowMillis: number = Date.now()
): HomeEventSummary[] {
  const summaries: HomeEventSummary[] = [];
  const validTodayKey = isValidDateOnlyKey(todayKey) ? todayKey : getLocalDateKey(new Date(nowMillis));`;
code = code.replace(buildHomeOriginal, buildHomeNew);

// In buildHomeEventSummaries, update the push for musicScale
const pushMusicOriginal = `    summaries.push({
      id: scale.id,
      type: 'music',
      title,
      date: scale.date,
      time: scale.time,
      locationName,
      songCount,
      teamCount,
      status: scale.status,
      userFunctionNames,
      isUserAssigned,
      songs,
    });`;

const pushMusicNew = `    const startObj = parseLocalEventStart(scale.date, scale.time);
    const startAtMillis = startObj ? startObj.getTime() : null;
    const durationMinutes = resolveEventDurationMinutes(scale.durationMinutes);
    const endAtMillis = getEventEndMillis(startAtMillis, durationMinutes);
    const eventTemporalState = getEventTemporalState({ startAtMillis, endAtMillis }, nowMillis);

    if (scale.date === validTodayKey && eventTemporalState === 'ended') return;

    summaries.push({
      id: scale.id,
      type: 'music',
      title,
      date: scale.date,
      time: scale.time,
      locationName,
      songCount,
      teamCount,
      status: scale.status,
      userFunctionNames,
      isUserAssigned,
      songs,
      durationMinutes,
      startAtMillis,
      endAtMillis,
      eventTemporalState,
    });`;
code = code.replace(pushMusicOriginal, pushMusicNew);


// Update Band Scales parsing in buildHomeEventSummaries
const pushBandOriginal = `    summaries.push({
      id: scale.id,
      type: 'band',
      title,
      date: scale.date,
      time: scale.time,
      locationName,
      songCount,
      teamCount,
      status: scale.status,
      userFunctionNames,
      isUserAssigned,
    });`;

const pushBandNew = `    const startObj = parseLocalEventStart(scale.date, scale.time);
    const startAtMillis = startObj ? startObj.getTime() : null;
    // BandScales usually don't have durationMinutes, so we fallback
    const durationMinutes = resolveEventDurationMinutes(undefined);
    const endAtMillis = getEventEndMillis(startAtMillis, durationMinutes);
    const eventTemporalState = getEventTemporalState({ startAtMillis, endAtMillis }, nowMillis);

    if (scale.date === validTodayKey && eventTemporalState === 'ended') return;

    summaries.push({
      id: scale.id,
      type: 'band',
      title,
      date: scale.date,
      time: scale.time,
      locationName,
      songCount,
      teamCount,
      status: scale.status,
      userFunctionNames,
      isUserAssigned,
      durationMinutes,
      startAtMillis,
      endAtMillis,
      eventTemporalState,
    });`;
code = code.replace(pushBandOriginal, pushBandNew);


// Update sort logic
const sortOriginal = `  return [...summaries].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    const timeA = a.time || '00:00';
    const timeB = b.time || '00:00';
    return timeA.localeCompare(timeB);
  });`;

const sortNew = `  return [...summaries].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    // REQUISITO 14.20: ordenação por início real
    if (typeof a.startAtMillis === 'number' && typeof b.startAtMillis === 'number') {
      return a.startAtMillis - b.startAtMillis;
    }
    const timeA = a.time || '00:00';
    const timeB = b.time || '00:00';
    return timeA.localeCompare(timeB);
  });`;
code = code.replace(sortOriginal, sortNew);

// Write back
fs.writeFileSync(path, code);
console.log('patched');
