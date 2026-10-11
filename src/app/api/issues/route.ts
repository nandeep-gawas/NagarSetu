import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { submitReport } from "@/lib/rules";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const categoryId = searchParams.get("categoryId");
  const overdueOnly = searchParams.get("overdue") === "true";

  const [issues, categories, departments, transitions, demoUsers] =
    await Promise.all([
      prisma.issue.findMany({
        where: {
          ...(status ? { status: status as never } : {}),
          ...(priority ? { priority: priority as never } : {}),
          ...(categoryId ? { categoryId } : {}),
          ...(overdueOnly ? { isOverdue: true } : {}),
        },
        include: {
          category: true,
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
              citizen: { select: { id: true, name: true, email: true } },
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
        orderBy: [{ isOverdue: "desc" }, { createdAt: "desc" }],
      }),
      prisma.category.findMany({
        include: { subcategories: true, department: true },
        orderBy: { name: "asc" },
      }),
      prisma.department.findMany({
        include: {
          category: true,
          users: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
      prisma.workflowTransition.findMany(),
      prisma.user.findMany({
        where: { isDemo: true },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: { select: { id: true, name: true } },
        },
        orderBy: [{ role: "asc" }, { email: "asc" }],
      }),
    ]);

  return NextResponse.json({
    issues,
    categories,
    departments,
    transitions,
    demoUsers,
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireRole(
    ["CITIZEN", "OFFICER", "SUPERVISOR", "ADMIN"],
    {
      action: "SUBMIT_GRIEVANCE_REPORT",
      entityType: "Report",
    }
  );
  if (!guard.authorized) return guard.response;

  try {
    const body = await req.json();
    const result = await submitReport(body, guard.user.id);
    return NextResponse.json(result, { status: result.httpStatus });
  } catch (err) {
    console.error("Create issue/report error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to submit grievance report." },
      { status: 500 }
    );
  }
}
