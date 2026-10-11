import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ referenceId: string }> }
) {
  const { referenceId } = await context.params;
  const guard = await requireRole(["CITIZEN", "SUPERVISOR"], {
    action: "CITIZEN_CONFIRM_CLOSURE",
    entityType: "Report",
    entityId: referenceId,
  });
  if (!guard.authorized) return guard.response;

  const report = await prisma.report.findUnique({
    where: { referenceId: decodeURIComponent(referenceId).trim() },
    include: { issue: true },
  });

  if (!report) {
    return NextResponse.json(
      { ok: false, error: "Complaint reference not found." },
      { status: 404 }
    );
  }

  if (
    guard.user.role === "CITIZEN" &&
    report.citizenId !== guard.user.id
  ) {
    await logAuditEvent({
      actorType: "USER",
      actorId: guard.user.id,
      actorLabel: `citizen:${guard.user.email}`,
      action: "CITIZEN_CONFIRM_CLOSURE",
      entityType: "Issue",
      entityId: report.issueId,
      oldValue: { status: report.issue.status },
      newValue: { status: "CLOSED" },
      reason: "Refused: Only the reporting citizen can confirm closure.",
      ruleApplied: "CitizenClosurePolicy:OwnerOnly",
      outcome: "REFUSED",
    });

    return NextResponse.json(
      { ok: false, error: "Only the reporting citizen may confirm closure." },
      { status: 403 }
    );
  }

  if (report.issue.status !== "RESOLVED_AWAITING_VERIFICATION") {
    await logAuditEvent({
      actorType: "USER",
      actorId: guard.user.id,
      actorLabel: `citizen:${guard.user.email}`,
      action: "CITIZEN_CONFIRM_CLOSURE",
      entityType: "Issue",
      entityId: report.issueId,
      oldValue: { status: report.issue.status },
      newValue: { status: "CLOSED" },
      reason: `Refused: Cannot confirm closure when issue status is ${report.issue.status}.`,
      ruleApplied: "CitizenClosurePolicy:RequiresResolvedAwaitingVerification",
      outcome: "REFUSED",
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          "Closure can only be confirmed when the complaint is in Resolved — Awaiting Verification state.",
      },
      { status: 400 }
    );
  }

  const now = new Date();
  const updatedIssue = await prisma.$transaction(async (tx) => {
    const updated = await tx.issue.update({
      where: { id: report.issueId },
      data: {
        status: "CLOSED",
        closedAt: now,
        isOverdue: false,
      },
    });

    await tx.auditEvent.create({
      data: {
        timestamp: now,
        actorType: "USER",
        actorId: guard.user.id,
        actorLabel: `${guard.user.role.toLowerCase()}:${guard.user.email}`,
        action: "WORKFLOW_TRANSITION_RESOLVED_AWAITING_VERIFICATION_TO_CLOSED",
        entityType: "Issue",
        entityId: report.issueId,
        oldValue: { status: "RESOLVED_AWAITING_VERIFICATION" },
        newValue: { status: "CLOSED" },
        reason: `Citizen confirmed resolution satisfaction on report ${report.referenceId}.`,
        ruleApplied: "CitizenClosureConfirmation(RESOLVED_AWAITING_VERIFICATION->CLOSED)",
        outcome: "ACCEPTED",
      },
    });

    return updated;
  });

  return NextResponse.json({
    ok: true,
    issue: updatedIssue,
  });
}
