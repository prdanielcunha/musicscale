import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { GlobalSong } from '../types';
import { logger } from '../lib/logger';
import { MusicScalePlan, MusicScaleFeatures, MusicScaleLimits } from './entitlementsService';

export interface UsageMonth {
  libraryImports: number;
  updatedAt: any;
  createdAt?: any;
  month: string;
  organizationId: string;
}

export function getCurrentMonthString(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export async function getMonthlyUsage(orgId: string, monthStr: string): Promise<number> {
  if (!orgId) return 0;
  try {
    const usageDocRef = doc(db, 'organizations', orgId, 'monthly_usage', monthStr);
    const snap = await getDoc(usageDocRef);
    if (snap.exists()) {
      return snap.data()?.libraryImports || 0;
    }
    return 0;
  } catch (error) {
    logger.error("Error fetching monthly usage", error);
    return 0;
  }
}

export interface ImportResult {
  success: boolean;
  importedCount: number;
  blockedCount: number;
  errorMessage?: string;
  errorCode?: 'STARTER_BLOCKED' | 'ADVANCED_LIMIT_REACHED' | 'INSUFFICIENT_IMPORT_QUOTA' | 'UNKNOWN';
}

export async function importGlobalLibrarySongsWithUsageCheck(
  organizationId: string,
  userUid: string,
  userDisplayName: string,
  selectedSongs: GlobalSong[],
  plan: MusicScalePlan,
  limits: MusicScaleLimits,
  features: MusicScaleFeatures,
  isSupportMode: boolean = false,
  systemRole: string = ''
): Promise<ImportResult> {
  if (!organizationId || selectedSongs.length === 0) {
    return { success: false, importedCount: 0, blockedCount: selectedSongs.length, errorMessage: "Invalid params" };
  }

  const isPro = plan === 'pro' || limits.libraryImportsPerMonth === -1 || features.libraryComplete;

  try {
    const { auth } = await import('./firebase');
    const token = await auth.currentUser?.getIdToken(true);
    
    if (!token) {
      throw new Error("No authentication token available");
    }

    const response = await fetch('/api/library/import', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        organizationId,
        userDisplayName,
        selectedSongs,
        isSupportMode,
        systemRole
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    logger.error("Usage API call failed", error);
    return {
      success: false,
      importedCount: 0,
      blockedCount: selectedSongs.length,
      errorCode: 'UNKNOWN',
      errorMessage: "Ocorreu um erro ao comunicar com o servidor. Tente novamente."
    };
  }
}
