"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Clock,
  AlertTriangle,
  Flame,
  Star,
  RefreshCw,
  Award,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

interface CategoryStat {
  categoryId: string;
  categoryName: string;
  total: number;
  overdue: number;
  resolved: number;
  escalated: number;
}

interface OfficerStat {
  officerId: string;
  officerName: string;
  totalAssigned: number;
  overdue: number;
  resolved: number;
  escalated: number;
}

interface RatingRecord {
  id: string;
  publicRef: string;
  satisfactionRating: number | null;
  satisfactionComment: string | null;
  ratedAt: string | null;
  category: { name: string };
}

interface MetricsData {
  totalEligible: number;
  totalResolved: number;
  totalOverdue: number;
  onTimeRate: number;
  overallResolutionRate: number;
  avgResolutionHours: number;
  categoryStats: CategoryStat[];
  officerStats: OfficerStat[];
  avgSatisfaction: number;
  totalRatingsCount: number;
  ratingDistribution: { stars: number; count: number }[];
  recentRatings: RatingRecord[];
}

export default function PerformanceCharts() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/metrics");
      if (!res.ok) {
        throw new Error(`Failed to load metrics (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (data.ok && data.metrics) {
        setMetrics(data.metrics);
      } else {
        throw new Error(data.error || "Invalid response");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-none shadow-sm border border-slate-200 p-8 text-center">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
        <p className="text-slate-600 font-medium">Calculating municipal performance metrics...</p>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-none p-6 text-red-700">
        <p className="font-semibold mb-2">Unable to display performance metrics</p>
        <p className="text-sm mb-4">{error || "No data available."}</p>
        <button
          onClick={fetchMetrics}
          className="px-4 py-2 bg-red-600 text-white rounded-none text-sm hover:bg-red-700 font-medium transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  const maxCategoryTotal = Math.max(...metrics.categoryStats.map((c) => c.total), 1);
  const maxOfficerAssigned = Math.max(...metrics.officerStats.map((o) => o.totalAssigned), 1);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 rounded-none shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Live Analytics Engine
            </span>
            <span className="text-xs text-slate-400">Rule-driven SLA tracking</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mt-1 text-white">
            Pune Municipal Grievance Performance Dashboard
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
            Real-time compliance monitoring across Pune Municipal Corporation departments.
            Evaluated against configured response and resolution SLAs.
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-xs rounded-none transition border border-slate-600"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Metrics
        </button>
      </div>

      {/* KPI Highlight Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* On-Time Rate */}
        <div className="bg-white rounded-none p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              On-Time SLA Rate
            </span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-none">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mb-1">
            {metrics.onTimeRate}%
          </div>
          <p className="text-xs text-slate-500">
            Resolved before deadline across eligible complaints
          </p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                metrics.onTimeRate >= 80 ? "bg-emerald-500" : "bg-amber-500"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, metrics.onTimeRate))}%` }}
            />
          </div>
        </div>

        {/* Avg Resolution Time */}
        <div className="bg-white rounded-none p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Avg Resolution Time
            </span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-none">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mb-1">
            {metrics.avgResolutionHours} <span className="text-lg font-medium text-slate-500">hrs</span>
          </div>
          <p className="text-xs text-slate-500">
            From verified submission to official closure
          </p>
          <div className="text-[11px] text-blue-600 font-medium mt-3 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> SLA Target: &le; 48 hours
          </div>
        </div>

        {/* Active Overdue */}
        <div className="bg-white rounded-none p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Overdue Complaints
            </span>
            <span className="p-2 bg-rose-50 text-rose-600 rounded-none">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-rose-600 mb-1">
            {metrics.totalOverdue}
          </div>
          <p className="text-xs text-slate-500">
            Passed resolution deadline without closure
          </p>
          <div className="text-[11px] text-rose-600 font-medium mt-3 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" /> High priority supervisory queue
          </div>
        </div>

        {/* Citizen Satisfaction */}
        <div className="bg-white rounded-none p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Citizen Satisfaction
            </span>
            <span className="p-2 bg-amber-50 text-amber-500 rounded-none">
              <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mb-1">
            {metrics.avgSatisfaction > 0 ? metrics.avgSatisfaction.toFixed(1) : "N/A"}{" "}
            <span className="text-sm font-normal text-slate-500">/ 5.0</span>
          </div>
          <p className="text-xs text-slate-500">
            Based on {metrics.totalRatingsCount} verified citizen reviews
          </p>
          <div className="flex items-center gap-1 mt-3">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-3.5 h-3.5 ${
                  s <= Math.round(metrics.avgSatisfaction)
                    ? "fill-amber-400 text-amber-400"
                    : "text-slate-200"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Row 1: Category Workload & Overdue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown Chart */}
        <div className="bg-white rounded-none p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Departmental Workload & Overdue Ratio
              </h3>
              <p className="text-xs text-slate-500">
                Total grievances vs overdue count per municipal category
              </p>
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-slate-100 rounded text-slate-600">
              5 Departments
            </span>
          </div>

          <div className="space-y-4 pt-2">
            {metrics.categoryStats.map((cat) => {
              const overduePercent = cat.total > 0 ? (cat.overdue / cat.total) * 100 : 0;
              const resolvedPercent = cat.total > 0 ? (cat.resolved / cat.total) * 100 : 0;

              return (
                <div key={cat.categoryId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 truncate max-w-[200px]">
                      {cat.categoryName}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">
                        {cat.total} total
                      </span>
                      <span className="text-emerald-600 font-medium">
                        {cat.resolved} resolved
                      </span>
                      {cat.overdue > 0 && (
                        <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">
                          {cat.overdue} overdue
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Multi-segment bar */}
                  <div className="w-full h-3 bg-slate-100 rounded-full flex overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${resolvedPercent}%` }}
                      title={`Resolved: ${cat.resolved}`}
                    />
                    <div
                      className="bg-rose-500 h-full transition-all"
                      style={{ width: `${overduePercent}%` }}
                      title={`Overdue: ${cat.overdue}`}
                    />
                    <div
                      className="bg-blue-400 h-full transition-all opacity-60"
                      style={{
                        width: `${Math.max(
                          0,
                          100 - resolvedPercent - overduePercent
                        )}%`,
                      }}
                      title="In Progress"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chart Legend */}
          <div className="flex items-center gap-4 text-xs text-slate-500 mt-6 pt-4 border-t border-slate-100">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm inline-block" />
              Resolved
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-sm inline-block" />
              Overdue (SLA Breached)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-blue-400 opacity-60 rounded-sm inline-block" />
              Active In Progress
            </span>
          </div>
        </div>

        {/* Officer Workload & Escalation Distribution */}
        <div className="bg-white rounded-none p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Officer Assignment & Escalation Level
              </h3>
              <p className="text-xs text-slate-500">
                Grievances assigned and supervisor escalations per field officer
              </p>
            </div>
            <Award className="w-5 h-5 text-indigo-500" />
          </div>

          <div className="space-y-4 pt-2">
            {metrics.officerStats.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">No officers assigned yet.</p>
            ) : (
              metrics.officerStats.map((off) => {
                const assignedRatio = (off.totalAssigned / maxOfficerAssigned) * 100;

                return (
                  <div key={off.officerId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">
                        {off.officerName}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500">
                          {off.totalAssigned} assigned
                        </span>
                        <span className="text-emerald-600 font-medium">
                          {off.resolved} done
                        </span>
                        {off.escalated > 0 && (
                          <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                            <Flame className="w-3 h-3 text-amber-500" />
                            {off.escalated} escalated
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full transition-all"
                        style={{ width: `${Math.max(5, assignedRatio)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Automated escalation occurs after 24h &amp; 48h SLA misses</span>
            <span className="text-indigo-600 font-medium">Supervisor monitored</span>
          </div>
        </div>
      </div>

      {/* Row 2: Citizen Satisfaction Ratings & Review Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rating Breakdown */}
        <div className="bg-white rounded-none p-6 border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-1">
            Citizen Satisfaction Distribution
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Ratings submitted by Pune citizens following complaint closure
          </p>

          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-100">
            <div className="text-4xl font-extrabold text-slate-900">
              {metrics.avgSatisfaction > 0 ? metrics.avgSatisfaction.toFixed(1) : "0.0"}
            </div>
            <div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${
                      s <= Math.round(metrics.avgSatisfaction)
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-200"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {metrics.totalRatingsCount} verified ratings
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((stars) => {
              const item = metrics.ratingDistribution.find((r) => r.stars === stars);
              const count = item ? item.count : 0;
              const percent =
                metrics.totalRatingsCount > 0
                  ? (count / metrics.totalRatingsCount) * 100
                  : 0;

              return (
                <div key={stars} className="flex items-center gap-2 text-xs">
                  <span className="w-12 text-slate-600 font-medium flex items-center gap-1">
                    {stars} <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  </span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-slate-500">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Citizen Feedback Comments */}
        <div className="bg-white rounded-none p-6 border border-slate-200 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Recent Citizen Comments &amp; Feedback
              </h3>
              <p className="text-xs text-slate-500">
                Verified feedback from citizen tracking portal upon resolution
              </p>
            </div>
            <span className="text-xs text-slate-400">Post-closure surveys</span>
          </div>

          {metrics.recentRatings.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              No citizen ratings recorded yet. Ratings appear when citizens evaluate closed grievances.
            </div>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {metrics.recentRatings.map((r) => (
                <div
                  key={r.id}
                  className="p-3.5 bg-slate-50 rounded-none border border-slate-100 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-indigo-700">
                        {r.publicRef}
                      </span>
                      <span className="text-slate-500">&bull; {r.category.name}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3 h-3 ${
                            s <= (r.satisfactionRating || 0)
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {r.satisfactionComment ? (
                    <p className="text-xs text-slate-700 italic">
                      &ldquo;{r.satisfactionComment}&rdquo;
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      (No written comment provided)
                    </p>
                  )}
                  {r.ratedAt && (
                    <span className="text-[10px] text-slate-400 self-end">
                      {new Date(r.ratedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
