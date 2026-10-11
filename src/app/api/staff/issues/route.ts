import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { IssuePriority, IssueStatus } from "@prisma/client";

/**
 * Staff Issues API: GET /api/staff/issues
 *
 * STRICT DEPARTMENT-BASED ACCESS CONTROL:
 * - OFFICER: restricted strictly to issues within their assigned department's categoryId.
 * - SUPERVISOR: restricted to issues within their department's categoryId (or all if unassigned).
 * - ADMIN: unrestricted cross-department view.
 * - CITIZEN: strictly prohibited (returns 403 Forbidden).
 */
export async function GET(req: NextRequest) {
  const guard = await requireRole(["OFFICER", "SUPERVISOR", "ADMIN"], {
    action: "STAFF_VIEW_ISSUES",
    entityType: "Issue",
  });
  if (!guard.authorized) return guard.response;

  const user = guard.user;
  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const priorityParam = searchParams.get("priority");
  const categoryIdParam = searchParams.get("categoryId");
  const assignedToMe = searchParams.get("assignedToMe") === "true";
  const overdueOnly = searchParams.get("overdue") === "true";
  const escalatedOnly = searchParams.get("escalated") === "true";

  // Determine department constraint based on role
  let allowedCategoryId: string | undefined = undefined;

  if (user.role === "OFFICER") {
    if (!user.departmentId) {
      return NextResponse.json({
        ok: true,
        issues: [],
        officerDepartment: null,
        message: "Officer is not currently assigned to a municipal department.",
      });
    }
    const dept = await prisma.department.findUnique({
      where: { id: user.departmentId },
    });
    if (!dept) {
      return NextResponse.json({
        ok: true,
        issues: [],
        officerDepartment: null,
        message: "Officer's department was not found in the database.",
      });
    }
    allowedCategoryId = dept.categoryId;
  } else if (user.role === "SUPERVISOR" && user.departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: user.departmentId },
    });
    if (dept) {
      allowedCategoryId = dept.categoryId;
    }
  }

  // If user explicitly passed a categoryIdParam, only allow it if it doesn't violate allowedCategoryId
  let effectiveCategoryId = allowedCategoryId;
  if (user.role === "ADMIN" && categoryIdParam) {
    effectiveCategoryId = categoryIdParam;
  } else if (categoryIdParam && allowedCategoryId && categoryIdParam !== allowedCategoryId) {
    // Attempting to query another department's category
    return NextResponse.json(
      {
        ok: false,
        error: "Access Refused: Officers and department supervisors cannot view or act on another department's complaints.",
      },
      { status: 403 }
    );
  }

  const whereClause: Record<string, unknown> = {
    ...(effectiveCategoryId ? { categoryId: effectiveCategoryId } : {}),
    ...(statusParam && statusParam !== "ALL" ? { status: statusParam as IssueStatus } : {}),
    ...(priorityParam && priorityParam !== "ALL" ? { priority: priorityParam as IssuePriority } : {}),
    ...(overdueOnly ? { isOverdue: true } : {}),
    ...(assignedToMe ? { assignedOfficerId: user.id } : {}),
  };

  const issues = await prisma.issue.findMany({
    where: whereClause,
    include: {
      category: {
        include: { department: true },
      },
      subcategory: true,
      assignedOfficer: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
        },
      },
      reports: {
        include: {
          citizen: { select: { id: true, name: true, email: true, phone: true } },
          evidences: true,
        },
        orderBy: { submittedAt: "desc" },
      },
      escalationEvents: {
        include: {
          notifiedUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      deadlineChanges: {
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: [
      { isOverdue: "desc" },
      { priority: "desc" },
      { resolutionDeadline: "asc" },
    ],
  });

  // Filter escalated in memory if requested
  const filteredIssues = escalatedOnly
    ? issues.filter((i) => i.escalationEvents.length > 0)
    : issues;

  // Officers in this department (for supervisor reassignment dropdown)
  let departmentOfficers: { id: string; name: string; email: string }[] = [];
  if (user.role === "SUPERVISOR" || user.role === "ADMIN") {
    departmentOfficers = await prisma.user.findMany({
      where: {
        role: "OFFICER",
        ...(effectiveCategoryId
          ? { department: { categoryId: effectiveCategoryId } }
          : {}),
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });
  }

  return NextResponse.json({
    ok: true,
    userRole: user.role,
    userDepartmentId: user.departmentId,
    issues: filteredIssues,
    departmentOfficers,
  });
}
