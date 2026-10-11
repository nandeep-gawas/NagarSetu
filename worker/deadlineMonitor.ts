import cron from "node-cron";
import { prisma } from "../src/lib/db";
import {
  recalculatePriority,
  DEMO_RULES_COMMITMENT_LABEL,
} from "../src/lib/rules";

/**
 * Dev helper to "time-travel" an issue's resolutionDeadline into the past
 * (or future) for live Scenario G deadline & escalation demonstrations.
 * Preserves originalResolutionDeadline and all historical EscalationEvent / AuditEvent rows.
 */
export async function timeTravelIssueDeadline(
  issueId: string,
  hoursInPast: number = 2
) {
  const now = new Date();
  const targetDeadline = new Date(now.getTime() - hoursInPast * 3600 * 1000);
  const updated = await prisma.issue.update({
    where: { id: issueId },
    data: {
      resolutionDeadline: targetDeadline,
    },
  });

  await prisma.auditEvent.create({
    data: {
      timestamp: now,
      actorType: "SYSTEM",
      actorId: null,
      actorLabel: "system:deadline-monitor",
      action: "DEV_TIME_TRAVEL_DEADLINE",
      entityType: "Issue",
      entityId: issueId,
      oldValue: { originalResolutionDeadline: updated.originalResolutionDeadline },
      newValue: { resolutionDeadline: targetDeadline, hoursInPast },
      reason: `Scenario G demo time-travel: shifted resolutionDeadline to ${hoursInPast}h in the past.`,
      ruleApplied: `DevTimeTravel(${hoursInPast}h) [${DEMO_RULES_COMMITMENT_LABEL}]`,
      outcome: "ACCEPTED",
    },
  });

  return updated;
}

/**
 * Single idempotent execution pass of the Deadline & Escalation Monitor.
 * Can be called by node-cron every minute, by tests, or by POST /api/dev/run-monitor.
 */
export async function runDeadlineMonitorPass(now: Date = new Date()) {
  const nonClosedIssues = await prisma.issue.findMany({
    where: {
      status: {
        notIn: ["CLOSED", "REJECTED", "RESOLVED_AWAITING_VERIFICATION"],
      },
    },
    include: {
      category: { include: { department: true } },
      escalationEvents: true,
    },
  });

  const [supervisors, admins, priorityRules] = await Promise.all([
    prisma.user.findMany({
      where: { role: "SUPERVISOR" },
      include: { department: true },
    }),
    prisma.user.findMany({
      where: { role: "ADMIN" },
    }),
    prisma.priorityRule.findMany({
      orderBy: { threshold: "asc" },
    }),
  ]);

  const overdueHighRule = priorityRules.find(
    (r) => r.ruleType === "OVERDUE_HIGH"
  );
  const overdueCriticalRule = priorityRules.find(
    (r) => r.ruleType === "OVERDUE_CRITICAL"
  );
  const criticalThresholdHours = overdueCriticalRule?.threshold ?? 24;

  let level1Escalations = 0;
  let level2Escalations = 0;
  let approachingCount = 0;

  for (const issue of nonClosedIssues) {
    const msPastDeadline = now.getTime() - issue.resolutionDeadline.getTime();
    const isNowOverdue = msPastDeadline > 0;

    // 1. Check "approaching deadline" (within 20% of total SLA time left, and not yet overdue)
    const totalWindowMs =
      issue.resolutionDeadline.getTime() - issue.createdAt.getTime();
    const remainingMs = issue.resolutionDeadline.getTime() - now.getTime();
    const isApproaching =
      !isNowOverdue &&
      totalWindowMs > 0 &&
      remainingMs > 0 &&
      remainingMs / totalWindowMs <= 0.2;

    if (isApproaching) {
      approachingCount++;
      if (!issue.isApproachingDeadline) {
        await prisma.issue.update({
          where: { id: issue.id },
          data: { isApproachingDeadline: true },
        });
      }
    }

    if (!isNowOverdue) {
      continue;
    }

    // Find matching department supervisor or fallback zonal supervisor
    const deptSupervisor =
      supervisors.find(
        (s) => s.department?.categoryId === issue.categoryId
      ) ?? supervisors[0];
    const adminUser = admins[0];

    const hasLevel1 = issue.escalationEvents.some((e) => e.level === 1);
    const hasLevel2 = issue.escalationEvents.some((e) => e.level === 2);

    // Recalculate priority (combines deadline-based + reportCount rules, never lowers priority)
    await recalculatePriority(issue.id, {
      now,
      actorType: "SYSTEM",
      actorId: null,
      actorLabel: "system:deadline-monitor",
    });

    // 2. Level 1 Escalation: Resolution deadline missed (idempotent — only once per issue)
    if (!hasLevel1) {
      const ruleName = overdueHighRule
        ? `PriorityRule(OVERDUE_HIGH>=${overdueHighRule.threshold}h->${overdueHighRule.resultingPriority}) [${DEMO_RULES_COMMITMENT_LABEL}]`
        : `DeadlineRule(ResolutionBreached) [${DEMO_RULES_COMMITMENT_LABEL}]`;

      await prisma.$transaction(async (tx) => {
        await tx.issue.update({
          where: { id: issue.id },
          data: {
            isOverdue: true,
            isApproachingDeadline: false,
          },
        });

        await tx.auditEvent.create({
          data: {
            timestamp: now,
            actorType: "SYSTEM",
            actorId: null,
            actorLabel: "system:deadline-monitor",
            action: "MISSED_DEADLINE",
            entityType: "Issue",
            entityId: issue.id,
            oldValue: {
              isOverdue: issue.isOverdue,
              resolutionDeadline: issue.resolutionDeadline,
            },
            newValue: {
              isOverdue: true,
              level: 1,
            },
            reason: `Resolution deadline missed for ${issue.publicRef} (${issue.publicLocationLabel}).`,
            ruleApplied: ruleName,
            outcome: "ACCEPTED",
          },
        });

        if (deptSupervisor) {
          await tx.escalationEvent.create({
            data: {
              issueId: issue.id,
              level: 1,
              reason: `Resolution deadline passed for ${issue.publicRef}. Escalated to Level 1 (Supervisor).`,
              notifiedUserId: deptSupervisor.id,
              createdAt: now,
            },
          });

          await tx.notification.create({
            data: {
              userId: deptSupervisor.id,
              issueId: issue.id,
              message: `[ESCALATION L1] Issue ${issue.publicRef} (${issue.publicLocationLabel}) missed its resolution deadline and was escalated to HIGH priority.`,
              createdAt: now,
            },
          });
        }
      });

      level1Escalations++;
    }

    // 3. Level 2 Escalation: Still unresolved after further configured threshold (e.g. 24h past deadline)
    const hoursOverdue = msPastDeadline / (1000 * 60 * 60);
    if (hoursOverdue >= criticalThresholdHours && !hasLevel2) {
      const ruleNameL2 = overdueCriticalRule
        ? `PriorityRule(OVERDUE_CRITICAL>=${overdueCriticalRule.threshold}h->${overdueCriticalRule.resultingPriority}) [${DEMO_RULES_COMMITMENT_LABEL}]`
        : `PriorityRule(OVERDUE_CRITICAL>=24h->CRITICAL) [${DEMO_RULES_COMMITMENT_LABEL}]`;

      await prisma.$transaction(async (tx) => {
        await tx.issue.update({
          where: { id: issue.id },
          data: {
            isOverdue: true,
            priority: "CRITICAL",
          },
        });

        await tx.auditEvent.create({
          data: {
            timestamp: now,
            actorType: "SYSTEM",
            actorId: null,
            actorLabel: "system:deadline-monitor",
            action: "ESCALATION_LEVEL_2_CRITICAL",
            entityType: "Issue",
            entityId: issue.id,
            oldValue: { priority: issue.priority, level: 1 },
            newValue: { priority: "CRITICAL", level: 2 },
            reason: `Issue ${issue.publicRef} remained unresolved ${Math.round(hoursOverdue)}h past deadline (threshold ${criticalThresholdHours}h). Escalated to Level 2 (CRITICAL).`,
            ruleApplied: ruleNameL2,
            outcome: "ACCEPTED",
          },
        });

        const notifyTarget = adminUser ?? deptSupervisor;
        if (notifyTarget) {
          await tx.escalationEvent.create({
            data: {
              issueId: issue.id,
              level: 2,
              reason: `Unresolved ${Math.round(hoursOverdue)}h past deadline. Level 2 CRITICAL escalation to Admin & Supervisor.`,
              notifiedUserId: notifyTarget.id,
              createdAt: now,
            },
          });

          await tx.notification.create({
            data: {
              userId: notifyTarget.id,
              issueId: issue.id,
              message: `[CRITICAL ESCALATION L2] Issue ${issue.publicRef} (${issue.publicLocationLabel}) is ${Math.round(hoursOverdue)}h overdue and raised to CRITICAL.`,
              createdAt: now,
            },
          });
        }

        if (deptSupervisor && adminUser && deptSupervisor.id !== adminUser.id) {
          await tx.notification.create({
            data: {
              userId: deptSupervisor.id,
              issueId: issue.id,
              message: `[CRITICAL ESCALATION L2] Issue ${issue.publicRef} (${issue.publicLocationLabel}) escalated to Admin (${adminUser.email}).`,
              createdAt: now,
            },
          });
        }
      });

      level2Escalations++;
    }
  }

  return {
    checked: nonClosedIssues.length,
    level1Escalations,
    level2Escalations,
    approachingCount,
    timestamp: now.toISOString(),
  };
}

/**
 * Starts the node-cron background schedule (runs every minute: "* * * * *").
 */
export function startDeadlineMonitorCron() {
  console.log(
    "[NagarSetu DeadlineMonitor] Starting node-cron worker (every minute)..."
  );
  const task = cron.schedule("* * * * *", async () => {
    try {
      const summary = await runDeadlineMonitorPass(new Date());
      console.log("[NagarSetu DeadlineMonitor] Tick:", summary);
    } catch (err) {
      console.error("[NagarSetu DeadlineMonitor] Error in cron tick:", err);
    }
  });
  return task;
}

if (require.main === module) {
  const runOnce = process.argv.includes("--once");
  runDeadlineMonitorPass(new Date())
    .then((res) => {
      console.log("[NagarSetu DeadlineMonitor] Initial pass complete:", res);
      if (runOnce) {
        return prisma.$disconnect();
      }
      startDeadlineMonitorCron();
    })
    .catch(async (err) => {
      console.error("[NagarSetu DeadlineMonitor] Fatal error:", err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
