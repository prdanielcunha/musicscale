import crypto from "crypto";
import { adminDb as db, admin } from "../../firebaseAdmin.js";
import type { FirebaseFirestore } from "@firebase/firestore-types";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue | undefined };

export interface CommandReceipt<TResult = unknown> {
  commandType: "bandScale.create" | "bandScale.update" | "musicScale.publish" | "musicScale.respondOwn";
  organizationId: string;
  userId?: string;
  authenticatedUserId?: string;
  musicScaleId?: string;
  entityId?: string;
  requestFingerprint: string;
  correlationId?: string;
  result: TResult;
  completedAt: unknown; // firestore Timestamp
}

export class IdempotencyService {
  /**
   * Generates a stable and unique receipt ID based on the organization and the idempotency key.
   */
  static getReceiptId(orgId: string, idempotencyKey: string): string {
    return crypto
      .createHash("sha256")
      .update(`${orgId}:${idempotencyKey}`)
      .digest("hex");
  }

  /**
   * Generates a request fingerprint to ensure that if the same key is used with different payloads,
   * a conflict is returned.
   */
  static getDeterministicString(obj: unknown): string {
    if (obj === null) return "null";
    if (obj === undefined) return "undefined";
    if (Array.isArray(obj)) {
      return "[" + obj.map(item => IdempotencyService.getDeterministicString(item)).join(",") + "]";
    }
    if (typeof obj === "object") {
      const keys = Object.keys(obj as Record<string, unknown>).sort();
      const parts = keys.map(k => `"${k}":${IdempotencyService.getDeterministicString((obj as Record<string, unknown>)[k])}`);
      return "{" + parts.join(",") + "}";
    }
    return JSON.stringify(obj);
  }

  static getRequestFingerprint(payload: unknown): string {
    const serialized = IdempotencyService.getDeterministicString(payload);
    return crypto.createHash("sha256").update(serialized).digest("hex");
  }

  /**
   * Retrieves a command receipt from a Firestore transaction.
   */
  static async getReceiptInTransaction<TResult = unknown>(
    transaction: FirebaseFirestore.Transaction,
    orgId: string,
    receiptId: string
  ): Promise<CommandReceipt<TResult> | null> {
    if (!db) return null;
    const receiptRef = db
      .collection("organizations")
      .doc(orgId)
      .collection("_commandReceipts")
      .doc(receiptId);
    const docSnap = await transaction.get(receiptRef);
    if (docSnap.exists) {
      return docSnap.data() as CommandReceipt<TResult>;
    }
    return null;
  }

  /**
   * Writes the command receipt in a Firestore transaction.
   */
  static writeReceiptInTransaction<TResult = unknown>(
    transaction: FirebaseFirestore.Transaction,
    orgId: string,
    receiptId: string,
    receipt: Omit<CommandReceipt<TResult>, "completedAt">
  ): void {
    if (!db) return;
    const receiptRef = db
      .collection("organizations")
      .doc(orgId)
      .collection("_commandReceipts")
      .doc(receiptId);
    transaction.set(receiptRef, {
      ...receipt,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}
