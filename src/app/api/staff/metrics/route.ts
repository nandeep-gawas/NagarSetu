import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const guard = await requireRole(["OFFICER", "SUPERVISOR", "ADMIN"], {
    action: "VIEW_STAFF_METRICS",
    entityType: "Issue",
  });
  if (!guard.authorized) return guard.response;

  // If officer, optionally scope or provide overall department vs city metrics
  const isOfficer = guard.user.role === "OFFICER";
  const departmentId = guard.user.departmentId;

  const department = departmentId
    ? await prisma.department.findUnique({
        where: { id: departmentId },
        include: { category: true },
      })
    : null;

  const whereClause: any = {};
  if (isOfficer && department?.category?.id) {
    whereClause.categoryId = department.category.id;
  }

  const [allIssues, categories, officers, ratings] = await Promise.all([
    prisma.issue.findMany({
      where: whereClause,
      include: {
        category: true,
        assignedOfficer: { select: { id: true, name: true, email: true } },
        escalationEvents: true,
      },
    }),
    prisma.category.findMany(),
    prisma.user.findMany({
      where: { role: "OFFICER" },
      select: { id: true, name: true, departmentId: true },
    }),
    prisma.issue.findMany({
      where: {
        satisfactionRating: { not: null },
        ...(isOfficer && department?.category?.id ? { categoryId: department.category.id } : {}),
      },
      select: {
        id: true,
        publicRef: true,
        satisfactionRating: true,
        satisfactionComment: true,
        ratedAt: true,
        category: { select: { name: true } },
      },
      orderBy: { ratedAt: "desc" },
      take: 20,
    }),
  ]);

  // Resolution metrics
  // Eligible complaints exclude REJECTED
  const eligibleIssues = allIssues.filter((i) => i.status !== "REJECTED");
  const resolvedIssues = eligibleIssues.filter(
    (i) => i.status === "RESOLVED_AWAITING_VERIFICATION" || i.status === "CLOSED"
  );
  const overdueIssues = eligibleIssues.filter((i) => i.isOverdue);

  // On-time rate
  // An issue is on-time if it was resolved before resolutionDeadline (or if resolvedAt <= resolutionDeadline)
  const resolvedOnTime = resolvedIssues.filter((i) => {
    if (!i.resolvedAt || !i.resolutionDeadline) return true;
    return i.resolvedAt <= i.resolutionDeadline;
  });

  const onTimeRate =
    resolvedIssues.length > 0
      ? Math.round((resolvedOnTime.length / resolvedIssues.length) * 100)
      : 100;

  const overallResolutionRate =
    eligibleIssues.length > 0
      ? Math.round((resolvedIssues.length / eligibleIssues.length) * 100)
      : 0;

  // Average resolution time in hours
  let totalResolutionHours = 0;
  let resolvedCountWithTimestamps = 0;
  for (const i of resolvedIssues) {
    if (i.resolvedAt && i.createdAt) {
      const diffMs = i.resolvedAt.getTime() - i.createdAt.getTime();
      const diffHrs = Math.max(0, diffMs / (1000 * 60 * 60));
      totalResolutionHours += diffHrs;
      resolvedCountWithTimestamps++;
    }
  }
  const avgResolutionHours =
    resolvedCountWithTimestamps > 0
      ? Math.round((totalResolutionHours / resolvedCountWithTimestamps) * 10) / 10
      : 0;

  // Overdue count & total by category
  const categoryStats = categories.map((cat) => {
    const catIssues = allIssues.filter((i) => i.categoryId === cat.id);
    const catOverdue = catIssues.filter((i) => i.isOverdue);
    const catResolved = catIssues.filter(
      (i) => i.status === "RESOLVED_AWAITING_VERIFICATION" || i.status === "CLOSED"
    );
    const catEscalated = catIssues.filter((i) => i.escalationEvents.length > 0);
    return {
      categoryId: cat.id,
      categoryName: cat.name,
      total: catIssues.length,
      overdue: catOverdue.length,
      resolved: catResolved.length,
      escalated: catEscalated.length,
    };
  });

  // Escalations by officer
  const officerStats = officers.map((off) => {
    const offIssues = allIssues.filter((i) => i.assignedOfficerId === off.id);
    const offOverdue = offIssues.filter((i) => i.isOverdue);
    const offResolved = offIssues.filter(
      (i) => i.status === "RESOLVED_AWAITING_VERIFICATION" || i.status === "CLOSED"
    );
    const offEscalated = offIssues.filter((i) => i.escalationEvents.length > 0);
    return {
      officerId: off.id,
      officerName: off.name,
      totalAssigned: offIssues.length,
      overdue: offOverdue.length,
      resolved: offResolved.length,
      escalated: offEscalated.length,
    };
  });

  // Satisfaction ratings breakdown
  const ratingDistribution = [1, 2, 3, 4, 5].map((star) => ({
    stars: star,
    count: ratings.filter((r) => r.satisfactionRating === star).length,
  }));

  const avgSatisfaction =
    ratings.length > 0
      ? Math.round(
          (ratings.reduce((acc, r) => acc + (r.satisfactionRating || 0), 0) /
            ratings.length) *
            10
        ) / 10
      : 0;

  return NextResponse.json({
    ok: true,
    metrics: {
      totalEligible: eligibleIssues.length,
      totalResolved: resolvedIssues.length,
      totalOverdue: overdueIssues.length,
      onTimeRate,
      overallResolutionRate,
      avgResolutionHours,
      categoryStats,
      officerStats,
      avgSatisfaction,
      totalRatingsCount: ratings.length,
      ratingDistribution,
      recentRatings: ratings,
    },
  });
}
