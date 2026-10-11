import { NextRequest, NextResponse } from "next/server";
import { computeDeadlines } from "@/lib/rules";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");
  const subcategoryId = searchParams.get("subcategoryId");

  if (!categoryId) {
    return NextResponse.json(
      { ok: false, error: "categoryId is required." },
      { status: 400 }
    );
  }

  const deadlines = await computeDeadlines(
    categoryId,
    subcategoryId || null,
    "STANDARD",
    new Date()
  );

  return NextResponse.json({
    ok: true,
    ...deadlines,
    expectedResponseDeadline: deadlines.responseDeadline.toISOString(),
    expectedResolutionDeadline: deadlines.resolutionDeadline.toISOString(),
    ruleSource: deadlines.ruleApplied,
    disclaimer: deadlines.label,
  });
}
