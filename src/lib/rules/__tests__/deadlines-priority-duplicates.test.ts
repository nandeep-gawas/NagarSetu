import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  computeDeadlines,
  recalculatePriority,
  submitReport,
  DEMO_RULES_COMMITMENT_LABEL,
} from "@/lib/rules";
import {
  runDeadlineMonitorPass,
  timeTravelIssueDeadline,
} from "../../../../worker/deadlineMonitor";

describe("NagarSetu Deadlines, Escalation, Dynamic Priority & Duplicate Detection", () => {
  let citizen1: Awaited<ReturnType<typeof prisma.user.findFirstOrThrow>>;
  let citizen2: Awaited<ReturnType<typeof prisma.user.findFirstOrThrow>>;
  let citizen3: Awaited<ReturnType<typeof prisma.user.findFirstOrThrow>>;
  let waterCategory: Awaited<
    ReturnType<typeof prisma.category.findFirstOrThrow>
  >;
  let pipeLeakSubcategory: Awaited<
    ReturnType<typeof prisma.subcategory.findFirstOrThrow>
  >;

  const createdIssueIds: string[] = [];

  beforeAll(async () => {
    const citizens = await prisma.user.findMany({
      where: { role: "CITIZEN" },
      orderBy: { email: "asc" },
      take: 3,
    });
    citizen1 = citizens[0];
    citizen2 = citizens[1];
    citizen3 = citizens[2];

    waterCategory = await prisma.category.findFirstOrThrow({
      where: { name: "Water & Sewage" },
    });
    pipeLeakSubcategory = await prisma.subcategory.findFirstOrThrow({
      where: {
        categoryId: waterCategory.id,
        name: "Major pipe leaks or bursts",
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

  it("PART A: computeDeadlines reads DeadlineRule table with subcategory -> category -> global fallback and demonstration label", async () => {
    const submittedAt = new Date("2026-10-11T08:00:00.000Z");
    const dl = await computeDeadlines(
      waterCategory.id,
      pipeLeakSubcategory.id,
      "HIGH",
      submittedAt
    );

    expect(dl.responseHours).toBe(4);
    expect(dl.resolutionHours).toBe(24);
    expect(dl.responseDeadline.toISOString()).toBe(
      new Date(submittedAt.getTime() + 4 * 3600 * 1000).toISOString()
    );
    expect(dl.resolutionDeadline.toISOString()).toBe(
      new Date(submittedAt.getTime() + 24 * 3600 * 1000).toISOString()
    );
    expect(dl.label).toBe(DEMO_RULES_COMMITMENT_LABEL);
    expect(dl.ruleApplied).toContain(DEMO_RULES_COMMITMENT_LABEL);
  });

  it("PART D.1: three different citizens reporting the same water leak at one location -> one Issue, reportCount 3, three references, priority raised to HIGH", async () => {
    // Use an isolated coordinate in Pune (Aundh riverfront area) so it doesn't collide with seeded issues
    const baseLat = 18.5642;
    const baseLng = 73.8124;
    const suffix = Date.now();

    // Citizen 1 submits initial report
    const res1 = await submitReport(
      {
        categoryId: waterCategory.id,
        subcategoryId: pipeLeakSubcategory.id,
        description:
          "Major water pipeline leak gushing clean drinking water onto Aundh main road near gymkhana",
        latitude: baseLat,
        longitude: baseLng,
        publicLocationLabel: "Aundh Gymkhana Road, Pune",
        idempotencyKey: `water-leak-c1-${suffix}`,
      },
      citizen1.id
    );

    expect(res1.ok).toBe(true);
    expect(res1.status).toBe("CREATED");
    if (!("issue" in res1) || !res1.issue) throw new Error("Expected issue");
    createdIssueIds.push(res1.issue.id);
    expect(res1.issue.reportCount).toBe(1);
    expect(res1.issue.priority).toBe("NORMAL");
    expect(res1.referenceId).toMatch(/^NS-\d{4}-\d{6}$/);

    // Citizen 2 submits ~15m away with similar description
    const res2 = await submitReport(
      {
        categoryId: waterCategory.id,
        subcategoryId: pipeLeakSubcategory.id,
        description:
          "Huge water pipeline burst leaking drinking water on Aundh main road near gymkhana",
        latitude: baseLat + 0.0001, // ~11 meters away
        longitude: baseLng + 0.00005,
        publicLocationLabel: "Aundh Gymkhana Road, Pune",
        idempotencyKey: `water-leak-c2-${suffix}`,
      },
      citizen2.id
    );

    expect(res2.ok).toBe(true);
    expect(res2.status).toBe("MERGED");
    if (!("issue" in res2) || !res2.issue) throw new Error("Expected issue");
    expect(res2.issue.id).toBe(res1.issue.id);
    expect(res2.issue.reportCount).toBe(2);
    expect(res2.referenceId).not.toBe(res1.referenceId);

    // Citizen 3 submits ~20m away with similar description -> triggers reportCount = 3 -> priority raised to HIGH!
    const res3 = await submitReport(
      {
        categoryId: waterCategory.id,
        subcategoryId: pipeLeakSubcategory.id,
        description:
          "Major drinking water pipeline leak flooding Aundh road outside gymkhana",
        latitude: baseLat - 0.0001, // ~11 meters away
        longitude: baseLng - 0.00005,
        publicLocationLabel: "Aundh Gymkhana Road, Pune",
        idempotencyKey: `water-leak-c3-${suffix}`,
      },
      citizen3.id
    );

    expect(res3.ok).toBe(true);
    expect(res3.status).toBe("MERGED");
    if (!("issue" in res3) || !res3.issue) throw new Error("Expected issue");

    // Verify all 3 reports point to the single underlying Issue, reportCount === 3, three distinct referenceIds, priority === HIGH
    expect(res3.issue.id).toBe(res1.issue.id);
    expect(res3.issue.reportCount).toBe(3);
    expect(res3.issue.priority).toBe("HIGH");

    const allReferences = new Set([
      res1.referenceId,
      res2.referenceId,
      res3.referenceId,
    ]);
    expect(allReferences.size).toBe(3);

    // Verify PRIORITY_ESCALATED AuditEvent was written
    const priorityAudit = await prisma.auditEvent.findFirst({
      where: {
        entityId: res1.issue.id,
        action: "PRIORITY_ESCALATED",
        outcome: "ACCEPTED",
      },
    });
    expect(priorityAudit).not.toBeNull();
    expect(priorityAudit?.oldValue).toMatchObject({ priority: "NORMAL" });
    expect(priorityAudit?.newValue).toMatchObject({ priority: "HIGH" });
  });

  it("PART D.2: same citizen submitting twice at the same location -> returns DUPLICATE_WARNING without creating anything", async () => {
    const lat = 18.5812;
    const lng = 73.7712; // Balewadi stadium area
    const suffix = Date.now();

    const first = await submitReport(
      {
        categoryId: waterCategory.id,
        subcategoryId: pipeLeakSubcategory.id,
        description:
          "Water supply main pipe leaking heavily outside Balewadi stadium gate 2",
        latitude: lat,
        longitude: lng,
        publicLocationLabel: "Balewadi Stadium Gate 2, Pune",
        idempotencyKey: `same-cit-1-${suffix}`,
      },
      citizen1.id
    );

    expect(first.status).toBe("CREATED");
    if (!("issue" in first) || !first.issue) throw new Error("Expected issue");
    createdIssueIds.push(first.issue.id);

    const reportsBefore = await prisma.report.count({
      where: { issueId: first.issue.id },
    });

    // Same citizen submits again 10m away with a new idempotencyKey
    const second = await submitReport(
      {
        categoryId: waterCategory.id,
        subcategoryId: pipeLeakSubcategory.id,
        description:
          "Main water supply pipe leaking heavily near Balewadi stadium gate 2",
        latitude: lat + 0.00005,
        longitude: lng + 0.00005,
        publicLocationLabel: "Balewadi Stadium Gate 2, Pune",
        idempotencyKey: `same-cit-2-${suffix}`,
      },
      citizen1.id
    );

    expect(second.status).toBe("DUPLICATE_WARNING");
    if (second.status !== "DUPLICATE_WARNING") {
      throw new Error("Expected DUPLICATE_WARNING");
    }
    expect(second.existingReferenceId).toBe(first.referenceId);
    expect(second.options).toEqual([
      "track",
      "add_evidence",
      "edit",
      "submit_as_different_issue",
    ]);

    const reportsAfter = await prisma.report.count({
      where: { issueId: first.issue.id },
    });
    expect(reportsAfter).toBe(reportsBefore);
  });

  it("PART D.3: same citizen reporting at a different location (> 50m away) -> allowed and creates a separate Issue", async () => {
    const lat1 = 18.4912;
    const lng1 = 73.9312; // Hadapsar Gadital
    const lat2 = 18.4985; // ~800m north
    const lng2 = 73.9312;
    const suffix = Date.now();

    const first = await submitReport(
      {
        categoryId: waterCategory.id,
        subcategoryId: pipeLeakSubcategory.id,
        description:
          "Major water pipe burst flooding the service lane in Hadapsar",
        latitude: lat1,
        longitude: lng1,
        publicLocationLabel: "Hadapsar Gadital South, Pune",
        idempotencyKey: `diff-loc-1-${suffix}`,
      },
      citizen1.id
    );

    expect(first.status).toBe("CREATED");
    if (!("issue" in first) || !first.issue) throw new Error("Expected issue");
    createdIssueIds.push(first.issue.id);

    // Same citizen, same subcategory, similar text, but ~800m away -> MUST be allowed!
    const second = await submitReport(
      {
        categoryId: waterCategory.id,
        subcategoryId: pipeLeakSubcategory.id,
        description:
          "Major water pipe burst flooding the service lane in Hadapsar",
        latitude: lat2,
        longitude: lng2,
        publicLocationLabel: "Hadapsar Gliding Centre North, Pune",
        idempotencyKey: `diff-loc-2-${suffix}`,
      },
      citizen1.id
    );

    expect(second.status).toBe("CREATED");
    if (!("issue" in second) || !second.issue)
      throw new Error("Expected second issue");
    createdIssueIds.push(second.issue.id);
    expect(second.issue.id).not.toBe(first.issue.id);
  });

  it("PART D.4: double-click with the same idempotencyKey -> creates only one record and returns original result", async () => {
    const lat = 18.5445;
    const lng = 73.7654; // Sus Road area
    const sharedKey = `double-click-idem-${Date.now()}`;

    const first = await submitReport(
      {
        categoryId: waterCategory.id,
        subcategoryId: pipeLeakSubcategory.id,
        description:
          "Pipeline valve chamber leaking water onto Sus Road footpath",
        latitude: lat,
        longitude: lng,
        publicLocationLabel: "Sus Road, Pune",
        idempotencyKey: sharedKey,
      },
      citizen2.id
    );

    expect(first.status).toBe("CREATED");
    if (!("issue" in first) || !first.issue || !first.report)
      throw new Error("Expected issue & report");
    createdIssueIds.push(first.issue.id);

    // Second call with identical idempotencyKey
    const second = await submitReport(
      {
        categoryId: waterCategory.id,
        subcategoryId: pipeLeakSubcategory.id,
        description:
          "Pipeline valve chamber leaking water onto Sus Road footpath",
        latitude: lat,
        longitude: lng,
        publicLocationLabel: "Sus Road, Pune",
        idempotencyKey: sharedKey,
      },
      citizen2.id
    );

    expect(second.status).toBe("IDEMPOTENT_REPLAY");
    if (!("report" in second) || !second.report || !second.issue)
      throw new Error("Expected replay report");
    expect(second.report.id).toBe(first.report.id);
    expect(second.issue.id).toBe(first.issue.id);
    expect(second.referenceId).toBe(first.referenceId);

    const matchingReports = await prisma.report.count({
      where: { idempotencyKey: sharedKey },
    });
    expect(matchingReports).toBe(1);
  });

  it("PART B & C: overdue issue -> priority raised NORMAL->HIGH, MISSED_DEADLINE & escalation recorded once (idempotent on re-run)", async () => {
    const lat = 18.5733;
    const lng = 73.8811; // Tingre Nagar area
    const suffix = Date.now();

    const submitted = await submitReport(
      {
        categoryId: waterCategory.id,
        subcategoryId: pipeLeakSubcategory.id,
        description:
          "Broken feeder water pipe leaking near Tingre Nagar Lane 4",
        latitude: lat,
        longitude: lng,
        publicLocationLabel: "Tingre Nagar Lane 4, Pune",
        idempotencyKey: `overdue-test-${suffix}`,
      },
      citizen3.id
    );

    expect(submitted.status).toBe("CREATED");
    if (!("issue" in submitted) || !submitted.issue)
      throw new Error("Expected created issue");
    const issueId = submitted.issue.id;
    createdIssueIds.push(issueId);

    expect(submitted.issue.priority).toBe("NORMAL");
    expect(submitted.issue.isOverdue).toBe(false);

    // Time-travel issue's deadline 3 hours into the past (Scenario G helper)
    await timeTravelIssueDeadline(issueId, 3);

    // Run deadline monitor pass #1
    await runDeadlineMonitorPass(new Date());

    const afterPass1 = await prisma.issue.findUniqueOrThrow({
      where: { id: issueId },
      include: { escalationEvents: true },
    });

    expect(afterPass1.isOverdue).toBe(true);
    expect(afterPass1.priority).toBe("HIGH");
    expect(afterPass1.escalationEvents).toHaveLength(1);
    expect(afterPass1.escalationEvents[0].level).toBe(1);

    const missedAuditsPass1 = await prisma.auditEvent.findMany({
      where: {
        entityId: issueId,
        action: "MISSED_DEADLINE",
        actorType: "SYSTEM",
        actorLabel: "system:deadline-monitor",
      },
    });
    expect(missedAuditsPass1).toHaveLength(1);
    expect(missedAuditsPass1[0].ruleApplied).toContain(
      DEMO_RULES_COMMITMENT_LABEL
    );

    // Run deadline monitor pass #2 immediately -> must be IDEMPOTENT (never escalates twice for same threshold)
    await runDeadlineMonitorPass(new Date());

    const escalationsPass2 = await prisma.escalationEvent.count({
      where: { issueId, level: 1 },
    });
    const missedAuditsPass2 = await prisma.auditEvent.count({
      where: { entityId: issueId, action: "MISSED_DEADLINE" },
    });

    expect(escalationsPass2).toBe(1);
    expect(missedAuditsPass2).toBe(1);

    // Now time-travel deadline 26 hours into the past -> triggers Level 2 escalation (HIGH -> CRITICAL)
    await timeTravelIssueDeadline(issueId, 26);
    await runDeadlineMonitorPass(new Date());

    const afterLevel2 = await prisma.issue.findUniqueOrThrow({
      where: { id: issueId },
      include: { escalationEvents: true },
    });
    expect(afterLevel2.priority).toBe("CRITICAL");
    expect(afterLevel2.escalationEvents).toHaveLength(2);

    // Verify recalculatePriority never lowers priority even if deadline is extended into the future
    await prisma.issue.update({
      where: { id: issueId },
      data: {
        resolutionDeadline: new Date(Date.now() + 48 * 3600 * 1000),
      },
    });
    const recalcAfterExtension = await recalculatePriority(issueId);
    expect(recalcAfterExtension.newPriority).toBe("CRITICAL");
  });
});
