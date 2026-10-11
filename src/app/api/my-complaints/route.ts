import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const guard = await requireRole(
    ["CITIZEN", "OFFICER", "SUPERVISOR", "ADMIN"],
    {
      action: "VIEW_MY_COMPLAINTS",
      entityType: "Report",
    }
  );
  if (!guard.authorized) return guard.response;

  const reports = await prisma.report.findMany({
    where: { citizenId: guard.user.id },
    include: {
      evidences: true,
      issue: {
        include: {
          category: { include: { department: true } },
          subcategory: true,
          escalationEvents: true,
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  const complaints = reports.map((r) => {
    const firstEv = r.evidences[0] ?? null;
    return {
      reportId: r.id,
      reportReferenceId: r.referenceId,
      description: r.description,
      photoUrl: firstEv ? firstEv.filePath : null,
      photoTimestamp: firstEv?.exifCapturedAt
        ? firstEv.exifCapturedAt.toISOString()
        : null,
      createdAt: r.submittedAt.toISOString(),
      issue: {
        id: r.issue.id,
        referenceId: r.referenceId,
        publicRef: r.issue.publicRef,
        status: r.issue.status,
        priority: r.issue.priority,
        publicLocationLabel: r.issue.publicLocationLabel,
        reportCount: r.issue.reportCount,
        submittedAt: r.submittedAt.toISOString(),
        responseDeadline: r.issue.responseDeadline.toISOString(),
        resolutionDeadline: r.issue.resolutionDeadline.toISOString(),
        resolvedAt: r.issue.resolvedAt
          ? r.issue.resolvedAt.toISOString()
          : null,
        closedAt: r.issue.closedAt ? r.issue.closedAt.toISOString() : null,
        isOverdue: r.issue.isOverdue,
        approachingDeadline: r.issue.isApproachingDeadline,
        escalationLevel:
          r.issue.escalationEvents.length > 0
            ? Math.max(...r.issue.escalationEvents.map((e) => e.level))
            : 0,
        category: {
          id: r.issue.category.id,
          name: r.issue.category.name,
          emoji: r.issue.category.emoji,
        },
        subcategory: r.issue.subcategory
          ? { id: r.issue.subcategory.id, name: r.issue.subcategory.name }
          : { id: "general", name: "General Municipal Issue" },
        department: r.issue.category.department
          ? {
              id: r.issue.category.department.id,
              name: r.issue.category.department.name,
            }
          : { id: "pmc", name: "Pune Municipal Department" },
      },
    };
  });

  return NextResponse.json({
    ok: true,
    reports,
    complaints,
  });
}
