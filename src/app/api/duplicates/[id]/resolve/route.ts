import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { recalculatePriority } from "@/lib/rules";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requireRole(["SUPERVISOR", "ADMIN"], {
    action: "RESOLVE_DUPLICATE_CANDIDATE",
    entityType: "DuplicateCandidate",
    entityId: id,
  });
  if (!guard.authorized) return guard.response;

  try {
    const body = await req.json();
    const { action, reason } = body; // action: "MERGE" | "KEEP_SEPARATE"

    if (action !== "MERGE" && action !== "KEEP_SEPARATE") {
      return NextResponse.json(
        {
          ok: false,
          error: "action must be either 'MERGE' or 'KEEP_SEPARATE'.",
        },
        { status: 400 }
      );
    }

    const candidate = await prisma.duplicateCandidate.findUnique({
      where: { id },
      include: {
        primaryIssue: { include: { reports: true } },
        duplicateIssue: { include: { reports: true } },
      },
    });

    if (!candidate) {
      return NextResponse.json(
        { ok: false, error: "DuplicateCandidate not found." },
        { status: 404 }
      );
    }

    const now = new Date();
    const actorLabel = `${guard.user.role.toLowerCase()}:${guard.user.email}`;

    if (action === "MERGE") {
      const movedCount = candidate.duplicateIssue.reports.length;
      const newReportCount = candidate.primaryIssue.reportCount + movedCount;

      const updatedCandidate = await prisma.$transaction(async (tx) => {
        // Re-link all reports from duplicateIssue to primaryIssue
        await tx.report.updateMany({
          where: { issueId: candidate.duplicateIssueId },
          data: { issueId: candidate.primaryIssueId },
        });

        await tx.issue.update({
          where: { id: candidate.primaryIssueId },
          data: { reportCount: newReportCount },
        });

        // Mark duplicateIssue as REJECTED (merged into primaryIssue)
        await tx.issue.update({
          where: { id: candidate.duplicateIssueId },
          data: {
            status: "REJECTED",
            closedAt: now,
            isOverdue: false,
          },
        });

        const resolvedCand = await tx.duplicateCandidate.update({
          where: { id: candidate.id },
          data: {
            status: "MERGED",
            resolvedById: guard.user.id,
            resolvedAt: now,
            reason:
              reason ||
              `Supervisor merged ${candidate.duplicateIssue.publicRef} into ${candidate.primaryIssue.publicRef}`,
          },
        });

        await recalculatePriority(candidate.primaryIssueId, {
          now,
          actorType: "USER",
          actorId: guard.user.id,
          actorLabel,
          tx,
        });

        await tx.auditEvent.create({
          data: {
            timestamp: now,
            actorType: "USER",
            actorId: guard.user.id,
            actorLabel,
            action: "DUPLICATE_CANDIDATE_MERGED",
            entityType: "DuplicateCandidate",
            entityId: candidate.id,
            oldValue: {
              status: candidate.status,
              primaryIssueId: candidate.primaryIssueId,
              duplicateIssueId: candidate.duplicateIssueId,
            },
            newValue: {
              status: "MERGED",
              newReportCount,
            },
            reason:
              reason ||
              `Merged duplicate issue ${candidate.duplicateIssue.publicRef} into ${candidate.primaryIssue.publicRef}`,
            ruleApplied: "DuplicateGovernance:SupervisorMerge",
            outcome: "ACCEPTED",
          },
        });

        return resolvedCand;
      });

      return NextResponse.json({
        ok: true,
        action: "MERGED",
        candidate: updatedCandidate,
      });
    } else {
      const updatedCandidate = await prisma.$transaction(async (tx) => {
        const resolvedCand = await tx.duplicateCandidate.update({
          where: { id: candidate.id },
          data: {
            status: "KEPT_SEPARATE",
            resolvedById: guard.user.id,
            resolvedAt: now,
            reason:
              reason ||
              "Supervisor reviewed and kept both issues as separate incidents.",
          },
        });

        await tx.auditEvent.create({
          data: {
            timestamp: now,
            actorType: "USER",
            actorId: guard.user.id,
            actorLabel,
            action: "DUPLICATE_CANDIDATE_KEPT_SEPARATE",
            entityType: "DuplicateCandidate",
            entityId: candidate.id,
            oldValue: { status: candidate.status },
            newValue: { status: "KEPT_SEPARATE" },
            reason:
              reason ||
              "Supervisor kept possible duplicate issues separate.",
            ruleApplied: "DuplicateGovernance:SupervisorKeepSeparate",
            outcome: "ACCEPTED",
          },
        });

        return resolvedCand;
      });

      return NextResponse.json({
        ok: true,
        action: "KEPT_SEPARATE",
        candidate: updatedCandidate,
      });
    }
  } catch (err) {
    console.error("Resolve duplicate error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to resolve duplicate candidate." },
      { status: 500 }
    );
  }
}
