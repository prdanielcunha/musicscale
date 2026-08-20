import { offlineDB } from './database';
import { ecosystemBridge } from '../ecosystem/EcosystemBridge';

export class ScaleRetentionService {
  private static instance: ScaleRetentionService;

  // Local cache rule: keep scales from the last 6 months.
  private readonly RETENTION_MONTHS = 6;
  // Never remove cache entries newer than this safety window.
  private readonly SAFETY_DAYS = 170;

  private constructor() {}

  public static getInstance(): ScaleRetentionService {
    if (!ScaleRetentionService.instance) {
      ScaleRetentionService.instance = new ScaleRetentionService();
    }
    return ScaleRetentionService.instance;
  }

  public async runRetentionCleanup(orgId: string): Promise<void> {
    if (!orgId) return;

    try {
      const now = new Date();
      const cutoffDate = new Date(now);
      cutoffDate.setMonth(cutoffDate.getMonth() - this.RETENTION_MONTHS);
      const cutoffIsoString = cutoffDate.toISOString().split('T')[0];

      const safetyCheckDate = new Date(now);
      safetyCheckDate.setDate(safetyCheckDate.getDate() - this.SAFETY_DAYS);
      const safetyIsoString = safetyCheckDate.toISOString().split('T')[0];

      if (cutoffIsoString >= safetyIsoString) {
        console.warn('[RetentionService] Safety check failed. Cutoff date is too close to today.', { cutoffIsoString, safetyIsoString });
        return;
      }

      console.info(`[RetentionService] Starting local cache cleanup for organization ${orgId}. Cutoff date: ${cutoffIsoString}`);

      const cachedScalesDeleted = await this.cleanupLocalScales(orgId, cutoffIsoString);

      if (cachedScalesDeleted > 0) {
        ecosystemBridge.publishEvent({
          type: 'telemetry',
          payload: {
            action: 'retention_cleanup',
            cachedScalesDeleted,
            orgId,
            cutoffIsoString
          },
          timestamp: Date.now()
        });
        console.info(`[RetentionService] Local cache cleanup complete. Removed ${cachedScalesDeleted} cached scales.`);
      }
    } catch (error) {
      console.error('[RetentionService] Error during local cache cleanup:', error);
      ecosystemBridge.publishEvent({
        type: 'error',
        payload: {
          type: 'retention_cleanup_error',
          message: error instanceof Error ? error.message : String(error)
        },
        timestamp: Date.now()
      });
    }
  }

  private async cleanupLocalScales(orgId: string, cutoffIsoString: string): Promise<number> {
    const cachedScales = await offlineDB.cachedScales.toArray();
    const idsToDelete = cachedScales
      .filter((scale) => (
        typeof scale?.id === 'string' &&
        scale.id.length > 0 &&
        typeof scale.organizationId === 'string' &&
        scale.organizationId === orgId &&
        this.isValidIsoDate(scale.date) &&
        scale.date < cutoffIsoString
      ))
      .map((scale) => scale.id as string);

    if (idsToDelete.length > 0) {
      await offlineDB.cachedScales.bulkDelete(idsToDelete);
    }

    return idsToDelete.length;
  }

  private isValidIsoDate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }
}

export const scaleRetentionService = ScaleRetentionService.getInstance();
