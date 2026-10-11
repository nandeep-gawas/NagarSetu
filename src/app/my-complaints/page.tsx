"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CivicHeader } from "@/components/CivicHeader";
import { useI18n } from "@/lib/i18n/context";

interface MyComplaintItem {
  reportId: string;
  reportReferenceId: string;
  description: string;
  photoUrl: string | null;
  photoTimestamp: string | null;
  createdAt: string;
  issue: {
    id: string;
    referenceId: string;
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
    category: { id: string; name: string; emoji: string };
    subcategory: { id: string; name: string };
    department: { id: string; name: string };
  };
}

export default function MyComplaintsPage() {
  const { t, tCategory, tSubcategory, tStatus } = useI18n();
  const [complaints, setComplaints] = useState<MyComplaintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthenticated, setUnauthenticated] = useState(false);

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/my-complaints", { cache: "no-store" });
      if (res.status === 401) {
        setUnauthenticated(true);
        setComplaints([]);
      } else if (res.ok) {
        const data = await res.json();
        setUnauthenticated(false);
        setComplaints(data.complaints || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComplaints();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <CivicHeader onAuthChange={() => loadComplaints()} />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-[#0f2942] text-white rounded-none p-6 shadow-sm border-l-8 border-amber-500 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold mb-1.5">
              CITIZEN GRIEVANCE RECORD • PUNE
            </span>
            <h1 className="text-2xl font-bold">{t("myComplaintsTitle")}</h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              View all municipal complaints submitted from your account, check
              SLA deadlines, and confirm resolutions.
            </p>
          </div>
          <Link
            href="/report"
            className="min-h-[44px] px-5 py-2.5 rounded-none bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center"
          >
            + {t("navReport")}
          </Link>
        </div>

        {loading && (
          <div className="bg-white border border-slate-300 rounded-none p-8 text-sm text-slate-600">
            Loading your complaints...
          </div>
        )}

        {!loading && unauthenticated && (
          <div className="bg-white border-2 border-amber-500 rounded-none p-6 space-y-3">
            <h2 className="text-lg font-bold text-slate-900">
               Sign In Required to View Your Complaints
            </h2>
            <p className="text-xs sm:text-sm text-slate-700">
              Please sign in as a citizen (or use the 1-click Demo Role Switcher
              in the top header) to view your personal grievance history.
            </p>
            <Link
              href="/login?returnTo=/my-complaints"
              className="inline-flex min-h-[44px] px-5 py-2.5 rounded-none bg-[#0f2942] text-white text-xs font-bold items-center"
            >
              Sign In Now →
            </Link>
          </div>
        )}

        {!loading && !unauthenticated && complaints.length === 0 && (
          <div className="bg-white border border-slate-300 rounded-none p-8 text-center space-y-3">
            <div className="text-base font-bold text-slate-900">
              No complaints registered under this account yet.
            </div>
            <Link
              href="/report"
              className="inline-flex min-h-[44px] px-5 py-2.5 rounded-none bg-[#0f2942] text-white text-xs font-bold items-center"
            >
              + {t("navReport")}
            </Link>
          </div>
        )}

        {!loading && !unauthenticated && complaints.length > 0 && (
          <div className="space-y-4">
            {complaints.map((c) => {
              const st = tStatus(c.issue.status);
              return (
                <div
                  key={c.reportId}
                  className="bg-white border border-slate-300 rounded-none p-5 shadow-2xs hover:border-slate-400 transition space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-base font-black text-[#0f2942]">
                          {c.issue.referenceId}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-xs border border-slate-300">
                          Report: {c.reportReferenceId}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#0f2942] text-white text-xs font-bold">
                          {st.label}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            c.issue.priority === "CRITICAL"
                              ? "bg-rose-600 text-white"
                              : c.issue.priority === "HIGH"
                              ? "bg-amber-500 text-slate-950"
                              : "bg-slate-200 text-slate-800"
                          }`}
                        >
                          {c.issue.priority}
                        </span>
                        {c.issue.isOverdue && (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 text-xs font-bold">
                             OVERDUE
                          </span>
                        )}
                      </div>

                      <h2 className="text-base font-bold text-slate-900 mt-1.5">
                        {c.issue.category.emoji}{" "}
                        {tCategory(c.issue.category.name)} —{" "}
                        {tSubcategory(c.issue.subcategory.name)}
                      </h2>
                      <p className="text-xs text-slate-600 mt-0.5">
                         {c.issue.publicLocationLabel} • Submitted:{" "}
                        {new Date(c.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <Link
                      href={`/track/${c.issue.referenceId}`}
                      className="min-h-[42px] px-4 py-2 rounded-none bg-[#0f2942] hover:bg-slate-800 text-white text-xs font-bold flex items-center shrink-0"
                    >
                      {c.issue.status === "RESOLVED_AWAITING_VERIFICATION"
                        ? " Verify & Confirm Closure →"
                        : "Track & Manage →"}
                    </Link>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-800 bg-slate-50 p-3 rounded-none border border-slate-200 line-clamp-2">
                    {c.description}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
