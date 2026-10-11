import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { transition } from "@/lib/workflow";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const guard = await requireRole(
    ["CITIZEN", "OFFICER", "SUPERVISOR", "ADMIN"],
    {
      action: "ISSUE_WORKFLOW_TRANSITION",
      entityType: "Issue",
      entityId: id,
    }
  );
  if (!guard.authorized) return guard.response;

  try {
    const body = await req.json();
    const {
      toState,
      reason,
      assignedOfficerId,
      resolutionNote,
      resolutionEvidencePath,
    } = body;

    if (!toState) {
      return NextResponse.json(
        { ok: false, error: "Target workflow state (toState) is required." },
        { status: 400 }
      );
    }

    const result = await transition(id, toState, guard.user, reason ?? null, {
      assignedOfficerId: assignedOfficerId ?? null,
      resolutionNote: resolutionNote ?? null,
      resolutionEvidencePath: resolutionEvidencePath ?? null,
    });

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
    console.error("Transition API error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to execute workflow transition." },
      { status: 500 }
    );
  }
}
