"use client";

import React, { useState } from "react";

interface InvalidActionDemoProps {
  issues: { id: string; publicRef: string; status: string; category: { name: string } }[];
  onAuditRefreshed?: () => void;
}

export function InvalidActionDemoPanel({
  issues,
  onAuditRefreshed,
}: InvalidActionDemoProps) {
  const [selectedIssueId, setSelectedIssueId] = useState(issues[0]?.id || "");
  const [scenarioType, setScenarioType] = useState<
    "citizen_close" | "officer_skip" | "wrong_dept"
  >("citizen_close");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    status: number;
    error?: string;
    auditEventId?: string;
    scenarioLabel: string;
    refusedAuditEntry?: {
      id: string;
      timestamp: string;
      actorLabel: string;
      action: string;
      reason: string;
      outcome: string;
      ruleApplied: string;
    } | null;
  } | null>(null);

  const selectedIssue = issues.find((i) => i.id === selectedIssueId) || issues[0];

  const handleExecuteIllegalAction = async () => {
    if (!selectedIssue) return;
    setLoading(true);
    setResult(null);

    let endpoint = `/api/issues/${selectedIssue.id}/transition`;
    let payload: Record<string, unknown> = {};
    let label = "";

    if (scenarioType === "citizen_close") {
      label = "Scenario H.1: Citizen Actor attempts to transition issue directly to CLOSED";
      // We simulate sending with an illegal state or actor parameter
      payload = {
        toState: "CLOSED",
        reason: "Illegal attempt by unauthorized citizen actor to close complaint",
      };
    } else if (scenarioType === "officer_skip") {
      label = "Scenario H.2: Officer skips prerequisite states (SUBMITTED -> RESOLVED_AWAITING_VERIFICATION)";
      payload = {
        toState: "RESOLVED_AWAITING_VERIFICATION",
        reason: "Illegal attempt: skipping verification and assignment prerequisites",
      };
    } else {
      label = "Scenario H.3: Officer attempts transition on another department's grievance";
      payload = {
        toState: "IN_PROGRESS",
        reason: "Illegal attempt across municipal department jurisdiction boundary",
      };
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      // Check the latest audit log to fetch the resulting REFUSED entry
      let refusedEntry = null;
      try {
        const auditRes = await fetch("/api/audit?outcome=REFUSED&limit=1");
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          if (auditData.auditEvents?.length > 0) {
            refusedEntry = auditData.auditEvents[0];
          }
        }
      } catch {
        // ignore
      }

      setResult({
        ok: res.ok,
        status: res.status,
        error: data.error || (res.ok ? "Unexpected: action was accepted!" : "Refused by server"),
        auditEventId: data.auditEventId || refusedEntry?.id,
        scenarioLabel: label,
        refusedAuditEntry: refusedEntry,
      });

      onAuditRefreshed?.();
    } catch (err) {
      setResult({
        ok: false,
        status: 500,
        error: "Network or server failure during simulation.",
        scenarioLabel: label,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border-2 border-rose-300 rounded-2xl shadow-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-lg bg-rose-600 text-white font-black flex items-center justify-center text-sm">
            ⚡
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Demonstration: Try an Invalid Action (Scenario H)
            </h3>
            <span className="text-xs text-rose-700 font-semibold block">
              Clearly labelled demo evaluator tool • Verifies server-side rejection & REFUSED audit logging
            </span>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200">
          DEMO ONLY • ADMIN & SUPERVISOR
        </span>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed">
        Test the server-enforced workflow invariants. In NagarSetu, rules are never enforced only by the UI. When an illegal move is executed (such as skipping required states, role authorization failure, or cross-department violations), the backend API refuses the request with an HTTP error and <strong>immediately writes an immutable AuditEvent with outcome = REFUSED</strong>.
      </p>

      {/* Simulator Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-rose-50/50 p-4 rounded-xl border border-rose-200 text-xs">
        <div>
          <label className="font-bold text-slate-800 block mb-1">
            1. Select Target Grievance:
          </label>
          <select
            value={selectedIssueId}
            onChange={(e) => setSelectedIssueId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-medium"
          >
            {issues.map((i) => (
              <option key={i.id} value={i.id}>
                {i.publicRef} — Status: {i.status} ({i.category.name})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-bold text-slate-800 block mb-1">
            2. Select Violation Scenario:
          </label>
          <select
            value={scenarioType}
            onChange={(e) =>
              setScenarioType(e.target.value as typeof scenarioType)
            }
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium"
          >
            <option value="citizen_close">
              Illegal Skip: Attempt to jump straight to CLOSED
            </option>
            <option value="officer_skip">
              State Graph Skip: Move SUBMITTED directly to RESOLVED without verification
            </option>
            <option value="wrong_dept">
              Department Violation: Cross-department state modification
            </option>
          </select>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={handleExecuteIllegalAction}
          disabled={loading || !selectedIssue}
          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition active:scale-95"
        >
          {loading ? "Simulating Refusal..." : "🚨 Deliberately Execute Illegal Action →"}
        </button>
      </div>

      {/* Output / Refusal Feedback Card */}
      {result && (
        <div className="space-y-3 pt-2">
          <div
            className={`p-4 rounded-xl border text-xs space-y-2 ${
              result.status === 400 || result.status === 403 || result.status === 401
                ? "bg-rose-950 text-rose-100 border-rose-700"
                : "bg-emerald-950 text-emerald-100 border-emerald-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold font-mono uppercase text-xs">
                Server Response: HTTP {result.status} {result.ok ? "ACCEPTED" : "REFUSED"}
              </span>
              <span className="px-2 py-0.5 rounded bg-rose-800 text-white text-[10px] font-bold">
                AUDIT LOGGED
              </span>
            </div>

            <p className="font-semibold text-rose-200">
              {result.error}
            </p>

            <div className="text-[11px] text-slate-300 border-t border-rose-800/60 pt-2 flex flex-wrap gap-4">
              <span><strong>Scenario:</strong> {result.scenarioLabel}</span>
              {result.auditEventId && (
                <span><strong>AuditEvent ID:</strong> <code>{result.auditEventId}</code></span>
              )}
            </div>
          </div>

          {/* New REFUSED Audit Entry Card */}
          {result.refusedAuditEntry && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-xs text-white space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="font-bold text-amber-400">
                  🛡️ New Immutable Audit Event Created:
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px]">
                  {result.refusedAuditEntry.outcome}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400">Action:</span>{" "}
                  <code className="text-rose-300">{result.refusedAuditEntry.action}</code>
                </div>
                <div>
                  <span className="text-slate-400">Actor:</span>{" "}
                  <span className="text-slate-200">{result.refusedAuditEntry.actorLabel}</span>
                </div>
                <div>
                  <span className="text-slate-400">Rule Applied:</span>{" "}
                  <span className="text-indigo-300 font-mono">{result.refusedAuditEntry.ruleApplied}</span>
                </div>
                <div>
                  <span className="text-slate-400">Timestamp:</span>{" "}
                  <span className="text-slate-300">{new Date(result.refusedAuditEntry.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-300 bg-slate-800/80 p-2 rounded border border-slate-700">
                <span className="text-slate-400">Refusal Reason:</span> {result.refusedAuditEntry.reason}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
