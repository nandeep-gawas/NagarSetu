import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  const [deadlineRules, priorityRules, workflowTransitions] = await Promise.all(
    [
      prisma.deadlineRule.findMany({
        include: { category: true, subcategory: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.priorityRule.findMany({
        orderBy: { threshold: "asc" },
      }),
      prisma.workflowTransition.findMany({
        orderBy: { fromState: "asc" },
      }),
    ]
  );

  return NextResponse.json({
    deadlineRules,
    priorityRules,
    workflowTransitions,
  });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"], {
    action: "UPDATE_WORKFLOW_RULE",
    entityType: "Rule",
  });
  if (!guard.authorized) return guard.response;

  try {
    const body = await req.json();
    const { type, id, responseHours, resolutionHours, threshold } = body;

    if (type === "DEADLINE") {
      const existing = await prisma.deadlineRule.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json(
          { error: "DeadlineRule not found." },
          { status: 404 }
        );
      }

      const updated = await prisma.deadlineRule.update({
        where: { id },
        data: {
          responseHours:
            typeof responseHours === "number"
              ? responseHours
              : existing.responseHours,
          resolutionHours:
            typeof resolutionHours === "number"
              ? resolutionHours
              : existing.resolutionHours,
        },
        include: { category: true, subcategory: true },
      });

      await logAuditEvent({
        actorType: "USER",
        actorId: guard.user.id,
        actorLabel: `${guard.user.role.toLowerCase()}:${guard.user.email}`,
        action: "UPDATE_DEADLINE_RULE",
        entityType: "DeadlineRule",
        entityId: updated.id,
        oldValue: {
          responseHours: existing.responseHours,
          resolutionHours: existing.resolutionHours,
        },
        newValue: {
          responseHours: updated.responseHours,
          resolutionHours: updated.resolutionHours,
        },
        reason: "Configurable SLA rule updated via Rule Engine API",
        ruleApplied: updated.label,
        outcome: "ACCEPTED",
      });

      return NextResponse.json({ deadlineRule: updated });
    }

    if (type === "PRIORITY") {
      const existing = await prisma.priorityRule.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json(
          { error: "PriorityRule not found." },
          { status: 404 }
        );
      }

      const updated = await prisma.priorityRule.update({
        where: { id },
        data: {
          threshold:
            typeof threshold === "number" ? threshold : existing.threshold,
        },
      });

      await logAuditEvent({
        actorType: "USER",
        actorId: guard.user.id,
        actorLabel: `${guard.user.role.toLowerCase()}:${guard.user.email}`,
        action: "UPDATE_PRIORITY_RULE",
        entityType: "PriorityRule",
        entityId: updated.id,
        oldValue: { threshold: existing.threshold },
        newValue: { threshold: updated.threshold },
        reason: "Configurable priority threshold updated",
        ruleApplied: updated.label,
        outcome: "ACCEPTED",
      });

      return NextResponse.json({ priorityRule: updated });
    }

    return NextResponse.json(
      { error: "Invalid rule type. Expected DEADLINE or PRIORITY." },
      { status: 400 }
    );
  } catch (err) {
    console.error("Update rule error:", err);
    return NextResponse.json(
      { error: "Failed to update rule." },
      { status: 500 }
    );
  }
}
