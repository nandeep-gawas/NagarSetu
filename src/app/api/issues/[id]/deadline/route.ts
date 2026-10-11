import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { changeIssueDeadline } from "@/lib/workflow";

async function handleDeadlineChange(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requireRole(["SUPERVISOR", "ADMIN"], {
    action: "UPDATE_ISSUE_DEADLINE",
    entityType: "Issue",
    entityId: id,
  });
  if (!guard.authorized) return guard.response;

  try {
    const body = await req.json();
    const { newDeadline, reason } = body;

    if (!newDeadline || !reason) {
      return NextResponse.json(
        {
          ok: false,
          error: "newDeadline and a non-empty reason are required.",
        },
        { status: 400 }
      );
    }

    const result = await changeIssueDeadline(
      id,
      newDeadline,
      guard.user,
      reason
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
      deadlineChange: result.deadlineChange,
      issue: result.issue,
      auditEventId: result.auditEventId,
    });
  } catch (err) {
    console.error("Update deadline error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to update issue deadline." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleDeadlineChange(req, context);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleDeadlineChange(req, context);
}
