import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  const guard = await requireRole(["ADMIN"], {
    action: "ADMIN_VIEW_SYSTEM_RULES",
    entityType: "SystemRules",
  });
  if (!guard.authorized) return guard.response;

  const [deadlineRules, priorityRules, categories, departments] =
    await Promise.all([
      prisma.deadlineRule.findMany({
        include: {
          category: { select: { id: true, name: true } },
          subcategory: { select: { id: true, name: true } },
        },
        orderBy: [{ categoryId: "asc" }, { severity: "asc" }],
      }),
      prisma.priorityRule.findMany({
        orderBy: { threshold: "asc" },
      }),
      prisma.category.findMany({
        include: {
          subcategories: true,
          department: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.department.findMany({
        orderBy: { name: "asc" },
      }),
    ]);

  return NextResponse.json({
    ok: true,
    deadlineRules,
    priorityRules,
    categories,
    departments,
  });
}

export async function PUT(req: NextRequest) {
  const guard = await requireRole(["ADMIN"], {
    action: "ADMIN_UPDATE_SYSTEM_RULE",
    entityType: "SystemRules",
  });
  if (!guard.authorized) return guard.response;

  try {
    const body = await req.json();
    const { type, id, data } = body;

    if (!type || !id || !data) {
      return NextResponse.json(
        { ok: false, error: "type ('DEADLINE_RULE' | 'PRIORITY_RULE'), id, and data are required." },
        { status: 400 }
      );
    }

    if (type === "DEADLINE_RULE") {
      const existing = await prisma.deadlineRule.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json(
          { ok: false, error: "DeadlineRule not found." },
          { status: 404 }
        );
      }

      const responseHours = Number(data.responseHours);
      const resolutionHours = Number(data.resolutionHours);

      if (
        isNaN(responseHours) ||
        isNaN(resolutionHours) ||
        responseHours <= 0 ||
        resolutionHours <= 0 ||
        responseHours > resolutionHours
      ) {
        await logAuditEvent({
          actorType: "USER",
          actorId: guard.user.id,
          actorLabel: `admin:${guard.user.email}`,
          action: "ADMIN_UPDATE_DEADLINE_RULE",
          entityType: "DeadlineRule",
          entityId: id,
          oldValue: existing,
          newValue: data,
          reason: "Validation failed: responseHours must be positive and <= resolutionHours.",
          ruleApplied: "RuleConfigGovernance:DeadlineHoursValidation",
          outcome: "REFUSED",
        });

        return NextResponse.json(
          {
            ok: false,
            error:
              "Validation failed: Response time must be positive and cannot exceed resolution time.",
          },
          { status: 400 }
        );
      }

      const updated = await prisma.deadlineRule.update({
        where: { id },
        data: {
          responseHours,
          resolutionHours,
        },
      });

      await logAuditEvent({
        actorType: "USER",
        actorId: guard.user.id,
        actorLabel: `admin:${guard.user.email}`,
        action: "ADMIN_UPDATE_DEADLINE_RULE",
        entityType: "DeadlineRule",
        entityId: id,
        oldValue: {
          responseHours: existing.responseHours,
          resolutionHours: existing.resolutionHours,
        },
        newValue: {
          responseHours: updated.responseHours,
          resolutionHours: updated.resolutionHours,
        },
        reason: `Admin updated deadline threshold to ${responseHours}h resp / ${resolutionHours}h res`,
        ruleApplied: "RuleConfigGovernance:AdminEdit",
        outcome: "ACCEPTED",
      });

      return NextResponse.json({ ok: true, rule: updated });
    }

    if (type === "PRIORITY_RULE") {
      const existing = await prisma.priorityRule.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json(
          { ok: false, error: "PriorityRule not found." },
          { status: 404 }
        );
      }

      const updated = await prisma.priorityRule.update({
        where: { id },
        data: {
          ...(data.targetPriority ? { targetPriority: data.targetPriority } : {}),
          ...(typeof data.isActive === "boolean" ? { isActive: data.isActive } : {}),
          ...(data.description ? { description: data.description } : {}),
        },
      });

      await logAuditEvent({
        actorType: "USER",
        actorId: guard.user.id,
        actorLabel: `admin:${guard.user.email}`,
        action: "ADMIN_UPDATE_PRIORITY_RULE",
        entityType: "PriorityRule",
        entityId: id,
        oldValue: existing,
        newValue: updated,
        reason: `Admin modified priority rule ${updated.ruleType} (${updated.resultingPriority})`,
        ruleApplied: "RuleConfigGovernance:PriorityEdit",
        outcome: "ACCEPTED",
      });

      return NextResponse.json({ ok: true, rule: updated });
    }

    return NextResponse.json(
      { ok: false, error: `Unsupported rule type: ${type}` },
      { status: 400 }
    );
  } catch (err) {
    console.error("Admin rules update error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to update rule configuration." },
      { status: 500 }
    );
  }
}
