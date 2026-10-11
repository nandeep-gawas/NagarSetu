"use client";

import React, { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CivicHeader } from "@/components/CivicHeader";
import { useI18n } from "@/lib/i18n/context";

const PuneLiveMap = dynamic(() => import("@/components/PuneLiveMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[620px] w-full rounded-none border border-slate-300 bg-slate-100 flex items-center justify-center text-xs text-slate-600">
      Loading interactive Pune OpenStreetMap...
    </div>
  ),
});

interface StatsData {
  totalComplaints: number;
  resolved: number;
  inProgress: number;
  overdue: number;
  resolutionRate: number;
  onTimeResolutionRate: number;
  isDemoData: boolean;
  demoDataNotice: string;
}

export default function ExploreMapPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState<StatsData | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // offline
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      <CivicHeader />

      <main className="max-w-7xl mx-auto w-full px-4 py-6 sm:py-8 space-y-6 flex-1">
        {/* Banner with Action Buttons */}
        <div className="bg-[#0f2942] text-white rounded-none p-5 sm:p-6 shadow-sm border-l-8 border-amber-500 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold">
                PUNE MUNICIPAL GRIEVANCE EXPLORER
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold">
                Live Public Map
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold">
              Explore Complaints on Pune Live Map
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Real-time map of verified municipal issues across Pune. All coordinates are generalized to ~100m grid for citizen privacy.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/report"
              className="min-h-[44px] px-5 py-2.5 rounded-none bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center shadow-2xs"
            >
               {t("navReport")} →
            </Link>
            <Link
              href="/track"
              className="min-h-[44px] px-4 py-2.5 rounded-none bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-semibold text-xs sm:text-sm flex items-center"
            >
               {t("navTrack")}
            </Link>
          </div>
        </div>

        {/* Live Database Statistics Strip */}
        {stats && (
          <section
            aria-label="Pune Municipal Live Complaint Statistics"
            className="bg-white border border-slate-300 rounded-none p-4 sm:p-5 shadow-2xs space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                   Municipal Grievance Performance Strip
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                  Demo data (Prototype)
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                Rule: Counts physical issues (duplicates merged) • Excludes rejected
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 rounded-none bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-600">
                  Total Active Complaints
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-950 mt-0.5">
                  {stats.totalComplaints}
                </div>
              </div>

              <div className="p-3 rounded-none bg-emerald-50 border border-emerald-200">
                <div className="text-[11px] font-semibold text-emerald-800">
                  Resolved Complaints
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-900 mt-0.5">
                  {stats.resolved}
                </div>
              </div>

              <div className="p-3 rounded-none bg-blue-50 border border-blue-200">
                <div className="text-[11px] font-semibold text-blue-800">
                  In Progress / Field Work
                </div>
                <div className="text-xl sm:text-2xl font-black text-blue-900 mt-0.5">
                  {stats.inProgress}
                </div>
              </div>

              <div className="p-3 rounded-none bg-rose-50 border border-rose-200">
                <div className="text-[11px] font-semibold text-rose-800">
                  Overdue SLA Breaches
                </div>
                <div className="text-xl sm:text-2xl font-black text-rose-900 mt-0.5">
                  {stats.overdue}
                </div>
              </div>

              <div className="p-3 rounded-none bg-amber-50 border border-amber-200">
                <div className="text-[11px] font-semibold text-amber-800">
                  Resolution Rate
                </div>
                <div className="text-xl sm:text-2xl font-black text-amber-950 mt-0.5">
                  {stats.resolutionRate}%
                </div>
              </div>

              <div className="p-3 rounded-none bg-purple-50 border border-purple-200">
                <div className="text-[11px] font-semibold text-purple-800">
                  On-Time Resolution Rate
                </div>
                <div className="text-xl sm:text-2xl font-black text-purple-950 mt-0.5">
                  {stats.onTimeResolutionRate}%
                </div>
              </div>
            </div>
          </section>
        )}

        {/* The Live Map */}
        <PuneLiveMap onDataRefresh={fetchStats} height="600px" />
      </main>
    </div>
  );
}
