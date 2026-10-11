"use client";

import React, { useState } from "react";
import Link from "next/link";

export function FloatingHelpAssistant() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-50 font-sans">
      {/* Popover Card */}
      {open && (
        <div
          role="dialog"
          aria-label="NagarSetu Help Assistant"
          className="mb-3 w-80 sm:w-96 bg-white border-2 border-[#0f2942] rounded-2xl shadow-2xl p-4 text-xs space-y-3 animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs">
                NS
              </span>
              <div>
                <strong className="text-slate-900 block text-xs">
                  NagarSetu Civic Assistant
                </strong>
                <span className="text-[10px] text-amber-800 font-semibold bg-amber-50 border border-amber-300 px-1.5 py-0.2 rounded">
                  Chatbot coming in next step
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-6 w-6 rounded-full hover:bg-slate-100 text-slate-500 flex items-center justify-center text-sm font-bold"
            >
              ✕
            </button>
          </div>

          <p className="text-slate-700 leading-relaxed">
            Welcome to <strong>NagarSetu</strong>! The upcoming AI chatbot module will guide citizens through conversational grievance intake with speech-to-text. In the meantime, use these quick shortcuts:
          </p>

          <div className="space-y-1.5 pt-1">
            <Link
              href="/report"
              onClick={() => setOpen(false)}
              className="w-full text-left p-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 flex items-center justify-between text-slate-900 font-bold transition"
            >
              <span>📢 Register a Municipal Complaint</span>
              <span>→</span>
            </Link>

            <Link
              href="/track"
              onClick={() => setOpen(false)}
              className="w-full text-left p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between text-slate-800 font-semibold transition"
            >
              <span>🔍 Track by Reference ID</span>
              <span>→</span>
            </Link>

            <Link
              href="/help"
              onClick={() => setOpen(false)}
              className="w-full text-left p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between text-slate-800 font-semibold transition"
            >
              <span>❓ Help & Technical Troubleshooting</span>
              <span>→</span>
            </Link>

            <Link
              href="/map"
              onClick={() => setOpen(false)}
              className="w-full text-left p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between text-slate-800 font-semibold transition"
            >
              <span>🗺️ Explore Pune Live Map</span>
              <span>→</span>
            </Link>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 text-center">
            Pune Municipal Grievance Workflow Engine • G-02 GovFix
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Toggle NagarSetu Help Assistant"
        className="min-h-[48px] px-4 py-2.5 rounded-full bg-[#0f2942] hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xl border-2 border-amber-500 transition hover:scale-105 active:scale-95"
      >
        <span className="text-base">💬</span>
        <span>Help Assistant</span>
        {!open && (
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
        )}
      </button>
    </div>
  );
}
