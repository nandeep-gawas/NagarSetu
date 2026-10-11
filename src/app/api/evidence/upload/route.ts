import { NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import exifr from "exifr";

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const ALLOWED_VIDEO_TYPES: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 30 * 1024 * 1024; // 30 MB

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (
      !file ||
      typeof file === "string" ||
      typeof (file as Blob).arrayBuffer !== "function"
    ) {
      return NextResponse.json(
        { ok: false, error: "Please select a valid photo or video file." },
        { status: 400 }
      );
    }

    const mimeType = (file.type || "").toLowerCase();
    const isImage = mimeType in ALLOWED_IMAGE_TYPES;
    const isVideo = mimeType in ALLOWED_VIDEO_TYPES;

    if (!isImage && !isVideo) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Unsupported file type. Allowed formats: JPG, PNG, WEBP images (up to 10 MB) or MP4, WEBM videos (up to 30 MB).",
        },
        { status: 400 }
      );
    }

    const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (file.size <= 0 || file.size > maxBytes) {
      const limitMb = isImage ? 10 : 30;
      return NextResponse.json(
        {
          ok: false,
          error: `File size exceeds the ${limitMb} MB limit for ${
            isImage ? "images" : "videos"
          }.`,
        },
        { status: 400 }
      );
    }

    const ext = isImage
      ? ALLOWED_IMAGE_TYPES[mimeType]
      : ALLOWED_VIDEO_TYPES[mimeType];
    const randomName = `${crypto.randomUUID()}${ext}`;

    // Store outside /public in /storage/evidence
    const storageDir = path.join(process.cwd(), "storage", "evidence");
    await fs.mkdir(storageDir, { recursive: true });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save the untouched original file
    const fullDiskPath = path.join(storageDir, randomName);
    await fs.writeFile(fullDiskPath, buffer);

    // Server-side EXIF extraction from the original uploaded buffer using exifr
    let exifLatitude: number | null = null;
    let exifLongitude: number | null = null;
    let exifCapturedAt: string | null = null;

    if (isImage) {
      try {
        const gps = await exifr.gps(buffer).catch(() => null);
        if (
          gps &&
          typeof gps.latitude === "number" &&
          !isNaN(gps.latitude) &&
          typeof gps.longitude === "number" &&
          !isNaN(gps.longitude)
        ) {
          exifLatitude = Number(gps.latitude.toFixed(6));
          exifLongitude = Number(gps.longitude.toFixed(6));
        }

        const parsedExif = await exifr
          .parse(buffer, ["DateTimeOriginal", "CreateDate", "ModifyDate"])
          .catch(() => null);
        const rawDate =
          parsedExif?.DateTimeOriginal ??
          parsedExif?.CreateDate ??
          parsedExif?.ModifyDate;
        if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
          exifCapturedAt = rawDate.toISOString();
        } else if (typeof rawDate === "string" && rawDate.trim().length > 0) {
          const normalized = rawDate
            .trim()
            .replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
          const d = new Date(normalized);
          exifCapturedAt = !isNaN(d.getTime())
            ? d.toISOString()
            : rawDate.trim();
        }
      } catch {
        // Gracefully ignore malformed or stripped EXIF
      }
    }

    const fileUrl = `/api/evidence/${randomName}`;
    const hasGps = exifLatitude !== null && exifLongitude !== null;

    return NextResponse.json(
      {
        ok: true,
        fileName: randomName,
        filePath: fileUrl,
        mimeType,
        sizeBytes: file.size,
        exifLatitude,
        exifLongitude,
        exifCapturedAt,
        file: {
          filename: randomName,
          url: fileUrl,
          mimeType,
          sizeBytes: file.size,
        },
        serverExif: {
          hasGps,
          latitude: exifLatitude,
          longitude: exifLongitude,
          photoTimestamp: exifCapturedAt,
        },
        exifVerificationNote:
          "From photo metadata, not verified. Never treated as proof.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Evidence upload error:", err);
    return NextResponse.json(
      { ok: false, error: "Could not upload file. Please try again." },
      { status: 500 }
    );
  }
}
