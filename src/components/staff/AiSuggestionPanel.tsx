"use client";

import React, { useState } from "react";

interface AiSuggestionProps {
  issueRef: string;
  categoryName: string;
  descriptions: string[];
}

export function AiSuggestionPanel({
  issueRef,
  categoryName,
  descriptions,
}: AiSuggestionProps) {
  const [copied, setCopied] = useState(false);

  // Compute deterministic demo AI suggestions based on citizen descriptions
  const sampleDesc = descriptions[0] || "Municipal complaint";
  const suggestedCategory = categoryName;
  const draftSummary = `Citizen reports: "${sampleDesc.slice(0, 140)}${sampleDesc.length > 140 ? "..." : ""}"`;
  const draftResponse = `Dear Citizen, Pune Municipal Corporation has logged your grievance (${issueRef}) regarding ${suggestedCategory}. Our field inspection team has been scheduled to investigate the site and initiate remedial measures as per municipal SLA guidelines. Thank you for helping keep Pune clean and safe.`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(draftResponse);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-slate-900 border-2 border-indigo-500/40 rounded-xl p-4 text-white space-y-3 shadow-md">
      {/* Header with Mandatory Governance Disclaimers */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-md bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
            🤖
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
      <div className="p-2.5 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-[11px] text-indigo-200 leading-relaxed">
        <strong>Mandatory Governance Rule:</strong> AI modules are strictly prohibited from changing complaint status, officer assignment, or SLA deadlines. This panel contains <u>NO buttons</u> that modify issue state or deadlines. An officer must review, manually edit, or copy drafts.
      </div>

      {/* Suggestions Content */}
      <div className="space-y-2 text-xs">
        <div>
          <span className="text-slate-400 block text-[11px] mb-0.5 font-medium">
            Suggested Category & Department:
          </span>
          <div className="bg-slate-800/80 px-2.5 py-1.5 rounded border border-slate-700 text-slate-200 font-mono text-[11px]">
            {suggestedCategory}
          </div>
        </div>

        <div>
          <span className="text-slate-400 block text-[11px] mb-0.5 font-medium">
            Automated Synthesis Summary:
          </span>
          <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700 text-slate-300 text-[11px]">
            {draftSummary}
          </div>
        </div>

        <div>
          <span className="text-slate-400 block text-[11px] mb-0.5 font-medium">
            Draft Citizen Response (Human Copy/Edit Only):
          </span>
          <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700 text-slate-200 text-[11px] leading-relaxed select-all">
            {draftResponse}
          </div>
        </div>
      </div>

      {/* Copy Action Only (No state changes) */}
      <div className="pt-1 flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-400 italic">
          Copy text to clipboard and paste into transition note if appropriate.
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
        >
          {copied ? "✓ Copied to Clipboard" : "📋 Copy Draft Response"}
        </button>
      </div>
    </div>
  );
}
