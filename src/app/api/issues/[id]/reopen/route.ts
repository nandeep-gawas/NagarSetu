import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { reopenIssue } from "@/lib/workflow";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const guard = await requireRole(["CITIZEN", "SUPERVISOR"], {
    action: "REOPEN_ISSUE",
    entityType: "Issue",
    entityId: id,
  });
  if (!guard.authorized) return guard.response;

  try {
    const body = await req.json().catch(() => ({}));
    const { reason } = body;

    const result = await reopenIssue(id, guard.user, reason);
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
    console.error("Reopen API error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to reopen complaint." },
      { status: 500 }
    );
  }
}
