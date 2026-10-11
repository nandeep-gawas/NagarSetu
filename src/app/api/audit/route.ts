import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

/**
 * GET /api/audit (staff only: OFFICER, SUPERVISOR, ADMIN)
 * Supports filters: issueId, actor, action, outcome, date range (from/to or startDate/endDate), pagination (page, pageSize / limit, offset).
 */
export async function GET(req: NextRequest) {
  const guard = await requireRole(["OFFICER", "SUPERVISOR", "ADMIN"], {
    action: "VIEW_AUDIT_TRAIL",
    entityType: "AuditEvent",
  });
  if (!guard.authorized) return guard.response;

  const { searchParams } = new URL(req.url);
  const issueId = searchParams.get("issueId");
  const actor = searchParams.get("actor");
  const action = searchParams.get("action");
  const outcome = searchParams.get("outcome");
  const fromDate = searchParams.get("from") || searchParams.get("startDate");
  const toDate = searchParams.get("to") || searchParams.get("endDate");

  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(
    200,
    Math.max(1, Number(searchParams.get("pageSize") || searchParams.get("limit") || 60))
  );
  const skip = searchParams.get("offset")
    ? Math.max(0, Number(searchParams.get("offset")))
    : (page - 1) * pageSize;

  const where: Prisma.AuditEventWhereInput = {};

  if (issueId) {
    where.entityId = issueId;
  }
  if (actor) {
    where.OR = [
      { actorId: actor },
      { actorLabel: { contains: actor } },
    ];
  }
  if (action) {
    where.action = { contains: action };
  }
  if (outcome === "ACCEPTED" || outcome === "REFUSED") {
    where.outcome = outcome;
  }
  if (fromDate || toDate) {
    where.timestamp = {
      ...(fromDate ? { gte: new Date(fromDate) } : {}),
      ...(toDate ? { lte: new Date(toDate) } : {}),
    };
  }

  const [totalCount, auditEvents, escalationEvents] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.escalationEvent.findMany({
      where: issueId ? { issueId } : undefined,
      include: {
        issue: {
          select: {
            id: true,
            publicRef: true,
            publicLocationLabel: true,
            status: true,
            priority: true,
          },
        },
        notifiedUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  return NextResponse.json({
    ok: true,
    auditEvents,
    escalationEvents,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  });
}

async function refuseAuditMutation(method: string) {
  await logAuditEvent({
    actorType: "USER",
    actorId: null,
    actorLabel: "api:tamper-attempt",
    action: `AUDIT_LOG_${method}_ATTEMPT`,
    entityType: "AuditEvent",
    entityId: null,
    oldValue: null,
    newValue: null,
    reason: `Attempted to ${method} immutable AuditEvent records via /api/audit.`,
    ruleApplied: "AuditImmutabilityPolicy:AppendOnly",
    outcome: "REFUSED",
  });

  return NextResponse.json(
    {
      ok: false,
      error:
        "Forbidden: AuditEvent rows are strictly immutable and cannot be created, updated, or deleted through any API.",
      code: "AUDIT_IMMUTABLE",
    },
    { status: 403 }
  );
}

export async function POST() {
  return refuseAuditMutation("POST");
}

export async function PUT() {
  return refuseAuditMutation("PUT");
}

export async function PATCH() {
  return refuseAuditMutation("PATCH");
}

export async function DELETE() {
  return refuseAuditMutation("DELETE");
}
