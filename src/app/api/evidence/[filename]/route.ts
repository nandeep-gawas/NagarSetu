import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;
  const safeName = path.basename(filename);
  const expectedPath = `/api/evidence/${safeName}`;

  const linkedEvidence = await prisma.evidence.findFirst({
    where: { filePath: { startsWith: expectedPath } },
    include: { report: true },
  });

  // If the file is linked to a submitted Report, enforce strict authorization:
  // ONLY the report's owning citizen or municipal staff (OFFICER/SUPERVISOR/ADMIN) can view it.
  if (linkedEvidence) {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to view submitted evidence files." },
        { status: 401 }
      );
    }

    if (
      user.role === "CITIZEN" &&
      linkedEvidence.report.citizenId !== user.id
    ) {
      return NextResponse.json(
        { error: "Forbidden: You may only view evidence for your own reports." },
        { status: 403 }
      );
    }
  }

  const diskPath = path.join(process.cwd(), "storage", "evidence", safeName);
  try {
    const fileBuf = await fs.readFile(diskPath);
    const ext = path.extname(safeName).toLowerCase();
    const contentType = MIME_BY_EXT[ext] || "application/octet-stream";

    return new NextResponse(fileBuf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Evidence file not found." },
      { status: 404 }
    );
  }
}
