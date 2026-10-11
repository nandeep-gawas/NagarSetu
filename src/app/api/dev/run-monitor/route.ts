import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  runDeadlineMonitorPass,
  timeTravelIssueDeadline,
} from "../../../../../worker/deadlineMonitor";

export async function POST(req: NextRequest) {
  const guard = await requireRole(["ADMIN"], {
    action: "DEV_RUN_DEADLINE_MONITOR",
    entityType: "SystemMonitor",
  });
  if (!guard.authorized) return guard.response;

  try {
    const body = await req.json().catch(() => ({}));
    const { timeTravelIssueId, hoursInPast } = body;

    let timeTraveledIssue = null;
    if (timeTravelIssueId) {
      timeTraveledIssue = await timeTravelIssueDeadline(
        String(timeTravelIssueId),
        typeof hoursInPast === "number" ? hoursInPast : 2
      );
    }

    const summary = await runDeadlineMonitorPass(new Date());

    return NextResponse.json({
      ok: true,
      timeTraveledIssue,
      monitorSummary: summary,
    });
  } catch (err) {
    console.error("Run monitor dev endpoint error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to run deadline monitor." },
      { status: 500 }
    );
  }
}
