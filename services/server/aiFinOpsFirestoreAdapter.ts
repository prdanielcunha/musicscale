import {
  AiFinOpsStorageAdapter,
  AiFinOpsTransactionAdapter,
  AI_FINOPS_REPOSITORY_ERRORS,
} from "./aiFinOpsRepository.js";

export interface AiFinOpsFirestoreDocumentSnapshotLike {
  readonly exists: boolean;
  data(): any;
}

export interface AiFinOpsFirestoreDocumentReferenceLike {
  readonly id: string;
  readonly path: string;
}

export interface AiFinOpsFirestoreTransactionLike {
  get(documentRef: AiFinOpsFirestoreDocumentReferenceLike): Promise<AiFinOpsFirestoreDocumentSnapshotLike>;
  set(documentRef: AiFinOpsFirestoreDocumentReferenceLike, data: any, options?: { merge?: boolean }): AiFinOpsFirestoreTransactionLike;
  create(documentRef: AiFinOpsFirestoreDocumentReferenceLike, data: any): AiFinOpsFirestoreTransactionLike;
  update(documentRef: AiFinOpsFirestoreDocumentReferenceLike, data: any): AiFinOpsFirestoreTransactionLike;
}

export interface AiFinOpsFirestoreLike {
  doc(path: string): AiFinOpsFirestoreDocumentReferenceLike;
  runTransaction<T>(updateFunction: (transaction: AiFinOpsFirestoreTransactionLike) => Promise<T>): Promise<T>;
}

export function assertValidFirestorePath(path: string): string {
  if (typeof path !== "string" || path.trim() === "") {
    throw new Error(`${AI_FINOPS_REPOSITORY_ERRORS.INVALID_PATH}: Path cannot be empty.`);
  }
  const cleanPath = path.trim();
  if (cleanPath.startsWith("/")) {
    throw new Error(`${AI_FINOPS_REPOSITORY_ERRORS.INVALID_PATH}: Path cannot start with "/".`);
  }
  if (cleanPath.endsWith("/")) {
    throw new Error(`${AI_FINOPS_REPOSITORY_ERRORS.INVALID_PATH}: Path cannot end with "/".`);
  }
  if (cleanPath.includes("//")) {
    throw new Error(`${AI_FINOPS_REPOSITORY_ERRORS.INVALID_PATH}: Path cannot contain "//".`);
  }
  const segments = cleanPath.split("/");
  for (const segment of segments) {
    if (segment === "") {
      throw new Error(`${AI_FINOPS_REPOSITORY_ERRORS.INVALID_PATH}: Path cannot contain empty segments.`);
    }
  }
  return cleanPath;
}

export function assertPlainObjectData(data: Record<string, unknown>): Record<string, unknown> {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error(`INVALID_EVENT: Data must be a non-null plain object.`);
  }
  return data;
}

export function createAiFinOpsFirestoreAdapter(db: AiFinOpsFirestoreLike): AiFinOpsStorageAdapter {
  return {
    runTransaction: async <T>(fn: (tx: AiFinOpsTransactionAdapter) => Promise<T>): Promise<T> => {
      return await db.runTransaction(async (firestoreTx) => {
        const txAdapter: AiFinOpsTransactionAdapter = {
          get: async (path: string) => {
            const validPath = assertValidFirestorePath(path);
            const ref = db.doc(validPath);
            const snapshot = await firestoreTx.get(ref);
            if (!snapshot.exists) {
              return null;
            }
            return snapshot.data() || {};
          },
          set: async (path: string, data: Record<string, unknown>, options?: { merge?: boolean }) => {
            const validPath = assertValidFirestorePath(path);
            const validData = assertPlainObjectData(data);
            const ref = db.doc(validPath);
            firestoreTx.set(ref, validData, options);
          },
          create: async (path: string, data: Record<string, unknown>) => {
            const validPath = assertValidFirestorePath(path);
            const validData = assertPlainObjectData(data);
            const ref = db.doc(validPath);
            try {
              firestoreTx.create(ref, validData);
            } catch (err: any) {
              if (err.code === 6 || err.message?.includes("ALREADY_EXISTS")) {
                throw new Error(AI_FINOPS_REPOSITORY_ERRORS.IDEMPOTENCY_CONFLICT);
              }
              throw err;
            }
          },
          update: async (path: string, data: Record<string, unknown>) => {
            const validPath = assertValidFirestorePath(path);
            const validData = assertPlainObjectData(data);
            const ref = db.doc(validPath);
            firestoreTx.update(ref, validData);
          }
        };

        return await fn(txAdapter);
      });
    }
  };
}
