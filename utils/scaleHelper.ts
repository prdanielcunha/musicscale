export interface SimpleScaleLike {
  eventType?: { name: string } | string;
  eventName?: { name: string } | string | null;
  eventTypeName?: string;
  eventNameName?: string;
}

export function getScaleTitle(scale: any): string {
  if (!scale) return "";
  
  const eventTypeName = scale.eventType?.name || scale.eventTypeName || (typeof scale.eventType === 'string' ? scale.eventType : null) || "Escala";
  const eventNameStr = scale.eventName?.name || scale.eventNameName || (typeof scale.eventName === 'string' ? scale.eventName : null) || "";
  
  if (eventTypeName && eventNameStr) {
    return `${eventTypeName} ${eventNameStr}`;
  }
  return eventTypeName;
}
