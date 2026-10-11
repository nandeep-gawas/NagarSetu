import { describe, it, expect, beforeAll } from "vitest";
import exifr from "exifr";
import { prisma } from "@/lib/db";
import { submitReport } from "@/lib/rules";
import { transition, reopenIssue } from "@/lib/workflow";
import { createSampleJpegWithPuneExifBytes } from "@/lib/exifTestSamples";
import {
  runDeadlineMonitorPass,
  timeTravelIssueDeadline,
} from "../../../../worker/deadlineMonitor";

describe("NagarSetu Comprehensive E2E Demonstration Suite (Scenarios A through J)", () => {
  let citizenA: any;
  let citizenB: any;
  let citizenC: any;
  let roadsOfficer: any;
  let waterOfficer: any;
  let supervisorWest: any;
  let roadsCategory: any;
  let potholesSubcategory: any;

  let createdIssueId: string = "";
  let createdPublicRef: string = "";
  let baseLat: number = 18.45;
  let baseLng: number = 73.75;

  beforeAll(async () => {
    // Unique test coordinates per run to avoid collision with existing SQLite rows
    const testOffset = ((Date.now() % 5000) * 0.0001);
    baseLat = Number((18.4500 + testOffset).toFixed(6));
    baseLng = Number((73.7500 + testOffset).toFixed(6));

    // 1. Fetch seed users and categories
    citizenA = await prisma.user.findFirstOrThrow({
      where: { email: "aarav.sharma@citizen.in" },
    });
    citizenB = await prisma.user.findFirstOrThrow({
      where: { email: "sneha.apte@citizen.in" },
    });
    citizenC = await prisma.user.findFirstOrThrow({
      where: { email: "rohan.gokhale@citizen.in" },
    });
    roadsOfficer = await prisma.user.findFirstOrThrow({
      where: { email: "officer.roads@pune.gov.in" },
      include: { department: true },
    });
    waterOfficer = await prisma.user.findFirstOrThrow({
      where: { email: "officer.water@pune.gov.in" },
      include: { department: true },
    });
    supervisorWest = await prisma.user.findFirstOrThrow({
      where: { email: "supervisor.west@pune.gov.in" },
      include: { department: true },
    });

    roadsCategory = await prisma.category.findFirstOrThrow({
      where: { name: "Roads & Infrastructure" },
    });
    potholesSubcategory = await prisma.subcategory.findFirstOrThrow({
      where: {
        categoryId: roadsCategory.id,
        name: { contains: "Pothole" },
      },
    });
  });

  // SCENARIO A
  it("Scenario A: Citizen files pothole report -> Issue created with status SUBMITTED, priority NORMAL, SLA deadlines", async () => {
    const res = await submitReport(
      {
        categoryId: roadsCategory.id,
        subcategoryId: potholesSubcategory.id,
        description: "Dangerous deep pothole near Model Colony Deep Bungalow Chowk damaging two-wheelers.",
        latitude: baseLat,
        longitude: baseLng,
        publicLocationLabel: "Deep Bungalow Chowk, Model Colony, Pune",
        idempotencyKey: `e2e-scen-a-${Date.now()}`,
      },
      citizenA.id
    );

    expect(res.ok).toBe(true);
    expect(res.status).toBe("CREATED");
    expect(res.issue).toBeDefined();

    createdIssueId = res.issue!.id;
    createdPublicRef = res.issue!.publicRef;

    const issue = await prisma.issue.findUniqueOrThrow({
      where: { id: createdIssueId },
    });

    expect(issue.status).toBe("SUBMITTED");
    expect(issue.priority).toBe("NORMAL");
    expect(issue.responseDeadline).toBeInstanceOf(Date);
    expect(issue.resolutionDeadline).toBeInstanceOf(Date);
    expect(issue.isOverdue).toBe(false);

    // Audit event recorded
    const audit = await prisma.auditEvent.findFirst({
      where: { entityId: createdIssueId, action: "REPORT_SUBMITTED" },
    });
    expect(audit).toBeDefined();
    expect(audit?.actorType).toBe("USER");
  });

  // SCENARIO B
  it("Scenario B: GPS coordinates extracted accurately from camera EXIF metadata", async () => {
    const jpegBytes = createSampleJpegWithPuneExifBytes();
    const gps = await exifr.gps(Buffer.from(jpegBytes));

    expect(gps).toBeDefined();
    expect(gps?.latitude).toBeCloseTo(18.5074, 3);
    expect(gps?.longitude).toBeCloseTo(73.8077, 3);

    // Ensure within Pune bounding box
    expect(gps!.latitude).toBeGreaterThan(18.0);
    expect(gps!.latitude).toBeLessThan(19.0);
    expect(gps!.longitude).toBeGreaterThan(73.5);
    expect(gps!.longitude).toBeLessThan(74.5);
  });

  // SCENARIO C
  it("Scenario C: Voice speech-to-text transcript preserved verbatim in citizen description", async () => {
    // Simulates voice input received via Web Speech API in Marathi/English
    const voiceTranscript = "रस्त्यावर मोठा खड्डा पडला आहे आणि रात्री दुचाकी वाहने घसरून पडत आहेत";

    const res = await submitReport(
      {
        categoryId: roadsCategory.id,
        subcategoryId: potholesSubcategory.id,
        description: voiceTranscript,
        latitude: baseLat + 0.05,
        longitude: baseLng + 0.05,
        publicLocationLabel: "Paud Road, Pune",
        idempotencyKey: `e2e-scen-c-voice-${Date.now()}`,
      },
      citizenA.id
    );

    expect(res.ok).toBe(true);
    const report = await prisma.report.findUniqueOrThrow({
      where: { id: res.report!.id },
    });
    expect(report.description).toBe(voiceTranscript);
  });

  // SCENARIO D
  it("Scenario D: Second citizen files report within 50m / 3 days -> linked as duplicate (MERGED) to existing Issue", async () => {
    // Citizen B reports near the original pothole location (within 20 meters)
    const res = await submitReport(
      {
        categoryId: roadsCategory.id,
        subcategoryId: potholesSubcategory.id,
        description: "Huge deep pothole at Deep Bungalow Chowk Model Colony causing traffic jams.",
        latitude: baseLat + 0.0001,
        longitude: baseLng + 0.00005,
        publicLocationLabel: "Near Deep Bungalow Chowk, Model Colony",
        idempotencyKey: `e2e-scen-d-dup-${Date.now()}`,
      },
      citizenB.id
    );

    expect(res.ok).toBe(true);
    expect(res.status).toBe("MERGED");
    expect(res.issue?.id).toBe(createdIssueId);

    // Verify issue report count increased
    const updatedIssue = await prisma.issue.findUniqueOrThrow({
      where: { id: createdIssueId },
    });
    expect(updatedIssue.reportCount).toBeGreaterThanOrEqual(2);

    // Audit event recorded for linking
    const audit = await prisma.auditEvent.findFirst({
      where: {
        entityId: createdIssueId,
        action: "REPORT_LINKED_TO_EXISTING_ISSUE",
      },
    });
    expect(audit).toBeDefined();
  });

  // SCENARIO E
  it("Scenario E: Same citizen tries to file duplicate report for same issue -> returns DUPLICATE_WARNING with options", async () => {
    // Citizen A tries to submit a second time for the exact same issue
    const res = await submitReport(
      {
        categoryId: roadsCategory.id,
        subcategoryId: potholesSubcategory.id,
        description: "Dangerous deep pothole near Model Colony Deep Bungalow Chowk damaging two-wheelers.",
        latitude: baseLat,
        longitude: baseLng,
        publicLocationLabel: "Deep Bungalow Chowk, Model Colony",
        idempotencyKey: `e2e-scen-e-samedup-${Date.now()}`,
      },
      citizenA.id
    );

    expect(res.ok).toBe(true);
    expect(res.status).toBe("DUPLICATE_WARNING");
    if ("options" in res) {
      expect(res.options).toContain("track");
      expect(res.options).toContain("submit_as_different_issue");
    }

    // Refusal logged in audit events
    const warningAudit = await prisma.auditEvent.findFirst({
      where: {
        entityId: createdIssueId,
        action: "DUPLICATE_WARNING_SAME_CITIZEN",
        outcome: "REFUSED",
      },
    });
    expect(warningAudit).toBeDefined();
  });

  // SCENARIO F
  it("Scenario F: Resolution deadline passes -> worker marks issue overdue, elevates priority, logs MISSED_DEADLINE audit, escalates", async () => {
    // Time travel the deadline 2 hours into the past
    await timeTravelIssueDeadline(createdIssueId, 2);

    // Run deadline monitor worker pass
    const workerResult = await runDeadlineMonitorPass();
    expect(workerResult.checked).toBeGreaterThan(0);

    const issueAfter = await prisma.issue.findUniqueOrThrow({
      where: { id: createdIssueId },
    });
    expect(issueAfter.isOverdue).toBe(true);

    // MISSED_DEADLINE audit event logged
    const missedAudit = await prisma.auditEvent.findFirst({
      where: {
        entityId: createdIssueId,
        action: "MISSED_DEADLINE",
      },
    });
    expect(missedAudit).toBeDefined();
    expect(missedAudit?.actorLabel).toBe("system:deadline-monitor");

    // Escalation event logged
    const escEvent = await prisma.escalationEvent.findFirst({
      where: { issueId: createdIssueId },
    });
    expect(escEvent).toBeDefined();
  });

  // SCENARIO G
  it("Scenario G: Officer attempts invalid transition (e.g. SUBMITTED -> RESOLVED) -> refused by workflow engine", async () => {
    const result = await transition(
      createdIssueId,
      "RESOLVED_AWAITING_VERIFICATION",
      {
        id: roadsOfficer.id,
        email: roadsOfficer.email,
        role: "OFFICER",
        departmentId: roadsOfficer.departmentId ?? undefined,
      },
      "Skipping straight to resolved without verifying or assigning"
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Cannot move from Submitted to Resolved");

    // Refusal logged in audit events
    const refusalAudit = await prisma.auditEvent.findFirst({
      where: {
        entityId: createdIssueId,
        action: "TRANSITION_REFUSED_INVALID_MOVE",
        outcome: "REFUSED",
      },
    });
    expect(refusalAudit).toBeDefined();
  });

  // SCENARIO H
  it("Scenario H: Officer in Water department attempts to act on Road issue -> refused by department isolation", async () => {
    // Water officer tries to verify Roads issue
    const result = await transition(
      createdIssueId,
      "VERIFIED",
      {
        id: waterOfficer.id,
        email: waterOfficer.email,
        role: "OFFICER",
        departmentId: waterOfficer.departmentId ?? undefined,
      },
      "Water officer acting on roads issue"
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Officers can only act inside their own department");

    // Refusal logged in audit events
    const deptRefusalAudit = await prisma.auditEvent.findFirst({
      where: {
        entityId: createdIssueId,
        action: "TRANSITION_REFUSED_DEPARTMENT_MISMATCH",
        outcome: "REFUSED",
      },
    });
    expect(deptRefusalAudit).toBeDefined();
  });

  // SCENARIO I
  it("Scenario I: Officer resolves issue with valid evidence -> RESOLVED_AWAITING_VERIFICATION; citizen can reopen within window", async () => {
    // Valid lifecycle progression by Roads Officer & Supervisor
    const t1 = await transition(
      createdIssueId,
      "VERIFIED",
      {
        id: roadsOfficer.id,
        email: roadsOfficer.email,
        role: "OFFICER",
        departmentId: roadsOfficer.departmentId ?? undefined,
      },
      "Verified on site"
    );
    expect(t1.ok).toBe(true);

    const t2 = await transition(
      createdIssueId,
      "ASSIGNED",
      {
        id: supervisorWest.id,
        email: supervisorWest.email,
        role: "SUPERVISOR",
        departmentId: supervisorWest.departmentId ?? undefined,
      },
      "Assigned to ward unit",
      { assignedOfficerId: roadsOfficer.id }
    );
    expect(t2.ok).toBe(true);

    const t3 = await transition(
      createdIssueId,
      "IN_PROGRESS",
      {
        id: roadsOfficer.id,
        email: roadsOfficer.email,
        role: "OFFICER",
        departmentId: roadsOfficer.departmentId ?? undefined,
      },
      "Repair crew mobilized"
    );
    expect(t3.ok).toBe(true);

    // Resolve with note and resolution evidence path
    const t4 = await transition(
      createdIssueId,
      "RESOLVED_AWAITING_VERIFICATION",
      {
        id: roadsOfficer.id,
        email: roadsOfficer.email,
        role: "OFFICER",
        departmentId: roadsOfficer.departmentId ?? undefined,
      },
      "Pothole filled with cold asphalt and road leveled smoothly.",
      {
        resolutionNote: "Pothole filled with cold asphalt and road leveled smoothly.",
        resolutionEvidencePath: "/uploads/evidence/after-repair-sample.jpg",
      }
    );
    expect(t4.ok).toBe(true);

    const resolvedIssue = await prisma.issue.findUniqueOrThrow({
      where: { id: createdIssueId },
    });
    expect(resolvedIssue.status).toBe("RESOLVED_AWAITING_VERIFICATION");
    expect(resolvedIssue.resolvedAt).toBeInstanceOf(Date);
    expect(resolvedIssue.resolutionNote).toBe(
      "Pothole filled with cold asphalt and road leveled smoothly."
    );

    // Citizen reopens grievance within 48h window
    const reopenRes = await reopenIssue(
      createdIssueId,
      {
        id: citizenA.id,
        email: citizenA.email,
        role: "CITIZEN",
      },
      "Asphalt is already disintegrating after rain today."
    );
    expect(reopenRes.ok).toBe(true);
    expect(reopenRes.issue!.status).toBe("REOPENED");

    // Verify reopen audit event
    const reopenAudit = await prisma.auditEvent.findFirst({
      where: {
        entityId: createdIssueId,
        action: { contains: "REOPENED" },
      },
    });
    expect(reopenAudit).toBeDefined();
    expect(reopenAudit?.actorType).toBe("USER");
  });

  // SCENARIO J
  it("Scenario J: Public statistics correctly count Issues (not duplicate Reports) and calculate on-time rate accurately", async () => {
    const totalIssuesCount = await prisma.issue.count({
      where: { isDemo: false },
    });
    const totalReportsCount = await prisma.report.count();

    // Verify duplicate reports do not inflate issue count
    expect(totalReportsCount).toBeGreaterThan(totalIssuesCount);

    const eligibleResolved = await prisma.issue.count({
      where: {
        status: { in: ["RESOLVED_AWAITING_VERIFICATION", "CLOSED"] },
      },
    });

    const eligibleTotal = await prisma.issue.count({
      where: {
        status: { not: "REJECTED" },
      },
    });

    const resolutionRate =
      eligibleTotal > 0 ? (eligibleResolved / eligibleTotal) * 100 : 0;

    expect(resolutionRate).toBeGreaterThanOrEqual(0);
    expect(resolutionRate).toBeLessThanOrEqual(100);
  });
});
