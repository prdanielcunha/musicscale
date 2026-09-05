export const MUSIC_SCALE_RESPONSE_CUTOFF_MINUTES = 5;

export const getMusicScaleResponseDeadline = (
  eventStart?: Date | null,
): Date | null => {
  if (!eventStart || Number.isNaN(eventStart.getTime())) return null;
  return new Date(
    eventStart.getTime() - MUSIC_SCALE_RESPONSE_CUTOFF_MINUTES * 60 * 1000,
  );
};

export const isMusicScaleResponseDeadlinePassed = (
  eventStart?: Date | null,
  nowMillis: number = Date.now(),
): boolean => {
  const deadline = getMusicScaleResponseDeadline(eventStart);
  return deadline ? nowMillis >= deadline.getTime() : false;
};
