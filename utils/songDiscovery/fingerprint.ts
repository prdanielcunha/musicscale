// A simple deterministic hash function for generating fingerprints
// NOTE: Cyrb53 is a non-cryptographic 53-bit hash. 
// It MUST NOT be used as absolute proof of identity.
// Collisions are possible. Matchers MUST use fingerprints only as a fast heuristic
// and corroborate with actual normalized strings when a deep match is required.
// The time complexity is O(N) where N is string length.
export function cyrb53(str: string, seed = 0): string {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

export function generateFingerprint(normalizedText: string | null | undefined): string | null {
    if (!normalizedText || normalizedText.trim().length === 0) return null;
    return cyrb53(normalizedText);
}
