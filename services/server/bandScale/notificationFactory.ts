import * as crypto from "crypto";
import { admin } from "../../firebaseAdmin.js";

export interface NotificationPayload {
  organizationId: string;
  recipientId: string;
  type: "band_scale";
  title: string;
  message: string;
  entityType: "bandScale";
  entityId: string;
  link: string;
  metadata: {
    action: "assigned" | "role_changed";
    bandScaleId: string;
    assignmentId: string;
    instrumentId: string;
    scaleVersion: number;
  };
  isRead: boolean;
  isArchived: boolean;
  createdAt: any; // serverTimestamp
  source: "band-scale-command-api";
  idempotencyKey: string;
  commandId: string;
}

export class NotificationFactory {
  /**
   * Helper to format a date string YYYY-MM-DD to DD/MM/YYYY
   */
  static formatDate(dateStr?: string): string {
    if (!dateStr) return "Data não definida";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }

  /**
   * Build a deterministic notification document ID.
   * organizationId + commandId + action + assignmentId
   */
  static getNotificationId(
    orgId: string,
    commandId: string,
    action: "assigned" | "role_changed",
    assignmentId: string
  ): string {
    return crypto
      .createHash("sha256")
      .update(`${orgId}:${commandId}:${action}:${assignmentId}`)
      .digest("hex");
  }

  /**
   * Constructs the notification payload for a newly assigned user.
   */
  static buildAssignedNotification(params: {
    orgId: string;
    recipientId: string;
    scaleId: string;
    assignmentId: string;
    instrumentId: string;
    instrumentName: string;
    scaleVersion: number;
    date?: string;
    time?: string;
    idempotencyKey: string;
    commandId: string;
  }): NotificationPayload {
    const formattedDate = this.formatDate(params.date);
    let eventDetails = formattedDate;
    if (params.time) {
      eventDetails += ` às ${params.time}`;
    }

    const title = "Você foi escalado!";
    const message = `Você foi escalado como ${params.instrumentName} para o evento de ${eventDetails}.`;

    return {
      organizationId: params.orgId,
      recipientId: params.recipientId,
      type: "band_scale",
      title,
      message,
      entityType: "bandScale",
      entityId: params.scaleId,
      link: `/band-scales/${params.scaleId}`,
      metadata: {
        action: "assigned",
        bandScaleId: params.scaleId,
        assignmentId: params.assignmentId,
        instrumentId: params.instrumentId,
        scaleVersion: params.scaleVersion,
      },
      isRead: false,
      isArchived: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      source: "band-scale-command-api",
      idempotencyKey: params.idempotencyKey,
      commandId: params.commandId,
    };
  }

  /**
   * Constructs the notification payload for an instrument change on the same assignment.
   */
  static buildRoleChangedNotification(params: {
    orgId: string;
    recipientId: string;
    scaleId: string;
    assignmentId: string;
    instrumentId: string;
    instrumentName: string;
    scaleVersion: number;
    idempotencyKey: string;
    commandId: string;
  }): NotificationPayload {
    const title = "Sua função na escala foi alterada";
    const message = `Agora você está escalado como ${params.instrumentName}.`;

    return {
      organizationId: params.orgId,
      recipientId: params.recipientId,
      type: "band_scale",
      title,
      message,
      entityType: "bandScale",
      entityId: params.scaleId,
      link: `/band-scales/${params.scaleId}`,
      metadata: {
        action: "role_changed",
        bandScaleId: params.scaleId,
        assignmentId: params.assignmentId,
        instrumentId: params.instrumentId,
        scaleVersion: params.scaleVersion,
      },
      isRead: false,
      isArchived: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      source: "band-scale-command-api",
      idempotencyKey: params.idempotencyKey,
      commandId: params.commandId,
    };
  }
}
