import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { assignIssue } from "@/lib/workflow";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const guard = await requireRole(["OFFICER", "SUPERVISOR", "ADMIN"], {
    action: "ASSIGN_ISSUE_OFFICER",
    entityType: "Issue",
    entityId: id,
  });
  if (!guard.authorized) return guard.response;

  try {
    const body = await req.json();
    const { officerId, reason } = body;

    if (!officerId) {
      return NextResponse.json(
        { ok: false, error: "officerId is required." },
        { status: 400 }
      );
    }

    const effectiveReason =
      typeof reason === "string" && reason.trim().length > 0
        ? reason.trim()
        : "Assigned to department field officer for inspection and resolution";

    const result = await assignIssue(
      id,
      String(officerId),
      guard.user,
      effectiveReason
    );
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          auditEventId: result.auditEventId,
        },
        { status: result.status }
      );
    }

    return NextResponse.json({
      ok: true,
      issue: result.issue,
      auditEventId: result.auditEventId,
    });
  } catch (err) {
    console.error("Assign API error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to assign officer." },
      { status: 500 }
    );
  }
}
