import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const guard = await requireRole(["CITIZEN", "ADMIN"], {
    action: "SUBMIT_CITIZEN_SATISFACTION_RATING",
    entityType: "Issue",
    entityId: id,
  });
  if (!guard.authorized) return guard.response;

  try {
    const body = await req.json();
    const { rating, comment } = body;

    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5 || !Number.isInteger(numRating)) {
      return NextResponse.json(
        { ok: false, error: "Rating must be an integer between 1 and 5." },
        { status: 400 }
      );
    }

    const issue = await prisma.issue.findUnique({
      where: { id },
      include: {
        reports: {
          select: { citizenId: true },
        },
      },
    });

    if (!issue) {
      return NextResponse.json(
        { ok: false, error: "Complaint not found." },
        { status: 404 }
      );
    }

    if (issue.status !== "CLOSED" && issue.status !== "RESOLVED_AWAITING_VERIFICATION") {
      return NextResponse.json(
        { ok: false, error: "Satisfaction rating can only be submitted after complaint resolution or closure." },
        { status: 400 }
      );
    }

    // Citizen must be owner of at least one report on this issue, unless admin
    if (guard.user.role === "CITIZEN") {
      const isOwner = issue.reports.some((r) => r.citizenId === guard.user.id);
      if (!isOwner) {
        return NextResponse.json(
          { ok: false, error: "Only the citizen who reported this grievance can rate the resolution." },
          { status: 403 }
        );
      }
    }

    const trimmedComment = typeof comment === "string" ? comment.trim() : null;
    const now = new Date();

    const updated = await prisma.issue.update({
      where: { id },
      data: {
        satisfactionRating: numRating,
        satisfactionComment: trimmedComment,
        ratedAt: now,
      },
    });

    await logAuditEvent({
      actorType: "USER",
      actorId: guard.user.id,
      actorLabel: `${guard.user.role.toLowerCase()}:${guard.user.email}`,
      action: "CITIZEN_SATISFACTION_RATED",
      entityType: "Issue",
      entityId: issue.id,
      oldValue: {
        satisfactionRating: issue.satisfactionRating,
      },
      newValue: {
        satisfactionRating: numRating,
        satisfactionComment: trimmedComment,
      },
      reason: `Citizen submitted resolution satisfaction rating of ${numRating}/5${trimmedComment ? `: "${trimmedComment}"` : ""}.`,
      ruleApplied: "SatisfactionFeedback:PostClosureRating",
      outcome: "ACCEPTED",
    });

    return NextResponse.json({
      ok: true,
      issue: updated,
    });
  } catch (err) {
    console.error("Satisfaction rating error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to submit satisfaction rating." },
      { status: 500 }
    );
  }
}
