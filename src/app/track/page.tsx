"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CivicHeader } from "@/components/CivicHeader";
import { useI18n } from "@/lib/i18n/context";

const SAMPLE_REFERENCE_IDS = [
  {
    ref: "NS-2026-001001",
    desc: "Deep pothole near Kothrud Bus Stand (Submitted)",
  },
  {
    ref: "NS-2026-001002",
    desc: "Major water pipe burst at Baner Link Road (In Progress — Overdue)",
  },
  {
    ref: "NS-2026-001003",
    desc: "Overflowing dustbin at Hadapsar (Resolved — Awaiting Verification)",
  },
  {
    ref: "NS-2026-001004",
    desc: "Broken streetlight at Viman Nagar (Assigned)",
  },
  {
    ref: "NS-2026-001005",
    desc: "Blocked sewage line at Kharadi (Verified)",
  },
];

export default function TrackSearchPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [refInput, setRefInput] = useState("NS-2026-001001");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = refInput.trim().toUpperCase();
    if (!cleaned) return;
    router.push(`/track/${encodeURIComponent(cleaned)}`);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <CivicHeader />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-[#0f2942] text-white rounded-xl p-6 shadow-sm border-l-8 border-amber-500">
          <span className="inline-block px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold mb-1.5">
            PMC GRIEVANCE TRACKER • PUNE
          </span>
          <h1 className="text-2xl font-bold">{t("trackPageTitle")}</h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Enter a Complaint Reference ID (e.g.{" "}
            <code className="font-mono text-amber-300">NS-2026-001001</code>) or
            Report Reference ID (e.g.{" "}
            <code className="font-mono text-amber-300">RPT-2026-1001</code>) to
            inspect live workflow status, SLA countdown, and the public audit
            timeline.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-5 flex flex-col sm:flex-row gap-2.5"
          >
            <input
              type="text"
              aria-label="Complaint Reference ID"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              placeholder={t("trackSearchPlaceholder")}
              className="flex-1 min-h-[48px] px-4 py-2.5 rounded-lg bg-white text-slate-900 font-mono text-sm border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="submit"
              className="min-h-[48px] px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition"
            >
              🔍 {t("btnSearchRef")}
            </button>
          </form>
        </div>

        {/* Seeded Pune Reference IDs for Quick Demo Testing */}
        <div className="bg-white border border-slate-300 rounded-xl p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              📌 Seeded Pune Grievance Reference IDs (1-Click Track)
            </h2>
            <Link
              href="/my-complaints"
              className="text-xs font-bold text-[#0f2942] underline"
            >
              View All My Registered Complaints →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SAMPLE_REFERENCE_IDS.map((item) => (
              <Link
                key={item.ref}
                href={`/track/${item.ref}`}
                className="p-3.5 rounded-lg border border-slate-300 hover:border-[#0f2942] bg-slate-50 hover:bg-amber-50/50 transition flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-mono text-sm font-bold text-[#0f2942]">
                    {item.ref}
                  </div>
                  <div className="text-xs text-slate-700 mt-0.5">
                    {item.desc}
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-800 shrink-0">
                  Track →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
