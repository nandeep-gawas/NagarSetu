"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { CivicHeader } from "@/components/CivicHeader";
import { useI18n } from "@/lib/i18n/context";

interface TimelineEntry {
  id: string;
  action: string;
  fromState: string | null;
  toState: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  ruleApplied: string | null;
  actorType: string;
  actorRole: string;
  createdAt: string;
}

interface EscalationEntry {
  id: string;
  level: number;
  reason: string;
  ruleFired: string;
  triggeredAt: string;
}

interface PrivateDetails {
  reportId: string;
  reportReferenceId: string;
  description: string;
  photoUrl: string | null;
  photoTimestamp: string | null;
  latitude: number;
  longitude: number;
  canConfirmClosure: boolean;
  canReopen: boolean;
  reopenWindowHours: number;
  reopenDeadline: string | null;
}

interface TrackData {
  ok: boolean;
  accessLevel: "PUBLIC" | "OWNER" | "STAFF";
  issue: {
    id: string;
    referenceId: string;
    searchedReferenceId: string;
    category: { id: string; name: string; emoji: string };
    subcategory: { id: string; name: string };
    department: string;
    status: string;
    priority: string;
    publicLocationLabel: string;
    reportCount: number;
    submittedAt: string;
    responseDeadline: string;
    resolutionDeadline: string;
    resolvedAt: string | null;
    closedAt: string | null;
    isOverdue: boolean;
    approachingDeadline: boolean;
    escalationLevel: number;
    escalationEvents: EscalationEntry[];
  };
  privateDetails: PrivateDetails | null;
  timeline: TimelineEntry[];
}

function formatDurationDelta(ms: number): string {
  const absSec = Math.floor(Math.abs(ms) / 1000);
  const days = Math.floor(absSec / 86400);
  const hours = Math.floor((absSec % 86400) / 3600);
  const mins = Math.floor((absSec % 3600) / 60);
  const secs = absSec % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

export default function TrackReferencePage({
  params,
}: {
  params: Promise<{ referenceId: string }>;
}) {
  const { referenceId } = use(params);
  const { t, tCategory, tSubcategory, tStatus } = useI18n();

  const [data, setData] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Citizen Action States
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  // Add Evidence / Note state
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [updateNote, setUpdateNote] = useState("");
  const [updateCaption, setUpdateCaption] = useState("");
  const [updatePhotoUrl, setUpdatePhotoUrl] = useState<string | null>(null);
  const [updatePhotoTime, setUpdatePhotoTime] = useState<string | null>(null);
  const [uploadingUpdatePhoto, setUploadingUpdatePhoto] = useState(false);

  // Reopen Request state
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  const fetchTrackData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/track/${encodeURIComponent(referenceId)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Complaint not found.");
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError("Network error while loading complaint status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackData();
  }, [referenceId]);

  // Live 1-second countdown ticker
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Upload optional photo for citizen evidence update
  const handleUploadUpdateFile = async (file: File) => {
    setUploadingUpdatePhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/evidence/upload", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (res.ok && json.file) {
        setUpdatePhotoUrl(json.file.url);
        setUpdatePhotoTime(json.serverExif?.photoTimestamp || null);
      } else {
        setActionMessage({
          type: "err",
          text: json.error || "Failed to upload photo.",
        });
      }
    } finally {
      setUploadingUpdatePhoto(false);
    }
  };

  // Submit citizen evidence / note
  const handleSubmitEvidenceUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(
        `/api/reports/${encodeURIComponent(referenceId)}/evidence`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            note: updateNote,
            photoUrl: updatePhotoUrl,
            caption: updateCaption,
            photoTimestamp: updatePhotoTime,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setActionMessage({
          type: "err",
          text: json.error || "Failed to add update.",
        });
      } else {
        setActionMessage({
          type: "ok",
          text: json.message || "Evidence / update added to your complaint.",
        });
        setUpdateNote("");
        setUpdateCaption("");
        setUpdatePhotoUrl(null);
        setShowAddEvidence(false);
        await fetchTrackData();
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm closure when RESOLVED_AWAITING_VERIFICATION
  const handleConfirmClosure = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(
        `/api/reports/${encodeURIComponent(referenceId)}/confirm-closure`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason:
              "Citizen verified on site that the municipal grievance is satisfactorily resolved.",
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setActionMessage({
          type: "err",
          text: json.error || "Could not confirm closure.",
        });
      } else {
        setActionMessage({
          type: "ok",
          text: json.message || "Complaint officially closed. Thank you!",
        });
        await fetchTrackData();
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Request reopening within 7-day window
  const handleRequestReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.issue.id) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/issues/${data.issue.id}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reopenReason }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionMessage({
          type: "err",
          text: json.error || "Reopen request refused by workflow engine.",
        });
      } else {
        setActionMessage({
          type: "ok",
          text:
            json.message ||
            "Complaint reopened and queued for supervisor reassignment.",
        });
        setReopenReason("");
        setShowReopenModal(false);
        await fetchTrackData();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const issue = data?.issue;
  const statusInfo = issue ? tStatus(issue.status) : null;

  const deadlineMs = issue
    ? new Date(issue.resolutionDeadline).getTime() - nowMs
    : 0;
  const isFinished =
    issue?.status === "RESOLVED_AWAITING_VERIFICATION" ||
    issue?.status === "CLOSED" ||
    issue?.status === "REJECTED";
  const isCurrentlyOverdue =
    Boolean(issue?.isOverdue) || (!isFinished && deadlineMs < 0);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <CivicHeader onAuthChange={() => fetchTrackData()} />

      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Top Breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/track"
            className="text-xs font-bold text-[#0f2942] hover:underline flex items-center gap-1"
          >
            ← Back to Reference ID Search
          </Link>
          <Link
            href="/my-complaints"
            className="text-xs font-bold text-[#0f2942] hover:underline"
          >
             {t("navMyComplaints")} →
          </Link>
        </div>

        {loading && (
          <div className="bg-white border border-slate-300 rounded-none p-8 text-sm text-slate-600">
            Loading complaint status for{" "}
            <code className="font-mono font-bold">{referenceId}</code>...
          </div>
        )}

        {error && !loading && (
          <div className="bg-white border-2 border-rose-300 rounded-none p-6 space-y-3">
            <h1 className="text-lg font-bold text-rose-900">
               Complaint Not Found
            </h1>
            <p className="text-xs sm:text-sm text-slate-700">{error}</p>
            <Link
              href="/track"
              className="inline-flex min-h-[42px] px-4 py-2 rounded-none bg-[#0f2942] text-white text-xs font-bold items-center"
            >
              Try Another Reference ID
            </Link>
          </div>
        )}

        {issue && statusInfo && (
          <>
            {/* Privacy / Access Level Notice Banner */}
            <div
              className={`p-3.5 rounded-none border text-xs font-semibold flex flex-wrap items-center justify-between gap-2 ${
                data.accessLevel === "PUBLIC"
                  ? "bg-amber-50 border-amber-300 text-amber-950"
                  : "bg-emerald-50 border-emerald-300 text-emerald-950"
              }`}
            >
              <span>
                {data.accessLevel === "PUBLIC"
                  ? ` ${t("publicViewNotice")}`
                  : `✓ ${t("ownerViewNotice")} (${data.accessLevel})`}
              </span>
              {data.accessLevel === "PUBLIC" && (
                <Link
                  href={`/login?returnTo=/track/${encodeURIComponent(
                    issue.referenceId
                  )}`}
                  className="px-3 py-1 rounded bg-[#0f2942] text-white font-bold text-xs"
                >
                  Sign In as Owner →
                </Link>
              )}
            </div>

            {/* HEADER SUMMARY CARD */}
            <div className="bg-white border border-slate-300 rounded-none shadow-sm overflow-hidden">
              <div className="bg-[#0f2942] text-white p-5 sm:p-6 border-b-4 border-amber-500">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-lg sm:text-xl font-black text-amber-400">
                        {issue.referenceId}
                      </span>
                      {issue.searchedReferenceId !== issue.referenceId && (
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-mono">
                          Report ID: {issue.searchedReferenceId}
                        </span>
                      )}
                      <span
                        className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                          issue.priority === "CRITICAL"
                            ? "bg-rose-600 text-white"
                            : issue.priority === "HIGH"
                            ? "bg-amber-500 text-slate-950"
                            : "bg-slate-700 text-slate-100"
                        }`}
                      >
                        {issue.priority} PRIORITY
                      </span>
                      {issue.escalationLevel > 0 && (
                        <span className="px-2.5 py-0.5 rounded bg-rose-700 text-white text-xs font-bold border border-rose-400">
                           ESCALATED (LEVEL {issue.escalationLevel})
                        </span>
                      )}
                    </div>

                    <h1 className="text-lg sm:text-xl font-bold mt-2">
                      {issue.category.emoji}{" "}
                      {tCategory(issue.category.name)} —{" "}
                      {tSubcategory(issue.subcategory.name)}
                    </h1>
                    <p className="text-xs text-slate-300 mt-1">
                       {issue.publicLocationLabel} • Department:{" "}
                      <strong>{issue.department}</strong> • Linked Reports:{" "}
                      <strong>{issue.reportCount}</strong>
                    </p>
                  </div>

                  {/* Live SLA Countdown / Overdue Badge */}
                  <div className="bg-slate-900/90 border border-slate-700 rounded-none p-3.5 text-right min-w-[210px]">
                    <div className="text-[11px] text-slate-400 uppercase font-bold">
                      Target Resolution SLA
                    </div>
                    {isFinished ? (
                      <div className="text-sm font-bold text-emerald-400 mt-0.5">
                        ✓ {statusInfo.label}
                      </div>
                    ) : isCurrentlyOverdue ? (
                      <div className="text-sm font-black text-rose-400 mt-0.5">
                         Overdue by {formatDurationDelta(deadlineMs)}
                      </div>
                    ) : (
                      <div className="text-sm font-mono font-bold text-amber-300 mt-0.5">
                        ⏳ {formatDurationDelta(deadlineMs)} remaining
                      </div>
                    )}
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Due: {new Date(issue.resolutionDeadline).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Plain-Language Status Explanation Box */}
              <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-xs font-bold uppercase text-slate-500">
                    Current Status:
                  </span>
                  <span className="px-3 py-1 rounded-full bg-[#0f2942] text-white text-xs font-bold">
                    {statusInfo.label}
                  </span>
                </div>
                <p className="text-sm text-slate-800 font-medium leading-relaxed">
                  {statusInfo.explanation}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200 text-xs">
                  <div>
                    <div className="text-slate-500 font-semibold">
                      Submitted At
                    </div>
                    <div className="font-mono font-bold text-slate-900 mt-0.5">
                      {new Date(issue.submittedAt).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-semibold">
                      Response Target
                    </div>
                    <div className="font-mono font-bold text-slate-900 mt-0.5">
                      {new Date(issue.responseDeadline).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-semibold">
                      Resolution Target
                    </div>
                    <div className="font-mono font-bold text-slate-900 mt-0.5">
                      {new Date(issue.resolutionDeadline).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-semibold">
                      Linked Citizen Reports
                    </div>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {issue.reportCount} report(s)
                    </div>
                  </div>
                </div>
              </div>

              {/* Escalation Indicator Box (if escalated) */}
              {issue.escalationEvents.length > 0 && (
                <div className="p-4 bg-rose-50 border-b border-rose-200 space-y-1.5">
                  <div className="text-xs font-bold text-rose-900 uppercase">
                     Automatic SLA Escalation Record
                  </div>
                  {issue.escalationEvents.map((esc) => (
                    <div
                      key={esc.id}
                      className="text-xs text-rose-950 flex flex-wrap items-center justify-between gap-2 bg-white/80 p-2.5 rounded border border-rose-200"
                    >
                      <span>
                        <strong>Level {esc.level}:</strong> {esc.reason}
                      </span>
                      <span className="font-mono text-[11px] text-rose-800">
                        {esc.ruleFired} •{" "}
                        {new Date(esc.triggeredAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* OWNER / STAFF PRIVATE DETAILS & CITIZEN ACTIONS */}
              {data.privateDetails && (
                <div className="p-5 sm:p-6 space-y-5 border-b border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                       Reporting Citizen Details & Evidence (
                      {data.privateDetails.reportReferenceId})
                    </h2>
                    <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded">
                      Visible only to report owner & authorized PMC staff
                    </span>
                  </div>

                  {/* Verbatim Citizen Description */}
                  <div className="p-4 rounded-none bg-slate-50 border border-slate-300">
                    <div className="text-xs font-bold text-slate-500 uppercase mb-1">
                      Citizen Complaint Description (Stored Verbatim)
                    </div>
                    <p className="text-sm text-slate-900 whitespace-pre-wrap">
                      {data.privateDetails.description}
                    </p>
                  </div>

                  {/* Attached Photo / Video Evidence */}
                  {data.privateDetails.photoUrl && (
                    <div className="p-4 rounded-none bg-slate-50 border border-slate-300 space-y-2">
                      <div className="text-xs font-bold text-slate-700">
                         Attached Evidence
                      </div>
                      {data.privateDetails.photoUrl.startsWith(
                        "/api/evidence/"
                      ) ? (
                        <img
                          src={data.privateDetails.photoUrl}
                          alt="Citizen grievance evidence"
                          className="max-h-64 rounded-none border border-slate-300"
                        />
                      ) : (
                        <div className="text-xs font-mono text-slate-700 bg-white p-2.5 rounded border border-slate-200">
                          Evidence File Reference: {data.privateDetails.photoUrl}
                        </div>
                      )}
                      {data.privateDetails.photoTimestamp && (
                        <div className="text-xs text-slate-600">
                          {t("photoTimeLabel")}{" "}
                          <span className="font-mono font-semibold text-slate-900">
                            {new Date(
                              data.privateDetails.photoTimestamp
                            ).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Feedback */}
                  {actionMessage && (
                    <div
                      role="alert"
                      className={`p-3.5 rounded-none border text-xs font-bold ${
                        actionMessage.type === "ok"
                          ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                          : "bg-rose-50 border-rose-300 text-rose-950"
                      }`}
                    >
                      {actionMessage.type === "ok" ? "✓ " : " "}
                      {actionMessage.text}
                    </div>
                  )}

                  {/* CITIZEN ACTION BUTTONS */}
                  <div className="space-y-3 pt-2">
                    <div className="text-xs font-bold text-slate-700 uppercase">
                      Citizen Actions on Your Complaint
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {/* 1. Confirm Closure when RESOLVED_AWAITING_VERIFICATION */}
                      {data.privateDetails.canConfirmClosure && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={handleConfirmClosure}
                          className="min-h-[44px] px-4 py-2 rounded-none bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition disabled:opacity-50"
                        >
                          {t("btnConfirmClosure")}
                        </button>
                      )}

                      {/* 2. Request Reopening within 7-day window */}
                      {data.privateDetails.canReopen && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => setShowReopenModal((v) => !v)}
                          className="min-h-[44px] px-4 py-2 rounded-none bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition disabled:opacity-50"
                        >
                          {t("btnRequestReopen")}
                        </button>
                      )}

                      {/* 3. Add New Evidence / Update */}
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => setShowAddEvidence((v) => !v)}
                        className="min-h-[44px] px-4 py-2 rounded-none bg-[#0f2942] hover:bg-slate-800 text-white text-xs font-bold transition disabled:opacity-50"
                      >
                        {t("btnAddEvidenceUpdate")}
                      </button>
                    </div>

                    {/* Reopen Rule Explanation */}
                    <p className="text-xs text-slate-600 bg-slate-100 p-2.5 rounded-none border border-slate-200">
                      ℹ️ {t("reopenRuleInfo")}
                      {data.privateDetails.reopenDeadline && (
                        <span className="ml-1 font-mono font-semibold text-slate-800">
                          (Reopen window open until{" "}
                          {new Date(
                            data.privateDetails.reopenDeadline
                          ).toLocaleString()}
                          )
                        </span>
                      )}
                    </p>

                    {/* Add Evidence Form */}
                    {showAddEvidence && (
                      <form
                        onSubmit={handleSubmitEvidenceUpdate}
                        className="p-4 rounded-none border border-slate-300 bg-slate-50 space-y-3"
                      >
                        <div className="text-xs font-bold text-slate-900">
                          Attach Additional Evidence or Progress Note
                        </div>
                        <div>
                          <label
                            htmlFor="citizen-update-note"
                            className="block text-xs font-semibold text-slate-700 mb-1"
                          >
                            Update / Progress Note
                          </label>
                          <textarea
                            id="citizen-update-note"
                            rows={3}
                            value={updateNote}
                            onChange={(e) => setUpdateNote(e.target.value)}
                            placeholder="Add any new observations or landmark details..."
                            className="w-full p-2.5 rounded-none border border-slate-300 bg-white text-xs text-slate-900"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="min-h-[38px] px-3 py-1.5 rounded-none bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-800 cursor-pointer flex items-center">
                             Attach Photo / Video
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleUploadUpdateFile(f);
                              }}
                              className="hidden"
                            />
                          </label>
                          {uploadingUpdatePhoto && (
                            <span className="text-xs text-amber-800 font-semibold">
                              Uploading file...
                            </span>
                          )}
                          {updatePhotoUrl && (
                            <span className="text-xs text-emerald-800 font-bold">
                              ✓ File ready to attach
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={
                              actionLoading ||
                              uploadingUpdatePhoto ||
                              (!updateNote.trim() && !updatePhotoUrl)
                            }
                            className="min-h-[40px] px-4 py-1.5 rounded-none bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
                          >
                            Save Evidence Update
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAddEvidence(false)}
                            className="min-h-[40px] px-3 py-1.5 rounded-none bg-slate-200 text-slate-800 text-xs font-bold"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Request Reopen Form */}
                    {showReopenModal && (
                      <form
                        onSubmit={handleRequestReopen}
                        className="p-4 rounded-none border-2 border-amber-500 bg-amber-50 space-y-3"
                      >
                        <div className="text-xs font-bold text-amber-950">
                          Request Reopening of Complaint ({issue.referenceId})
                        </div>
                        <textarea
                          rows={3}
                          required
                          value={reopenReason}
                          onChange={(e) => setReopenReason(e.target.value)}
                          placeholder="Explain why the issue is still unresolved on site (required)..."
                          className="w-full p-2.5 rounded-none border border-amber-300 bg-white text-xs text-slate-900"
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={actionLoading || !reopenReason.trim()}
                            className="min-h-[40px] px-4 py-1.5 rounded-none bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold disabled:opacity-50"
                          >
                            Submit Reopen Request
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowReopenModal(false)}
                            className="min-h-[40px] px-3 py-1.5 rounded-none bg-white border border-slate-300 text-slate-800 text-xs font-bold"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              )}

              {/* AUDIT TIMELINE OF ACCEPTED STATUS CHANGES & ESCALATIONS */}
              <div className="p-5 sm:p-6">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
                   Verified Workflow & Escalation Audit Timeline (
                  {data.timeline.length} events)
                </h2>

                <ol className="relative border-l-2 border-slate-300 ml-3 space-y-4">
                  {data.timeline.map((ev) => (
                    <li key={ev.id} className="ml-5">
                      <span
                        className={`absolute -left-2.5 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white text-[10px] font-bold ${
                          ev.action.includes("ESCALATION") ||
                          ev.action === "MISSED_DEADLINE"
                            ? "bg-rose-600 text-white"
                            : "bg-[#0f2942] text-white"
                        }`}
                      >
                        •
                      </span>
                      <div className="p-3.5 rounded-none bg-slate-50 border border-slate-200">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {ev.action}
                            </span>
                            {ev.fromState && ev.toState && (
                              <span className="text-xs font-semibold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                                {tStatus(ev.fromState).label} →{" "}
                                {tStatus(ev.toState).label}
                              </span>
                            )}
                            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                              {ev.actorType === "SYSTEM"
                                ? "SYSTEM MONITOR"
                                : ev.actorRole}
                            </span>
                          </div>
                          <time className="text-[11px] font-mono text-slate-500">
                            {new Date(ev.createdAt).toLocaleString()}
                          </time>
                        </div>
                        {ev.reason && (
                          <p className="text-xs text-slate-700 mt-1.5">
                            {ev.reason}
                          </p>
                        )}
                        {ev.ruleApplied && (
                          <div className="text-[11px] font-mono text-slate-500 mt-1">
                            Rule: {ev.ruleApplied}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
