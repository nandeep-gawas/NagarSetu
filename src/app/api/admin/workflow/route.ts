import { NextRequest, NextResponse } from "next/server";
import { IssueStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

const VALID_STATES: IssueStatus[] = [
  "SUBMITTED",
  "VERIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED_AWAITING_VERIFICATION",
  "CLOSED",
  "REJECTED",
  "REOPENED",
];

const VALID_ROLES: Role[] = ["CITIZEN", "OFFICER", "SUPERVISOR", "ADMIN"];

export async function GET() {
  const guard = await requireRole(["ADMIN"], {
    action: "ADMIN_VIEW_WORKFLOW_CONFIG",
    entityType: "WorkflowTransition",
  });
  if (!guard.authorized) return guard.response;

  const transitions = await prisma.workflowTransition.findMany({
    orderBy: [{ fromState: "asc" }, { toState: "asc" }],
  });

  return NextResponse.json({
    ok: true,
    transitions,
  });
}

export async function PUT(req: NextRequest) {
  const guard = await requireRole(["ADMIN"], {
    action: "ADMIN_UPDATE_WORKFLOW_TRANSITION",
    entityType: "WorkflowTransition",
  });
  if (!guard.authorized) return guard.response;

  try {
    const body = await req.json();
    const {
      id,
      fromState,
      toState,
      allowedRoles,
      requiresReason,
      sameDepartmentOnly,
    } = body;

    if (
      !Array.isArray(allowedRoles) ||
      allowedRoles.length === 0 ||
      !allowedRoles.every((r: string) => VALID_ROLES.includes(r as Role))
    ) {
      await logAuditEvent({
        actorType: "USER",
        actorId: guard.user.id,
        actorLabel: `admin:${guard.user.email}`,
        action: "ADMIN_UPDATE_WORKFLOW_TRANSITION",
        entityType: "WorkflowTransition",
        entityId: id ?? null,
        oldValue: null,
        newValue: body,
        reason: "Invalid allowedRoles provided for WorkflowTransition update.",
        ruleApplied: "WorkflowConfigValidation:AllowedRoles",
        outcome: "REFUSED",
      });

      return NextResponse.json(
        {
          ok: false,
          error:
            "allowedRoles must be a non-empty array of valid roles (CITIZEN, OFFICER, SUPERVISOR, ADMIN).",
        },
        { status: 400 }
      );
    }

    const existing = id
      ? await prisma.workflowTransition.findUnique({ where: { id } })
      : fromState && toState
        ? await prisma.workflowTransition.findUnique({
            where: {
              fromState_toState: {
                fromState: fromState as IssueStatus,
                toState: toState as IssueStatus,
              },
            },
          })
        : null;

    if (!existing) {
      if (
        !fromState ||
        !toState ||
        !VALID_STATES.includes(fromState as IssueStatus) ||
        !VALID_STATES.includes(toState as IssueStatus)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Valid id or (fromState, toState) pair is required.",
          },
          { status: 404 }
        );
      }
    }

    const targetToState = (toState ?? existing?.toState) as IssueStatus;
    if (
      allowedRoles.includes("CITIZEN") &&
      targetToState !== "REOPENED"
    ) {
      await logAuditEvent({
        actorType: "USER",
        actorId: guard.user.id,
        actorLabel: `admin:${guard.user.email}`,
        action: "ADMIN_UPDATE_WORKFLOW_TRANSITION",
        entityType: "WorkflowTransition",
        entityId: existing?.id ?? null,
        oldValue: existing ?? null,
        newValue: body,
        reason: `Refused granting CITIZEN role permission for transition to ${targetToState}.`,
        ruleApplied: "WorkflowConfigValidation:CitizenRestriction",
        outcome: "REFUSED",
      });

      return NextResponse.json(
        {
          ok: false,
          error:
            "Citizens cannot be granted workflow transition permissions other than REOPENED.",
        },
        { status: 400 }
      );
    }

    // Invariant: Prevent removing every path to CLOSED
    if (targetToState === "CLOSED" && (!allowedRoles || allowedRoles.length === 0)) {
      await logAuditEvent({
        actorType: "USER",
        actorId: guard.user.id,
        actorLabel: `admin:${guard.user.email}`,
        action: "ADMIN_UPDATE_WORKFLOW_TRANSITION",
        entityType: "WorkflowTransition",
        entityId: existing?.id ?? null,
        oldValue: existing ?? null,
        newValue: body,
        reason: "Refused: Invariant prevents removing all permissions to reach the terminal CLOSED state.",
        ruleApplied: "WorkflowConfigValidation:TerminalStateReachable",
        outcome: "REFUSED",
      });

      return NextResponse.json(
        {
          ok: false,
          error: "Invalid Configuration: Workflow Engine invariant prohibits removing all permissions to reach the terminal CLOSED state.",
        },
        { status: 400 }
      );
    }

    const [updated, audit] = await prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.workflowTransition.update({
            where: { id: existing.id },
            data: {
              allowedRoles,
              requiresReason:
                typeof requiresReason === "boolean"
                  ? requiresReason
                  : existing.requiresReason,
              sameDepartmentOnly:
                typeof sameDepartmentOnly === "boolean"
                  ? sameDepartmentOnly
                  : existing.sameDepartmentOnly,
            },
          })
        : await tx.workflowTransition.create({
            data: {
              fromState: fromState as IssueStatus,
              toState: toState as IssueStatus,
              allowedRoles,
              requiresReason: Boolean(requiresReason),
              sameDepartmentOnly:
                typeof sameDepartmentOnly === "boolean"
                  ? sameDepartmentOnly
                  : true,
            },
          });

      const createdAudit = await tx.auditEvent.create({
        data: {
          timestamp: new Date(),
          actorType: "USER",
          actorId: guard.user.id,
          actorLabel: `admin:${guard.user.email}`,
          action: "ADMIN_UPDATE_WORKFLOW_TRANSITION",
          entityType: "WorkflowTransition",
          entityId: saved.id,
          oldValue: existing
            ? {
                fromState: existing.fromState,
                toState: existing.toState,
                allowedRoles: existing.allowedRoles,
                requiresReason: existing.requiresReason,
                sameDepartmentOnly: existing.sameDepartmentOnly,
              }
            : undefined,
          newValue: {
            fromState: saved.fromState,
            toState: saved.toState,
            allowedRoles: saved.allowedRoles,
            requiresReason: saved.requiresReason,
            sameDepartmentOnly: saved.sameDepartmentOnly,
          },
          reason: `Admin updated WorkflowTransition (${saved.fromState} -> ${saved.toState})`,
          ruleApplied: "WorkflowConfigGovernance:AdminEdit",
          outcome: "ACCEPTED",
        },
      });

      return [saved, createdAudit] as const;
    });

    return NextResponse.json({
      ok: true,
      transition: updated,
      auditEventId: audit.id,
    });
  } catch (err) {
    console.error("Admin workflow update error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to update WorkflowTransition." },
      { status: 500 }
    );
  }
}
