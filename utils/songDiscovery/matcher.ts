import { NormalizedSongIdentity, SongMatchEvidence, MatchClassification, MatchReasonCode, MatchWarningCode } from './types.js';
import { EXACT_MATCH_THRESHOLD, HIGH_CONFIDENCE_THRESHOLD, POSSIBLE_DUPLICATE_THRESHOLD, MAX_EDIT_DISTANCE_TEXT_LENGTH, MIN_LYRICS_WORDS_FOR_STRONG_MATCH, GENERIC_TITLES } from './constants.js';

export function calculateSimilarity(str1: string | null | undefined, str2: string | null | undefined): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1.0;
    
    // Levenshtein distance based similarity
    let s1 = str1;
    let s2 = str2;
    
    if (s1.length > MAX_EDIT_DISTANCE_TEXT_LENGTH) s1 = s1.substring(0, MAX_EDIT_DISTANCE_TEXT_LENGTH);
    if (s2.length > MAX_EDIT_DISTANCE_TEXT_LENGTH) s2 = s2.substring(0, MAX_EDIT_DISTANCE_TEXT_LENGTH);
    
    const len1 = s1.length;
    const len2 = s2.length;
    if (len1 === 0 && len2 === 0) return 1.0;
    if (len1 === 0 || len2 === 0) return 0.0;
    
    // Simple fast substring inclusion for texts if one is much smaller but perfectly contained (e.g. chorus)
    if (len1 > 30 && len2 > 30) {
       if (s1.includes(s2) || s2.includes(s1)) return 0.9;
    }

    const dp: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
    
    for (let i = 0; i <= len1; i++) dp[i][0] = i;
    for (let j = 0; j <= len2; j++) dp[0][j] = j;

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }
    
    const maxLen = Math.max(len1, len2);
    const distance = dp[len1][len2];
    return 1 - (distance / maxLen);
}

// Compare two arrays of words (Jaccard similarity style for tokens/artists)
export function calculateSetSimilarity(set1: string[], set2: string[]): number {
    if (set1.length === 0 && set2.length === 0) return 1.0;
    if (set1.length === 0 || set2.length === 0) return 0.0;

    const s1 = new Set(set1);
    const s2 = new Set(set2);
    
    let intersection = 0;
    for (const item of s1) {
        if (s2.has(item)) intersection++;
    }
    const union = s1.size + s2.size - intersection;
    return intersection / union;
}

export function compareSongs(target: NormalizedSongIdentity, candidate: NormalizedSongIdentity): SongMatchEvidence {
    const reasons: MatchReasonCode[] = [];
    const warnings: MatchWarningCode[] = [];
    const comparableFields: string[] = [];
    const missingFields: string[] = [];

    // 1. Content Fingerprint Check (O(1) exact match candidate, requires verification)
    if (target.contentFingerprint && target.contentFingerprint === candidate.contentFingerprint) {
        if (target.normalizedTitle === candidate.normalizedTitle && 
            target.normalizedLyrics === candidate.normalizedLyrics && 
            calculateSetSimilarity(target.normalizedArtists, candidate.normalizedArtists) === 1.0) {
                
            reasons.push('CONTENT_FINGERPRINT_MATCH');
            return {
                overallScore: 1.0,
                classification: 'exact_match',
                scores: {
                    title: 1.0, artist: 1.0, lyrics: 1.0, opening: 1.0, chorus: 1.0,
                    structure: null, externalReference: null, harmony: null
                },
                reasons,
                warnings,
                comparableFields: ['contentFingerprint'],
                missingFields: []
            };
        } else {
            warnings.push('FINGERPRINT_COLLISION_GUARD');
        }
    }

    if (target.originalTitle && (target.originalTitle.includes('/') || target.originalTitle.toLowerCase().includes('medley'))) {
       warnings.push('POSSIBLE_MEDLEY');
    }

    // 2. Compute individual components
    
    // Title Score
    let titleScore: number | null = null;
    if (target.normalizedTitle && candidate.normalizedTitle) {
        comparableFields.push('title');
        titleScore = calculateSimilarity(target.normalizedTitle, candidate.normalizedTitle);
        // Bonus for subset matching if titles have extra words but share a core
        if (target.normalizedTitle.includes(candidate.normalizedTitle) || candidate.normalizedTitle.includes(target.normalizedTitle)) {
             titleScore = Math.max(titleScore, 0.95);
        }
        if (titleScore === 1.0) reasons.push('TITLE_EXACT');
        else if (titleScore > 0.9) reasons.push('TITLE_HIGH_SIMILARITY');
        
        if (GENERIC_TITLES.has(target.normalizedTitle)) {
            warnings.push('GENERIC_TITLE');
        }
    } else {
        missingFields.push('title');
    }

    // Artist Score
    let artistScore: number | null = null;
    if (target.normalizedArtists.length > 0 && candidate.normalizedArtists.length > 0) {
        comparableFields.push('artist');
        artistScore = calculateSetSimilarity(target.normalizedArtists, candidate.normalizedArtists);
        if (artistScore === 1.0) reasons.push('ARTIST_EXACT');
        else if (artistScore === 0) warnings.push('ARTIST_CONFLICT');
    } else {
        missingFields.push('artist');
    }

    // Lyrics Score
    let lyricsScore: number | null = null;
    if (target.lyricsFingerprint && candidate.lyricsFingerprint && target.lyricsFingerprint === candidate.lyricsFingerprint) {
        lyricsScore = 1.0;
        comparableFields.push('lyrics');
        reasons.push('LYRICS_EXACT');
    } else if (target.normalizedLyrics && candidate.normalizedLyrics) {
        comparableFields.push('lyrics');
        lyricsScore = calculateSimilarity(target.normalizedLyrics, candidate.normalizedLyrics);
        if (lyricsScore > 0.9) reasons.push('LYRICS_HIGH_SIMILARITY');
        
        const wordCount = target.normalizedLyrics.split(' ').length;
        if (wordCount < MIN_LYRICS_WORDS_FOR_STRONG_MATCH) {
             warnings.push('SHORT_LYRICS');
        }
    } else {
        missingFields.push('lyrics');
        warnings.push('MISSING_LYRICS');
    }

    // Opening Score
    let openingScore: number | null = null;
    if (target.openingLyrics && candidate.openingLyrics) {
        comparableFields.push('opening');
        openingScore = calculateSimilarity(target.openingLyrics, candidate.openingLyrics);
        if (openingScore > 0.9) reasons.push('OPENING_MATCH');
    } else {
        missingFields.push('opening');
    }

    // Chorus Score
    let chorusScore: number | null = null;
    if (target.chorusLyrics && candidate.chorusLyrics) {
        comparableFields.push('chorus');
        chorusScore = calculateSimilarity(target.chorusLyrics, candidate.chorusLyrics);
        if (chorusScore > 0.9) reasons.push('CHORUS_MATCH');
    } else {
        missingFields.push('chorus');
    }

    // External reference Score (Youtube)
    let externalScore: number | null = null;
    if (target.externalReferences.youtubeVideoId && candidate.externalReferences.youtubeVideoId) {
        comparableFields.push('youtube');
        externalScore = target.externalReferences.youtubeVideoId === candidate.externalReferences.youtubeVideoId ? 1.0 : 0.0;
        if (externalScore === 1.0) {
            reasons.push('EXTERNAL_VIDEO_MATCH');
        }
    } else {
        missingFields.push('youtube');
    }

    // 3. Weight and Aggregate Logic
    // We only use weights for non-null components.
    let scoreSum = 0;
    let weightSum = 0;

    if (titleScore !== null) {
        scoreSum += titleScore * 0.40;
        weightSum += 0.40;
    }
    
    if (artistScore !== null) {
        scoreSum += artistScore * 0.15;
        weightSum += 0.15;
    }
    
    if (lyricsScore !== null) {
        scoreSum += lyricsScore * 0.45;
        weightSum += 0.45;
    } else if (openingScore !== null && chorusScore !== null) {
        const partialLyricsScore = (openingScore * 0.5 + chorusScore * 0.5);
        scoreSum += partialLyricsScore * 0.30; // Max out at 0.3 without full lyrics
        weightSum += 0.30;
    }

    if (externalScore === 1.0) {
        scoreSum += 0.30; // Direct bonus, but bounded below
        weightSum += 0.30;
    }
    
    let overallScore = weightSum > 0 ? scoreSum / weightSum : 0;
    
    // Bounds Check: If titles strongly disagree, it heavily penalizes
    if (titleScore !== null && titleScore < 0.6) {
        overallScore = Math.min(overallScore, 0.7);
        warnings.push('TITLE_CONFLICT');
    }

    // 4. Determine Classification
    let classification: MatchClassification = 'insufficient_data';
    
    if (comparableFields.length < 2) {
       classification = 'insufficient_data';
       warnings.push('INSUFFICIENT_DATA');
    } else if (overallScore >= EXACT_MATCH_THRESHOLD && lyricsScore !== null && lyricsScore > 0.95 && titleScore !== null && titleScore > 0.95) {
       classification = 'exact_match';
    } else if (overallScore >= EXACT_MATCH_THRESHOLD) {
       // High score, but missing absolute certainty 
       classification = 'high_confidence_match';
    } else if (overallScore >= HIGH_CONFIDENCE_THRESHOLD) {
       classification = 'high_confidence_match';
    } else if (overallScore >= POSSIBLE_DUPLICATE_THRESHOLD) {
       classification = 'possible_duplicate';
    } else {
       classification = 'likely_unique';
    }

    return {
        overallScore,
        classification,
        scores: {
            title: titleScore,
            artist: artistScore,
            lyrics: lyricsScore,
            opening: openingScore,
            chorus: chorusScore,
            structure: null,
            externalReference: externalScore,
            harmony: null
        },
        reasons,
        warnings,
        comparableFields,
        missingFields
    };
}
