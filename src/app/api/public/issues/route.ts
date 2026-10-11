import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { IssuePriority, IssueStatus } from "@prisma/client";

/**
 * Public Map & Issues API: GET /api/public/issues
 *
 * LOCATION PRIVACY SPECIFICATION:
 * - Coordinates are snapped to ~100m grid (rounded to 3 decimal places) to protect
 *   private residential locations. Precise coordinates are strictly reserved for
 *   authenticated municipal staff internal endpoints.
 * - ZERO personal fields are ever exposed: no citizen names, emails, phones, citizen IDs,
 *   private descriptions, or unverified raw EXIF metadata.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const categoryId = searchParams.get("categoryId") || undefined;
  const statusParam = searchParams.get("status") || undefined;
  const priorityParam = searchParams.get("priority") || undefined;
  const overdueOnly = searchParams.get("overdue") === "true";

  const now = new Date();

  const issues = await prisma.issue.findMany({
    where: {
      categoryId: categoryId || undefined,
      status: (statusParam as IssueStatus) || undefined,
      priority: (priorityParam as IssuePriority) || undefined,
      ...(overdueOnly ? { isOverdue: true } : {}),
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          emoji: true,
        },
      },
      subcategory: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const publicIssues = issues.map((issue) => {
    // Snap coordinates to ~100m grid (3 decimal places ~= 111m)
    const sanitizedLat = Number((Math.round(issue.latitude * 1000) / 1000).toFixed(3));
    const sanitizedLng = Number((Math.round(issue.longitude * 1000) / 1000).toFixed(3));

    const isActuallyOverdue =
      issue.isOverdue ||
      (issue.status !== "RESOLVED_AWAITING_VERIFICATION" &&
        issue.status !== "CLOSED" &&
        issue.status !== "REJECTED" &&
        new Date(issue.resolutionDeadline) < now);

    return {
      id: issue.id,
      publicRef: issue.publicRef,
      category: issue.category,
      subcategory: issue.subcategory,
      status: issue.status,
      priority: issue.priority,
      isOverdue: isActuallyOverdue,
      reportCount: issue.reportCount,
      publicLocationLabel: issue.publicLocationLabel,
      latitude: sanitizedLat,
      longitude: sanitizedLng,
      submittedAt: issue.createdAt.toISOString(),
      responseDeadline: issue.responseDeadline.toISOString(),
      resolutionDeadline: issue.resolutionDeadline.toISOString(),
      resolvedAt: issue.resolvedAt ? issue.resolvedAt.toISOString() : null,
      closedAt: issue.closedAt ? issue.closedAt.toISOString() : null,
      isDemo: issue.isDemo,
    };
  });

  return NextResponse.json({
    ok: true,
    count: publicIssues.length,
    issues: publicIssues,
    gridPrecisionMeters: "~100m",
    privacyNotice:
      "Coordinates are generalized to ~100m grid and personal identifiers are removed for public privacy.",
  });
}
