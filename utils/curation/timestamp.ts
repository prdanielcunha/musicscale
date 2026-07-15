export type FirestoreTimestampLike = { toMillis: () => number };
export type FirestoreDateLike = { toDate: () => Date };
export type SecondsNanoseconds = { seconds: number; nanoseconds?: number };
export type LegacyMillis = number;
export type DateInstance = Date;
export type ISODateString = string;

export type FlexibleTimestamp = 
    | FirestoreTimestampLike 
    | FirestoreDateLike 
    | SecondsNanoseconds 
    | LegacyMillis 
    | DateInstance 
    | ISODateString 
    | null 
    | undefined;

export function parseTimestampToMillis(t: FlexibleTimestamp): number | null {
    if (!t) return null;
    
    if (typeof t === 'object') {
        if ('toMillis' in t && typeof t.toMillis === 'function') {
            try { return t.toMillis(); } catch (_) {}
        }
        if ('toDate' in t && typeof t.toDate === 'function') {
            try { return t.toDate().getTime(); } catch (_) {}
        }
        if ('seconds' in t && typeof t.seconds === 'number') {
            return t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1000000);
        }
    }

    if (t instanceof Date) {
        return t.getTime();
    }
    
    if (typeof t === 'number') {
        return t;
    }
    
    if (typeof t === 'string') {
        const parsed = Date.parse(t);
        return isNaN(parsed) ? null : parsed;
    }
    
    return null;
}
