import { BandAssignment } from "./assignmentNormalizer.js";

export interface AssignmentDiff {
  created: BandAssignment[];
  updated: BandAssignment[];
  removed: BandAssignment[];
  unchanged: BandAssignment[];
}

export class AssignmentDiffService {
  /**
   * Computes the diff between existing assignments and reconciled assignments.
   */
  static diff(existing: any[] = [], reconciled: BandAssignment[]): AssignmentDiff {
    const existingMap = new Map<string, any>();
    for (const ext of existing) {
      if (ext.assignmentId) {
        existingMap.set(ext.assignmentId, ext);
      }
    }

    const created: BandAssignment[] = [];
    const updated: BandAssignment[] = [];
    const unchanged: BandAssignment[] = [];
    const matchedExistingIds = new Set<string>();

    for (const rec of reconciled) {
      const ext = existingMap.get(rec.assignmentId);
      if (!ext) {
        created.push(rec);
      } else {
        matchedExistingIds.add(rec.assignmentId);
        if (ext.userId === rec.userId && ext.instrumentId === rec.instrumentId) {
          unchanged.push(rec);
        } else {
          updated.push(rec);
        }
      }
    }

    const removed: BandAssignment[] = [];
    for (const ext of existing) {
      if (ext.assignmentId && !matchedExistingIds.has(ext.assignmentId)) {
        removed.push({
          assignmentId: ext.assignmentId,
          userId: ext.userId,
          instrumentId: ext.instrumentId,
        });
      }
    }

    return {
      created,
      updated,
      removed,
      unchanged,
    };
  }
}
