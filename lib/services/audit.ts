// lib/services/audit.ts
// Centralized audit logging — call from every sensitive API route
// Never throws — audit failures must not break user flows

import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { NextRequest } from "next/server";

export type AuditAction =
  // Training
  | "train.create"
  | "train.cancel"
  // Models
  | "model.edit"
  | "model.delete"
  | "model.deploy"
  // Billing
  | "billing.order_created"
  | "billing.payment_verified"
  | "billing.webhook_received"
  // Auth
  | "auth.user_created"
  | "auth.user_updated"
  // Admin
  | "admin.config_read"
  | "admin.config_update"
  | "admin.user_role_change"
  | "admin.ai_action_executed"
  // Inference
  | "inference.chat"
  // Integration
  | "integrate.neurofast_pull"
  // Demo
  | "demo.chat_message"
  | "demo.conversion"
  // Rollback
  | "admin.rollback_executed"
  | "admin.bulk_config_update";

export type AuditSeverity = "info" | "warn" | "error" | "critical";

export interface AuditEntry {
  userId?: string;
  actorEmail?: string;
  action: AuditAction;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  severity?: AuditSeverity;
  req?: NextRequest;
}

export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const rawIp = entry.req
      ? (entry.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
         ?? entry.req.headers.get("x-real-ip")
         ?? "unknown")
      : undefined;
    const ipAddress = rawIp;

    const userAgent = entry.req
      ? (entry.req.headers.get("user-agent") ?? undefined)
      : undefined;
    
    // v6: enrich metadata with device fingerprint for audit trail
    const enrichedMetadata = {
      ...(entry.metadata ?? {}),
      ...(entry.req ? {
        _ip: rawIp,
        _ua: userAgent?.slice(0, 120),
        _origin: entry.req.headers.get("origin") ?? undefined,
      } : {}),
    };

    await db.insert(auditLogs).values({
      userId: entry.userId ?? null,
      actorEmail: entry.actorEmail ?? null,
      action: entry.action,
      resource: entry.resource ?? null,
      resourceId: entry.resourceId ?? null,
      metadata: JSON.stringify(enrichedMetadata),
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      severity: entry.severity ?? "info",
    });
  } catch (err) {
    // Audit failures are non-fatal — log to console only
    console.error("[AuditService] Failed to write audit log:", err);
  }
}

// Shorthand helpers
export const auditInfo = (entry: Omit<AuditEntry, "severity">) =>
  audit({ ...entry, severity: "info" });

export const auditWarn = (entry: Omit<AuditEntry, "severity">) =>
  audit({ ...entry, severity: "warn" });

export const auditCritical = (entry: Omit<AuditEntry, "severity">) =>
  audit({ ...entry, severity: "critical" });
