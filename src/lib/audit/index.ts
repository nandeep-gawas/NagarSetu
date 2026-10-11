import { AuditActorType, AuditOutcome, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface LogAuditEventParams {
  actorType: AuditActorType;
  actorId?: string | null;
  actorLabel: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
  reason?: string | null;
  ruleApplied?: string | null;
  outcome: AuditOutcome;
}

/**
 * Persists an immutable server-timestamped AuditEvent row.
 * Used for both ACCEPTED operational actions and REFUSED security/workflow violations.
 */
export async function logAuditEvent(params: LogAuditEventParams) {
  return prisma.auditEvent.create({
    data: {
      timestamp: new Date(),
      actorType: params.actorType,
      actorId: params.actorId ?? null,
      actorLabel: params.actorLabel,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      oldValue: params.oldValue ?? Prisma.DbNull,
      newValue: params.newValue ?? Prisma.DbNull,
      reason: params.reason ?? null,
      ruleApplied: params.ruleApplied ?? null,
      outcome: params.outcome,
    },
  });
}
