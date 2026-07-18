import crypto from 'crypto';

export interface ImportPlanResult {
  songsToImport: any[];
  skippedIds: string[];
  newGlobalIds: string[];
  projectedTotalCount: number;
  limitExceeded: boolean;
}

export interface OnboardingStateDoc {
  starterPackVersion: string;
  starterPackImportedGlobalIds: string[];
  starterPackImportedCount: number;
  starterPackStartedAt: any;
  starterPackCompletedAt: any | null;
  updatedAt: any;
  lastActorUid: string;
}

/**
 * Generates a deterministic song ID for starter pack songs to ensure idempotency.
 */
export function generateDeterministicStarterSongId(orgId: string, globalSongId: string, version: string = '1.0'): string {
  const deterministicInput = `${orgId}_${globalSongId}_${version}`;
  return "starter_" + crypto.createHash('sha256').update(deterministicInput).digest('hex').slice(0, 20);
}

/**
 * Selects up to 10 starter songs from globalSongs without requiring a compound query index.
 */
export async function selectStarterPack(db: any): Promise<any[]> {
  const songsRef = db.collection("globalSongs");

  // Fetch all marked as onboardingStarter
  const starterSnap = await songsRef.where("onboardingStarter", "==", true).get();
  let starterSongs = starterSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

  // Filter for active status in-memory
  starterSongs = starterSongs.filter((song: any) => song.status === 'active');

  // Sort onboardingStarterRank
  starterSongs.sort((a: any, b: any) => (a.onboardingStarterRank || 999) - (b.onboardingStarterRank || 999));

  // If we need more to reach 10, fetch general active globalSongs and filter in-memory
  if (starterSongs.length < 10) {
    const needed = 10 - starterSongs.length;
    // Query simply status === active, limit to 100
    const activeSnap = await songsRef.where("status", "==", "active").limit(100).get();
    const activeSongs = activeSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    // Filter in-memory to find popular Portuguese songs not already in starter pack
    const filteredActive = activeSongs.filter((song: any) => {
      const isLanguagePt = song.language === 'pt';
      const isNotAlreadyStarter = !song.onboardingStarter && !starterSongs.some((s: any) => s.id === song.id);
      return isLanguagePt && song.title && song.artist && isNotAlreadyStarter;
    });

    // Sort by importCount descending in-memory
    filteredActive.sort((a: any, b: any) => (b.importCount || 0) - (a.importCount || 0));

    // Append to starter songs
    starterSongs = [...starterSongs, ...filteredActive.slice(0, needed)];
  }

  // Deduplicate just in case
  const seenIds = new Set<string>();
  const uniqueSongs: any[] = [];
  for (const song of starterSongs) {
    if (!seenIds.has(song.id)) {
      seenIds.add(song.id);
      uniqueSongs.push(song);
    }
  }

  return uniqueSongs.slice(0, 10);
}

/**
 * Validates selected song IDs against resolved starter pack songs.
 */
export function validateStarterSelection(selectedSongIds: string[], starterSongs: any[]): { valid: boolean; error?: string; message?: string } {
  const uniqueIds = Array.from(new Set(selectedSongIds));
  if (uniqueIds.length > 10) {
    return { valid: false, error: "LIMIT_EXCEEDED", message: "Cannot import more than 10 songs at once" };
  }
  const starterIds = new Set(starterSongs.map(s => s.id));
  for (const id of uniqueIds) {
    if (!starterIds.has(id)) {
      return { valid: false, error: "FORBIDDEN_SONG_ID", message: "Um ou mais IDs não pertencem ao pacote inicial permitido." };
    }
  }
  return { valid: true };
}

/**
 * Computes the import plan, validating the 10-song limit and tracking global IDs.
 */
export function computeStarterImportPlan(params: {
  selectedSongIds: string[];
  starterSongs: any[];
  existingOrganizationGlobalIds?: string[];
  starterPackImportedGlobalIds?: string[];
  existingGlobalIds?: string[]; // Backwards compatibility fallback
  existingDocIds?: string[];
  orgId?: string;
  version?: string;
}): ImportPlanResult {
  const selectedUnique = Array.from(new Set(params.selectedSongIds));
  
  // Use organization global IDs to prevent duplication in the repertoire
  const existingOrgSet = new Set(params.existingOrganizationGlobalIds || params.existingGlobalIds || []);
  const starterPackImportedSet = new Set(params.starterPackImportedGlobalIds || []);
  const existingDocSet = new Set(params.existingDocIds || []);
  const orgId = params.orgId || '';
  const version = params.version || '1.0';

  const songsToImport: any[] = [];
  const skippedIds: string[] = [];
  
  // Start with existing starter pack imported IDs
  const finalStarterPackGlobalIds = [...(params.starterPackImportedGlobalIds || [])];

  for (const id of selectedUnique) {
    const deterministicId = orgId ? generateDeterministicStarterSongId(orgId, id, version) : '';
    
    const existsInRepertoire = existingOrgSet.has(id);
    const deterministicExists = deterministicId ? existingDocSet.has(deterministicId) : false;

    if (existsInRepertoire || deterministicExists) {
      skippedIds.push(id);
      
      // Include originGlobalSongId in starter pack state if it is indeed a starter pack song
      const isStarterPackSong = starterPackImportedSet.has(id) || deterministicExists;
      if (isStarterPackSong && !finalStarterPackGlobalIds.includes(id)) {
        finalStarterPackGlobalIds.push(id);
      }
    } else {
      const song = params.starterSongs.find(s => s.id === id);
      if (song) {
        songsToImport.push(song);
        if (!finalStarterPackGlobalIds.includes(id)) {
          finalStarterPackGlobalIds.push(id);
        }
      }
    }
  }

  const uniqueNewGlobalIds = Array.from(new Set(finalStarterPackGlobalIds));
  const projectedTotalCount = uniqueNewGlobalIds.length;
  const limitExceeded = projectedTotalCount > 10;

  return {
    songsToImport,
    skippedIds,
    newGlobalIds: uniqueNewGlobalIds,
    projectedTotalCount,
    limitExceeded
  };
}

/**
 * Builds the updated onboarding state document while enforcing limits and business rules.
 */
export function buildUpdatedOnboardingState(
  existingState: any,
  newGlobalIds: string[],
  actorUid: string,
  version: string = '1.0',
  serverTimestamp: any = new Date()
): OnboardingStateDoc {
  const currentGlobalIds = Array.isArray(existingState?.starterPackImportedGlobalIds)
    ? existingState.starterPackImportedGlobalIds
    : [];

  const combinedIds = Array.from(new Set([...currentGlobalIds, ...newGlobalIds]));
  const count = combinedIds.length;

  if (count > 10) {
    throw new Error("starter_pack_limit_exceeded");
  }

  const starterPackStartedAt = existingState?.starterPackStartedAt || serverTimestamp;
  const starterPackCompletedAt = existingState?.starterPackCompletedAt || (count === 10 ? serverTimestamp : null);

  return {
    starterPackVersion: existingState?.starterPackVersion || version || '1.0',
    starterPackImportedGlobalIds: combinedIds,
    starterPackImportedCount: count,
    starterPackStartedAt,
    starterPackCompletedAt,
    updatedAt: serverTimestamp,
    lastActorUid: actorUid
  };
}

/**
 * Normalizes a global song to be imported into an organization's repertoire.
 */
export function normalizeStarterSong(
  song: any,
  orgId: string,
  createdBy: any,
  importedByUid: string,
  version: string = '1.0'
): any {
  const starterPackVersion = song.onboardingStarterVersion || version || '1.0';
  const songDocId = generateDeterministicStarterSongId(orgId, song.id, starterPackVersion);

  return {
    id: songDocId,
    organizationId: orgId,
    title: song.title || '',
    artist: song.artist || '',
    originalKey: song.key || song.originalKey || '',
    selectedKey: song.key || song.selectedKey || song.originalKey || '',
    bpm: song.bpm || null,
    suggestedBpm: song.suggestedBpm || song.bpm || null,
    bpmConfidence: song.bpmConfidence || 'high',
    bpmSource: song.bpmSource || 'manual',
    sections: song.sections || [],
    status: 'active',
    tagIds: song.tagIds || [],
    lyrics: song.lyrics || '',
    chords: song.chords || '',
    videoUrl: song.videoUrl || "",
    chordsUrl: song.chordsUrl || "",
    language: song.language || 'pt',
    originGlobalSongId: song.id,
    onboardingStarter: true,
    onboardingStarterPack: true,
    onboardingStarterVersion: starterPackVersion,
    lastPlayed: song.lastPlayed || null,
    lastScheduledAt: song.lastScheduledAt || null,
    createdBy,
    importedBy: importedByUid,
    usageConsumed: false,
    freshness: {
      status: 'new',
      source: 'auto',
      autoUpdatedAt: new Date().toISOString()
    }
  };
}

/**
 * Resolves whether an organization is entitled based on core canonical subscriptions/apps data.
 */
export async function resolveStarterEntitlementState(db: any, orgId: string): Promise<boolean> {
  try {
    const orgSnap = await db.collection('organizations').doc(orgId).get();
    if (!orgSnap.exists) return false;
    const orgData = orgSnap.data() || {};

    // Archiving is instantly invalid
    if (orgData.status === 'archived' || orgData.archived === true) {
      return false;
    }

    // Check canonical apps mapping
    const msApp = orgData.apps?.musicscale;
    if (msApp && msApp.status) {
      const rawStatus = String(msApp.status).toLowerCase().trim();
      if (['active', 'trial', 'trialing'].includes(rawStatus)) {
        return true;
      }
      // Check active within grace/canceled period
      if (rawStatus === 'canceled' || rawStatus === 'cancelled') {
        const expiresAt = msApp.expiresAt || msApp.currentPeriodEnd;
        if (expiresAt) {
          const expiryDate = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
          if (expiryDate > new Date()) {
            return true;
          }
        }
      }
    }

    // Check fallback subscriptions collection
    const subSnap = await db.collection('subscriptions').doc(orgId).get();
    if (subSnap.exists) {
      const subData = subSnap.data() || {};
      const rawStatus = String(subData.status || '').toLowerCase().trim();
      if (['active', 'trial', 'trialing'].includes(rawStatus)) {
        return true;
      }
      if (rawStatus === 'canceled' || rawStatus === 'cancelled') {
        const expiresAt = subData.expiresAt || subData.currentPeriodEnd || subData.endsAt;
        if (expiresAt) {
          const expiryDate = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
          if (expiryDate > new Date()) {
            return true;
          }
        }
      }
    }

  } catch (e) {
    console.error("[firstScaleOnboardingService] Technical failure resolving entitlement - failing closed:", e);
  }

  return false;
}

/**
 * Resolves the Starter Pack Allowance Context for API routes.
 * This checks authorization, entitlement, and retrieves the current allowance.
 */
export async function resolveStarterPackAllowanceContext(
  req: any,
  res: any,
  db: any,
  adminAuth: any
): Promise<{ 
  error?: string; 
  statusCode?: number; 
  message?: string; 
  correlationId?: string;
  allowance?: any;
  orgId?: string;
  authContext?: any;
} | null> {
  const orgIdHeader = req.headers["x-organization-id"];
  const orgId = Array.isArray(orgIdHeader) ? orgIdHeader[0] : orgIdHeader;
  
  if (!orgId) {
    res.status(400).json({ error: "Missing x-organization-id header", message: "Falta x-organization-id" });
    return null;
  }

  const { resolveOrganizationAuthorization } = await import("../organizationAuthorization.js");
  const authResult = await resolveOrganizationAuthorization(req.headers.authorization, orgId, db, adminAuth);
  
  if (authResult.error || authResult.statusCode || !authResult.context?.isActive) {
    res.status(authResult.statusCode || 403).json({ 
      error: authResult.error,
      message: "Não autorizado ou sem acesso à organização."
    });
    return null;
  }

  const entitled = await resolveStarterEntitlementState(db, orgId);
  if (!entitled) {
    res.status(403).json({ 
       error: "NO_ENTITLEMENT", 
       message: "Esta organização não possui entitlement do MusicScale."
    });
    return null;
  }

  const { resolveStarterPackAllowance } = await import("../../../utils/starterPackAllowance.js");
  
  // Read state
  const stateRef = db.collection("organizations").doc(orgId).collection("musicScaleOnboarding").doc("state");
  const stateSnap = await stateRef.get();
  const onboardingState = stateSnap.exists ? stateSnap.data() : {};
  
  // Read songs for fallback verification
  const songsRef = db.collection("songs");
  const songsSnap = await songsRef.where("organizationId", "==", orgId).get();
  
  const organizationSongs: any[] = [];
  songsSnap.forEach((doc: any) => {
    const data = doc.data();
    if (data.onboardingStarter || data.onboardingStarterPack) {
       organizationSongs.push({
         originGlobalSongId: data.originGlobalSongId,
         onboardingStarter: data.onboardingStarter,
         onboardingStarterPack: data.onboardingStarterPack
       });
    }
  });

  const allowance = resolveStarterPackAllowance({ onboardingState, organizationSongs, limit: 10 });

  return {
    allowance,
    orgId,
    authContext: authResult.context
  };
}
