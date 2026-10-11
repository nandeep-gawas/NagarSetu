import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  transition,
  assignIssue,
  reopenIssue,
  changeIssueDeadline,
} from "@/lib/workflow";
import {
  PUT as auditCollectionPut,
  PATCH as auditCollectionPatch,
  DELETE as auditCollectionDelete,
  POST as auditCollectionPost,
} from "@/app/api/audit/route";
import {
  PUT as auditItemPut,
  PATCH as auditItemPatch,
  DELETE as auditItemDelete,
} from "@/app/api/audit/[id]/route";

describe("NagarSetu Server-Enforced Workflow Engine (G-02 GovFix)", () => {
  let citizenUser: Awaited<ReturnType<typeof prisma.user.findFirstOrThrow>>;
  let otherCitizenUser: Awaited<ReturnType<typeof prisma.user.findFirstOrThrow>>;
  let roadsOfficer: Awaited<ReturnType<typeof prisma.user.findFirstOrThrow>>;
  let wasteOfficer: Awaited<ReturnType<typeof prisma.user.findFirstOrThrow>>;
  let supervisorUser: Awaited<ReturnType<typeof prisma.user.findFirstOrThrow>>;
  let roadsCategory: Awaited<ReturnType<typeof prisma.category.findFirstOrThrow>>;
  let potholesSubcategory: Awaited<
    ReturnType<typeof prisma.subcategory.findFirstOrThrow>
  >;

  const createdIssueIds: string[] = [];

  async function createTestIssue(status: "SUBMITTED" | "VERIFIED" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED_AWAITING_VERIFICATION" = "SUBMITTED", resolvedAt?: Date) {
    const now = new Date();
    const origDeadline = new Date(now.getTime() + 72 * 3600 * 1000);
    const refSuffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const issue = await prisma.issue.create({
      data: {
        publicRef: `PMC-TEST-${refSuffix}`,
        categoryId: roadsCategory.id,
        subcategoryId: potholesSubcategory.id,
        status,
        priority: "NORMAL",
        isOverdue: false,
        latitude: 18.5074,
        longitude: 73.8077,
        publicLocationLabel: "Test Chowk, Kothrud, Pune",
        responseDeadline: new Date(now.getTime() + 12 * 3600 * 1000),
        resolutionDeadline: origDeadline,
        originalResolutionDeadline: origDeadline,
        reportCount: 1,
        resolvedAt: resolvedAt ?? null,
        isDemo: true,
        reports: {
          create: {
            referenceId: `RPT-TEST-${refSuffix}`,
            citizenId: citizenUser.id,
            description: "Automated test pothole complaint in Kothrud",
            language: "en",
            latitude: 18.5074,
            longitude: 73.8077,
            submittedAt: now,
            idempotencyKey: `idem-test-${refSuffix}`,
          },
        },
      },
    });
    createdIssueIds.push(issue.id);
    return issue;
  }

  beforeAll(async () => {
    // Ensure WorkflowTransition for RESOLVED_AWAITING_VERIFICATION -> CLOSED is SUPERVISOR only
    await prisma.workflowTransition.updateMany({
      where: {
        fromState: "RESOLVED_AWAITING_VERIFICATION",
        toState: "CLOSED",
      },
      data: {
        allowedRoles: ["SUPERVISOR"],
      },
    });

    citizenUser = await prisma.user.findFirstOrThrow({
      where: { email: "aarav.sharma@citizen.in" },
    });
    otherCitizenUser = await prisma.user.findFirstOrThrow({
      where: { email: "sneha.apte@citizen.in" },
    });
    roadsOfficer = await prisma.user.findFirstOrThrow({
      where: { email: "officer.roads@pune.gov.in" },
      include: { department: true },
    });
    wasteOfficer = await prisma.user.findFirstOrThrow({
      where: { email: "officer.waste@pune.gov.in" },
      include: { department: true },
    });
    supervisorUser = await prisma.user.findFirstOrThrow({
      where: { email: "supervisor.west@pune.gov.in" },
    });
    roadsCategory = await prisma.category.findFirstOrThrow({
      where: { name: "Roads & Infrastructure" },
    });
    potholesSubcategory = await prisma.subcategory.findFirstOrThrow({
      where: {
        categoryId: roadsCategory.id,
        name: "Potholes or damaged roads",
      },
    });
  });

  afterAll(async () => {
    if (createdIssueIds.length > 0) {
      await prisma.issue.deleteMany({
        where: { id: { in: createdIssueIds } },
      });
    }
    await prisma.$disconnect();
  });

  it("1. refuses when a citizen tries to set IN_PROGRESS, CLOSED, or ASSIGNED (403 + REFUSED AuditEvent)", async () => {
    const issue = await createTestIssue("ASSIGNED");

    // Citizen attempts IN_PROGRESS
    const resInProgress = await transition(
      issue.id,
      "IN_PROGRESS",
      citizenUser
    );
    expect(resInProgress.ok).toBe(false);
    expect(resInProgress.status).toBe(403);
    expect(resInProgress.error).toBe(
      "Citizens are not permitted to change a complaint to In Progress."
    );

    const auditInProgress = await prisma.auditEvent.findUniqueOrThrow({
      where: { id: resInProgress.auditEventId },
    });
    expect(auditInProgress.outcome).toBe("REFUSED");
    expect(auditInProgress.entityId).toBe(issue.id);

    // Citizen raw tampering: attempts CLOSED
    const resClosed = await transition(issue.id, "CLOSED", citizenUser);
    expect(resClosed.ok).toBe(false);
    expect(resClosed.status).toBe(403);
    expect(resClosed.error).toBe(
      "Citizens are not permitted to change a complaint to Closed."
    );
    const auditClosed = await prisma.auditEvent.findUniqueOrThrow({
      where: { id: resClosed.auditEventId },
    });
    expect(auditClosed.outcome).toBe("REFUSED");

    // Citizen raw tampering: attempts ASSIGNED
    const resAssigned = await transition(issue.id, "ASSIGNED", citizenUser);
    expect(resAssigned.ok).toBe(false);
    expect(resAssigned.status).toBe(403);
    expect(resAssigned.error).toBe(
      "Citizens are not permitted to change a complaint to Assigned."
    );
    const auditAssigned = await prisma.auditEvent.findUniqueOrThrow({
      where: { id: resAssigned.auditEventId },
    });
    expect(auditAssigned.outcome).toBe("REFUSED");

    // Verify issue status did not change
    const unchanged = await prisma.issue.findUniqueOrThrow({
      where: { id: issue.id },
    });
    expect(unchanged.status).toBe("ASSIGNED");
  });

  it("2. refuses when an officer tries to skip ASSIGNED/IN_PROGRESS and jump directly to RESOLVED (refused + logged)", async () => {
    const issue = await createTestIssue("SUBMITTED");

    const res = await transition(issue.id, "RESOLVED", roadsOfficer);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
    expect(res.error).toBe(
      "Cannot move from Submitted to Resolved: a complaint must be Verified, Assigned and In Progress first."
    );

    const audit = await prisma.auditEvent.findUniqueOrThrow({
      where: { id: res.auditEventId },
    });
    expect(audit.outcome).toBe("REFUSED");
    expect(audit.entityId).toBe(issue.id);

    const unchanged = await prisma.issue.findUniqueOrThrow({
      where: { id: issue.id },
    });
    expect(unchanged.status).toBe("SUBMITTED");
  });

  it("3. refuses when an officer from another department attempts to transition or be assigned to an issue", async () => {
    const roadsIssue = await createTestIssue("SUBMITTED");

    // Waste officer attempts to verify a Roads & Infrastructure issue
    const res = await transition(roadsIssue.id, "VERIFIED", wasteOfficer);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
    expect(res.error).toContain(
      "Officers can only act inside their own department"
    );

    const audit = await prisma.auditEvent.findUniqueOrThrow({
      where: { id: res.auditEventId },
    });
    expect(audit.outcome).toBe("REFUSED");

    // Supervisor attempts to assign Waste Officer to Roads issue
    const assignRes = await assignIssue(
      roadsIssue.id,
      wasteOfficer.id,
      supervisorUser,
      "Attempting cross-department officer assignment"
    );
    expect(assignRes.ok).toBe(false);
    expect(assignRes.status).toBe(403);

    const assignAudit = await prisma.auditEvent.findUniqueOrThrow({
      where: { id: assignRes.auditEventId },
    });
    expect(assignAudit.outcome).toBe("REFUSED");
  });

  it("4. executes the valid full path SUBMITTED → VERIFIED → ASSIGNED → IN_PROGRESS → RESOLVED_AWAITING_VERIFICATION → CLOSED and creates 5 ACCEPTED audit rows", async () => {
    const issue = await createTestIssue("SUBMITTED");

    // 1. SUBMITTED -> VERIFIED (Officer in same department)
    const step1 = await transition(
      issue.id,
      "VERIFIED",
      roadsOfficer,
      "Verified pothole depth on Paud Road"
    );
    expect(step1.ok).toBe(true);
    expect(step1.issue?.status).toBe("VERIFIED");

    // 2. VERIFIED -> ASSIGNED (Supervisor)
    const step2 = await transition(
      issue.id,
      "ASSIGNED",
      supervisorUser,
      "Assigned to Roads Officer Priya Joshi",
      { assignedOfficerId: roadsOfficer.id }
    );
    expect(step2.ok).toBe(true);
    expect(step2.issue?.status).toBe("ASSIGNED");
    expect(step2.issue?.assignedOfficerId).toBe(roadsOfficer.id);

    // 3. ASSIGNED -> IN_PROGRESS (Officer)
    const step3 = await transition(
      issue.id,
      "IN_PROGRESS",
      roadsOfficer,
      "Hot-mix asphalt crew dispatched to site"
    );
    expect(step3.ok).toBe(true);
    expect(step3.issue?.status).toBe("IN_PROGRESS");

    // 4. IN_PROGRESS -> RESOLVED_AWAITING_VERIFICATION (Officer)
    const step4 = await transition(
      issue.id,
      "RESOLVED_AWAITING_VERIFICATION",
      roadsOfficer,
      "Pothole filled, leveled, and compacted"
    );
    expect(step4.ok).toBe(true);
    expect(step4.issue?.status).toBe("RESOLVED_AWAITING_VERIFICATION");
    expect(step4.issue?.resolvedAt).not.toBeNull();

    // 5. RESOLVED_AWAITING_VERIFICATION -> CLOSED (Supervisor)
    const step5 = await transition(
      issue.id,
      "CLOSED",
      supervisorUser,
      "Verified resurfacing quality and closed complaint"
    );
    expect(step5.ok).toBe(true);
    expect(step5.issue?.status).toBe("CLOSED");
    expect(step5.issue?.closedAt).not.toBeNull();

    // Confirm exactly 5 ACCEPTED AuditEvent rows exist for this issue
    const acceptedAudits = await prisma.auditEvent.findMany({
      where: {
        entityType: "Issue",
        entityId: issue.id,
        outcome: "ACCEPTED",
      },
      orderBy: { timestamp: "asc" },
    });

    expect(acceptedAudits).toHaveLength(5);
    expect(acceptedAudits.map((a) => a.action)).toEqual([
      "WORKFLOW_TRANSITION_SUBMITTED_TO_VERIFIED",
      "WORKFLOW_TRANSITION_VERIFIED_TO_ASSIGNED",
      "WORKFLOW_TRANSITION_ASSIGNED_TO_IN_PROGRESS",
      "WORKFLOW_TRANSITION_IN_PROGRESS_TO_RESOLVED_AWAITING_VERIFICATION",
      "WORKFLOW_TRANSITION_RESOLVED_AWAITING_VERIFICATION_TO_CLOSED",
    ]);
  });

  it("5. refuses reopen after the 7-day post-resolution window expires (and refuses citizens who do not own a report)", async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 3600 * 1000);
    const expiredIssue = await createTestIssue(
      "RESOLVED_AWAITING_VERIFICATION",
      eightDaysAgo
    );

    // Attempt reopen after 8 days (window is 7 days)
    const expiredRes = await reopenIssue(
      expiredIssue.id,
      citizenUser,
      "Pothole opened up again",
      { windowDays: 7 }
    );
    expect(expiredRes.ok).toBe(false);
    expect(expiredRes.status).toBe(400);
    expect(expiredRes.error).toContain("7-day reopen window after resolution has expired");

    const expAudit = await prisma.auditEvent.findUniqueOrThrow({
      where: { id: expiredRes.auditEventId },
    });
    expect(expAudit.outcome).toBe("REFUSED");

    // Verify a recent resolution (2 days ago) CAN be reopened by the reporting citizen, but NOT by an unrelated citizen
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    const recentIssue = await createTestIssue(
      "RESOLVED_AWAITING_VERIFICATION",
      twoDaysAgo
    );

    const wrongCitizenRes = await reopenIssue(
      recentIssue.id,
      otherCitizenUser,
      "Trying to reopen someone else's complaint"
    );
    expect(wrongCitizenRes.ok).toBe(false);
    expect(wrongCitizenRes.status).toBe(403);

    const validReopenRes = await reopenIssue(
      recentIssue.id,
      citizenUser,
      "Patchwork settled unevenly after rain"
    );
    expect(validReopenRes.ok).toBe(true);
    expect(validReopenRes.issue?.status).toBe("REOPENED");
  });

  it("6. deadline change keeps originalResolutionDeadline, preserves earlier escalations, saves DeadlineChange, and logs reason", async () => {
    const issue = await createTestIssue("IN_PROGRESS");
    const initialOriginalDeadline = issue.originalResolutionDeadline;
    const initialResolutionDeadline = issue.resolutionDeadline;

    // Seed an earlier EscalationEvent on this issue to prove it is never deleted
    const escalation = await prisma.escalationEvent.create({
      data: {
        issueId: issue.id,
        level: 1,
        reason: "Initial SLA warning before extension",
        notifiedUserId: supervisorUser.id,
      },
    });

    const extendedDeadline = new Date(
      initialResolutionDeadline.getTime() + 48 * 3600 * 1000
    );
    const reason =
      "Heavy monsoon waterlogging required hot-mix plant mobilization";

    const res = await changeIssueDeadline(
      issue.id,
      extendedDeadline,
      supervisorUser,
      reason
    );

    expect(res.ok).toBe(true);
    expect(res.issue?.resolutionDeadline.toISOString()).toBe(
      extendedDeadline.toISOString()
    );
    // Original resolution deadline MUST remain strictly unchanged
    expect(res.issue?.originalResolutionDeadline.toISOString()).toBe(
      initialOriginalDeadline.toISOString()
    );

    // Check DeadlineChange record
    const dcRows = await prisma.deadlineChange.findMany({
      where: { issueId: issue.id },
    });
    expect(dcRows).toHaveLength(1);
    expect(dcRows[0].oldDeadline.toISOString()).toBe(
      initialResolutionDeadline.toISOString()
    );
    expect(dcRows[0].newDeadline.toISOString()).toBe(
      extendedDeadline.toISOString()
    );
    expect(dcRows[0].reason).toBe(reason);

    // Check EscalationEvent was preserved
    const preservedEscalation = await prisma.escalationEvent.findUnique({
      where: { id: escalation.id },
    });
    expect(preservedEscalation).not.toBeNull();

    // Check AuditEvent
    const audit = await prisma.auditEvent.findUniqueOrThrow({
      where: { id: res.auditEventId },
    });
    expect(audit.outcome).toBe("ACCEPTED");
    expect(audit.reason).toBe(reason);
  });

  it("7. prevents updating or deleting AuditEvent rows through any API route", async () => {
    const sampleAudit = await prisma.auditEvent.findFirstOrThrow();

    const putCollectionRes = await auditCollectionPut();
    const patchCollectionRes = await auditCollectionPatch();
    const deleteCollectionRes = await auditCollectionDelete();
    const postCollectionRes = await auditCollectionPost();

    expect(putCollectionRes.status).toBe(403);
    expect(patchCollectionRes.status).toBe(403);
    expect(deleteCollectionRes.status).toBe(403);
    expect(postCollectionRes.status).toBe(403);

    const dummyReq = new NextRequest(
      `http://localhost:3000/api/audit/${sampleAudit.id}`,
      { method: "DELETE" }
    );
    const context = { params: Promise.resolve({ id: sampleAudit.id }) };

    const putItemRes = await auditItemPut(dummyReq, context);
    const patchItemRes = await auditItemPatch(dummyReq, context);
    const deleteItemRes = await auditItemDelete(dummyReq, context);

    expect(putItemRes.status).toBe(403);
    expect(patchItemRes.status).toBe(403);
    expect(deleteItemRes.status).toBe(403);

    // Verify original AuditEvent row still exists and is untouched
    const stillExists = await prisma.auditEvent.findUnique({
      where: { id: sampleAudit.id },
    });
    expect(stillExists).not.toBeNull();
    expect(stillExists?.action).toBe(sampleAudit.action);
    expect(stillExists?.outcome).toBe(sampleAudit.outcome);
  });

  it("8. enforces the AI Separation Rule: refuses any AI actor and proves no AI code path calls transition()", async () => {
    const issue = await createTestIssue("SUBMITTED");

    const aiActor = {
      id: "ai:classifier-v1",
      email: "ai:triage@pune.gov.in",
      role: "AI",
      actorType: "AI",
      isAi: true,
    };

    const aiTransitionRes = await transition(issue.id, "VERIFIED", aiActor);
    expect(aiTransitionRes.ok).toBe(false);
    expect(aiTransitionRes.status).toBe(403);
    expect(aiTransitionRes.error).toContain("AI Separation Rule Violation");

    const aiAssignRes = await assignIssue(
      issue.id,
      roadsOfficer.id,
      aiActor,
      "AI auto-assign"
    );
    expect(aiAssignRes.ok).toBe(false);
    expect(aiAssignRes.status).toBe(403);

    const aiDeadlineRes = await changeIssueDeadline(
      issue.id,
      new Date(),
      aiActor,
      "AI deadline change"
    );
    expect(aiDeadlineRes.ok).toBe(false);
    expect(aiDeadlineRes.status).toBe(403);

    // Static verification: scan all application source files outside __tests__ to prove no AI module calls transition()
    const srcDir = path.resolve(process.cwd(), "src");
    const collectFiles = (dir: string): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "__tests__") {
            files.push(...collectFiles(fullPath));
          }
        } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
          files.push(fullPath);
        }
      }
      return files;
    };

    const allSourceFiles = collectFiles(srcDir);
    for (const file of allSourceFiles) {
      const content = fs.readFileSync(file, "utf-8");
      // No AI SDK (e.g. @google/genai, openai) may import or invoke transition()
      const importsAiSdk =
        content.includes("@google/genai") || content.includes("openai");
      const callsTransition = content.includes("transition(");
      expect(importsAiSdk && callsTransition).toBe(false);
    }
  });
});
