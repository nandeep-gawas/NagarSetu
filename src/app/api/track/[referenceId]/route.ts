import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  context: { params: Promise<{ referenceId: string }> }
) {
  const { referenceId } = await context.params;
  const decodedRef = decodeURIComponent(referenceId).trim();

  const sessionUser = await getSessionUser();

  // Look up by Report.referenceId (e.g. NS-2026-001001) OR Issue.publicRef (e.g. PMC-2026-1001)
  let report = await prisma.report.findUnique({
    where: { referenceId: decodedRef },
    include: {
      citizen: { select: { id: true, name: true, email: true } },
      evidences: true,
      issue: {
        include: {
          category: { include: { department: true } },
          subcategory: true,
          assignedOfficer: { select: { id: true, name: true } },
          escalationEvents: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!report) {
    const issueByPublicRef = await prisma.issue.findUnique({
      where: { publicRef: decodedRef },
      include: {
        reports: {
          orderBy: { submittedAt: "asc" },
          take: 1,
        },
      },
    });
    if (issueByPublicRef && issueByPublicRef.reports[0]) {
      report = await prisma.report.findUnique({
        where: { id: issueByPublicRef.reports[0].id },
        include: {
          citizen: { select: { id: true, name: true, email: true } },
          evidences: true,
          issue: {
            include: {
              category: { include: { department: true } },
              subcategory: true,
              assignedOfficer: { select: { id: true, name: true } },
              escalationEvents: {
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      });
    }
  }

  if (!report) {
    return NextResponse.json(
      { ok: false, error: "No complaint found with that Reference ID." },
      { status: 404 }
    );
  }

  const issue = report.issue;
  const isStaff = Boolean(
    sessionUser &&
      ["OFFICER", "SUPERVISOR", "ADMIN"].includes(sessionUser.role)
  );
  const isOwner = Boolean(sessionUser && sessionUser.id === report.citizenId);
  const canViewFullDetails = isOwner || isStaff;
  const accessLevel: "OWNER" | "STAFF" | "PUBLIC" = isOwner
    ? "OWNER"
    : isStaff
    ? "STAFF"
    : "PUBLIC";

  // Build public timeline strictly from ACCEPTED status/lifecycle AuditEvent rows & EscalationEvents
  // (Never expose internal REFUSED attempts or staff-only data)
  const acceptedAudits = await prisma.auditEvent.findMany({
    where: {
      entityType: "Issue",
      entityId: issue.id,
      outcome: "ACCEPTED",
      action: {
        notIn: ["DEV_TIME_TRAVEL_DEADLINE"],
      },
    },
    orderBy: { timestamp: "asc" },
  });

  const timeline = acceptedAudits.map((a) => {
    const oldStatus =
      a.oldValue && typeof a.oldValue === "object" && "status" in a.oldValue
        ? String((a.oldValue as { status?: string }).status || "")
        : null;
    const newStatus =
      a.newValue && typeof a.newValue === "object" && "status" in a.newValue
        ? String((a.newValue as { status?: string }).status || "")
        : null;
    return {
      id: a.id,
      timestamp: a.timestamp.toISOString(),
      createdAt: a.timestamp.toISOString(),
      action: a.action,
      fromState: oldStatus || null,
      toState: newStatus || null,
      oldStatus: oldStatus || null,
      newStatus: newStatus || null,
      oldValue: oldStatus || null,
      newValue: newStatus || null,
      reason: a.reason,
      ruleApplied: a.ruleApplied,
      actorType: a.actorType,
      actorRole: a.actorLabel.split(":")[0]?.toUpperCase() || a.actorType,
      outcome: a.outcome,
    };
  });

  // Compute reopen window remaining (default 7 days = 168 hours after resolvedAt)
  const reopenWindowDays = 7;
  const reopenWindowHours = reopenWindowDays * 24;
  let canReopen = false;
  let reopenWindowEndsAt: string | null = null;
  if (
    issue.status === "RESOLVED_AWAITING_VERIFICATION" ||
    issue.status === "CLOSED"
  ) {
    const resolvedTime =
      issue.resolvedAt ?? issue.closedAt ?? issue.createdAt;
    const endMs =
      resolvedTime.getTime() + reopenWindowDays * 24 * 3600 * 1000;
    reopenWindowEndsAt = new Date(endMs).toISOString();
    if (Date.now() <= endMs && isOwner) {
      canReopen = true;
    }
  }

  const canConfirmClosure =
    isOwner && issue.status === "RESOLVED_AWAITING_VERIFICATION";

  const firstEvidence = report.evidences[0] ?? null;

  return NextResponse.json({
    ok: true,
    accessLevel,
    isOwner,
    isStaff,
    canViewFullDetails,
    canConfirmClosure,
    canReopen,
    reopenWindowDays,
    reopenWindowEndsAt,
    issue: {
      id: issue.id,
      referenceId: report.referenceId,
      publicRef: issue.publicRef,
      searchedReferenceId: decodedRef,
      category: {
        id: issue.category.id,
        name: issue.category.name,
        emoji: issue.category.emoji,
      },
      subcategory: issue.subcategory
        ? { id: issue.subcategory.id, name: issue.subcategory.name }
        : { id: "general", name: "General Municipal Issue" },
      department:
        issue.category.department?.name || "Pune Municipal Department",
      status: issue.status,
      priority: issue.priority,
      publicLocationLabel: issue.publicLocationLabel,
      reportCount: issue.reportCount,
      submittedAt: report.submittedAt.toISOString(),
      responseDeadline: issue.responseDeadline.toISOString(),
      resolutionDeadline: issue.resolutionDeadline.toISOString(),
      resolvedAt: issue.resolvedAt ? issue.resolvedAt.toISOString() : null,
      closedAt: issue.closedAt ? issue.closedAt.toISOString() : null,
      isOverdue: issue.isOverdue,
      approachingDeadline: issue.isApproachingDeadline,
      escalationLevel:
        issue.escalationEvents.length > 0
          ? Math.max(...issue.escalationEvents.map((e) => e.level))
          : 0,
      escalationEvents: issue.escalationEvents.map((e) => ({
        id: e.id,
        level: e.level,
        reason: e.reason,
        ruleFired: `SLA_ESCALATION_LEVEL_${e.level}`,
        triggeredAt: e.createdAt.toISOString(),
      })),
    },
    privateDetails: canViewFullDetails
      ? {
          reportId: report.id,
          reportReferenceId: report.referenceId,
          description: report.description,
          photoUrl: firstEvidence ? firstEvidence.filePath : null,
          photoTimestamp: firstEvidence?.exifCapturedAt
            ? firstEvidence.exifCapturedAt.toISOString()
            : null,
          latitude: report.latitude,
          longitude: report.longitude,
          canConfirmClosure,
          canReopen,
          reopenWindowHours,
          reopenDeadline: reopenWindowEndsAt,
        }
      : null,
    timeline,
  });
}
