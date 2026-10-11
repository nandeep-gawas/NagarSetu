import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * ============================================================================
 * NAGARSETU STATISTICAL RULES SPECIFICATION (G-02 GovFix):
 * ============================================================================
 * 1. Unit of Measurement:
 *    Count Issues (not duplicate Reports), so multiple citizen reports merged
 *    into the same physical issue do not inflate complaint counts.
 *
 * 2. Eligibility:
 *    Eligible complaints EXCLUDE REJECTED / invalid records.
 *    eligibleIssues = totalIssues where status != "REJECTED".
 *
 * 3. Resolution Rate (%):
 *    resolved = count of eligible issues in "RESOLVED_AWAITING_VERIFICATION" or "CLOSED"
 *    resolutionRate = (resolved / eligibleIssues) * 100
 *
 * 4. On-Time Resolution Rate (%):
 *    resolvedOnTime = resolved issues where resolvedAt <= resolutionDeadline
 *    onTimeRate = (resolvedOnTime / resolved) * 100
 *
 * 5. Data Notice:
 *    Marked as demonstration data (isDemoData: true) — never claimed as official
 *    Pune Municipal Corporation performance statistics.
 * ============================================================================
 */

export async function GET() {
  const [
    allIssues,
    categories,
    departments,
  ] = await Promise.all([
    prisma.issue.findMany({
      include: {
        category: true,
      },
    }),
    prisma.category.findMany({
      include: {
        department: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.department.findMany({
      include: {
        category: true,
      },
    }),
  ]);

  const now = new Date();

  // Filter eligible complaints (EXCLUDES REJECTED)
  const eligibleIssues = allIssues.filter((i) => i.status !== "REJECTED");
  const totalEligible = eligibleIssues.length;

  const resolvedIssues = eligibleIssues.filter(
    (i) =>
      i.status === "RESOLVED_AWAITING_VERIFICATION" || i.status === "CLOSED"
  );
  const resolvedCount = resolvedIssues.length;

  const inProgressCount = eligibleIssues.filter(
    (i) => i.status === "IN_PROGRESS" || i.status === "ASSIGNED"
  ).length;

  const overdueIssues = eligibleIssues.filter(
    (i) =>
      i.isOverdue ||
      (i.status !== "RESOLVED_AWAITING_VERIFICATION" &&
        i.status !== "CLOSED" &&
        new Date(i.resolutionDeadline) < now)
  );
  const overdueCount = overdueIssues.length;

  // Resolution Rate = resolved / eligible * 100
  const resolutionRate =
    totalEligible > 0
      ? Number(((resolvedCount / totalEligible) * 100).toFixed(1))
      : 0;

  // On-time Resolution Rate = resolved on or before deadline / resolved * 100
  const resolvedOnTime = resolvedIssues.filter((i) => {
    if (!i.resolvedAt) return true; // resolved awaiting verification without explicit stamp counts as within window
    return new Date(i.resolvedAt) <= new Date(i.resolutionDeadline);
  });
  const onTimeResolutionRate =
    resolvedCount > 0
      ? Number(((resolvedOnTime.length / resolvedCount) * 100).toFixed(1))
      : 0;

  // Department-level metrics for the Accountability Scorecard
  const departmentScorecard = categories.map((cat) => {
    const deptIssues = eligibleIssues.filter((i) => i.categoryId === cat.id);
    const deptEligible = deptIssues.length;
    const deptResolved = deptIssues.filter(
      (i) =>
        i.status === "RESOLVED_AWAITING_VERIFICATION" || i.status === "CLOSED"
    );
    const deptOverdue = deptIssues.filter(
      (i) =>
        i.isOverdue ||
        (i.status !== "RESOLVED_AWAITING_VERIFICATION" &&
          i.status !== "CLOSED" &&
          new Date(i.resolutionDeadline) < now)
    );

    const deptOnTime = deptResolved.filter((i) => {
      if (!i.resolvedAt) return true;
      return new Date(i.resolvedAt) <= new Date(i.resolutionDeadline);
    });

    const deptOnTimeRate =
      deptResolved.length > 0
        ? Number(((deptOnTime.length / deptResolved.length) * 100).toFixed(1))
        : 0;

    // Average resolution time in hours for resolved issues
    let totalResolutionHours = 0;
    let resolvedWithTimes = 0;
    for (const item of deptResolved) {
      const finishTime = item.resolvedAt ?? item.closedAt ?? item.updatedAt;
      const hours =
        (finishTime.getTime() - new Date(item.createdAt).getTime()) / (1000 * 3600);
      if (hours >= 0) {
        totalResolutionHours += hours;
        resolvedWithTimes++;
      }
    }
    const avgResolutionHours =
      resolvedWithTimes > 0
        ? Number((totalResolutionHours / resolvedWithTimes).toFixed(1))
        : 0;

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      emoji: cat.emoji,
      departmentName:
        cat.department?.name || `${cat.name} Municipal Department`,
      totalComplaints: deptEligible,
      resolved: deptResolved.length,
      overdue: deptOverdue.length,
      onTimeResolutionRate: deptOnTimeRate,
      avgResolutionHours,
    };
  });

  return NextResponse.json({
    ok: true,
    totalComplaints: totalEligible,
    resolved: resolvedCount,
    inProgress: inProgressCount,
    overdue: overdueCount,
    resolutionRate,
    onTimeResolutionRate,
    isDemoData: true,
    demoDataNotice:
      "All metrics are calculated live from the demonstrative municipal database. These are prototype figures and do not represent official Pune Municipal Corporation data.",
    departmentScorecard,
  });
}
