import { describe, it, expect } from "vitest";
import exifr from "exifr";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { submitReport } from "@/lib/rules";
import { transition, reopenIssue } from "@/lib/workflow";
import {
  translateKey,
  translateCategory,
  translateSubcategory,
  translateStatus,
} from "@/lib/i18n/dictionaries";
import {
  createSampleJpegWithPuneExifBytes,
  createSampleJpegWithoutExifBytes,
} from "@/lib/exifTestSamples";
import { POST as uploadEvidencePost } from "@/app/api/evidence/upload/route";
import { GET as trackGet } from "@/app/api/track/[referenceId]/route";

describe("Citizen Portal: i18n, Real EXIF Extraction, Secure Uploads & Tracking Privacy", () => {
  it("1. i18n translates UI keys, categories, subcategories, and status explanations in English, Marathi, and Hindi with English fallback", () => {
    expect(translateKey("en", "navReport")).toBe("Register a Complaint");
    expect(translateKey("mr", "navReport")).toBe("तक्रार नोंदवा");
    expect(translateKey("hi", "navReport")).toBe("शिकायत दर्ज करें");

    // Fallback to English when key is missing in target language or dictionary
    expect(translateKey("mr", "nonExistentKey_123")).toBe("nonExistentKey_123");

    // Category & Subcategory translations
    expect(translateCategory("mr", "Roads & Infrastructure")).toContain("रस्ते");
    expect(translateCategory("hi", "Water & Sewage")).toContain("जल");
    expect(
      translateSubcategory("mr", "Potholes or damaged roads")
    ).toContain("खड्डे");

    // Status labels and plain-language explanations
    const resolvedMr = translateStatus("mr", "RESOLVED_AWAITING_VERIFICATION");
    expect(resolvedMr.label).toContain("निराकरण पूर्ण");
    expect(resolvedMr.explanation).toContain("७ दिवसांच्या आत");
  });

  it("2. Extracts GPS coordinates and DateTimeOriginal from a real JPEG with EXIF, and handles a JPEG without EXIF", async () => {
    const withExifBytes = createSampleJpegWithPuneExifBytes();
    const gps = await exifr.gps(Buffer.from(withExifBytes));
    expect(gps).toBeDefined();
    expect(gps?.latitude).toBeCloseTo(18.5074, 4);
    expect(gps?.longitude).toBeCloseTo(73.8077, 4);

    const parsed = await exifr.parse(Buffer.from(withExifBytes), [
      "DateTimeOriginal",
    ]);
    expect(parsed?.DateTimeOriginal).toBeDefined();

    // Stripped gallery JPEG without EXIF
    const noExifBytes = createSampleJpegWithoutExifBytes();
    const noGps = await exifr.gps(Buffer.from(noExifBytes)).catch(() => null);
    expect(noGps ?? null).toBeNull();
  });

  it("3. Server /api/evidence/upload validates MIME/size, saves outside /public with random UUID filename, and re-extracts EXIF on server", async () => {
    const withExifBytes = createSampleJpegWithPuneExifBytes();
    const file = new File([withExifBytes], "citizen_camera_pothole.jpg", {
      type: "image/jpeg",
    });
    const formData = new FormData();
    formData.append("file", file);

    const req = new Request("http://localhost:3000/api/evidence/upload", {
      method: "POST",
      body: formData,
    });

    const res = await uploadEvidencePost(req);
    expect(res.status).toBe(201);
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(data.file.filename).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(data.file.url).toBe(`/api/evidence/${data.file.filename}`);
    expect(data.serverExif.hasGps).toBe(true);
    expect(data.serverExif.latitude).toBeCloseTo(18.5074, 4);
    expect(data.serverExif.longitude).toBeCloseTo(73.8077, 4);
    expect(data.serverExif.photoTimestamp).toBeTruthy();

    // Confirm file is stored in /storage/evidence (outside /public)
    const savedPath = path.join(
      process.cwd(),
      "storage",
      "evidence",
      data.file.filename
    );
    const stat = await fs.stat(savedPath);
    expect(stat.size).toBe(withExifBytes.byteLength);

    // Reject unsupported MIME type
    const badFile = new File([new Uint8Array([1, 2, 3])], "malicious.exe", {
      type: "application/x-msdownload",
    });
    const badForm = new FormData();
    badForm.append("file", badFile);
    const badRes = await uploadEvidencePost(
      new Request("http://localhost:3000/api/evidence/upload", {
        method: "POST",
        body: badForm,
      })
    );
    expect(badRes.status).toBe(400);
  });

  it("4. Stores citizen complaint description verbatim (Marathi/Hindi/English) and keeps unverified photoTimestamp separate from server submittedAt", async () => {
    const citizen = await prisma.user.findUniqueOrThrow({
      where: { email: "aarav.sharma@citizen.in" },
    });
    const category = await prisma.category.findFirstOrThrow({
      where: { name: "Roads & Infrastructure" },
      include: { subcategories: true },
    });
    const subcategory = category.subcategories.find(
      (s: { name: string }) => s.name === "Potholes or damaged roads"
    )!;

    const verbatimMarathiDescription =
      "सिंहगड रोडवरील राजाराम पुलाजवळ मोठा खड्डा पडला आहे, दुचाकीस्वारांना धोका आहे. कृपया तात्काळ दुरुस्ती करावी.";
    const unverifiedExifTimestamp = "2026-10-10T09:30:00.000Z";

    const result = await submitReport(
      {
        categoryId: category.id,
        subcategoryId: subcategory.id,
        description: verbatimMarathiDescription,
        latitude: 18.4785 + Math.random() * 0.005,
        longitude: 73.8221 + Math.random() * 0.005,
        publicLocationLabel: "Near Rajaram Bridge, Sinhagad Road, Pune",
        evidence: {
          filePath: "/api/evidence/sample-uuid.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 4096,
          exifLatitude: 18.5074,
          exifLongitude: 73.8077,
          exifCapturedAt: unverifiedExifTimestamp,
        },
        idempotencyKey: `test-verbatim-${Date.now()}`,
      },
      citizen.id
    );

    expect(result.status).toBe("CREATED");
    expect(result.report?.description).toBe(verbatimMarathiDescription);
    const savedExifDate = result.report?.evidences[0]?.exifCapturedAt;
    expect(savedExifDate?.toISOString()).toBe(unverifiedExifTimestamp);
    // Server submittedAt is distinct from the unverified exifCapturedAt
    expect(result.report?.submittedAt.getTime()).toBeGreaterThan(
      savedExifDate!.getTime()
    );
  });

  it("5. Enforces public vs owner privacy on /api/track/[referenceId] and supports citizen reopening within 7-day window & closure verification", async () => {
    const sampleReport = await prisma.report.findFirstOrThrow({
      orderBy: { submittedAt: "asc" },
    });

    // Public (unauthenticated) call to /api/track/[referenceId]
    const req = new Request(
      `http://localhost:3000/api/track/${sampleReport.referenceId}`,
      { method: "GET" }
    );
    const res = await trackGet(req, {
      params: Promise.resolve({ referenceId: sampleReport.referenceId }),
    });
    expect(res.status).toBe(200);
    const trackJson = await res.json();

    expect(trackJson.accessLevel).toBe("PUBLIC");
    expect(trackJson.privateDetails).toBeNull();
    expect(trackJson.issue.referenceId).toBe(sampleReport.referenceId);
    expect(trackJson.issue.publicLocationLabel).toBeTruthy();

    // Ensure no REFUSED events leak into the public citizen timeline
    const refusedInPublicTimeline = trackJson.timeline.some(
      (ev: { outcome?: string }) => ev.outcome === "REFUSED"
    );
    expect(refusedInPublicTimeline).toBe(false);

    // Test citizen reopen within 7-day window on a fresh resolved issue
    const citizen = await prisma.user.findUniqueOrThrow({
      where: { email: "sneha.apte@citizen.in" },
    });
    const officer = await prisma.user.findUniqueOrThrow({
      where: { email: "officer.roads@pune.gov.in" },
    });
    const supervisor = await prisma.user.findUniqueOrThrow({
      where: { email: "supervisor.west@pune.gov.in" },
    });
    const category = await prisma.category.findFirstOrThrow({
      where: { name: "Roads & Infrastructure" },
      include: { subcategories: true },
    });

    const created = await submitReport(
      {
        categoryId: category.id,
        subcategoryId: category.subcategories[0].id,
        description: "Damaged road patch near Aundh ITI Road signal.",
        latitude: 18.5612 + Math.random() * 0.005,
        longitude: 73.8091 + Math.random() * 0.005,
        publicLocationLabel: "Near ITI Road, Aundh, Pune",
        idempotencyKey: `test-citizen-reopen-${Date.now()}`,
        duplicateOption: "submit_as_different_issue",
      },
      citizen.id
    );

    const issueId = created.issue!.id;
    await transition(issueId, "VERIFIED", {
      id: officer.id,
      email: officer.email,
      role: officer.role,
      departmentId: officer.departmentId,
    });
    await transition(issueId, "ASSIGNED", {
      id: supervisor.id,
      email: supervisor.email,
      role: supervisor.role,
      departmentId: supervisor.departmentId,
    });
    await transition(issueId, "IN_PROGRESS", {
      id: officer.id,
      email: officer.email,
      role: officer.role,
      departmentId: officer.departmentId,
    });
    await transition(
      issueId,
      "RESOLVED_AWAITING_VERIFICATION",
      {
        id: officer.id,
        email: officer.email,
        role: officer.role,
        departmentId: officer.departmentId,
      },
      "Resurfaced road patch and cleared debris."
    );

    // Citizen reopens within 7-day window after resolution
    const reopenRes = await reopenIssue(
      issueId,
      {
        id: citizen.id,
        email: citizen.email,
        role: citizen.role,
        departmentId: null,
      },
      "Surface subsided again after heavy rain."
    );
    expect(reopenRes.ok).toBe(true);
    expect(reopenRes.issue?.status).toBe("REOPENED");
  });
});
