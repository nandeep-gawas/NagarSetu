"use client";

import React, { useState, useEffect } from "react";
import {
  Copy,
  GitMerge,
  Split,
  MapPin,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Sparkles,
} from "lucide-react";

interface ReportItem {
  id: string;
  description: string;
  evidenceUrl: string | null;
  citizen?: { name: string; email: string };
  createdAt: string;
}

interface IssueData {
  id: string;
  publicRef: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  reportCount: number;
  latitude: number | null;
  longitude: number | null;
  category: { name: string };
  subcategory: { name: string };
  reports: ReportItem[];
  createdAt: string;
}

interface DuplicateCandidateItem {
  id: string;
  primaryIssueId: string;
  duplicateIssueId: string;
  distanceMeters: number | null;
  textSimilarity: number | null;
  status: "PENDING" | "MERGED" | "KEPT_SEPARATE";
  reason: string | null;
  createdAt: string;
  primaryIssue: IssueData;
  duplicateIssue: IssueData;
}

export default function DuplicateReviewQueue() {
  const [candidates, setCandidates] = useState<DuplicateCandidateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState<{ [id: string]: string }>({});
  const [resultMessage, setResultMessage] = useState<{
    id: string;
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/duplicates/review?status=${statusFilter}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.candidates)) {
        setCandidates(data.candidates);
      }
    } catch (err) {
      console.error("Failed to fetch duplicate review candidates", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [statusFilter]);

  const handleResolve = async (
    candidateId: string,
    action: "MERGE" | "KEEP_SEPARATE"
  ) => {
    setActionLoading(candidateId);
    setResultMessage(null);
    try {
      const reason = resolutionNote[candidateId] || undefined;
      const res = await fetch(`/api/duplicates/${candidateId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        setResultMessage({
          id: candidateId,
          type: "success",
          text:
            action === "MERGE"
              ? "Successfully merged duplicate into primary issue. All reports and priority updated."
              : "Marked as separate incident. Both issues remain active independently.",
        });
        await fetchCandidates();
      } else {
        setResultMessage({
          id: candidateId,
          type: "error",
          text: data.error || "Action failed to execute on server.",
        });
      }
    } catch (err: any) {
      setResultMessage({
        id: candidateId,
        type: "error",
        text: err.message || "Network error while resolving candidate.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              Possible-Duplicate Review Queue
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Grievances flagged by the geospatial and TF-IDF duplicate detection engine for supervisor review.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
            <button
              onClick={() => setStatusFilter("PENDING")}
              className={`px-3 py-1.5 font-medium transition ${
                statusFilter === "PENDING"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Pending Review
            </button>
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 font-medium transition ${
                statusFilter === "ALL"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              All Records
            </button>
          </div>

          <button
            onClick={fetchCandidates}
            className="p-2 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Scanning duplicate candidates...</p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
          <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Review Queue Clear</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            No unresolved duplicate candidates pending in Pune municipal records. Newly submitted complaints matching distance (&lt;50m) and text similarity (&gt;60%) will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {candidates.map((cand) => {
            const isPending = cand.status === "PENDING";
            const distance = cand.distanceMeters !== null ? `${Math.round(cand.distanceMeters)}m` : "N/A";
            const similarity = cand.textSimilarity !== null ? `${Math.round(cand.textSimilarity * 100)}%` : "N/A";

            return (
              <div
                key={cand.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Comparison Banner */}
                <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-slate-700">
                      Candidate ID: <span className="font-mono">{cand.id.slice(0, 8)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                      <MapPin className="w-3 h-3" /> Distance: {distance}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                      <Sparkles className="w-3 h-3" /> Text Similarity: {similarity}
                    </span>
                  </div>

                  <div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-semibold uppercase text-[11px] ${
                        cand.status === "PENDING"
                          ? "bg-amber-100 text-amber-800"
                          : cand.status === "MERGED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {cand.status === "PENDING"
                        ? "Pending Decision"
                        : cand.status === "MERGED"
                        ? "Merged"
                        : "Kept Separate"}
                    </span>
                  </div>
                </div>

                {/* Side-by-side comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 p-6 gap-6">
                  {/* Left: Primary Issue */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Existing Master Issue
                      </span>
                      <span className="font-mono text-sm font-bold text-slate-900">
                        {cand.primaryIssue.publicRef}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">
                        {cand.primaryIssue.title}
                      </h4>
                      <p className="text-xs text-slate-600 mt-1 whitespace-pre-line bg-slate-50 p-3 rounded-lg border border-slate-100">
                        {cand.primaryIssue.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-medium">
                        {cand.primaryIssue.category.name} &bull; {cand.primaryIssue.subcategory.name}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                        Status: <strong className="text-slate-900">{cand.primaryIssue.status}</strong>
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                        Linked Reports: <strong className="text-slate-900">{cand.primaryIssue.reportCount}</strong>
                      </span>
                    </div>

                    {/* Photos from Primary Issue Reports */}
                    {cand.primaryIssue.reports.some((r) => r.evidenceUrl) && (
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                          Evidence Photos:
                        </span>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {cand.primaryIssue.reports
                            .filter((r) => r.evidenceUrl)
                            .map((r) => (
                              <a
                                key={r.id}
                                href={r.evidenceUrl!}
                                target="_blank"
                                rel="noreferrer"
                                className="relative group block flex-shrink-0"
                              >
                                <img
                                  src={r.evidenceUrl!}
                                  alt="Primary evidence"
                                  className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                                />
                                <span className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg text-xs transition">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </span>
                              </a>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Duplicate Candidate Issue */}
                  <div className="space-y-4 pt-4 md:pt-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-700 uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        New Candidate Issue
                      </span>
                      <span className="font-mono text-sm font-bold text-slate-900">
                        {cand.duplicateIssue.publicRef}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">
                        {cand.duplicateIssue.title}
                      </h4>
                      <p className="text-xs text-slate-600 mt-1 whitespace-pre-line bg-slate-50 p-3 rounded-lg border border-slate-100">
                        {cand.duplicateIssue.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-medium">
                        {cand.duplicateIssue.category.name} &bull; {cand.duplicateIssue.subcategory.name}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                        Status: <strong className="text-slate-900">{cand.duplicateIssue.status}</strong>
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                        Submitted: {new Date(cand.duplicateIssue.createdAt).toLocaleDateString("en-IN")}
                      </span>
                    </div>

                    {/* Photos from Duplicate Issue Reports */}
                    {cand.duplicateIssue.reports.some((r) => r.evidenceUrl) && (
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                          Evidence Photos:
                        </span>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {cand.duplicateIssue.reports
                            .filter((r) => r.evidenceUrl)
                            .map((r) => (
                              <a
                                key={r.id}
                                href={r.evidenceUrl!}
                                target="_blank"
                                rel="noreferrer"
                                className="relative group block flex-shrink-0"
                              >
                                <img
                                  src={r.evidenceUrl!}
                                  alt="Duplicate candidate evidence"
                                  className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                                />
                                <span className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg text-xs transition">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </span>
                              </a>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status or Action Footer */}
                <div className="bg-slate-50 p-4 border-t border-slate-200">
                  {resultMessage && resultMessage.id === cand.id && (
                    <div
                      className={`mb-3 p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                        resultMessage.type === "success"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-rose-50 text-rose-800 border border-rose-200"
                      }`}
                    >
                      {resultMessage.type === "success" ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      )}
                      <span>{resultMessage.text}</span>
                    </div>
                  )}

                  {isPending ? (
                    <div className="space-y-3">
                      <div>
                        <input
                          type="text"
                          value={resolutionNote[cand.id] || ""}
                          onChange={(e) =>
                            setResolutionNote((prev) => ({
                              ...prev,
                              [cand.id]: e.target.value,
                            }))
                          }
                          placeholder="Supervisor note / reason (e.g. Same pothole on FC road photographed by different citizens)..."
                          className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <button
                          disabled={actionLoading === cand.id}
                          onClick={() => handleResolve(cand.id, "KEEP_SEPARATE")}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                        >
                          <Split className="w-3.5 h-3.5 text-slate-500" />
                          Keep Separate
                        </button>

                        <button
                          disabled={actionLoading === cand.id}
                          onClick={() => handleResolve(cand.id, "MERGE")}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                        >
                          {actionLoading === cand.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <GitMerge className="w-3.5 h-3.5" />
                          )}
                          Merge &amp; Link Reports
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 flex items-center justify-between">
                      <span>
                        Resolved decision: <strong className="text-slate-800">{cand.status}</strong>
                        {cand.reason && ` &mdash; "${cand.reason}"`}
                      </span>
                      <span>Audited in municipal governance ledger</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
