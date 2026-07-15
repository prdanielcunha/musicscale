import crypto from "crypto";

export interface BandAssignment {
  assignmentId: string;
  userId: string;
  instrumentId: string;
}

export class AssignmentNormalizer {
  /**
   * Normalizes and reconciles a list of assignments for creation or update.
   * On update, it compares new assignments against existing ones to maintain assignmentId stability.
   */
  static reconcile(
    existing: any[] = [],
    incoming: any[] = [],
    scaleId: string
  ): BandAssignment[] {
    // 1. Basic validation: Reject duplicate exact combinations of userId + instrumentId in the incoming payload
    const seen = new Set<string>();
    for (const item of incoming) {
      if (!item.userId || !item.instrumentId) {
        throw new Error("Cada atribuição precisa conter userId e instrumentId válidos.");
      }
      const key = `${item.userId}:${item.instrumentId}`;
      if (seen.has(key)) {
        throw new Error(`Atribuição duplicada encontrada para o usuário ${item.userId} com o instrumento ${item.instrumentId}.`);
      }
      seen.add(key);
    }

    // 2. Pre-process existing assignments to ensure they all have some ID for comparison (even if legacy)
    const existingNormalized = existing.map((ext, idx) => {
      const assignmentId =
        ext.assignmentId ||
        crypto
          .createHash("sha256")
          .update(`legacy:${scaleId}:${idx}:${ext.userId}:${ext.instrumentId}`)
          .digest("hex")
          .substring(0, 20);
      return {
        assignmentId,
        userId: ext.userId,
        instrumentId: ext.instrumentId,
      };
    });

    // We will build the final reconciled list
    const reconciled: BandAssignment[] = [];
    const matchedExistingIds = new Set<string>();

    // Step A: Reconcile incoming assignments that already specify an assignmentId
    const incomingWithId = incoming.filter((inc) => !!inc.assignmentId);
    const incomingWithoutId = incoming.filter((inc) => !inc.assignmentId);

    for (const inc of incomingWithId) {
      const match = existingNormalized.find(
        (ext) => ext.assignmentId === inc.assignmentId
      );
      if (match) {
        // Rule: Troca de pessoa não é permitida mantendo o mesmo assignmentId.
        if (match.userId !== inc.userId) {
          throw new Error(
            `Mudança de integrante no assignmentId '${inc.assignmentId}' de '${match.userId}' para '${inc.userId}' não é permitida. Remova a atribuição anterior e crie uma nova.`
          );
        }
        reconciled.push({
          assignmentId: inc.assignmentId,
          userId: inc.userId,
          instrumentId: inc.instrumentId,
        });
        matchedExistingIds.add(inc.assignmentId);
      } else {
        // If they provided an assignmentId but it is not found in existing assignments,
        // we can treat it as a new assignment with that ID, but to be completely safe,
        // let's preserve it if it looks valid or generate a new stable ID. Let's preserve it.
        reconciled.push({
          assignmentId: inc.assignmentId,
          userId: inc.userId,
          instrumentId: inc.instrumentId,
        });
      }
    }

    // Step B: Match incoming assignments that don't have an ID
    // Pass 1: Exact match on userId and instrumentId (person remaining in same role)
    for (let i = incomingWithoutId.length - 1; i >= 0; i--) {
      const inc = incomingWithoutId[i];
      const match = existingNormalized.find(
        (ext) =>
          !matchedExistingIds.has(ext.assignmentId) &&
          ext.userId === inc.userId &&
          ext.instrumentId === inc.instrumentId
      );
      if (match) {
        reconciled.push({
          assignmentId: match.assignmentId,
          userId: inc.userId,
          instrumentId: inc.instrumentId,
        });
        matchedExistingIds.add(match.assignmentId);
        incomingWithoutId.splice(i, 1); // remove from unmatched incoming list
      }
    }

    // Pass 2: Match on userId only (person changing instrument/role)
    for (let i = incomingWithoutId.length - 1; i >= 0; i--) {
      const inc = incomingWithoutId[i];
      // Find ALL unmatched existing assignments for this user
      const candidateMatches = existingNormalized.filter(
        (ext) =>
          !matchedExistingIds.has(ext.assignmentId) &&
          ext.userId === inc.userId
      );

      if (candidateMatches.length === 1) {
        const match = candidateMatches[0];
        reconciled.push({
          assignmentId: match.assignmentId,
          userId: inc.userId,
          instrumentId: inc.instrumentId,
        });
        matchedExistingIds.add(match.assignmentId);
        incomingWithoutId.splice(i, 1);
      } else if (candidateMatches.length > 1) {
        // Ambiguity: Multiple assignments for the same user exist, and we cannot resolve which one to update.
        // As per MVP requirement: Reject if it makes reconciliation ambiguous.
        throw new Error(
          `Reconciliação ambígua para o usuário '${inc.userId}'. Há múltiplas atribuições antigas para este usuário. Por favor, forneça o 'assignmentId' explícito.`
        );
      }
    }

    // Step C: For any remaining unmatched incoming assignments, generate a brand new stable ID
    for (let i = 0; i < incomingWithoutId.length; i++) {
      const inc = incomingWithoutId[i];
      const deterministicNewId = crypto
        .createHash("sha256")
        .update(`new:${scaleId}:${i}:${inc.userId}:${inc.instrumentId}`)
        .digest("hex")
        .substring(0, 20);

      reconciled.push({
        assignmentId: deterministicNewId,
        userId: inc.userId,
        instrumentId: inc.instrumentId,
      });
    }

    return reconciled;
  }
}
