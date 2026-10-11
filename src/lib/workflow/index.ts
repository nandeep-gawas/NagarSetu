import { IssueStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";

/**
 * ============================================================================
 * AI SEPARATION RULE (MANDATORY GOVERNANCE INVARIANT)
 * ============================================================================
 * Nothing in the workflow engine may accept input from an AI module to change
 * complaint status, officer assignment, or SLA deadline.
 *
 * Every state transition, assignment, and deadline change MUST originate from
 * an authenticated human actor (CITIZEN, OFFICER, SUPERVISOR, or ADMIN).
 * Any call bearing an AI actor type, role, flag, or identifier is immediately
 * refused and logged to AuditEvent with outcome = REFUSED.
 * ============================================================================
 */

export interface WorkflowActor {
  id: string;
  name?: string;
  email: string;
  role: Role | string;
  departmentId?: string | null;
  department?: {
    id: string;
    name: string;
    categoryId: string;
  } | null;
  actorType?: string;
  isAi?: boolean;
}

export interface TransitionOptions {
  assignedOfficerId?: string | null;
  reopenWindowDays?: number;
  now?: Date;
  resolutionNote?: string | null;
  resolutionEvidencePath?: string | null;
}

export interface WorkflowResult {
  ok: boolean;
  success: boolean;
  status: number;
  error?: string;
  issue?: Awaited<ReturnType<typeof prisma.issue.findUnique>>;
  auditEventId?: string;
}

const DEFAULT_REOPEN_WINDOW_DAYS = 7;

export function formatStateLabel(state: string): string {
  switch (state) {
    case "SUBMITTED":
      return "Submitted";
    case "VERIFIED":
      return "Verified";
    case "ASSIGNED":
      return "Assigned";
    case "IN_PROGRESS":
      return "In Progress";
    case "RESOLVED":
    case "RESOLVED_AWAITING_VERIFICATION":
      return "Resolved";
    case "CLOSED":
      return "Closed";
    case "REJECTED":
      return "Rejected";
    case "REOPENED":
      return "Reopened";
    default:
      return state;
  }
}

function formatRolePlural(role: string): string {
  switch (role) {
    case "CITIZEN":
      return "Citizens";
    case "OFFICER":
      return "Officers";
    case "SUPERVISOR":
      return "Supervisors";
    case "ADMIN":
      return "Admins";
    default:
      return `${role}s`;
  }
}

export function normalizeTargetState(rawState: string): IssueStatus | null {
  if (rawState === "RESOLVED") {
    return "RESOLVED_AWAITING_VERIFICATION";
  }
  const validStates: IssueStatus[] = [
    "SUBMITTED",
    "VERIFIED",
    "ASSIGNED",
    "IN_PROGRESS",
    "RESOLVED_AWAITING_VERIFICATION",
    "CLOSED",
    "REJECTED",
    "REOPENED",
  ];
  if (validStates.includes(rawState as IssueStatus)) {
    return rawState as IssueStatus;
  }
  return null;
}

function isAiActor(actor: WorkflowActor | null | undefined): boolean {
  if (!actor) return false;
  if (actor.isAi === true) return true;
  if (String(actor.actorType || "").toUpperCase() === "AI") return true;
  if (String(actor.role || "").toUpperCase() === "AI") return true;
  if (String(actor.email || "").toLowerCase().startsWith("ai:")) return true;
  if (String(actor.id || "").toLowerCase().startsWith("ai:")) return true;
  return false;
}

async function resolveActorDepartment(actor: WorkflowActor) {
  if (actor.department) return actor.department;
  const dbUser = await prisma.user.findUnique({
    where: { id: actor.id },
    include: { department: true },
  });
  return dbUser?.department ?? null;
}

/**
 * Central Server-Enforced Workflow Engine Function:
 * transition(issueId, toState, actor, reason?, options?)
 *
 * Enforces:
 * 1. AI Separation Rule (no AI module may change status)
 * 2. Citizen tampering prevention & role authorization
 * 3. Valid (fromState -> toState) lookup in WorkflowTransition table
 * 4. Department boundary enforcement (sameDepartmentOnly)
 * 5. Mandatory non-empty reason when requiresReason is true
 * 6. Reopen window enforcement (default 7 days after resolvedAt)
 * 7. Transactional state + timestamp update + immutable AuditEvent recording
 */
export async function transition(
  issueId: string,
  toStateInput: IssueStatus | "RESOLVED" | string,
  actor: WorkflowActor,
  reason?: string | null,
  options?: TransitionOptions
): Promise<WorkflowResult> {
  const actorLabel = actor
    ? `${String(actor.role).toLowerCase()}:${actor.email}`
    : "unknown:unauthenticated";

  // 0. AI Separation Rule check
  if (isAiActor(actor)) {
    const audit = await logAuditEvent({
      actorType: "SYSTEM",
      actorId: actor?.id ?? null,
      actorLabel: actorLabel || "ai:prohibited",
      action: `AI_WORKFLOW_TRANSITION_ATTEMPT_TO_${toStateInput}`,
      entityType: "Issue",
      entityId: issueId,
      oldValue: null,
      newValue: { toState: toStateInput },
      reason:
        "AI Separation Rule: AI modules are strictly prohibited from changing complaint status, assignment, or deadline.",
      ruleApplied: "AISeparationRule:NoAiWorkflowMutation",
      outcome: "REFUSED",
    });
    return {
      ok: false,
      success: false,
      status: 403,
      error:
        "AI Separation Rule Violation: AI modules cannot change complaint status, assignment, or deadline.",
      auditEventId: audit.id,
    };
  }

  // 1. Load current issue
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: {
      category: {
        include: { department: true },
      },
      subcategory: true,
      reports: {
        select: { citizenId: true, referenceId: true },
      },
    },
  });

  if (!issue) {
    const audit = await logAuditEvent({
      actorType: "USER",
      actorId: actor.id,
      actorLabel,
      action: `WORKFLOW_TRANSITION_TO_${toStateInput}`,
      entityType: "Issue",
      entityId: issueId,
      oldValue: null,
      newValue: { toState: toStateInput },
      reason: "Issue not found",
      ruleApplied: "WorkflowEngine:IssueExistence",
      outcome: "REFUSED",
    });
    return {
      ok: false,
      success: false,
      status: 404,
      error: "Issue not found.",
      auditEventId: audit.id,
    };
  }

  const toState = normalizeTargetState(String(toStateInput));
  if (!toState) {
    const audit = await logAuditEvent({
      actorType: "USER",
      actorId: actor.id,
      actorLabel,
      action: `WORKFLOW_TRANSITION_${issue.status}_TO_${toStateInput}`,
      entityType: "Issue",
      entityId: issue.id,
      oldValue: { status: issue.status },
      newValue: { status: toStateInput },
      reason: `Unknown target state '${toStateInput}'.`,
      ruleApplied: "WorkflowEngine:StateValidation",
      outcome: "REFUSED",
    });
    return {
      ok: false,
      success: false,
      status: 400,
      error: `Invalid target state: ${toStateInput}.`,
      auditEventId: audit.id,
    };
  }

  const fromState = issue.status;

  // 2. Citizen tampering & role restriction check
  // Citizens are NEVER permitted to set IN_PROGRESS, ASSIGNED, VERIFIED, RESOLVED_AWAITING_VERIFICATION, CLOSED, or REJECTED via transition tampering.
  if (actor.role === "CITIZEN") {
    if (toState !== "REOPENED") {
      const msg = `Citizens are not permitted to change a complaint to ${formatStateLabel(toState)}.`;
      const audit = await logAuditEvent({
        actorType: "USER",
        actorId: actor.id,
        actorLabel,
        action: `WORKFLOW_TRANSITION_${fromState}_TO_${toState}`,
        entityType: "Issue",
        entityId: issue.id,
        oldValue: { status: fromState, actorRole: actor.role },
        newValue: { status: toState },
        reason: msg,
        ruleApplied: "WorkflowEngine:CitizenRoleRestriction",
        outcome: "REFUSED",
      });
      return {
        ok: false,
        success: false,
        status: 403,
        error: msg,
        auditEventId: audit.id,
      };
    }

    // Citizen attempting REOPENED: must own a linked report on this issue
    const ownsReport = issue.reports.some((r) => r.citizenId === actor.id);
    if (!ownsReport) {
      const msg =
        "Citizens are not permitted to reopen a complaint unless they own a linked report.";
      const audit = await logAuditEvent({
        actorType: "USER",
        actorId: actor.id,
        actorLabel,
        action: `WORKFLOW_TRANSITION_${fromState}_TO_${toState}`,
        entityType: "Issue",
        entityId: issue.id,
        oldValue: { status: fromState, actorId: actor.id },
        newValue: { status: toState },
        reason: msg,
        ruleApplied: "WorkflowEngine:CitizenReportOwnership",
        outcome: "REFUSED",
      });
      return {
        ok: false,
        success: false,
        status: 403,
        error: msg,
        auditEventId: audit.id,
      };
    }
  }

  // 3. Look up (fromState -> toState) in WorkflowTransition table
  const transitionRule = await prisma.workflowTransition.findUnique({
    where: {
      fromState_toState: {
        fromState,
        toState,
      },
    },
  });

  if (!transitionRule) {
    const humanMessage =
      toState === "RESOLVED_AWAITING_VERIFICATION"
        ? `Cannot move from ${formatStateLabel(fromState)} to Resolved: a complaint must be Verified, Assigned and In Progress first.`
        : `Cannot move from ${formatStateLabel(fromState)} to ${formatStateLabel(toState)}: a complaint must complete the required prerequisite workflow steps first.`;

    const audit = await logAuditEvent({
      actorType: "USER",
      actorId: actor.id,
      actorLabel,
      action: `WORKFLOW_TRANSITION_${fromState}_TO_${toState}`,
      entityType: "Issue",
      entityId: issue.id,
      oldValue: { status: fromState },
      newValue: { status: toState },
      reason: humanMessage,
      ruleApplied: "WorkflowEngine:TransitionTableLookup",
      outcome: "REFUSED",
    });

    return {
      ok: false,
      success: false,
      status: 400,
      error: humanMessage,
      auditEventId: audit.id,
    };
  }

  // 4. Check actor's role is in allowedRoles
  const allowedRoles = Array.isArray(transitionRule.allowedRoles)
    ? (transitionRule.allowedRoles as string[])
    : [];

  if (!allowedRoles.includes(String(actor.role))) {
    const roleMsg = `${formatRolePlural(String(actor.role))} are not permitted to change a complaint to ${formatStateLabel(toState)}.`;
    const audit = await logAuditEvent({
      actorType: "USER",
      actorId: actor.id,
      actorLabel,
      action: `WORKFLOW_TRANSITION_${fromState}_TO_${toState}`,
      entityType: "Issue",
      entityId: issue.id,
      oldValue: { status: fromState, actorRole: actor.role },
      newValue: { status: toState, allowedRoles },
      reason: roleMsg,
      ruleApplied: `WorkflowTransition(${fromState}->${toState}:allowedRoles)`,
      outcome: "REFUSED",
    });
    return {
      ok: false,
      success: false,
      status: 403,
      error: roleMsg,
      auditEventId: audit.id,
    };
  }

  // 5. Check sameDepartmentOnly (officers can only act inside their department; supervisors in their department; admin config only)
  if (transitionRule.sameDepartmentOnly) {
    const actorDept = await resolveActorDepartment(actor);

    if (actor.role === "OFFICER") {
      if (!actorDept || actorDept.categoryId !== issue.categoryId) {
        const deptMsg = `Officers can only act inside their own department. (${actorDept?.name || "No Department"} does not match ${issue.category.department?.name || issue.category.name}).`;
        const audit = await logAuditEvent({
          actorType: "USER",
          actorId: actor.id,
          actorLabel,
          action: `WORKFLOW_TRANSITION_${fromState}_TO_${toState}`,
          entityType: "Issue",
          entityId: issue.id,
          oldValue: {
            status: fromState,
            issueCategoryId: issue.categoryId,
            actorDepartmentCategoryId: actorDept?.categoryId ?? null,
          },
          newValue: { status: toState },
          reason: deptMsg,
          ruleApplied: `WorkflowTransition(${fromState}->${toState}:sameDepartmentOnly)`,
          outcome: "REFUSED",
        });
        return {
          ok: false,
          success: false,
          status: 403,
          error: deptMsg,
          auditEventId: audit.id,
        };
      }
    } else if (actor.role === "SUPERVISOR") {
      // If supervisor is scoped to a specific department, enforce department match
      if (actorDept && actorDept.categoryId !== issue.categoryId) {
        const deptMsg = `Supervisors can only act inside their own department. (${actorDept.name} does not match ${issue.category.department?.name || issue.category.name}).`;
        const audit = await logAuditEvent({
          actorType: "USER",
          actorId: actor.id,
          actorLabel,
          action: `WORKFLOW_TRANSITION_${fromState}_TO_${toState}`,
          entityType: "Issue",
          entityId: issue.id,
          oldValue: {
            status: fromState,
            issueCategoryId: issue.categoryId,
            actorDepartmentCategoryId: actorDept.categoryId,
          },
          newValue: { status: toState },
          reason: deptMsg,
          ruleApplied: `WorkflowTransition(${fromState}->${toState}:sameDepartmentOnly)`,
          outcome: "REFUSED",
        });
        return {
          ok: false,
          success: false,
          status: 403,
          error: deptMsg,
          auditEventId: audit.id,
        };
      }
    }
  }

  // 6. Reopen window check when transitioning to REOPENED
  if (toState === "REOPENED") {
    const nowTime = options?.now ?? new Date();
    const windowDays =
      options?.reopenWindowDays ??
      (Number(process.env.REOPEN_WINDOW_DAYS) || DEFAULT_REOPEN_WINDOW_DAYS);
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    const referenceResolvedAt = issue.resolvedAt ?? issue.updatedAt;

    if (
      referenceResolvedAt &&
      nowTime.getTime() - referenceResolvedAt.getTime() > windowMs
    ) {
      const expMsg = `Cannot reopen complaint: the ${windowDays}-day reopen window after resolution has expired.`;
      const audit = await logAuditEvent({
        actorType: "USER",
        actorId: actor.id,
        actorLabel,
        action: `WORKFLOW_TRANSITION_${fromState}_TO_REOPENED`,
        entityType: "Issue",
        entityId: issue.id,
        oldValue: {
          status: fromState,
          resolvedAt: issue.resolvedAt,
        },
        newValue: { status: "REOPENED" },
        reason: expMsg,
        ruleApplied: `ReopenPolicy:Window(${windowDays}d)`,
        outcome: "REFUSED",
      });
      return {
        ok: false,
        success: false,
        status: 400,
        error: expMsg,
        auditEventId: audit.id,
      };
    }
  }

  // 7. Check requiresReason
  if (transitionRule.requiresReason && (!reason || reason.trim().length === 0)) {
    const reasonMsg = `Cannot move from ${formatStateLabel(fromState)} to ${formatStateLabel(toState)}: a non-empty reason is required.`;
    const audit = await logAuditEvent({
      actorType: "USER",
      actorId: actor.id,
      actorLabel,
      action: `WORKFLOW_TRANSITION_${fromState}_TO_${toState}`,
      entityType: "Issue",
      entityId: issue.id,
      oldValue: { status: fromState },
      newValue: { status: toState, reason: reason ?? null },
      reason: reasonMsg,
      ruleApplied: `WorkflowTransition(${fromState}->${toState}:requiresReason)`,
      outcome: "REFUSED",
    });
    return {
      ok: false,
      success: false,
      status: 400,
      error: reasonMsg,
      auditEventId: audit.id,
    };
  }

  // Require resolution note when moving to RESOLVED_AWAITING_VERIFICATION
  const resolutionNoteText = options?.resolutionNote?.trim() || reason?.trim();
  if (toState === "RESOLVED_AWAITING_VERIFICATION" && (!resolutionNoteText || resolutionNoteText.length === 0)) {
    const resMsg = "A non-empty resolution note is required when resolving a complaint.";
    const audit = await logAuditEvent({
      actorType: "USER",
      actorId: actor.id,
      actorLabel,
      action: `WORKFLOW_TRANSITION_${fromState}_TO_RESOLVED_AWAITING_VERIFICATION`,
      entityType: "Issue",
      entityId: issue.id,
      oldValue: { status: fromState },
      newValue: { status: toState },
      reason: resMsg,
      ruleApplied: "WorkflowEngine:ResolutionNoteRequired",
      outcome: "REFUSED",
    });
    return {
      ok: false,
      success: false,
      status: 400,
      error: resMsg,
      auditEventId: audit.id,
    };
  }

  // Resolve officer assignment if transitioning to ASSIGNED
  let nextAssignedOfficerId = issue.assignedOfficerId;
  if (toState === "ASSIGNED") {
    if (options?.assignedOfficerId) {
      nextAssignedOfficerId = options.assignedOfficerId;
    } else if (!nextAssignedOfficerId) {
      const deptOfficer = await prisma.user.findFirst({
        where: {
          role: "OFFICER",
          department: {
            categoryId: issue.categoryId,
          },
        },
      });
      if (deptOfficer) {
        nextAssignedOfficerId = deptOfficer.id;
      }
    }
  }

  const now = options?.now ?? new Date();

  // 8. Execute state update and AuditEvent inside a single database transaction
  const [updatedIssue, audit] = await prisma.$transaction(async (tx) => {
    const updateData: {
      status: IssueStatus;
      assignedOfficerId?: string | null;
      resolvedAt?: Date | null;
      closedAt?: Date | null;
      isOverdue?: boolean;
      resolutionNote?: string | null;
      resolutionEvidencePath?: string | null;
    } = {
      status: toState,
      assignedOfficerId: nextAssignedOfficerId,
    };

    if (toState === "RESOLVED_AWAITING_VERIFICATION") {
      updateData.resolvedAt = now;
      updateData.isOverdue = false;
      if (resolutionNoteText) {
        updateData.resolutionNote = resolutionNoteText;
      }
      if (options?.resolutionEvidencePath) {
        updateData.resolutionEvidencePath = options.resolutionEvidencePath;
      }
    } else if (toState === "CLOSED") {
      updateData.closedAt = now;
      updateData.isOverdue = false;
    } else if (toState === "REJECTED") {
      updateData.closedAt = now;
      updateData.isOverdue = false;
    } else if (toState === "REOPENED") {
      updateData.resolvedAt = null;
      updateData.closedAt = null;
    }

    const updated = await tx.issue.update({
      where: { id: issue.id },
      data: updateData,
      include: {
        category: true,
        subcategory: true,
        assignedOfficer: {
          select: { id: true, name: true, email: true, role: true },
        },
        reports: {
          include: {
            citizen: { select: { id: true, name: true, email: true } },
            evidences: true,
          },
        },
      },
    });

    const createdAudit = await tx.auditEvent.create({
      data: {
        timestamp: now,
        actorType: "USER",
        actorId: actor.id,
        actorLabel,
        action: `WORKFLOW_TRANSITION_${fromState}_TO_${toState}`,
        entityType: "Issue",
        entityId: issue.id,
        oldValue: {
          status: fromState,
          assignedOfficerId: issue.assignedOfficerId,
        },
        newValue: {
          status: toState,
          assignedOfficerId: updated.assignedOfficerId,
        },
        reason: reason?.trim() || `Transitioned ${fromState} -> ${toState}`,
        ruleApplied: `WorkflowTransition(${fromState}->${toState})`,
        outcome: "ACCEPTED",
      },
    });

    // Notify linked citizens
    const citizenIds = Array.from(
      new Set(issue.reports.map((r) => r.citizenId))
    );
    if (citizenIds.length > 0) {
      await tx.notification.createMany({
        data: citizenIds.map((citizenId) => ({
          userId: citizenId,
          issueId: issue.id,
          message: `Issue ${issue.publicRef} (${issue.publicLocationLabel}) status updated from ${fromState} to ${toState}${reason ? ` — Reason: ${reason}` : ""}.`,
        })),
      });
    }

    return [updated, createdAudit] as const;
  });

  return {
    ok: true,
    success: true,
    status: 200,
    issue: updatedIssue,
    auditEventId: audit.id,
  };
}

/**
 * Backwards-compatible wrapper for transition()
 */
export async function executeWorkflowTransition(req: {
  issueId: string;
  toState: IssueStatus | string;
  actor: WorkflowActor;
  reason?: string | null;
  assignedOfficerId?: string | null;
}): Promise<WorkflowResult> {
  return transition(req.issueId, req.toState, req.actor, req.reason, {
    assignedOfficerId: req.assignedOfficerId,
  });
}

/**
 * Supervisor-only Officer Assignment / Reassignment Engine Function.
 * Enforces same-department officer assignment, preserves history, and records AuditEvent.
 */
export async function assignIssue(
  issueId: string,
  officerId: string,
  actor: WorkflowActor,
  reason?: string | null
): Promise<WorkflowResult> {
  const actorLabel = `${String(actor.role).toLowerCase()}:${actor.email}`;

  if (isAiActor(actor)) {
    const audit = await logAuditEvent({
      actorType: "SYSTEM",
      actorId: actor?.id ?? null,
      actorLabel,
      action: "AI_ASSIGN_ATTEMPT",
      entityType: "Issue",
      entityId: issueId,
      oldValue: null,
      newValue: { officerId },
      reason: "AI Separation Rule: AI modules cannot assign officers.",
      ruleApplied: "AISeparationRule:NoAiWorkflowMutation",
      outcome: "REFUSED",
    });
    return {
      ok: false,
      success: false,
      status: 403,
      error: "AI Separation Rule Violation: AI modules cannot assign officers.",
      auditEventId: audit.id,
    };
  }

  if (actor.role !== "SUPERVISOR" && actor.role !== "ADMIN") {
    const msg = `${formatRolePlural(String(actor.role))} are not permitted to assign officers. Supervisor or Admin role is required.`;
    const audit = await logAuditEvent({
      actorType: "USER",
      actorId: actor.id,
      actorLabel,
      action: "ASSIGN_ISSUE_OFFICER",
      entityType: "Issue",
      entityId: issueId,
      oldValue: { actorRole: actor.role },
      newValue: { officerId },
      reason: msg,
      ruleApplied: "AssignmentPolicy:SupervisorOnly",
      outcome: "REFUSED",
    });
    return {
      ok: false,
      success: false,
      status: 403,
      error: msg,
      auditEventId: audit.id,
    };
  }

  if (!reason || reason.trim().length === 0) {
    const msg = "A non-empty reason is required when assigning or reassigning an officer.";
    const audit = await logAuditEvent({
      actorType: "USER",
      actorId: actor.id,
      actorLabel,
      action: "ASSIGN_ISSUE_OFFICER",
      entityType: "Issue",
      entityId: issueId,
      oldValue: null,
      newValue: { officerId },
      reason: msg,
      ruleApplied: "AssignmentPolicy:RequiresReason",
      outcome: "REFUSED",
    });
    return {
      ok: false,
      success: false,
      status: 400,
      error: msg,
      auditEventId: audit.id,
    };
  }

  const [issue, officer] = await Promise.all([
    prisma.issue.findUnique({
      where: { id: issueId },
      include: { category: { include: { department: true } } },
    }),
    prisma.user.findUnique({
      where: { id: officerId },
      include: { department: true },
    }),
  ]);

  if (!issue) {
    const audit = await logAuditEvent({
      actorType: "USER",
      actorId: actor.id,
      actorLabel,
      action: "ASSIGN_ISSUE_OFFICER",
      entityType: "Issue",
      entityId: issueId,
      oldValue: null,
      newValue: { officerId },
      reason: "Issue not found",
      ruleApplied: "AssignmentPolicy:IssueExistence",
      outcome: "REFUSED",
    });
    return {
      ok: false,
      success: false,
      status: 404,
      error: "Issue not found.",
      auditEventId: audit.id,
    };
  }

  if (!officer || officer.role !== "OFFICER") {
    const msg = "Target user is not a valid municipal officer.";
    const audit = await logAuditEvent({
      actorType: "USER",
      actorId: actor.id,
      actorLabel,
      action: "ASSIGN_ISSUE_OFFICER",
      entityType: "Issue",
      entityId: issue.id,
      oldValue: { assignedOfficerId: issue.assignedOfficerId },
      newValue: { officerId },
      reason: msg,
      ruleApplied: "AssignmentPolicy:ValidOfficerRole",
      outcome: "REFUSED",
    });
    return {
      ok: false,
      success: false,
      status: 400,
      error: msg,
      auditEventId: audit.id,
    };
  }

  // Officer must belong to the same department as the issue's category
  if (!officer.department || officer.department.categoryId !== issue.categoryId) {
    const msg = `Officer ${officer.name} belongs to '${officer.department?.name || "None"}', which does not match issue department '${issue.category.department?.name || issue.category.name}'.`;
    const audit = await logAuditEvent({
      actorType: "USER",
      actorId: actor.id,
      actorLabel,
      action: "ASSIGN_ISSUE_OFFICER",
      entityType: "Issue",
      entityId: issue.id,
      oldValue: {
        assignedOfficerId: issue.assignedOfficerId,
        issueCategoryId: issue.categoryId,
      },
      newValue: {
        officerId: officer.id,
        officerDepartmentCategoryId: officer.department?.categoryId ?? null,
      },
      reason: msg,
      ruleApplied: "AssignmentPolicy:SameDepartmentOnly",
      outcome: "REFUSED",
    });
    return {
      ok: false,
      success: false,
      status: 403,
      error: msg,
      auditEventId: audit.id,
    };
  }

  // Check supervisor department if supervisor has a specific departmentId
  const supervisorDept = await resolveActorDepartment(actor);
  if (supervisorDept && supervisorDept.categoryId !== issue.categoryId) {
    const msg = `Supervisors can only assign complaints inside their own department (${supervisorDept.name}).`;
    const audit = await logAuditEvent({
      actorType: "USER",
      actorId: actor.id,
      actorLabel,
      action: "ASSIGN_ISSUE_OFFICER",
      entityType: "Issue",
      entityId: issue.id,
      oldValue: { assignedOfficerId: issue.assignedOfficerId },
      newValue: { officerId: officer.id },
      reason: msg,
      ruleApplied: "AssignmentPolicy:SupervisorSameDepartment",
      outcome: "REFUSED",
    });
    return {
      ok: false,
      success: false,
      status: 403,
      error: msg,
      auditEventId: audit.id,
    };
  }

  const nextStatus: IssueStatus =
    issue.status === "VERIFIED" || issue.status === "REOPENED"
      ? "ASSIGNED"
      : issue.status;

  const [updatedIssue, audit] = await prisma.$transaction(async (tx) => {
    const updated = await tx.issue.update({
      where: { id: issue.id },
      data: {
        assignedOfficerId: officer.id,
        status: nextStatus,
      },
      include: {
        category: true,
        subcategory: true,
        assignedOfficer: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    const createdAudit = await tx.auditEvent.create({
      data: {
        timestamp: new Date(),
        actorType: "USER",
        actorId: actor.id,
        actorLabel,
        action: "ASSIGN_ISSUE_OFFICER",
        entityType: "Issue",
        entityId: issue.id,
        oldValue: {
          assignedOfficerId: issue.assignedOfficerId,
          status: issue.status,
        },
        newValue: {
          assignedOfficerId: officer.id,
          officerEmail: officer.email,
          status: nextStatus,
        },
        reason: reason.trim(),
        ruleApplied: "AssignmentPolicy:SupervisorSameDepartment",
        outcome: "ACCEPTED",
      },
    });

    await tx.notification.create({
      data: {
        userId: officer.id,
        issueId: issue.id,
        message: `You have been assigned to issue ${issue.publicRef} (${issue.publicLocationLabel}). Reason: ${reason.trim()}`,
      },
    });

    return [updated, createdAudit] as const;
  });

  return {
    ok: true,
    success: true,
    status: 200,
    issue: updatedIssue,
    auditEventId: audit.id,
  };
}

/**
 * Citizen Reopen Engine Function:
 * Only a citizen who owns a linked report (within the configurable window after resolution, default 7 days)
 * may reopen a RESOLVED_AWAITING_VERIFICATION complaint.
 */
export async function reopenIssue(
  issueId: string,
  actor: WorkflowActor,
  reason?: string | null,
  options?: { windowDays?: number; now?: Date }
): Promise<WorkflowResult> {
  return transition(
    issueId,
    "REOPENED",
    actor,
    reason && reason.trim().length > 0
      ? reason
      : "Reopened by citizen within post-resolution verification window",
    {
      reopenWindowDays: options?.windowDays,
      now: options?.now,
    }
  );
}

/**
 * Supervisor / Admin Deadline Change Engine Function:
 * Saves a DeadlineChange row, preserves originalResolutionDeadline and all earlier
 * missed-deadline / escalation records, and logs an AuditEvent.
 */
export async function changeIssueDeadline(
  issueId: string,
  newDeadlineInput: Date | string,
  actor: WorkflowActor,
  reason?: string | null
) {
  const actorLabel = `${String(actor.role).toLowerCase()}:${actor.email}`;

  if (isAiActor(actor)) {
    const audit = await logAuditEvent({
      actorType: "SYSTEM",
      actorId: actor?.id ?? null,
      actorLabel,
      action: "AI_DEADLINE_CHANGE_ATTEMPT",
      entityType: "Issue",
      entityId: issueId,
      oldValue: null,
      newValue: { newDeadline: String(newDeadlineInput) },
      reason: "AI Separation Rule: AI modules cannot modify deadlines.",
      ruleApplied: "AISeparationRule:NoAiWorkflowMutation",
      outcome: "REFUSED",
    });
    return {
      ok: false,
      status: 403,
      error: "AI Separation Rule Violation: AI modules cannot modify deadlines.",
      auditEventId: audit.id,
    };
  }

  if (actor.role !== "SUPERVISOR" && actor.role !== "ADMIN") {
    const msg = `${formatRolePlural(String(actor.role))} are not permitted to modify complaint deadlines.`;
    const audit = await logAuditEvent({
      actorType: "USER",
      actorId: actor.id,
      actorLabel,
      action: "DEADLINE_CHANGE",
      entityType: "Issue",
      entityId: issueId,
      oldValue: { actorRole: actor.role },
      newValue: { newDeadline: String(newDeadlineInput) },
      reason: msg,
      ruleApplied: "DeadlineGovernance:SupervisorOrAdminOnly",
      outcome: "REFUSED",
    });
    return {
      ok: false,
      status: 403,
      error: msg,
      auditEventId: audit.id,
    };
  }

  if (!reason || reason.trim().length === 0) {
    const msg = "A non-empty reason is required to change a complaint deadline.";
    const audit = await logAuditEvent({
      actorType: "USER",
      actorId: actor.id,
      actorLabel,
      action: "DEADLINE_CHANGE",
      entityType: "Issue",
      entityId: issueId,
      oldValue: null,
      newValue: { newDeadline: String(newDeadlineInput) },
      reason: msg,
      ruleApplied: "DeadlineGovernance:RequiresReason",
      outcome: "REFUSED",
    });
    return {
      ok: false,
      status: 400,
      error: msg,
      auditEventId: audit.id,
    };
  }

  const parsedNewDeadline =
    newDeadlineInput instanceof Date
      ? newDeadlineInput
      : new Date(newDeadlineInput);

  if (isNaN(parsedNewDeadline.getTime())) {
    return {
      ok: false,
      status: 400,
      error: "Invalid newDeadline date format.",
    };
  }

  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) {
    const audit = await logAuditEvent({
      actorType: "USER",
      actorId: actor.id,
      actorLabel,
      action: "DEADLINE_CHANGE",
      entityType: "Issue",
      entityId: issueId,
      oldValue: null,
      newValue: { newDeadline: parsedNewDeadline.toISOString() },
      reason: "Issue not found",
      ruleApplied: "DeadlineGovernance:IssueExistence",
      outcome: "REFUSED",
    });
    return {
      ok: false,
      status: 404,
      error: "Issue not found.",
      auditEventId: audit.id,
    };
  }

  // Transactionally create DeadlineChange, update resolutionDeadline (NEVER touching originalResolutionDeadline
  // and NEVER deleting earlier DeadlineChange or EscalationEvent rows), and create AuditEvent
  const [deadlineChange, updatedIssue, audit] = await prisma.$transaction(
    async (tx) => {
      const dc = await tx.deadlineChange.create({
        data: {
          issueId: issue.id,
          oldDeadline: issue.resolutionDeadline,
          newDeadline: parsedNewDeadline,
          actorId: actor.id,
          reason: reason.trim(),
        },
      });

      const updated = await tx.issue.update({
        where: { id: issue.id },
        data: {
          resolutionDeadline: parsedNewDeadline,
          // originalResolutionDeadline is intentionally untouched!
        },
      });

      const createdAudit = await tx.auditEvent.create({
        data: {
          timestamp: new Date(),
          actorType: "USER",
          actorId: actor.id,
          actorLabel,
          action: "DEADLINE_CHANGE",
          entityType: "Issue",
          entityId: issue.id,
          oldValue: {
            resolutionDeadline: issue.resolutionDeadline,
            originalResolutionDeadline: issue.originalResolutionDeadline,
          },
          newValue: {
            resolutionDeadline: parsedNewDeadline,
            originalResolutionDeadline: updated.originalResolutionDeadline,
          },
          reason: reason.trim(),
          ruleApplied: "DeadlineGovernance:PreservesOriginalDeadline",
          outcome: "ACCEPTED",
        },
      });

      return [dc, updated, createdAudit] as const;
    }
  );

  return {
    ok: true,
    status: 200,
    deadlineChange,
    issue: updatedIssue,
    auditEventId: audit.id,
  };
}

/**
 * Returns only the transitions the CURRENT logged-in user may perform right now on the issue.
 */
export async function getAllowedTransitionsForActor(
  issueId: string,
  actor: WorkflowActor | null
) {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: {
      category: { include: { department: true } },
      reports: { select: { citizenId: true } },
    },
  });

  if (!issue) {
    return { found: false as const, allowedTransitions: [] };
  }

  if (!actor || isAiActor(actor)) {
    return {
      found: true as const,
      currentStatus: issue.status,
      allowedTransitions: [],
    };
  }

  const candidateRules = await prisma.workflowTransition.findMany({
    where: { fromState: issue.status },
  });

  const actorDept = await resolveActorDepartment(actor);
  const windowDays =
    Number(process.env.REOPEN_WINDOW_DAYS) || DEFAULT_REOPEN_WINDOW_DAYS;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  const allowedTransitions = candidateRules.filter((rule) => {
    const roles = Array.isArray(rule.allowedRoles)
      ? (rule.allowedRoles as string[])
      : [];
    if (!roles.includes(String(actor.role))) return false;

    if (actor.role === "CITIZEN") {
      if (rule.toState !== "REOPENED") return false;
      const ownsReport = issue.reports.some((r) => r.citizenId === actor.id);
      if (!ownsReport) return false;
    }

    if (rule.toState === "REOPENED" && issue.resolvedAt) {
      if (Date.now() - issue.resolvedAt.getTime() > windowMs) {
        return false;
      }
    }

    if (rule.sameDepartmentOnly) {
      if (actor.role === "OFFICER") {
        if (!actorDept || actorDept.categoryId !== issue.categoryId) {
          return false;
        }
      } else if (actor.role === "SUPERVISOR") {
        if (actorDept && actorDept.categoryId !== issue.categoryId) {
          return false;
        }
      }
    }

    return true;
  });

  return {
    found: true as const,
    currentStatus: issue.status,
    allowedTransitions,
  };
}
