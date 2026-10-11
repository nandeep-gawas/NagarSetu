import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAllowedTransitionsForActor } from "@/lib/workflow";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const user = await getSessionUser();

  const result = await getAllowedTransitionsForActor(id, user);
  if (!result.found) {
    return NextResponse.json(
      { ok: false, error: "Issue not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    issueId: id,
    currentStatus: result.currentStatus,
    allowedTransitions: result.allowedTransitions,
  });
}
