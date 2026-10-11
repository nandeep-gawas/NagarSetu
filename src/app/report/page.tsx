"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CivicHeader } from "@/components/CivicHeader";
import { useI18n } from "@/lib/i18n/context";
import { findNearestPuneLandmark } from "@/components/PuneLeafletMap";
import {
  createSampleJpegWithPuneExifBytes,
  createSampleJpegWithoutExifBytes,
} from "@/lib/exifTestSamples";

const PuneLeafletMap = dynamic(() => import("@/components/PuneLeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[340px] sm:h-[400px] w-full rounded-xl border border-slate-300 bg-slate-100 flex items-center justify-center text-xs text-slate-600">
      Loading interactive Pune OpenStreetMap...
    </div>
  ),
});

interface SubcategoryItem {
  id: string;
  name: string;
  defaultSeverity: string;
}

interface CategoryItem {
  id: string;
  name: string;
  emoji: string;
  subcategories: SubcategoryItem[];
}

interface UploadedEvidenceInfo {
  filename: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
  caption: string;
  clientExif: {
    hasGps: boolean;
    latitude: number | null;
    longitude: number | null;
    photoTimestamp: string | null;
  };
  serverExif: {
    hasGps: boolean;
    latitude: number | null;
    longitude: number | null;
    photoTimestamp: string | null;
  };
}

interface DuplicateCandidateInfo {
  issueId: string;
  referenceId: string;
  status: string;
  publicLocationLabel: string;
  distanceMeters: number;
  similarityScore: number;
}

interface SubmissionSuccessData {
  outcome: "CREATED" | "MERGED";
  message: string;
  referenceId: string;
  issueReferenceId: string;
  categoryName: string;
  subcategoryName: string;
  status: string;
  priority: string;
  responseDeadline: string;
  resolutionDeadline: string;
  reportCount: number;
}

const DRAFT_STORAGE_KEY = "nagarsetu_report_draft_v1";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `ns-submit-${crypto.randomUUID()}`;
  }
  return `ns-submit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function ReportWizardContent() {
  const { t, tCategory, tSubcategory, tStatus } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const categorySlugParam = searchParams.get("category");

  const [step, setStep] = useState<number>(1);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Step 1 state
  const [categoryId, setCategoryId] = useState<string>("");
  const [subcategoryId, setSubcategoryId] = useState<string>("");

  // Step 2 state
  const [description, setDescription] = useState<string>("");
  const [step2Error, setStep2Error] = useState<string | null>(null);

  // Step 3 & 4 state
  const [evidence, setEvidence] = useState<UploadedEvidenceInfo | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Location & GPS state (Default: Pune Municipal Corporation Main Building, Shivajinagar)
  const [latitude, setLatitude] = useState<number>(18.5204);
  const [longitude, setLongitude] = useState<number>(73.8567);
  const [publicLocationLabel, setPublicLocationLabel] = useState<string>(
    "Near JM Road Corner, Shivajinagar, Pune"
  );
  const [locationSource, setLocationSource] = useState<
    "PHOTO_EXIF" | "DEVICE_GPS" | "MAP_PIN"
  >("MAP_PIN");
  const [gpsConfirmed, setGpsConfirmed] = useState<boolean>(false);

  const [deviceGps, setDeviceGps] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [geoPermissionState, setGeoPermissionState] = useState<
    "idle" | "requesting" | "granted" | "denied"
  >("idle");
  const [geoStatusMessage, setGeoStatusMessage] = useState<string | null>(null);

  // Step 6 SLA Preview
  const [slaPreview, setSlaPreview] = useState<{
    responseHours: number;
    resolutionHours: number;
    expectedResponseDeadline: string;
    expectedResolutionDeadline: string;
    ruleSource: string;
    disclaimer: string;
  } | null>(null);

  // Step 7 Submission & Idempotency
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    generateIdempotencyKey()
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] =
    useState<DuplicateCandidateInfo | null>(null);
  const [submissionSuccess, setSubmissionSuccess] =
    useState<SubmissionSuccessData | null>(null);
  const [addingToDuplicate, setAddingToDuplicate] = useState(false);

  // Auth status
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    email: string;
    role: string;
  } | null>(null);

  // Restore saved progress from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.step && parsed.step >= 1 && parsed.step <= 7) {
          setStep(parsed.step);
        }
        if (parsed.categoryId) setCategoryId(parsed.categoryId);
        if (parsed.subcategoryId) setSubcategoryId(parsed.subcategoryId);
        if (typeof parsed.description === "string")
          setDescription(parsed.description);
        if (parsed.evidence) setEvidence(parsed.evidence);
        if (typeof parsed.latitude === "number") setLatitude(parsed.latitude);
        if (typeof parsed.longitude === "number")
          setLongitude(parsed.longitude);
        if (parsed.publicLocationLabel)
          setPublicLocationLabel(parsed.publicLocationLabel);
        if (parsed.locationSource) setLocationSource(parsed.locationSource);
        if (typeof parsed.gpsConfirmed === "boolean")
          setGpsConfirmed(parsed.gpsConfirmed);
        if (parsed.idempotencyKey) setIdempotencyKey(parsed.idempotencyKey);
      }
    } catch {
      // ignore invalid storage
    }
  }, []);

  // Persist draft on state changes
  useEffect(() => {
    if (submissionSuccess) return;
    try {
      sessionStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          step,
          categoryId,
          subcategoryId,
          description,
          evidence,
          latitude,
          longitude,
          publicLocationLabel,
          locationSource,
          gpsConfirmed,
          idempotencyKey,
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [
    step,
    categoryId,
    subcategoryId,
    description,
    evidence,
    latitude,
    longitude,
    publicLocationLabel,
    locationSource,
    gpsConfirmed,
    idempotencyKey,
    submissionSuccess,
  ]);

  // Load categories and handle ?category=slug preselection
  useEffect(() => {
    async function fetchCats() {
      setLoadingCategories(true);
      try {
        const res = await fetch("/api/categories");
        if (res.ok) {
          const data = await res.json();
          const list: CategoryItem[] = data.categories || [];
          setCategories(list);

          if (list.length > 0) {
            let matchedCat: CategoryItem | undefined;
            if (categorySlugParam) {
              const target = categorySlugParam.toLowerCase();
              matchedCat = list.find(
                (c) =>
                  toSlug(c.name) === target ||
                  toSlug(c.name).includes(target) ||
                  c.id.toLowerCase() === target
              );
            }

            setCategoryId((prev) => {
              if (matchedCat) return matchedCat.id;
              if (prev && list.some((c) => c.id === prev)) return prev;
              return list[0].id;
            });

            setSubcategoryId((prev) => {
              const activeCat =
                matchedCat ||
                list.find((c) => c.id === categoryId) ||
                list[0];
              if (
                prev &&
                activeCat.subcategories.some((s) => s.id === prev)
              ) {
                return prev;
              }
              return activeCat.subcategories[0]?.id || "";
            });
          }
        }
      } finally {
        setLoadingCategories(false);
      }
    }
    fetchCats();
  }, [categorySlugParam]);

  // Fetch SLA preview whenever category/subcategory changes
  useEffect(() => {
    if (!categoryId) return;
    const url = `/api/rules/preview?categoryId=${encodeURIComponent(
      categoryId
    )}${
      subcategoryId
        ? `&subcategoryId=${encodeURIComponent(subcategoryId)}`
        : ""
    }`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.ok) setSlaPreview(data);
      })
      .catch(() => {});
  }, [categoryId, subcategoryId]);

  const selectedCategory =
    categories.find((c) => c.id === categoryId) || categories[0];
  const selectedSubcategory =
    selectedCategory?.subcategories.find((s) => s.id === subcategoryId) ||
    selectedCategory?.subcategories[0];

  // Handle Category Change
  const handleSelectCategory = (cat: CategoryItem) => {
    setCategoryId(cat.id);
    if (cat.subcategories.length > 0) {
      setSubcategoryId(cat.subcategories[0].id);
    }
  };

  // Client + Server File Upload & EXIF Extraction
  const processSelectedFile = async (file: File) => {
    setUploadError(null);

    const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
    const allowedVideoTypes = ["video/mp4", "video/webm"];
    const isImage = allowedImageTypes.includes(file.type);
    const isVideo = allowedVideoTypes.includes(file.type);

    if (!isImage && !isVideo) {
      setUploadError(
        `Unsupported file format (${
          file.type || "unknown"
        }). Supported: JPG, PNG, WEBP up to 10 MB; MP4, WEBM up to 30 MB.`
      );
      return;
    }

    const maxBytes = isImage ? 10 * 1024 * 1024 : 30 * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadError(
        `File size (${(file.size / (1024 * 1024)).toFixed(
          1
        )} MB) exceeds the ${isImage ? "10 MB photo" : "30 MB video"} limit.`
      );
      return;
    }

    setUploadingFile(true);

    // 1. Browser EXIF extraction with `exifr`
    let clientHasGps = false;
    let clientLat: number | null = null;
    let clientLng: number | null = null;
    let clientTime: string | null = null;

    if (isImage) {
      try {
        const exifr = await import("exifr");
        const gps = await exifr.gps(file).catch(() => null);
        if (
          gps &&
          typeof gps.latitude === "number" &&
          typeof gps.longitude === "number" &&
          !Number.isNaN(gps.latitude) &&
          !Number.isNaN(gps.longitude)
        ) {
          clientHasGps = true;
          clientLat = Number(gps.latitude.toFixed(6));
          clientLng = Number(gps.longitude.toFixed(6));
        }

        const parsed = await exifr
          .parse(file, ["DateTimeOriginal", "CreateDate", "ModifyDate"])
          .catch(() => null);
        const rawDate =
          parsed?.DateTimeOriginal || parsed?.CreateDate || parsed?.ModifyDate;
        if (rawDate instanceof Date && !Number.isNaN(rawDate.getTime())) {
          clientTime = rawDate.toISOString();
        } else if (typeof rawDate === "string" && rawDate.trim().length > 0) {
          clientTime = rawDate.trim();
        }
      } catch {
        // Fallback to server extraction
      }
    }

    // 2. Upload original file to server `/api/evidence/upload` (which also runs server `exifr`)
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/evidence/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Failed to upload evidence file.");
        setUploadingFile(false);
        return;
      }

      const serverExif = data.serverExif || {
        hasGps: false,
        latitude: null,
        longitude: null,
        photoTimestamp: null,
      };

      const effectiveLat = serverExif.latitude ?? clientLat;
      const effectiveLng = serverExif.longitude ?? clientLng;
      const effectiveHasGps =
        Boolean(serverExif.hasGps || clientHasGps) &&
        typeof effectiveLat === "number" &&
        typeof effectiveLng === "number";

      const newEvidence: UploadedEvidenceInfo = {
        filename: data.file.filename,
        url: data.file.url,
        mimeType: data.file.mimeType,
        sizeBytes: data.file.sizeBytes,
        originalName: file.name,
        caption: evidence?.caption || "",
        clientExif: {
          hasGps: clientHasGps,
          latitude: clientLat,
          longitude: clientLng,
          photoTimestamp: clientTime,
        },
        serverExif,
      };

      setEvidence(newEvidence);

      if (effectiveHasGps && effectiveLat !== null && effectiveLng !== null) {
        setLatitude(effectiveLat);
        setLongitude(effectiveLng);
        setPublicLocationLabel(
          findNearestPuneLandmark(effectiveLat, effectiveLng)
        );
        setLocationSource("PHOTO_EXIF");
        setGpsConfirmed(false);
      }
    } catch {
      setUploadError("Network error while uploading file.");
    } finally {
      setUploadingFile(false);
    }
  };

  // Sample test generators for hackathon evaluation
  const handleLoadSampleExifPhoto = async () => {
    const bytes = createSampleJpegWithPuneExifBytes();
    const file = new File([bytes], "kothrud_pothole_with_gps_exif.jpg", {
      type: "image/jpeg",
    });
    await processSelectedFile(file);
  };

  const handleLoadSampleStrippedPhoto = async () => {
    const bytes = createSampleJpegWithoutExifBytes();
    const file = new File([bytes], "gallery_photo_no_exif.jpg", {
      type: "image/jpeg",
    });
    await processSelectedFile(file);
  };

  // Request browser navigator.geolocation
  const handleRequestDeviceLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoPermissionState("denied");
      setGeoStatusMessage(
        "Browser geolocation is unavailable on this device. Please search a Pune landmark or drag the pin on the map in Step 5."
      );
      return;
    }

    setGeoPermissionState("requesting");
    setGeoStatusMessage("Requesting device location permission...");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setDeviceGps({ lat, lng });
        setGeoPermissionState("granted");
        setGeoStatusMessage(
          "Device location granted. Proposed location updated on Pune map."
        );

        // If photo did not have GPS, immediately set map pin to device GPS
        const hasPhotoGps =
          evidence?.serverExif.hasGps || evidence?.clientExif.hasGps;
        if (!hasPhotoGps) {
          setLatitude(lat);
          setLongitude(lng);
          setPublicLocationLabel(findNearestPuneLandmark(lat, lng));
          setLocationSource("DEVICE_GPS");
          setGpsConfirmed(true);
        }
      },
      () => {
        setGeoPermissionState("denied");
        setGeoStatusMessage(
          "Location permission was denied or unavailable. No problem — you can search for a Pune address/landmark or drag the pin on the map in Step 5."
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Helper to simulate denied geolocation or >100m discrepancy for live demo testing
  const handleSimulateDeniedGeolocation = () => {
    setDeviceGps(null);
    setGeoPermissionState("denied");
    setGeoStatusMessage(
      "Location permission denied (simulated). Please search a Pune landmark or drag the pin on the map in Step 5 — you never need to type coordinates."
    );
  };

  const handleSimulateDiscrepancyDeviceGps = () => {
    // Simulate device GPS at Baner (18.5590, 73.7868) while photo GPS is at Kothrud (18.5074, 73.8077) -> ~6.1 km apart (>100m)
    const simLat = 18.559;
    const simLng = 73.7868;
    setDeviceGps({ lat: simLat, lng: simLng });
    setGeoPermissionState("granted");
    setGeoStatusMessage(
      "Device GPS detected at Baner Link Road (>100m away from Photo GPS). Choose which location to use below."
    );
  };

  // Compute photo vs device GPS discrepancy if both exist
  const photoLat =
    evidence?.serverExif.latitude ?? evidence?.clientExif.latitude ?? null;
  const photoLng =
    evidence?.serverExif.longitude ?? evidence?.clientExif.longitude ?? null;
  const hasPhotoGps = photoLat !== null && photoLng !== null;
  const photoTimestamp =
    evidence?.serverExif.photoTimestamp ??
    evidence?.clientExif.photoTimestamp ??
    null;

  const gpsDiscrepancyMeters =
    hasPhotoGps && deviceGps
      ? Math.round(
          haversineMeters(photoLat, photoLng, deviceGps.lat, deviceGps.lng)
        )
      : null;

  // Step navigation validation
  const handleNextStep = () => {
    if (step === 1) {
      if (!categoryId || !subcategoryId) return;
      setStep(2);
    } else if (step === 2) {
      const trimmed = description.trim();
      if (trimmed.length < 5 || trimmed.length > 2000) {
        setStep2Error(t("descValidationError"));
        return;
      }
      setStep2Error(null);
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      setStep(5);
    } else if (step === 5) {
      setStep(6);
    } else if (step === 6) {
      setStep(7);
    }
  };

  const handlePrevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  // Submit complaint to POST /api/reports
  const submitComplaint = async (overrideDuplicate: boolean) => {
    if (!currentUser) {
      router.push("/login?returnTo=/report");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const keyToUse = overrideDuplicate
      ? generateIdempotencyKey()
      : idempotencyKey;
    if (overrideDuplicate) {
      setIdempotencyKey(keyToUse);
    }

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          subcategoryId,
          description, // Stored verbatim as typed!
          latitude,
          longitude,
          publicLocationLabel,
          evidence: evidence
            ? {
                filePath: evidence.url,
                mimeType: evidence.mimeType,
                sizeBytes: evidence.sizeBytes,
                caption: evidence.caption || null,
                exifLatitude: photoLat,
                exifLongitude: photoLng,
                exifCapturedAt: photoTimestamp || null,
              }
            : null,
          idempotencyKey: keyToUse,
          overrideDuplicate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Failed to submit complaint.");
        setSubmitting(false);
        return;
      }

      const statusOrOutcome = data.status || data.outcome;
      if (statusOrOutcome === "DUPLICATE_WARNING") {
        setDuplicateWarning({
          issueId: data.existingIssueId || data.duplicateCandidate?.issueId || "",
          referenceId:
            data.existingReferenceId ||
            data.duplicateCandidate?.referenceId ||
            data.existingPublicRef ||
            "",
          status: data.duplicateCandidate?.status || "SUBMITTED",
          publicLocationLabel:
            data.duplicateCandidate?.publicLocationLabel || publicLocationLabel,
          distanceMeters:
            data.distanceMeters ?? data.duplicateCandidate?.distanceMeters ?? 0,
          similarityScore:
            data.similarityScore ??
            data.duplicateCandidate?.similarityScore ??
            0,
        });
        setSubmitting(false);
        return;
      }

      // CREATED or MERGED or IDEMPOTENT_REPLAY
      setDuplicateWarning(null);
      const outcomeLabel =
        statusOrOutcome === "MERGED" ? "MERGED" : "CREATED";
      setSubmissionSuccess({
        outcome: outcomeLabel,
        message:
          data.message ||
          (outcomeLabel === "MERGED"
            ? "Your complaint has been linked to an existing active municipal issue at this location and its priority was recalculated."
            : "Your complaint has been officially registered with Pune Municipal Corporation."),
        referenceId: data.report?.referenceId || data.referenceId,
        issueReferenceId:
          data.report?.referenceId ||
          data.referenceId ||
          data.issue?.publicRef,
        categoryName: selectedCategory?.name || "",
        subcategoryName: selectedSubcategory?.name || "",
        status: data.issue.status,
        priority: data.issue.priority,
        responseDeadline: data.issue.responseDeadline,
        resolutionDeadline: data.issue.resolutionDeadline,
        reportCount: data.issue.reportCount,
      });
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      setSubmitError("Network error while submitting complaint.");
    } finally {
      setSubmitting(false);
    }
  };

  // Option 2 on DUPLICATE_WARNING: Add new evidence/update to existing complaint
  const handleAddEvidenceToExisting = async (existingRefId: string) => {
    setAddingToDuplicate(true);
    setSubmitError(null);
    try {
      const res = await fetch(
        `/api/reports/${encodeURIComponent(existingRefId)}/evidence`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            note: description,
            photoUrl: evidence?.url || null,
            caption: evidence?.caption || null,
            photoTimestamp: photoTimestamp || null,
          }),
        }
      );
      if (res.ok) {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        router.push(`/track/${existingRefId}`);
      } else {
        const d = await res.json();
        setSubmitError(d.error || "Could not attach update to existing report.");
        setAddingToDuplicate(false);
      }
    } catch {
      setSubmitError("Network error while updating existing complaint.");
      setAddingToDuplicate(false);
    }
  };

  const resetForNewComplaint = () => {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    setSubmissionSuccess(null);
    setDuplicateWarning(null);
    setDescription("");
    setEvidence(null);
    setGpsConfirmed(false);
    setIdempotencyKey(generateIdempotencyKey());
    setStep(1);
  };

  const stepsList = [
    { num: 1, title: t("step1Title") },
    { num: 2, title: t("step2Title") },
    { num: 3, title: t("step3Title") },
    { num: 4, title: t("step4Title") },
    { num: 5, title: t("step5Title") },
    { num: 6, title: t("step6Title") },
    { num: 7, title: t("step7Title") },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <CivicHeader onAuthChange={(u) => setCurrentUser(u)} />

      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        {/* Top Title Banner */}
        <div className="bg-[#0f2942] text-white rounded-xl p-5 sm:p-6 shadow-sm border-l-8 border-amber-500 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold mb-1.5">
                PMC CITIZEN GRIEVANCE PORTAL • PUNE
              </span>
              <h1 className="text-xl sm:text-2xl font-bold">
                {t("reportPageTitle")}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                {t("reportPageSubtitle")}
              </p>
            </div>
            <Link
              href="/track"
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-600 text-xs font-bold flex items-center"
            >
              🔍 {t("navTrack")}
            </Link>
          </div>
        </div>

        {/* Stepper Progress Bar */}
        {!submissionSuccess && (
          <nav
            aria-label="Complaint Registration Steps"
            className="bg-white border border-slate-300 rounded-xl p-3 sm:p-4 mb-6 shadow-2xs"
          >
            <ol className="grid grid-cols-2 sm:grid-cols-7 gap-2">
              {stepsList.map((s) => {
                const isCurrent = step === s.num;
                const isCompleted = step > s.num;
                return (
                  <li key={s.num}>
                    <button
                      type="button"
                      onClick={() => {
                        if (s.num < step) setStep(s.num);
                      }}
                      disabled={s.num > step}
                      className={`w-full min-h-[42px] px-2.5 py-1.5 rounded-lg text-left text-xs font-bold transition flex items-center gap-1.5 border ${
                        isCurrent
                          ? "bg-[#0f2942] text-white border-[#0f2942] shadow-2xs"
                          : isCompleted
                          ? "bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100 cursor-pointer"
                          : "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
                      }`}
                    >
                      <span
                        className={`h-5 w-5 rounded-full flex items-center justify-center text-[11px] shrink-0 ${
                          isCurrent
                            ? "bg-amber-500 text-slate-950 font-black"
                            : isCompleted
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {isCompleted ? "✓" : s.num}
                      </span>
                      <span className="truncate">{s.title.split(". ")[1] || s.title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}

        {/* MAIN STEP CARD */}
        <div className="bg-white border border-slate-300 rounded-xl p-5 sm:p-7 shadow-sm">
          {/* STEP 1: CATEGORY & SUBCATEGORY */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {t("step1Title")} — {t("selectCategoryPrompt")}
                </h2>
                {categorySlugParam && (
                  <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1 mt-1 inline-block font-medium">
                    ✓ Preselected from URL parameter{" "}
                    <code className="font-mono">?category={categorySlugParam}</code>{" "}
                    (you can change it below).
                  </p>
                )}
              </div>

              {loadingCategories ? (
                <div className="p-6 text-sm text-slate-600">
                  Loading official PMC categories...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {categories.map((cat) => {
                      const active = cat.id === categoryId;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleSelectCategory(cat)}
                          className={`min-h-[64px] p-4 rounded-xl border-2 text-left transition flex items-start gap-3.5 ${
                            active
                              ? "border-[#0f2942] bg-amber-50/70 shadow-2xs"
                              : "border-slate-200 hover:border-slate-400 bg-white"
                          }`}
                        >
                          <span className="text-2xl shrink-0">{cat.emoji}</span>
                          <div className="flex-1">
                            <div className="text-sm font-bold text-slate-900">
                              {tCategory(cat.name)}
                            </div>
                            <div className="text-[11px] text-slate-600 mt-0.5">
                              {cat.name}
                            </div>
                          </div>
                          {active && (
                            <span className="px-2 py-0.5 rounded bg-[#0f2942] text-white text-[10px] font-bold">
                              Selected
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {selectedCategory && (
                    <div className="pt-4 border-t border-slate-200">
                      <h3 className="text-sm font-bold text-slate-900 mb-3">
                        {t("selectSubcategoryPrompt")}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {selectedCategory.subcategories.map((sub) => {
                          const active = sub.id === subcategoryId;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => setSubcategoryId(sub.id)}
                              className={`min-h-[52px] p-3.5 rounded-lg border text-left transition flex items-center justify-between gap-2 ${
                                active
                                  ? "border-[#0f2942] bg-[#0f2942] text-white font-bold shadow-2xs"
                                  : "border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-900 font-medium"
                              }`}
                            >
                              <div>
                                <div className="text-xs sm:text-sm">
                                  {tSubcategory(sub.name)}
                                </div>
                                {tSubcategory(sub.name) !== sub.name && (
                                  <div
                                    className={`text-[11px] ${
                                      active
                                        ? "text-slate-300"
                                        : "text-slate-500"
                                    }`}
                                  >
                                    {sub.name}
                                  </div>
                                )}
                              </div>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded font-bold shrink-0 ${
                                  active
                                    ? "bg-amber-500 text-slate-950"
                                    : "bg-slate-200 text-slate-700"
                                }`}
                              >
                                {sub.defaultSeverity}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-end pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={!categoryId || !subcategoryId}
                  className="min-h-[46px] px-6 py-2.5 rounded-lg bg-[#0f2942] hover:bg-slate-800 text-white font-bold text-sm transition disabled:opacity-50"
                >
                  {t("btnNext")}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: VERBATIM DESCRIPTION */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {t("step2Title")} — {t("descLabel")}
                </h2>
                <p className="text-xs text-slate-600 mt-1">{t("descHelp")}</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
                <span>
                  Selected:{" "}
                  <strong>
                    {selectedCategory?.emoji}{" "}
                    {selectedCategory ? tCategory(selectedCategory.name) : ""}
                  </strong>{" "}
                  →{" "}
                  <strong>
                    {selectedSubcategory
                      ? tSubcategory(selectedSubcategory.name)
                      : ""}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-amber-800 underline font-bold"
                >
                  {t("btnEdit")}
                </button>
              </div>

              <div>
                <label
                  htmlFor="complaint-description"
                  className="block text-xs font-bold text-slate-800 mb-1.5"
                >
                  {t("descLabel")} *
                </label>
                <textarea
                  id="complaint-description"
                  rows={5}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (step2Error) setStep2Error(null);
                  }}
                  placeholder={t("descPlaceholder")}
                  className="w-full p-3.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0f2942]"
                />
                <div className="flex items-center justify-between mt-1.5 text-xs">
                  <span className="text-slate-600">
                    🔒 Stored verbatim as typed — never auto-translated or
                    rewritten by AI.
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      description.trim().length < 5
                        ? "text-amber-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {description.length} / 2000 chars (min 5)
                  </span>
                </div>
                {step2Error && (
                  <p
                    role="alert"
                    className="mt-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded p-2.5"
                  >
                    ⚠️ {step2Error}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="min-h-[46px] px-5 py-2.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold text-sm transition"
                >
                  {t("btnBack")}
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="min-h-[46px] px-6 py-2.5 rounded-lg bg-[#0f2942] hover:bg-slate-800 text-white font-bold text-sm transition"
                >
                  {t("btnNext")}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: EVIDENCE UPLOAD & CAMERA CAPTURE */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {t("step3Title")} — {t("evidenceTitle")}
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  {t("evidenceHelp")}
                </p>
              </div>

              {/* Hidden file inputs */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) processSelectedFile(f);
                  e.target.value = "";
                }}
                className="hidden"
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) processSelectedFile(f);
                  e.target.value = "";
                }}
                className="hidden"
              />

              {/* Primary Camera & File Upload Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={uploadingFile}
                  onClick={() => cameraInputRef.current?.click()}
                  className="min-h-[56px] p-4 rounded-xl bg-[#0f2942] hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-2xs transition disabled:opacity-50"
                >
                  {t("btnTakePhoto")}
                </button>
                <button
                  type="button"
                  disabled={uploadingFile}
                  onClick={() => galleryInputRef.current?.click()}
                  className="min-h-[56px] p-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-2xs transition disabled:opacity-50"
                >
                  {t("btnUploadFile")}
                </button>
              </div>

              {/* Interactive Hackathon Test Helper for Real EXIF & Stripped EXIF */}
              <div className="bg-slate-50 border border-slate-300 rounded-xl p-3.5">
                <div className="text-xs font-bold text-slate-800 mb-1.5">
                  🧪 Instant Evidence Test Fixtures (for Hackathon Verification):
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={uploadingFile}
                    onClick={handleLoadSampleExifPhoto}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition"
                  >
                    📸 Test Photo WITH Real GPS EXIF (Kothrud 18.5074, 73.8077)
                  </button>
                  <button
                    type="button"
                    disabled={uploadingFile}
                    onClick={handleLoadSampleStrippedPhoto}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition"
                  >
                    🖼️ Test Gallery Photo WITHOUT EXIF (Stripped Metadata)
                  </button>
                </div>
              </div>

              {uploadingFile && (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold">
                  ⏳ Validating file & extracting EXIF metadata on client +
                  server...
                </div>
              )}

              {uploadError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold"
                >
                  ⚠️ {uploadError}
                </div>
              )}

              {/* Preview Card */}
              {evidence && (
                <div className="border border-slate-300 rounded-xl p-4 bg-slate-50 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded">
                        ✓ Uploaded Securely Outside /public
                      </span>
                      <div className="text-xs font-semibold text-slate-800 mt-1">
                        File: {evidence.originalName} (
                        {(evidence.sizeBytes / 1024).toFixed(1)} KB •{" "}
                        {evidence.mimeType})
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="min-h-[38px] px-3 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-800"
                      >
                        {t("btnReplaceFile")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEvidence(null)}
                        className="min-h-[38px] px-3 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 text-xs font-bold"
                      >
                        {t("btnRemoveFile")}
                      </button>
                    </div>
                  </div>

                  {/* Visual preview */}
                  <div className="bg-slate-900 rounded-lg p-3 flex items-center justify-center max-h-60 overflow-hidden">
                    {evidence.mimeType.startsWith("video/") ? (
                      <video
                        src={evidence.url}
                        controls
                        className="max-h-52 rounded"
                      />
                    ) : (
                      <img
                        src={evidence.url}
                        alt={evidence.caption || "Uploaded grievance evidence"}
                        className="max-h-52 object-contain rounded"
                      />
                    )}
                  </div>

                  {/* Caption Input */}
                  <div>
                    <label
                      htmlFor="evidence-caption"
                      className="block text-xs font-bold text-slate-800 mb-1"
                    >
                      {t("captionLabel")}
                    </label>
                    <input
                      id="evidence-caption"
                      type="text"
                      maxLength={160}
                      value={evidence.caption}
                      onChange={(e) =>
                        setEvidence({ ...evidence, caption: e.target.value })
                      }
                      placeholder={t("captionPlaceholder")}
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0f2942]"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="min-h-[46px] px-5 py-2.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold text-sm transition"
                >
                  {t("btnBack")}
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={uploadingFile}
                  className="min-h-[46px] px-6 py-2.5 rounded-lg bg-[#0f2942] hover:bg-slate-800 text-white font-bold text-sm transition"
                >
                  {t("btnNext")}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: AUTOMATIC PHOTO LOCATION & TIME (EXIF + GEOLOCATION) */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {t("step4Title")} — {t("step4Header")}
                </h2>
                <p className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded-lg p-3 mt-2 font-medium">
                  ℹ️ {t("exifDisclaimer")}
                </p>
              </div>

              {/* Photo Timestamp Display (Kept separate from server submittedAt) */}
              <div className="p-4 rounded-xl border border-slate-300 bg-slate-50">
                <div className="text-xs font-bold text-slate-700">
                  🕒 {t("photoTimeLabel")}
                </div>
                {photoTimestamp ? (
                  <div className="mt-1 text-sm font-mono font-bold text-slate-900">
                    {photoTimestamp}{" "}
                    <span className="text-xs font-sans font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded ml-1">
                      Unverified EXIF Timestamp (Separate from Official Server
                      Submission Time)
                    </span>
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-slate-600">
                    {t("photoTimeMissing")}
                  </div>
                )}
              </div>

              {/* GPS Found vs GPS Missing Branch */}
              {hasPhotoGps ? (
                <div className="p-4 rounded-xl border-2 border-emerald-600 bg-emerald-50/70 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded bg-emerald-700 text-white text-[11px] font-bold">
                        ✓ EXIF GPS EXTRACTED (CLIENT + SERVER VERIFIED)
                      </span>
                      <p className="text-xs sm:text-sm font-bold text-emerald-950 mt-1.5">
                        {t("gpsFoundMsg")}
                      </p>
                      <p className="text-xs text-slate-700 mt-1">
                        Proposed Landmark:{" "}
                        <strong>
                          {findNearestPuneLandmark(photoLat, photoLng)}
                        </strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setLatitude(photoLat);
                        setLongitude(photoLng);
                        setPublicLocationLabel(
                          findNearestPuneLandmark(photoLat, photoLng)
                        );
                        setLocationSource("PHOTO_EXIF");
                        setGpsConfirmed(true);
                      }}
                      className={`min-h-[42px] px-4 py-2 rounded-lg text-xs font-bold transition ${
                        gpsConfirmed && locationSource === "PHOTO_EXIF"
                          ? "bg-emerald-700 text-white"
                          : "bg-[#0f2942] hover:bg-slate-800 text-white"
                      }`}
                    >
                      {gpsConfirmed && locationSource === "PHOTO_EXIF"
                        ? "✓ Photo Location Confirmed"
                        : "Confirm Photo Location on Map"}
                    </button>

                    <button
                      type="button"
                      onClick={handleRequestDeviceLocation}
                      className="min-h-[42px] px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold"
                    >
                      {t("btnUseDeviceLocation")}
                    </button>

                    <button
                      type="button"
                      onClick={handleSimulateDiscrepancyDeviceGps}
                      className="min-h-[42px] px-3 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-bold"
                    >
                      🧪 Simulate Device GPS &gt;100m Away
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-slate-300 bg-slate-50 space-y-3">
                  <span className="inline-block px-2 py-0.5 rounded bg-slate-700 text-white text-[11px] font-bold">
                    NO GPS IN PHOTO METADATA
                  </span>
                  <p className="text-xs sm:text-sm text-slate-800 font-medium">
                    {t("gpsMissingMsg")}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleRequestDeviceLocation}
                      className="min-h-[44px] px-4 py-2 rounded-lg bg-[#0f2942] hover:bg-slate-800 text-white text-xs font-bold transition"
                    >
                      {t("btnUseDeviceLocation")}
                    </button>
                    <button
                      type="button"
                      onClick={handleSimulateDeniedGeolocation}
                      className="min-h-[44px] px-3.5 py-2 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 text-xs font-bold transition"
                    >
                      🧪 Simulate Denied Location Permission
                    </button>
                  </div>
                </div>
              )}

              {/* Geolocation status banner */}
              {geoStatusMessage && (
                <div
                  className={`p-3.5 rounded-lg border text-xs font-semibold ${
                    geoPermissionState === "denied"
                      ? "bg-amber-50 border-amber-300 text-amber-950"
                      : "bg-blue-50 border-blue-200 text-blue-950"
                  }`}
                >
                  {geoStatusMessage}
                </div>
              )}

              {/* >100m Discrepancy Chooser when both Photo GPS and Device GPS exist */}
              {hasPhotoGps &&
                deviceGps &&
                gpsDiscrepancyMeters !== null &&
                gpsDiscrepancyMeters > 100 && (
                  <div className="p-4 rounded-xl border-2 border-amber-500 bg-amber-50 space-y-3">
                    <div className="text-xs sm:text-sm font-bold text-amber-950">
                      ⚠️ {t("distanceWarningTitle")} ({gpsDiscrepancyMeters}m
                      apart)
                    </div>
                    <p className="text-xs text-slate-700">
                      Your photo metadata location and your current device
                      location differ by{" "}
                      <strong>{gpsDiscrepancyMeters} metres</strong>. Please
                      choose which spot represents the actual grievance location:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setLatitude(photoLat);
                          setLongitude(photoLng);
                          setPublicLocationLabel(
                            findNearestPuneLandmark(photoLat, photoLng)
                          );
                          setLocationSource("PHOTO_EXIF");
                          setGpsConfirmed(true);
                        }}
                        className={`min-h-[52px] p-3 rounded-lg border text-left text-xs font-bold transition ${
                          locationSource === "PHOTO_EXIF"
                            ? "bg-[#0f2942] text-white border-[#0f2942]"
                            : "bg-white text-slate-900 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        <div>📷 {t("btnChoosePhotoGps")}</div>
                        <div className="text-[11px] opacity-80 mt-0.5">
                          {findNearestPuneLandmark(photoLat, photoLng)}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setLatitude(deviceGps.lat);
                          setLongitude(deviceGps.lng);
                          setPublicLocationLabel(
                            findNearestPuneLandmark(
                              deviceGps.lat,
                              deviceGps.lng
                            )
                          );
                          setLocationSource("DEVICE_GPS");
                          setGpsConfirmed(true);
                        }}
                        className={`min-h-[52px] p-3 rounded-lg border text-left text-xs font-bold transition ${
                          locationSource === "DEVICE_GPS"
                            ? "bg-[#0f2942] text-white border-[#0f2942]"
                            : "bg-white text-slate-900 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        <div>📍 {t("btnChooseDeviceGps")}</div>
                        <div className="text-[11px] opacity-80 mt-0.5">
                          {findNearestPuneLandmark(
                            deviceGps.lat,
                            deviceGps.lng
                          )}
                        </div>
                      </button>
                    </div>
                  </div>
                )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="min-h-[46px] px-5 py-2.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold text-sm transition"
                >
                  {t("btnBack")}
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="min-h-[46px] px-6 py-2.5 rounded-lg bg-[#0f2942] hover:bg-slate-800 text-white font-bold text-sm transition"
                >
                  {t("btnNext")}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: INTERACTIVE LEAFLET + OPENSTREETMAP PUNE MAP */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {t("step5Title")} — {t("step5Header")}
                </h2>
                <p className="text-xs text-slate-600 mt-1">{t("step5Help")}</p>
              </div>

              <PuneLeafletMap
                latitude={latitude}
                longitude={longitude}
                publicLocationLabel={publicLocationLabel}
                onLocationChange={(loc) => {
                  setLatitude(loc.latitude);
                  setLongitude(loc.longitude);
                  setPublicLocationLabel(loc.publicLocationLabel);
                  setGpsConfirmed(true);
                }}
              />

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="min-h-[46px] px-5 py-2.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold text-sm transition"
                >
                  {t("btnBack")}
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={!publicLocationLabel.trim()}
                  className="min-h-[46px] px-6 py-2.5 rounded-lg bg-[#0f2942] hover:bg-slate-800 text-white font-bold text-sm transition disabled:opacity-50"
                >
                  {t("btnNext")}
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: REVIEW ALL DETAILS & EXPECTED SLA DEADLINES */}
          {step === 6 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {t("step6Title")} — {t("step6Header")}
                </h2>
              </div>

              <div className="divide-y divide-slate-200 border border-slate-300 rounded-xl overflow-hidden">
                {/* Category & Subcategory */}
                <div className="p-4 bg-white flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase">
                      {t("step1Title")}
                    </div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                      {selectedCategory?.emoji}{" "}
                      {selectedCategory ? tCategory(selectedCategory.name) : ""}{" "}
                      →{" "}
                      {selectedSubcategory
                        ? tSubcategory(selectedSubcategory.name)
                        : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="min-h-[36px] px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800"
                  >
                    {t("btnEdit")}
                  </button>
                </div>

                {/* Verbatim Description */}
                <div className="p-4 bg-white flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-xs font-bold text-slate-500 uppercase">
                      {t("step2Title")} (Verbatim Citizen Text)
                    </div>
                    <p className="text-sm text-slate-900 mt-1 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200">
                      {description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="min-h-[36px] px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800"
                  >
                    {t("btnEdit")}
                  </button>
                </div>

                {/* Evidence & Metadata */}
                <div className="p-4 bg-white flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase">
                      {t("step3Title")} & {t("step4Title")}
                    </div>
                    {evidence ? (
                      <div className="mt-1 space-y-1 text-xs text-slate-800">
                        <div className="font-bold">
                          Attached: {evidence.originalName}
                        </div>
                        {evidence.caption && (
                          <div>Caption: &ldquo;{evidence.caption}&rdquo;</div>
                        )}
                        <div>
                          {t("photoTimeLabel")}{" "}
                          <span className="font-mono font-semibold">
                            {photoTimestamp || t("photoTimeMissing")}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-600 mt-1">
                        No photo/video attached.
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="min-h-[36px] px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800"
                  >
                    {t("btnEdit")}
                  </button>
                </div>

                {/* Location */}
                <div className="p-4 bg-white flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase">
                      {t("step5Title")}
                    </div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                      📍 {publicLocationLabel}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(5)}
                    className="min-h-[36px] px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800"
                  >
                    {t("btnEdit")}
                  </button>
                </div>
              </div>

              {/* SLA Targets Preview Box */}
              {slaPreview && (
                <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-bold text-amber-950 uppercase">
                    ⏱️ {t("slaTargetTitle")}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="bg-white p-3 rounded-lg border border-amber-200">
                      <div className="text-xs text-slate-600">
                        {t("expectedResponseLabel")}
                      </div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        Within {slaPreview.responseHours} hours
                      </div>
                      <div className="text-[11px] text-slate-600 font-mono">
                        By{" "}
                        {new Date(
                          slaPreview.expectedResponseDeadline
                        ).toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-amber-200">
                      <div className="text-xs text-slate-600">
                        {t("expectedResolutionLabel")}
                      </div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        Within {slaPreview.resolutionHours} hours
                      </div>
                      <div className="text-[11px] text-slate-600 font-mono">
                        By{" "}
                        {new Date(
                          slaPreview.expectedResolutionDeadline
                        ).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-amber-900">
                    Rule applied: <code className="font-mono">{slaPreview.ruleSource}</code> •{" "}
                    {slaPreview.disclaimer}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="min-h-[46px] px-5 py-2.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold text-sm transition"
                >
                  {t("btnBack")}
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="min-h-[46px] px-6 py-2.5 rounded-lg bg-[#0f2942] hover:bg-slate-800 text-white font-bold text-sm transition"
                >
                  {t("btnNext")}
                </button>
              </div>
            </div>
          )}

          {/* STEP 7: EXPLICIT CONFIRM & SUBMIT + DUPLICATE WARNING + REAL CONFIRMATION */}
          {step === 7 && !submissionSuccess && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {t("step7Title")}
                </h2>
                <p className="text-xs sm:text-sm text-slate-700 mt-1">
                  {t("step7Prompt")}
                </p>
              </div>

              {/* Auth Check Notice */}
              {!currentUser ? (
                <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-500 space-y-3">
                  <div className="text-sm font-bold text-amber-950">
                    🔐 Citizen Sign-In Required Before Final Submission
                  </div>
                  <p className="text-xs text-slate-700">
                    Your 7-step complaint draft is safely saved in this browser
                    tab. Sign in or register as a Pune citizen and you will
                    return directly to this step.
                  </p>
                  <Link
                    href="/login?returnTo=/report"
                    className="inline-flex min-h-[44px] px-5 py-2.5 rounded-lg bg-[#0f2942] hover:bg-slate-800 text-white text-xs font-bold items-center"
                  >
                    🔐 Sign In / Register to Submit →
                  </Link>
                </div>
              ) : (
                <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 flex items-center justify-between">
                  <span>
                    Submitting as authenticated citizen:{" "}
                    <strong>{currentUser.name}</strong> ({currentUser.email})
                  </span>
                  <span className="font-mono text-[11px] text-emerald-800">
                    Idempotency Key: {idempotencyKey.slice(0, 18)}...
                  </span>
                </div>
              )}

              {submitError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold"
                >
                  ⚠️ {submitError}
                </div>
              )}

              {/* SAME-USER DUPLICATE WARNING MODAL / PANEL WITH THE 4 REQUIRED OPTIONS */}
              {duplicateWarning && (
                <div
                  role="region"
                  aria-label="Potential Duplicate Complaint Warning"
                  className="p-5 rounded-xl border-2 border-amber-600 bg-amber-50 space-y-4 shadow-sm"
                >
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded bg-amber-600 text-white text-[11px] font-bold uppercase">
                      Duplicate Check Alert
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1.5">
                      {t("duplicateWarningTitle")}
                    </h3>
                    <p className="text-xs text-slate-700 mt-1">
                      {t("duplicateWarningBody")}
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded-lg border border-amber-300 text-xs space-y-1">
                    <div className="font-bold text-slate-900">
                      Existing Active Issue:{" "}
                      <span className="font-mono text-amber-900">
                        {duplicateWarning.referenceId}
                      </span>
                    </div>
                    <div className="text-slate-700">
                      Status:{" "}
                      <strong>
                        {tStatus(duplicateWarning.status).label}
                      </strong>{" "}
                      • Distance: <strong>{duplicateWarning.distanceMeters}m</strong>{" "}
                      • Location: {duplicateWarning.publicLocationLabel}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Option 1: Track existing complaint */}
                    <Link
                      href={`/track/${duplicateWarning.referenceId}`}
                      className="min-h-[46px] px-4 py-2.5 rounded-lg bg-[#0f2942] hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center text-center"
                    >
                      1. 🔍 {t("optTrackExisting")} ({duplicateWarning.referenceId})
                    </Link>

                    {/* Option 2: Add new evidence/update */}
                    <button
                      type="button"
                      disabled={addingToDuplicate}
                      onClick={() =>
                        handleAddEvidenceToExisting(
                          duplicateWarning.referenceId
                        )
                      }
                      className="min-h-[46px] px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition disabled:opacity-50"
                    >
                      2. 📎{" "}
                      {addingToDuplicate
                        ? "Adding Update..."
                        : t("optAddEvidence")}
                    </button>

                    {/* Option 3: Go back and correct */}
                    <button
                      type="button"
                      onClick={() => {
                        setDuplicateWarning(null);
                        setStep(2);
                      }}
                      className="min-h-[46px] px-4 py-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-900 text-xs font-bold transition"
                    >
                      3. ✏️ {t("optGoBack")}
                    </button>

                    {/* Option 4: Submit as a different issue */}
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => submitComplaint(true)}
                      className="min-h-[46px] px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition disabled:opacity-50"
                    >
                      4. ➕ {t("optSubmitDifferent")}
                    </button>
                  </div>
                </div>
              )}

              {/* Explicit Confirm and Submit Button */}
              {!duplicateWarning && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handlePrevStep}
                    className="min-h-[48px] px-5 py-2.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold text-sm transition disabled:opacity-50"
                  >
                    {t("btnBack")}
                  </button>

                  <button
                    type="button"
                    disabled={submitting || !currentUser}
                    onClick={() => submitComplaint(false)}
                    className="min-h-[48px] px-7 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-sm shadow-sm transition disabled:opacity-50"
                  >
                    {submitting ? t("btnSubmitting") : `✓ ${t("btnConfirmSubmit")}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* REAL DATABASE CONFIRMATION SCREEN AFTER SUBMISSION */}
          {submissionSuccess && (
            <div className="space-y-6">
              <div className="p-5 rounded-xl bg-emerald-50 border-2 border-emerald-600 space-y-2">
                <span className="inline-block px-2.5 py-0.5 rounded bg-emerald-700 text-white text-xs font-bold">
                  ✓ OFFICIAL PMC GRIEVANCE REGISTERED ({submissionSuccess.outcome})
                </span>
                <h2 className="text-xl font-bold text-slate-900">
                  Reference ID:{" "}
                  <span className="font-mono text-emerald-900">
                    {submissionSuccess.issueReferenceId}
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-700">
                  {submissionSuccess.message}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-lg border border-slate-300 bg-slate-50">
                  <div className="text-slate-500 font-bold uppercase">
                    Report Reference ID
                  </div>
                  <div className="text-sm font-mono font-bold text-slate-900 mt-0.5">
                    {submissionSuccess.referenceId}
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-300 bg-slate-50">
                  <div className="text-slate-500 font-bold uppercase">
                    Initial Workflow Status
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {tStatus(submissionSuccess.status).label} (
                    {submissionSuccess.priority} Priority)
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-300 bg-slate-50">
                  <div className="text-slate-500 font-bold uppercase">
                    Category & Subcategory
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {tCategory(submissionSuccess.categoryName)} →{" "}
                    {tSubcategory(submissionSuccess.subcategoryName)}
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-300 bg-slate-50">
                  <div className="text-slate-500 font-bold uppercase">
                    Target Resolution Deadline
                  </div>
                  <div className="text-sm font-mono font-bold text-slate-900 mt-0.5">
                    {new Date(
                      submissionSuccess.resolutionDeadline
                    ).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-200">
                <Link
                  href={`/track/${submissionSuccess.issueReferenceId}`}
                  className="min-h-[46px] px-6 py-2.5 rounded-lg bg-[#0f2942] hover:bg-slate-800 text-white font-bold text-sm flex items-center"
                >
                  🔍 Track This Complaint ({submissionSuccess.issueReferenceId}) →
                </Link>
                <Link
                  href="/my-complaints"
                  className="min-h-[46px] px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center"
                >
                  📋 View My Complaints
                </Link>
                <button
                  type="button"
                  onClick={resetForNewComplaint}
                  className="min-h-[46px] px-4 py-2.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold text-xs"
                >
                  + Register Another Complaint
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 p-8 text-sm text-slate-600">
          Loading complaint wizard...
        </div>
      }
    >
      <ReportWizardContent />
    </Suspense>
  );
}
