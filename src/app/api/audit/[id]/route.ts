import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit";

async function refuseAuditItemMutation(
  method: string,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  await logAuditEvent({
    actorType: "USER",
    actorId: null,
    actorLabel: "api:tamper-attempt",
    action: `AUDIT_LOG_${method}_ATTEMPT`,
    entityType: "AuditEvent",
    entityId: id,
    oldValue: null,
    newValue: null,
    reason: `Attempted to ${method} immutable AuditEvent record ${id}.`,
    ruleApplied: "AuditImmutabilityPolicy:AppendOnly",
    outcome: "REFUSED",
  });

  return NextResponse.json(
    {
      ok: false,
      error:
        "Forbidden: AuditEvent rows are strictly immutable and cannot be updated or deleted through any API.",
      code: "AUDIT_IMMUTABLE",
    },
    { status: 403 }
  );
}

export async function PUT(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return refuseAuditItemMutation("PUT", context);
}

export async function PATCH(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return refuseAuditItemMutation("PATCH", context);
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return refuseAuditItemMutation("DELETE", context);
}
