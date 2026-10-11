import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const user = await getSessionUser();

  const issue = await prisma.issue.findUnique({
    where: { id },
    include: {
      category: { include: { department: true } },
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
  });

  if (!issue) {
    return NextResponse.json(
      { ok: false, error: "Issue not found." },
      { status: 404 }
    );
  }

  // RBAC and Department Isolation check
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Authentication required to view detailed staff records." },
      { status: 401 }
    );
  }

  if (user.role === "CITIZEN") {
    const isOwner = issue.reports.some((r) => r.citizenId === user.id);
    if (!isOwner) {
      return NextResponse.json(
        { ok: false, error: "Citizens can only view their own filed grievances." },
        { status: 403 }
      );
    }
  } else if (user.role === "OFFICER") {
    // Officer can only view if issue matches their department's category
    if (user.departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: user.departmentId },
      });
      if (dept && dept.categoryId !== issue.categoryId) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Access Refused: Field officers cannot access or inspect complaints assigned to another municipal department.",
          },
          { status: 403 }
        );
      }
    }
  } else if (user.role === "SUPERVISOR") {
    if (user.departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: user.departmentId },
      });
      if (dept && dept.categoryId !== issue.categoryId) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Access Refused: Department supervisors cannot inspect complaints belonging to another municipal department.",
          },
          { status: 403 }
        );
      }
    }
  }

  // Fetch issue audit history
  const auditEvents = await prisma.auditEvent.findMany({
    where: { entityId: id },
    orderBy: { timestamp: "desc" },
    take: 50,
  });

  return NextResponse.json({
    ok: true,
    issue,
    auditEvents,
  });
}
