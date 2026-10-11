import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { submitReport } from "@/lib/rules";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, "report", 20, 60 * 1000);
  if (!rl.allowed) {
    return rateLimitResponse(rl.resetMs);
  }

  // Anonymous reports are not supported; duplicate detection depends on verified accounts.
  const guard = await requireRole(
    ["CITIZEN", "OFFICER", "SUPERVISOR", "ADMIN"],
    {
      action: "SUBMIT_GRIEVANCE_REPORT",
      entityType: "Report",
    }
  );
  if (!guard.authorized) return guard.response;

  try {
    const body = await req.json();
    const result = await submitReport(body, guard.user.id);

    if (!result.ok) {
      return NextResponse.json(result, { status: result.httpStatus });
    }

    return NextResponse.json(result, { status: result.httpStatus });
  } catch (err) {
    console.error("Submit report API error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to process report submission." },
      { status: 500 }
    );
  }
}
