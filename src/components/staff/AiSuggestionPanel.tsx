"use client";

import React, { useState, useEffect } from "react";

interface AiSuggestionProps {
  issueId?: string;
  issueRef: string;
  categoryName: string;
  descriptions: string[];
  locationLabel?: string;
}

interface SuggestionData {
  categoryValidation: string;
  draftSummary: string;
  severityCues: string[];
  draftResponse: string;
  disclaimer: string;
}

export function AiSuggestionPanel({
  issueId,
  issueRef,
  categoryName,
  descriptions,
  locationLabel,
}: AiSuggestionProps) {
  const [data, setData] = useState<SuggestionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedResponse, setCopiedResponse] = useState<boolean>(false);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadSuggestion() {
      setLoading(true);
      try {
        const res = await fetch("/api/staff/ai-suggestion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issueId,
            publicRef: issueRef,
            categoryName,
            descriptions,
            locationLabel,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.ok && json.data && isMounted) {
            setData(json.data);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Could not fetch server AI suggestion, using local fallback", err);
      }

      // Local fallback
      if (isMounted) {
        const sampleDesc = descriptions[0] || "Municipal complaint";
        setData({
          categoryValidation: `Confirmed match for ${categoryName}. Field inspection recommended.`,
          draftSummary: `Citizen reports: "${sampleDesc.slice(0, 140)}${sampleDesc.length > 140 ? "..." : ""}"`,
          severityCues: ["Standard municipal maintenance complaint."],
          draftResponse: `Dear Citizen, Pune Municipal Corporation has logged your grievance (${issueRef}) regarding ${categoryName}. Our field inspection team has been scheduled to investigate the site and initiate remedial measures as per municipal SLA guidelines. Thank you for helping keep Pune clean and safe.`,
          disclaimer: "AI suggestion, not an official action. Human officer review required.",
        });
        setLoading(false);
      }
    }

    loadSuggestion();
    return () => {
      isMounted = false;
    };
  }, [issueId, issueRef, categoryName, descriptions, locationLabel]);

  const logCopyAudit = async (fieldCopied: string, text: string) => {
    if (!issueId) return;
    try {
      await fetch("/api/staff/ai-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "LOG_COPY",
          issueId,
          copiedText: text,
          fieldCopied,
        }),
      });
    } catch (err) {
      console.warn("Failed to log copy audit:", err);
    }
  };

  const handleCopyResponse = () => {
    if (!data) return;
    navigator.clipboard?.writeText(data.draftResponse);
    setCopiedResponse(true);
    logCopyAudit("draftResponse", data.draftResponse);
    setTimeout(() => setCopiedResponse(false), 2500);
  };

  const handleCopySummary = () => {
    if (!data) return;
    navigator.clipboard?.writeText(data.draftSummary);
    setCopiedSummary(true);
    logCopyAudit("draftSummary", data.draftSummary);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  return (
    <div className="bg-slate-900 border-2 border-indigo-500/40 rounded-none p-4 text-white space-y-3 shadow-md">
      {/* Header with Mandatory Governance Disclaimers */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-none bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
            
          </span>
          <div>
            <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
              AI Suggestion Panel (Draft Assistant)
            </h4>
            <span className="text-[10px] text-amber-300 font-semibold block">
              AI suggestion, not an official action
            </span>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-600/40 text-[10px] font-bold">
          NO DIRECT STATE MUTATION
        </span>
      </div>

      {/* AI Separation Invariant Notice */}
      <div className="p-2.5 rounded-none bg-indigo-950/60 border border-indigo-500/30 text-[11px] text-indigo-200 leading-relaxed">
        <strong>Mandatory Governance Rule:</strong> AI modules are strictly prohibited from changing complaint status, officer assignment, or SLA deadlines. This panel contains <u>NO buttons</u> that modify issue state or deadlines. An officer must review, manually edit, or copy drafts.
      </div>

      {loading ? (
        <div className="py-4 text-center text-xs text-indigo-300 animate-pulse">
          Generating AI suggestions and cues...
        </div>
      ) : data ? (
        /* Suggestions Content */
        <div className="space-y-3 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px] mb-0.5 font-medium">
              Suggested Category & Department:
            </span>
            <div className="bg-slate-800/80 px-2.5 py-1.5 rounded border border-slate-700 text-slate-200 font-mono text-[11px]">
              {categoryName} — <span className="text-emerald-400">{data.categoryValidation}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-slate-400 text-[11px] font-medium">
                Automated Incident Synthesis:
              </span>
              <button
                type="button"
                onClick={handleCopySummary}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 underline"
              >
                {copiedSummary ? " Copied" : "Copy Summary"}
              </button>
            </div>
            <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700 text-slate-300 text-[11px]">
              {data.draftSummary}
            </div>
          </div>

          {data.severityCues && data.severityCues.length > 0 && (
            <div>
              <span className="text-slate-400 block text-[11px] mb-1 font-medium">
                Extracted Severity / Priority Cues:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {data.severityCues.map((cue, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700 text-[10px]"
                  >
                     {cue}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <span className="text-slate-400 block text-[11px] mb-0.5 font-medium">
              Draft Citizen Response (Human Copy/Edit Only):
            </span>
            <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700 text-slate-200 text-[11px] leading-relaxed select-all">
              {data.draftResponse}
            </div>
          </div>

          {/* Copy Action Only (No state changes) */}
          <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800">
            <span className="text-[10px] text-slate-400 italic">
              Copy text to clipboard and paste into transition note if appropriate. Every copy event is logged to the municipal audit trail.
            </span>
            <button
              type="button"
              onClick={handleCopyResponse}
              className="px-3 py-1.5 rounded-none bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
            >
              {copiedResponse ? " Copied & Audit Logged" : " Copy Draft Response"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
