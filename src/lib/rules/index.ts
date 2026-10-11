import { IssuePriority, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { issueEvents } from "@/lib/events";

export const DEMO_RULES_COMMITMENT_LABEL =
  "demonstration rules, not official PMC commitments";

const PRIORITY_RANK: Record<IssuePriority, number> = {
  NORMAL: 1,
  HIGH: 2,
  CRITICAL: 3,
};

export function maxPriority(a: IssuePriority, b: IssuePriority): IssuePriority {
  return PRIORITY_RANK[a] >= PRIORITY_RANK[b] ? a : b;
}

/**
 * Calculates Haversine distance in meters between two GPS coordinates.
 */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "near",
  "in",
  "on",
  "at",
  "to",
  "of",
  "is",
  "are",
  "from",
  "with",
  "pune",
  "road",
  "lane",
  "chowk",
  "please",
  "urgent",
]);

function getTrigrams(text: string): Set<string> {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const trigrams = new Set<string>();
  if (normalized.length < 3) {
    if (normalized.length > 0) trigrams.add(normalized);
    return trigrams;
  }
  for (let i = 0; i <= normalized.length - 3; i++) {
    trigrams.add(normalized.slice(i, i + 3));
  }
  return trigrams;
}

function getWordFrequency(text: string): Map<string, number> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  const freq = new Map<string, number>();
  for (const token of tokens) {
    // Simple stem normalization (strip trailing 's' / 'ing' / 'ed')
    const stem = token
      .replace(/(ing|ed|s)$/, "")
      .trim();
    const key = stem.length >= 3 ? stem : token;
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  return freq;
}

/**
 * Computes combined Trigram Jaccard + TF-IDF / Cosine word similarity in [0, 1].
 */
export function computeDescriptionSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;

  // 1. Trigram Jaccard
  const triA = getTrigrams(a);
  const triB = getTrigrams(b);
  let triIntersection = 0;
  for (const t of triA) {
    if (triB.has(t)) triIntersection++;
  }
  const triUnion = triA.size + triB.size - triIntersection;
  const trigramScore = triUnion > 0 ? triIntersection / triUnion : 0;

  // 2. Token Cosine Similarity
  const freqA = getWordFrequency(a);
  const freqB = getWordFrequency(b);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [k, v] of freqA.entries()) {
    normA += v * v;
    if (freqB.has(k)) {
      dot += v * (freqB.get(k) ?? 0);
    }
  }
  for (const v of freqB.values()) {
    normB += v * v;
  }
  const cosineScore =
    normA > 0 && normB > 0 ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;

  return Math.max(trigramScore, cosineScore, (trigramScore + cosineScore) / 2);
}

/**
 * PART A: Deadline assignment
 * computeDeadlines(categoryId, subcategoryId, severity, submittedAt)
 * Reads the DeadlineRule table and returns responseDeadline and resolutionDeadline.
 * Falls back to subcategory match -> category default -> global default.
 * All values are configurable and labelled "demonstration rules, not official PMC commitments".
 */
export async function computeDeadlines(
  categoryId: string,
  subcategoryId?: string | null,
  severity: string = "STANDARD",
  submittedAt: Date = new Date()
) {
  const rules = await prisma.deadlineRule.findMany({
    where: { categoryId },
    include: { subcategory: true, category: true },
  });

  // 1. Subcategory + severity match
  const exactSubSeverity = subcategoryId
    ? rules.find(
        (r) =>
          r.subcategoryId === subcategoryId &&
          r.severity.toUpperCase() === severity.toUpperCase()
      )
    : undefined;

  // 2. Subcategory match (any severity)
  const subFallback = subcategoryId
    ? rules.find((r) => r.subcategoryId === subcategoryId)
    : undefined;

  // 3. Category default (subcategoryId === null)
  const categorySeverityDefault = rules.find(
    (r) =>
      r.subcategoryId === null &&
      r.severity.toUpperCase() === severity.toUpperCase()
  );
  const categoryDefault = rules.find((r) => r.subcategoryId === null);

  const chosenRule =
    exactSubSeverity ??
    subFallback ??
    categorySeverityDefault ??
    categoryDefault ??
    rules[0];

  // 4. Global default fallback if category has no rules in DB
  const responseHours = chosenRule?.responseHours ?? 12;
  const resolutionHours = chosenRule?.resolutionHours ?? 48;

  const responseDeadline = new Date(
    submittedAt.getTime() + responseHours * 60 * 60 * 1000
  );
  const resolutionDeadline = new Date(
    submittedAt.getTime() + resolutionHours * 60 * 60 * 1000
  );

  const ruleName = chosenRule
    ? chosenRule.subcategory
      ? `DeadlineRule(subcategory:${chosenRule.subcategory.name}, resp=${responseHours}h, res=${resolutionHours}h)`
      : `DeadlineRule(categoryDefault:${chosenRule.category.name}, resp=${responseHours}h, res=${resolutionHours}h)`
    : `DeadlineRule(globalDefault:resp=${responseHours}h, res=${resolutionHours}h)`;

  return {
    responseDeadline,
    resolutionDeadline,
    originalResolutionDeadline: resolutionDeadline,
    responseHours,
    resolutionHours,
    label: DEMO_RULES_COMMITMENT_LABEL,
    ruleApplied: `${ruleName} [${DEMO_RULES_COMMITMENT_LABEL}]`,
  };
}

/**
 * Backwards-compatible wrapper for computeDeadlines
 */
export async function computeDeadlinesForIssue(params: {
  categoryId: string;
  subcategoryId?: string | null;
  severity?: string;
  baseTime?: Date;
}) {
  return computeDeadlines(
    params.categoryId,
    params.subcategoryId ?? null,
    params.severity ?? "STANDARD",
    params.baseTime ?? new Date()
  );
}

/**
 * Pure helper evaluating priority from DB PriorityRule rows without mutating DB.
 */
export async function evaluateIssuePriority(params: {
  currentPriority: IssuePriority;
  reportCount: number;
  resolutionDeadline: Date;
  createdAt?: Date;
  status: string;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const isTerminalOrResolved =
    params.status === "CLOSED" ||
    params.status === "REJECTED" ||
    params.status === "RESOLVED_AWAITING_VERIFICATION";

  const priorityRules = await prisma.priorityRule.findMany({
    orderBy: { threshold: "asc" },
  });

  let deadlinePriority: IssuePriority = "NORMAL";
  let reportCountPriority: IssuePriority = "NORMAL";
  const appliedRules: string[] = [];

  // 1. Report count rules (e.g. 3 -> HIGH, 5 -> CRITICAL)
  const reportRules = priorityRules.filter(
    (r) => r.ruleType === "REPORT_COUNT"
  );
  for (const rule of reportRules) {
    if (params.reportCount >= rule.threshold) {
      reportCountPriority = maxPriority(
        reportCountPriority,
        rule.resultingPriority
      );
      appliedRules.push(
        `PriorityRule(REPORT_COUNT>=${rule.threshold}->${rule.resultingPriority})`
      );
    }
  }

  // 2. Deadline-based rules (OVERDUE_HIGH, OVERDUE_CRITICAL)
  const msOverdue = now.getTime() - params.resolutionDeadline.getTime();
  const isOverdue = !isTerminalOrResolved && msOverdue > 0;

  if (isOverdue) {
    const hoursOverdue = msOverdue / (1000 * 60 * 60);
    const overdueRules = priorityRules.filter(
      (r) =>
        r.ruleType === "OVERDUE_HIGH" || r.ruleType === "OVERDUE_CRITICAL"
    );
    for (const rule of overdueRules) {
      if (hoursOverdue >= rule.threshold) {
        deadlinePriority = maxPriority(
          deadlinePriority,
          rule.resultingPriority
        );
        appliedRules.push(
          `PriorityRule(${rule.ruleType}>=${rule.threshold}h->${rule.resultingPriority})`
        );
      }
    }
  }

  // Approaching deadline: within 20% of total SLA time left (and not yet overdue)
  let isApproachingDeadline = false;
  if (!isTerminalOrResolved && !isOverdue && params.createdAt) {
    const totalWindowMs =
      params.resolutionDeadline.getTime() - params.createdAt.getTime();
    const remainingMs = params.resolutionDeadline.getTime() - now.getTime();
    if (totalWindowMs > 0 && remainingMs > 0) {
      isApproachingDeadline = remainingMs / totalWindowMs <= 0.2;
    }
  }

  // Never lower priority automatically: combine currentPriority, deadlinePriority, reportCountPriority
  const combinedDynamic = maxPriority(deadlinePriority, reportCountPriority);
  const finalPriority = maxPriority(params.currentPriority, combinedDynamic);

  return {
    priority: finalPriority,
    deadlinePriority,
    reportCountPriority,
    isOverdue,
    isApproachingDeadline,
    ruleApplied:
      appliedRules.length > 0
        ? `${appliedRules.join(" + ")} [${DEMO_RULES_COMMITMENT_LABEL}]`
        : null,
  };
}

/**
 * PART C: Priority calculation
 * recalculatePriority(issueId) combining:
 * (1) deadline-based escalation
 * (2) reportCount thresholds from PriorityRules (e.g. 3 linked reports -> HIGH, 5 -> CRITICAL).
 * Final priority = the highest of the two (and never lowers existing priority).
 * Whenever priority changes, writes an AuditEvent with previous priority, new priority, reason, and rule.
 */
export async function recalculatePriority(
  issueId: string,
  options?: {
    now?: Date;
    actorType?: "USER" | "SYSTEM";
    actorId?: string | null;
    actorLabel?: string;
    tx?: Prisma.TransactionClient;
  }
) {
  const db = options?.tx ?? prisma;
  const now = options?.now ?? new Date();

  const issue = await db.issue.findUnique({
    where: { id: issueId },
  });
  if (!issue) {
    throw new Error(`Issue ${issueId} not found for priority recalculation.`);
  }

  const evalResult = await evaluateIssuePriority({
    currentPriority: issue.priority,
    reportCount: issue.reportCount,
    resolutionDeadline: issue.resolutionDeadline,
    createdAt: issue.createdAt,
    status: issue.status,
    now,
  });

  const priorityChanged = evalResult.priority !== issue.priority;
  const overdueChanged =
    evalResult.isOverdue !== issue.isOverdue ||
    evalResult.isApproachingDeadline !== issue.isApproachingDeadline;

  let updatedIssue = issue;
  if (priorityChanged || overdueChanged) {
    updatedIssue = await db.issue.update({
      where: { id: issue.id },
      data: {
        priority: evalResult.priority,
        isOverdue: evalResult.isOverdue,
        isApproachingDeadline: evalResult.isApproachingDeadline,
      },
    });
  }

  if (priorityChanged) {
    const reasonParts: string[] = [];
    if (PRIORITY_RANK[evalResult.reportCountPriority] > PRIORITY_RANK[issue.priority]) {
      reasonParts.push(`linked report count reached ${issue.reportCount}`);
    }
    if (PRIORITY_RANK[evalResult.deadlinePriority] > PRIORITY_RANK[issue.priority]) {
      reasonParts.push(`resolution deadline breached`);
    }

    await db.auditEvent.create({
      data: {
        timestamp: now,
        actorType: options?.actorType ?? "SYSTEM",
        actorId: options?.actorId ?? null,
        actorLabel: options?.actorLabel ?? "system:priority-engine",
        action: "PRIORITY_ESCALATED",
        entityType: "Issue",
        entityId: issue.id,
        oldValue: {
          priority: issue.priority,
          reportCount: issue.reportCount,
          isOverdue: issue.isOverdue,
        },
        newValue: {
          priority: evalResult.priority,
          reportCount: issue.reportCount,
          isOverdue: evalResult.isOverdue,
        },
        reason: `Priority raised from ${issue.priority} to ${evalResult.priority} (${reasonParts.join(" and ") || "dynamic priority rule evaluation"}).`,
        ruleApplied:
          evalResult.ruleApplied ??
          `PriorityRule(${evalResult.priority}) [${DEMO_RULES_COMMITMENT_LABEL}]`,
        outcome: "ACCEPTED",
      },
    });
  }

  return {
    changed: priorityChanged,
    previousPriority: issue.priority,
    newPriority: evalResult.priority,
    isOverdue: evalResult.isOverdue,
    isApproachingDeadline: evalResult.isApproachingDeadline,
    ruleApplied: evalResult.ruleApplied,
    issue: updatedIssue,
  };
}

export interface EvidenceInput {
  filePath: string;
  mimeType?: string;
  sizeBytes?: number;
  caption?: string | null;
  exifLatitude?: number | null;
  exifLongitude?: number | null;
  exifCapturedAt?: string | Date | null;
}

export interface SubmitReportInput {
  categoryId: string;
  subcategoryId?: string | null;
  description: string;
  latitude: number;
  longitude: number;
  publicLocationLabel?: string;
  language?: string;
  evidence?: EvidenceInput | EvidenceInput[] | null;
  idempotencyKey: string;
  overrideDuplicate?: boolean;
  duplicateOption?: "track" | "add_evidence" | "edit" | "submit_as_different_issue";
}

// Bounding box covering Pune & Maharashtra (15.5°N–22.2°N, 72.5°E–81.0°E)
const MAHARASHTRA_BOUNDS = {
  minLat: 15.5,
  maxLat: 22.2,
  minLng: 72.5,
  maxLng: 81.0,
};

const SAME_ISSUE_RADIUS_METERS = 55; // ~50m threshold
const POSSIBLE_DUPLICATE_RADIUS_METERS = 180;
const STRONG_SIMILARITY_THRESHOLD = 0.25;
const MEDIUM_SIMILARITY_THRESHOLD = 0.1;

/**
 * PART D: Submission service with duplicate detection
 * submitReport(input, citizenId) used by BOTH the web form and the chatbot.
 */
export async function submitReport(
  input: SubmitReportInput,
  citizenId: string
) {
  // 1. Validate input
  if (!citizenId || citizenId.trim().length === 0) {
    throw new Error("Authenticated citizenId is required. Anonymous reports are not supported.");
  }

  const description = String(input.description || "").trim();
  if (!input.categoryId || description.length < 5 || description.length > 2000) {
    return {
      ok: false,
      httpStatus: 400,
      status: "VALIDATION_ERROR" as const,
      error:
        "categoryId and a description between 5 and 2000 characters are required.",
    };
  }

  const lat = Number(input.latitude);
  const lng = Number(input.longitude);
  if (
    isNaN(lat) ||
    isNaN(lng) ||
    lat < MAHARASHTRA_BOUNDS.minLat ||
    lat > MAHARASHTRA_BOUNDS.maxLat ||
    lng < MAHARASHTRA_BOUNDS.minLng ||
    lng > MAHARASHTRA_BOUNDS.maxLng
  ) {
    return {
      ok: false,
      httpStatus: 400,
      status: "VALIDATION_ERROR" as const,
      error:
        "Coordinates must be valid GPS coordinates inside the Pune / Maharashtra bounding area.",
    };
  }

  const idempotencyKey = String(input.idempotencyKey || "").trim();
  if (!idempotencyKey) {
    return {
      ok: false,
      httpStatus: 400,
      status: "VALIDATION_ERROR" as const,
      error: "A unique idempotencyKey is required.",
    };
  }

  // 2. Idempotency check (outside & inside transaction)
  const existingByIdempotency = await prisma.report.findUnique({
    where: { idempotencyKey },
    include: {
      evidences: true,
      issue: {
        include: {
          category: true,
          subcategory: true,
          reports: true,
        },
      },
    },
  });

  if (existingByIdempotency) {
    return {
      ok: true,
      httpStatus: 200,
      status: "IDEMPOTENT_REPLAY" as const,
      deduplicatedRequest: true,
      mergedIntoExistingIssue: existingByIdempotency.issue.reportCount > 1,
      referenceId: existingByIdempotency.referenceId,
      report: existingByIdempotency,
      issue: existingByIdempotency.issue,
    };
  }

  const citizen = await prisma.user.findUnique({
    where: { id: citizenId },
  });
  if (!citizen) {
    return {
      ok: false,
      httpStatus: 401,
      status: "UNAUTHORIZED" as const,
      error: "Verified citizen account not found.",
    };
  }

  const evidenceArray: EvidenceInput[] = Array.isArray(input.evidence)
    ? input.evidence
    : input.evidence && input.evidence.filePath
      ? [input.evidence]
      : [];

  const allowOverride =
    input.overrideDuplicate === true ||
    input.duplicateOption === "submit_as_different_issue";

  // Execute steps 3..6 inside a database transaction
  const txResult = await prisma.$transaction(async (tx) => {
    // Re-check idempotency inside transaction to prevent concurrent race conditions
    const raceReport = await tx.report.findUnique({
      where: { idempotencyKey },
      include: {
        evidences: true,
        issue: {
          include: { category: true, subcategory: true, reports: true },
        },
      },
    });
    if (raceReport) {
      return {
        ok: true,
        httpStatus: 200,
        status: "IDEMPOTENT_REPLAY" as const,
        deduplicatedRequest: true,
        mergedIntoExistingIssue: raceReport.issue.reportCount > 1,
        referenceId: raceReport.referenceId,
        report: raceReport,
        issue: raceReport.issue,
      };
    }

    // Fetch active (not CLOSED/REJECTED) issues in the same subcategory (or category if subcategoryId is null)
    const activeIssues = await tx.issue.findMany({
      where: {
        categoryId: input.categoryId,
        ...(input.subcategoryId ? { subcategoryId: input.subcategoryId } : {}),
        status: {
          notIn: ["CLOSED", "REJECTED"],
        },
      },
      include: {
        reports: {
          orderBy: { submittedAt: "asc" },
        },
        category: true,
        subcategory: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // 3. SAME-CITIZEN duplicate check:
    // Same citizen + same subcategory + active issue within ~50m + description similarity above threshold
    for (const candidateIssue of activeIssues) {
      const sameCitizenReport = candidateIssue.reports.find(
        (r) => r.citizenId === citizenId
      );
      if (!sameCitizenReport) continue;

      const distMeters = haversineMeters(
        lat,
        lng,
        candidateIssue.latitude,
        candidateIssue.longitude
      );
      if (distMeters <= SAME_ISSUE_RADIUS_METERS) {
        const sim = computeDescriptionSimilarity(
          description,
          sameCitizenReport.description
        );
        if (sim >= STRONG_SIMILARITY_THRESHOLD) {
          if (!allowOverride) {
            await tx.auditEvent.create({
              data: {
                timestamp: new Date(),
                actorType: "USER",
                actorId: citizen.id,
                actorLabel: `${citizen.role.toLowerCase()}:${citizen.email}`,
                action: "DUPLICATE_WARNING_SAME_CITIZEN",
                entityType: "Issue",
                entityId: candidateIssue.id,
                oldValue: {
                  existingReferenceId: sameCitizenReport.referenceId,
                  distanceMeters: Math.round(distMeters),
                  similarity: Number(sim.toFixed(2)),
                },
                newValue: { description },
                reason: `Same citizen submitted similar active complaint within ${Math.round(distMeters)}m (similarity=${sim.toFixed(2)}). Returned DUPLICATE_WARNING.`,
                ruleApplied: "DuplicateDetection:SameCitizen50mSimilarity",
                outcome: "REFUSED",
              },
            });

            return {
              ok: true,
              httpStatus: 200,
              status: "DUPLICATE_WARNING" as const,
              existingReferenceId: sameCitizenReport.referenceId,
              existingIssueId: candidateIssue.id,
              existingPublicRef: candidateIssue.publicRef,
              distanceMeters: Math.round(distMeters),
              similarityScore: Number(sim.toFixed(2)),
              options: [
                "track",
                "add_evidence",
                "edit",
                "submit_as_different_issue",
              ] as const,
            };
          } else {
            // Citizen explicitly chose submit_as_different_issue
            await tx.auditEvent.create({
              data: {
                timestamp: new Date(),
                actorType: "USER",
                actorId: citizen.id,
                actorLabel: `${citizen.role.toLowerCase()}:${citizen.email}`,
                action: "DUPLICATE_WARNING_OVERRIDDEN",
                entityType: "Issue",
                entityId: candidateIssue.id,
                oldValue: { existingReferenceId: sameCitizenReport.referenceId },
                newValue: { overrideDuplicate: true },
                reason:
                  "Citizen explicitly selected submit_as_different_issue override.",
                ruleApplied: "DuplicateDetection:CitizenOverridePermitted",
                outcome: "ACCEPTED",
              },
            });
          }
        }
      }
    }

    const serverNow = new Date();
    const totalReportsSoFar = await tx.report.count();
    const referenceId = `NS-${serverNow.getFullYear()}-${String(totalReportsSoFar + 1001).padStart(6, "0")}`;

    // 4. DIFFERENT-CITIZEN same-issue check:
    // Other citizens' active issues of the same subcategory within ~50m with strong similarity -> merge into existing Issue!
    let bestStrongMatch: {
      issue: (typeof activeIssues)[number];
      distMeters: number;
      sim: number;
    } | null = null;

    let bestMediumMatch: {
      issue: (typeof activeIssues)[number];
      distMeters: number;
      sim: number;
    } | null = null;

    if (!allowOverride) {
      for (const candidateIssue of activeIssues) {
        const distMeters = haversineMeters(
          lat,
          lng,
          candidateIssue.latitude,
          candidateIssue.longitude
        );
        const primaryDesc = candidateIssue.reports[0]?.description ?? "";
        const sim = computeDescriptionSimilarity(description, primaryDesc);

        if (
          distMeters <= SAME_ISSUE_RADIUS_METERS &&
          sim >= STRONG_SIMILARITY_THRESHOLD
        ) {
          if (!bestStrongMatch || sim > bestStrongMatch.sim) {
            bestStrongMatch = { issue: candidateIssue, distMeters, sim };
          }
        } else if (
          (distMeters <= SAME_ISSUE_RADIUS_METERS &&
            sim >= MEDIUM_SIMILARITY_THRESHOLD) ||
          (distMeters <= POSSIBLE_DUPLICATE_RADIUS_METERS &&
            sim >= STRONG_SIMILARITY_THRESHOLD)
        ) {
          if (!bestMediumMatch || sim > bestMediumMatch.sim) {
            bestMediumMatch = { issue: candidateIssue, distMeters, sim };
          }
        }
      }
    }

    if (bestStrongMatch) {
      const targetIssue = bestStrongMatch.issue;
      const newReportCount = targetIssue.reportCount + 1;

      const createdReport = await tx.report.create({
        data: {
          referenceId,
          issueId: targetIssue.id,
          citizenId: citizen.id,
          description,
          language: input.language || "en",
          latitude: lat,
          longitude: lng,
          submittedAt: serverNow,
          idempotencyKey,
          ...(evidenceArray.length > 0
            ? {
                evidences: {
                  create: evidenceArray.map((ev) => ({
                    filePath: String(ev.filePath),
                    mimeType: String(ev.mimeType || "image/jpeg"),
                    sizeBytes: Number(ev.sizeBytes || 204800),
                    caption: ev.caption ? String(ev.caption) : null,
                    exifLatitude:
                      typeof ev.exifLatitude === "number"
                        ? ev.exifLatitude
                        : null,
                    exifLongitude:
                      typeof ev.exifLongitude === "number"
                        ? ev.exifLongitude
                        : null,
                    exifCapturedAt: ev.exifCapturedAt
                      ? new Date(ev.exifCapturedAt)
                      : null,
                  })),
                },
              }
            : {}),
        },
        include: { evidences: true },
      });

      await tx.issue.update({
        where: { id: targetIssue.id },
        data: {
          reportCount: newReportCount,
        },
      });

      // Recalculate priority inside the transaction (raises priority if reportCount hits 3 or 5 and logs AuditEvent)
      await recalculatePriority(targetIssue.id, {
        now: serverNow,
        actorType: "SYSTEM",
        actorId: citizen.id,
        actorLabel: "system:priority-engine",
        tx,
      });

      const refreshedIssue = await tx.issue.findUniqueOrThrow({
        where: { id: targetIssue.id },
        include: {
          category: true,
          subcategory: true,
          reports: { include: { evidences: true } },
        },
      });

      await tx.auditEvent.create({
        data: {
          timestamp: serverNow,
          actorType: "USER",
          actorId: citizen.id,
          actorLabel: `${citizen.role.toLowerCase()}:${citizen.email}`,
          action: "REPORT_LINKED_TO_EXISTING_ISSUE",
          entityType: "Issue",
          entityId: targetIssue.id,
          oldValue: {
            reportCount: targetIssue.reportCount,
            priority: targetIssue.priority,
          },
          newValue: {
            reportCount: refreshedIssue.reportCount,
            priority: refreshedIssue.priority,
            referenceId,
            distanceMeters: Math.round(bestStrongMatch.distMeters),
            similarityScore: Number(bestStrongMatch.sim.toFixed(2)),
          },
          reason: `Linked citizen report ${referenceId} to existing active issue ${targetIssue.publicRef} (${Math.round(bestStrongMatch.distMeters)}m away, similarity=${bestStrongMatch.sim.toFixed(2)}).`,
          ruleApplied: "DuplicateDetection:DifferentCitizenAutoLink50m",
          outcome: "ACCEPTED",
        },
      });

      return {
        ok: true,
        httpStatus: 201,
        status: "MERGED" as const,
        mergedIntoExistingIssue: true,
        distanceMeters: Math.round(bestStrongMatch.distMeters),
        similarityScore: Number(bestStrongMatch.sim.toFixed(2)),
        referenceId,
        report: createdReport,
        issue: refreshedIssue,
      };
    }

    // 5. Otherwise create a brand new Issue + Report
    const deadlines = await computeDeadlines(
      input.categoryId,
      input.subcategoryId ?? null,
      "STANDARD",
      serverNow
    );

    const totalIssues = await tx.issue.count();
    const publicRef = `PMC-${serverNow.getFullYear()}-${String(totalIssues + 1001).padStart(4, "0")}`;
    const locationLabel =
      input.publicLocationLabel?.trim() ||
      `Pune Municipal Area (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`;

    const newIssue = await tx.issue.create({
      data: {
        publicRef,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId || null,
        status: "SUBMITTED",
        priority: "NORMAL",
        isOverdue: false,
        isApproachingDeadline: false,
        latitude: lat,
        longitude: lng,
        publicLocationLabel: locationLabel,
        responseDeadline: deadlines.responseDeadline,
        resolutionDeadline: deadlines.resolutionDeadline,
        originalResolutionDeadline: deadlines.originalResolutionDeadline,
        reportCount: 1,
        createdAt: serverNow,
        isDemo: false,
        reports: {
          create: {
            referenceId,
            citizenId: citizen.id,
            description,
            language: input.language || "en",
            latitude: lat,
            longitude: lng,
            submittedAt: serverNow,
            idempotencyKey,
            ...(evidenceArray.length > 0
              ? {
                  evidences: {
                    create: evidenceArray.map((ev) => ({
                      filePath: String(ev.filePath),
                      mimeType: String(ev.mimeType || "image/jpeg"),
                      sizeBytes: Number(ev.sizeBytes || 204800),
                      caption: ev.caption ? String(ev.caption) : null,
                      exifLatitude:
                        typeof ev.exifLatitude === "number"
                          ? ev.exifLatitude
                          : null,
                      exifLongitude:
                        typeof ev.exifLongitude === "number"
                          ? ev.exifLongitude
                          : null,
                      exifCapturedAt: ev.exifCapturedAt
                        ? new Date(ev.exifCapturedAt)
                        : null,
                    })),
                  },
                }
              : {}),
          },
        },
      },
      include: {
        category: true,
        subcategory: true,
        reports: { include: { evidences: true } },
      },
    });

    // 6. Write audit events for submission & deadline creation
    await tx.auditEvent.create({
      data: {
        timestamp: serverNow,
        actorType: "USER",
        actorId: citizen.id,
        actorLabel: `${citizen.role.toLowerCase()}:${citizen.email}`,
        action: "REPORT_SUBMITTED",
        entityType: "Issue",
        entityId: newIssue.id,
        oldValue: Prisma.DbNull,
        newValue: {
          publicRef: newIssue.publicRef,
          referenceId,
          status: newIssue.status,
          priority: newIssue.priority,
          responseDeadline: newIssue.responseDeadline,
          resolutionDeadline: newIssue.resolutionDeadline,
        },
        reason: `New Pune municipal grievance submitted at ${locationLabel} with reference ${referenceId}.`,
        ruleApplied: deadlines.ruleApplied,
        outcome: "ACCEPTED",
      },
    });

    // If medium-confidence match existed, queue a DuplicateCandidate for supervisor review
    let duplicateCandidate = null;
    if (bestMediumMatch) {
      duplicateCandidate = await tx.duplicateCandidate.create({
        data: {
          primaryIssueId: bestMediumMatch.issue.id,
          duplicateIssueId: newIssue.id,
          distanceMeters: Math.round(bestMediumMatch.distMeters),
          similarityScore: Number(bestMediumMatch.sim.toFixed(2)),
          status: "PENDING",
        },
      });

      await tx.auditEvent.create({
        data: {
          timestamp: serverNow,
          actorType: "SYSTEM",
          actorId: null,
          actorLabel: "system:duplicate-detector",
          action: "POSSIBLE_DUPLICATE_FLAGGED",
          entityType: "Issue",
          entityId: newIssue.id,
          oldValue: { primaryIssueId: bestMediumMatch.issue.id },
          newValue: {
            duplicateCandidateId: duplicateCandidate.id,
            distanceMeters: duplicateCandidate.distanceMeters,
            similarityScore: duplicateCandidate.similarityScore,
          },
          reason: `Medium-confidence duplicate match with ${bestMediumMatch.issue.publicRef} queued for supervisor review.`,
          ruleApplied: "DuplicateDetection:MediumConfidenceSupervisorReview",
          outcome: "ACCEPTED",
        },
      });
    }

    return {
      ok: true,
      httpStatus: 201,
      status: "CREATED" as const,
      mergedIntoExistingIssue: false,
      possibleDuplicateFlagged: Boolean(duplicateCandidate),
      duplicateCandidateId: duplicateCandidate?.id ?? null,
      referenceId,
      report: newIssue.reports[0],
      issue: newIssue,
    };
  });

  // 7. Emit internal domain event ("issue.created" or "issue.updated")
  if (txResult.ok && "issue" in txResult && txResult.issue) {
    const eventType =
      txResult.status === "MERGED" ? "issue.updated" : "issue.created";
    if (txResult.status === "CREATED" || txResult.status === "MERGED") {
      issueEvents.emitIssueEvent(eventType, {
        issueId: txResult.issue.id,
        publicRef: txResult.issue.publicRef,
        status: txResult.issue.status,
        priority: txResult.issue.priority,
        reportCount: txResult.issue.reportCount,
      });
    }
  }

  return txResult;
}

/**
 * Legacy helper alias for finding open duplicates
 */
export async function findDuplicateOpenIssue(params: {
  categoryId: string;
  subcategoryId?: string | null;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}) {
  const radius = params.radiusMeters ?? SAME_ISSUE_RADIUS_METERS;
  const candidates = await prisma.issue.findMany({
    where: {
      categoryId: params.categoryId,
      ...(params.subcategoryId ? { subcategoryId: params.subcategoryId } : {}),
      status: {
        notIn: ["CLOSED", "REJECTED"],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  for (const candidate of candidates) {
    const dist = haversineMeters(
      params.latitude,
      params.longitude,
      candidate.latitude,
      candidate.longitude
    );
    if (dist <= radius) {
      return { issue: candidate, distanceMeters: Math.round(dist) };
    }
  }

  return null;
}
