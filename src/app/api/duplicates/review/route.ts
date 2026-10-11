import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const guard = await requireRole(["SUPERVISOR", "ADMIN"], {
    action: "VIEW_DUPLICATE_REVIEW_QUEUE",
    entityType: "DuplicateCandidate",
  });
  if (!guard.authorized) return guard.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "PENDING";

  const candidates = await prisma.duplicateCandidate.findMany({
    where: status === "ALL" ? undefined : { status },
    include: {
      primaryIssue: {
        include: {
          category: true,
          subcategory: true,
          reports: {
            include: {
              citizen: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
      duplicateIssue: {
        include: {
          category: true,
          subcategory: true,
          reports: {
            include: {
              citizen: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  await logAuditEvent({
    actorType: "USER",
    actorId: guard.user.id,
    actorLabel: `${guard.user.role.toLowerCase()}:${guard.user.email}`,
    action: "VIEW_DUPLICATE_REVIEW_QUEUE",
    entityType: "DuplicateCandidate",
    entityId: null,
    oldValue: null,
    newValue: { statusFilter: status, count: candidates.length },
    reason: "Supervisor accessed possible duplicate review list",
    ruleApplied: "DuplicateGovernance:SupervisorReview",
    outcome: "ACCEPTED",
  });

  return NextResponse.json({
    ok: true,
    candidates,
  });
}
