import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ referenceId: string }> }
) {
  const { referenceId } = await context.params;
  const decodedRef = decodeURIComponent(referenceId).trim();

  const guard = await requireRole(
    ["CITIZEN", "OFFICER", "SUPERVISOR", "ADMIN"],
    {
      action: "CITIZEN_ADD_EVIDENCE_OR_UPDATE",
      entityType: "Report",
      entityId: decodedRef,
    }
  );
  if (!guard.authorized) return guard.response;

  try {
    let report = await prisma.report.findUnique({
      where: { referenceId: decodedRef },
      include: { issue: true },
    });

    if (!report) {
      const issueByPublicRef = await prisma.issue.findUnique({
        where: { publicRef: decodedRef },
        include: { reports: { orderBy: { submittedAt: "asc" }, take: 1 } },
      });
      if (issueByPublicRef?.reports[0]) {
        report = await prisma.report.findUnique({
          where: { id: issueByPublicRef.reports[0].id },
          include: { issue: true },
        });
      }
    }

    if (!report) {
      return NextResponse.json(
        { ok: false, error: "Complaint reference not found." },
        { status: 404 }
      );
    }

    if (
      guard.user.role === "CITIZEN" &&
      report.citizenId !== guard.user.id
    ) {
      await logAuditEvent({
        actorType: "USER",
        actorId: guard.user.id,
        actorLabel: `citizen:${guard.user.email}`,
        action: "CITIZEN_ADD_EVIDENCE_OR_UPDATE",
        entityType: "Report",
        entityId: report.id,
        oldValue: { ownerId: report.citizenId },
        newValue: { actorId: guard.user.id },
        reason:
          "Refused: Citizens may only add evidence/updates to their own reports.",
        ruleApplied: "ReportOwnershipPolicy:CitizenOwnerOnly",
        outcome: "REFUSED",
      });

      return NextResponse.json(
        {
          ok: false,
          error:
            "Forbidden: You can only add evidence or updates to your own complaint.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const additionalNote = body.additionalNote ?? body.note ?? "";
    const filePath = body.evidence?.filePath ?? body.photoUrl ?? null;
    const caption = body.evidence?.caption ?? body.caption ?? null;
    const rawPhotoTime =
      body.evidence?.exifCapturedAt ?? body.photoTimestamp ?? null;

    if (!String(additionalNote).trim() && !filePath) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please provide an update note or an uploaded evidence file.",
        },
        { status: 400 }
      );
    }

    const updatedDescription = String(additionalNote).trim()
      ? `${report.description}\n\n[Citizen Update ${new Date()
          .toISOString()
          .slice(0, 16)
          .replace("T", " ")}]: ${String(additionalNote).trim()}`
      : report.description;

    const activeReport = report;
    const updatedReport = await prisma.$transaction(async (tx) => {
      if (filePath) {
        await tx.evidence.create({
          data: {
            reportId: activeReport.id,
            filePath: String(filePath),
            mimeType: String(body.evidence?.mimeType || "image/jpeg"),
            sizeBytes: Number(body.evidence?.sizeBytes || 102400),
            caption: caption ? String(caption) : null,
            exifLatitude:
              typeof body.evidence?.exifLatitude === "number"
                ? body.evidence.exifLatitude
                : null,
            exifLongitude:
              typeof body.evidence?.exifLongitude === "number"
                ? body.evidence.exifLongitude
                : null,
            exifCapturedAt: rawPhotoTime ? new Date(rawPhotoTime) : null,
          },
        });
      }

      const rep = await tx.report.update({
        where: { id: activeReport.id },
        data: { description: updatedDescription },
        include: { evidences: true },
      });

      await tx.auditEvent.create({
        data: {
          timestamp: new Date(),
          actorType: "USER",
          actorId: guard.user.id,
          actorLabel: `${guard.user.role.toLowerCase()}:${guard.user.email}`,
          action: "CITIZEN_ADDED_EVIDENCE_UPDATE",
          entityType: "Issue",
          entityId: activeReport.issueId,
          oldValue: { referenceId: activeReport.referenceId },
          newValue: {
            referenceId: activeReport.referenceId,
            addedEvidence: Boolean(filePath),
            addedNote: Boolean(String(additionalNote).trim()),
          },
          reason: String(additionalNote).trim()
            ? `Citizen added update note on ${activeReport.referenceId}`
            : `Citizen attached new photo/video evidence on ${activeReport.referenceId}`,
          ruleApplied: "CitizenSelfService:AddEvidenceOrUpdate",
          outcome: "ACCEPTED",
        },
      });

      return rep;
    });

    return NextResponse.json({
      ok: true,
      message: "Your update and evidence have been attached to the complaint.",
      report: updatedReport,
    });
  } catch (err) {
    console.error("Add evidence/update error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to save update." },
      { status: 500 }
    );
  }
}
