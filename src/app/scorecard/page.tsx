"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CivicHeader } from "@/components/CivicHeader";
import { useI18n } from "@/lib/i18n/context";

interface DepartmentScorecardItem {
  categoryId: string;
  categoryName: string;
  emoji: string;
  departmentName: string;
  totalComplaints: number;
  resolved: number;
  overdue: number;
  onTimeResolutionRate: number;
  avgResolutionHours: number;
}

interface StatsResponse {
  ok: boolean;
  totalComplaints: number;
  resolved: number;
  inProgress: number;
  overdue: number;
  resolutionRate: number;
  onTimeResolutionRate: number;
  isDemoData: boolean;
  demoDataNotice: string;
  departmentScorecard: DepartmentScorecardItem[];
}

export default function ScorecardPage() {
  const { t, tCategory } = useI18n();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      <CivicHeader />

      <main className="max-w-6xl mx-auto w-full px-4 py-8 space-y-8 flex-1">
        {/* Banner */}
        <div className="bg-[#0f2942] text-white rounded-none p-6 sm:p-8 shadow-sm border-l-8 border-amber-500 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold">
                PUNE CIVIC ACCOUNTABILITY BENCHMARK
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 font-bold text-[10px]">
                Demo Data Prototype
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              Municipal Accountability Scorecard
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Live departmental performance audit. On-time resolution rate, average resolution time, and active SLA overdue counts calculated strictly from the municipal database.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/map"
              className="min-h-[44px] px-4 py-2.5 rounded-none bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs sm:text-sm font-semibold flex items-center"
            >
               Explore Map
            </Link>
            <Link
              href="/report"
              className="min-h-[44px] px-5 py-2.5 rounded-none bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center shadow-2xs"
            >
               {t("navReport")} →
            </Link>
          </div>
        </div>

        {/* Global Summary Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-none border border-slate-300 shadow-2xs space-y-1">
              <div className="text-xs font-semibold text-slate-600">
                Citywide Resolution Rate
              </div>
              <div className="text-2xl sm:text-3xl font-black text-[#0f2942]">
                {stats.resolutionRate}%
              </div>
              <div className="text-[11px] text-slate-500">
                {stats.resolved} of {stats.totalComplaints} eligible complaints
              </div>
            </div>

            <div className="bg-white p-5 rounded-none border border-purple-200 shadow-2xs space-y-1">
              <div className="text-xs font-semibold text-purple-800">
                On-Time Resolution Rate
              </div>
              <div className="text-2xl sm:text-3xl font-black text-purple-900">
                {stats.onTimeResolutionRate}%
              </div>
              <div className="text-[11px] text-slate-500">
                Resolved before SLA expiration
              </div>
            </div>

            <div className="bg-white p-5 rounded-none border border-rose-200 shadow-2xs space-y-1">
              <div className="text-xs font-semibold text-rose-800">
                Current Overdue Issues
              </div>
              <div className="text-2xl sm:text-3xl font-black text-rose-600">
                {stats.overdue}
              </div>
              <div className="text-[11px] text-rose-600 font-semibold">
                Auto-escalated by deadline worker
              </div>
            </div>

            <div className="bg-white p-5 rounded-none border border-blue-200 shadow-2xs space-y-1">
              <div className="text-xs font-semibold text-blue-800">
                In Progress on Site
              </div>
              <div className="text-2xl sm:text-3xl font-black text-blue-900">
                {stats.inProgress}
              </div>
              <div className="text-[11px] text-slate-500">
                Assigned to department field teams
              </div>
            </div>
          </div>
        )}

        {/* Department Breakdown Table */}
        <div className="bg-white border border-slate-300 rounded-none overflow-hidden shadow-2xs">
          <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
                 Departmental Performance Matrix
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Comparison across the 5 PMC operational grievance branches
              </p>
            </div>
            <button
              type="button"
              onClick={fetchStats}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-none bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100"
            >
              {loading ? "Updating..." : "↻ Refresh Stats"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Department & Category</th>
                  <th className="p-3.5 text-center">Eligible Issues</th>
                  <th className="p-3.5 text-center">Resolved</th>
                  <th className="p-3.5 text-center">Overdue </th>
                  <th className="p-3.5 text-center">On-Time Rate (%)</th>
                  <th className="p-3.5 text-center">Avg Resolution Time</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {stats?.departmentScorecard.map((dept) => (
                  <tr key={dept.categoryId} className="hover:bg-slate-50 transition">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{dept.emoji}</span>
                        <div>
                          <div className="font-bold text-slate-900">
                            {tCategory(dept.categoryName)}
                          </div>
                          <div className="text-xs text-slate-500">
                            {dept.departmentName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 text-center font-bold font-mono">
                      {dept.totalComplaints}
                    </td>
                    <td className="p-3.5 text-center font-semibold text-emerald-800 font-mono">
                      {dept.resolved}
                    </td>
                    <td className="p-3.5 text-center font-bold text-rose-600 font-mono">
                      {dept.overdue > 0 ? ` ${dept.overdue}` : "0"}
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full font-bold text-xs ${
                          dept.onTimeResolutionRate >= 75
                            ? "bg-emerald-100 text-emerald-900"
                            : dept.onTimeResolutionRate >= 50
                            ? "bg-amber-100 text-amber-900"
                            : "bg-rose-100 text-rose-900"
                        }`}
                      >
                        {dept.onTimeResolutionRate}%
                      </span>
                    </td>
                    <td className="p-3.5 text-center font-mono">
                      {dept.avgResolutionHours > 0
                        ? `${dept.avgResolutionHours} hrs`
                        : "—"}
                    </td>
                    <td className="p-3.5 text-right">
                      <Link
                        href={`/map`}
                        className="text-xs font-bold text-[#0f2942] underline hover:text-amber-800"
                      >
                        View on Map →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Calculation Invariant Rules Section */}
        <section className="bg-white border border-slate-300 rounded-none p-5 shadow-2xs space-y-2 text-xs">
          <h3 className="font-bold text-slate-900 uppercase tracking-wider">
             Official Scorecard Calculation Rules
          </h3>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>
              <strong>Physical Issue Counting:</strong> Complaints merged due to duplicate proximity are grouped under their primary issue to prevent artificial volume inflation.
            </li>
            <li>
              <strong>Exclusion of Rejected Items:</strong> Issues rejected due to out-of-jurisdiction claims are excluded from performance denominators.
            </li>
            <li>
              <strong>On-Time Calculation:</strong> An issue counts as on-time only if resolved timestamp is strictly on or prior to the initial resolution SLA deadline.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
