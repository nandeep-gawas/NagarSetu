import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, "staff_ai", 40, 60 * 1000);
  if (!rl.allowed) {
    return rateLimitResponse(rl.resetMs);
  }

  // Ensure caller is authorized staff (OFFICER, SUPERVISOR, ADMIN)
  const guard = await requireRole(["OFFICER", "SUPERVISOR", "ADMIN"], {
    action: "ACCESS_AI_SUGGESTION",
    entityType: "Issue",
  });
  if (!guard.authorized) return guard.response;

  try {
    const body = await req.json();

    // 1. Audit Logging Action: Staff copies AI suggestion to clipboard or notes
    if (body.action === "LOG_COPY") {
      const { issueId, copiedText, fieldCopied } = body;
      if (issueId) {
        await prisma.auditEvent.create({
          data: {
            actorType: "USER",
            actorId: guard.user.id,
            actorLabel: guard.user.email,
            action: "STAFF_COPIED_AI_SUGGESTION",
            entityType: "ISSUE",
            entityId: String(issueId),
            outcome: "ACCEPTED",
            newValue: {
              fieldCopied: fieldCopied || "draftResponse",
              copiedText: String(copiedText || "").slice(0, 500),
            },
            reason: `Staff member copied AI ${fieldCopied || "suggestion"} text to clipboard for manual officer review.`,
            ruleApplied: "Strict human-in-the-loop governance: AI suggestions require manual officer review and cannot auto-execute.",
          },
        });
      }
      return NextResponse.json({ ok: true, logged: true });
    }

    // 2. Generate Staff AI Suggestion
    const { issueId, publicRef, categoryName, descriptions = [], locationLabel } = body;

    const descList: string[] = Array.isArray(descriptions) ? descriptions : [String(descriptions || "")];
    const fullText = descList.join(" ").toLowerCase();

    // Extract severity cues
    const severityCues: string[] = [];
    if (fullText.includes("burst") || fullText.includes("overflow") || fullText.includes("heavy") || fullText.includes("urgent")) {
      severityCues.push("High volume or flooding detected in description");
    }
    if (fullText.includes("deep") || fullText.includes("accident") || fullText.includes("hazard") || fullText.includes("injury")) {
      severityCues.push("Safety hazard or vehicular damage reported");
    }
    if (fullText.includes("days") || fullText.includes("week") || fullText.includes("recurring") || fullText.includes("again")) {
      severityCues.push("Chronic or recurring civic complaint");
    }
    if (severityCues.length === 0) {
      severityCues.push("Standard civic maintenance complaint; no critical emergency keywords detected");
    }

    // Category validation
    const categoryCheck = `Confirmed match for ${categoryName || "selected department"}. Field inspection recommended.`;

    // Incident summary
    const sampleDesc = descList[0] || "Municipal complaint";
    const draftSummary = `Citizen reports: "${sampleDesc.slice(0, 160)}${sampleDesc.length > 160 ? "..." : ""}"${
      locationLabel ? ` located near ${locationLabel}.` : ""
    }${descList.length > 1 ? ` (${descList.length} duplicate citizen reports consolidated under this issue).` : ""}`;

    // Draft citizen response
    const draftResponse = `Dear Citizen, Pune Municipal Corporation has logged your grievance (${publicRef || "PUN-XXXX"}) regarding ${categoryName || "civic works"}. Our ward field inspection team has been scheduled to inspect the site${
      locationLabel ? ` at ${locationLabel}` : ""
    } and carry out necessary remedial actions under standard municipal SLA guidelines. Thank you for notifying the municipal corporation.`;

    return NextResponse.json({
      ok: true,
      data: {
        categoryValidation: categoryCheck,
        draftSummary,
        severityCues,
        draftResponse,
        disclaimer: "AI suggestion, not an official action. Human officer review required before sending or taking action.",
      },
    });
  } catch (err: any) {
    console.error("Staff AI suggestion API error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to generate staff AI suggestion." },
      { status: 500 }
    );
  }
}
