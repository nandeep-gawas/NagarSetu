"use client";

import React from "react";
import Link from "next/link";
import { CivicHeader } from "@/components/CivicHeader";
import { useI18n } from "@/lib/i18n/context";

export default function AboutPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      <CivicHeader />

      <main className="max-w-4xl mx-auto w-full px-4 py-8 space-y-8 flex-1">
        {/* Banner */}
        <div className="bg-[#0f2942] text-white rounded-none p-6 sm:p-8 shadow-sm border-l-8 border-amber-500 space-y-3">
          <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold inline-block">
            G-02 GOVFIX • PUNE MUNICIPAL GRIEVANCE ENGINE
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold">About NagarSetu</h1>
          <p className="text-base sm:text-lg font-serif italic text-amber-300">
            &ldquo;Your Complaint. Our Accountability. Pune&apos;s Progress.&rdquo;
          </p>
        </div>

        {/* Mission & Purpose */}
        <section className="bg-white border border-slate-300 rounded-none p-6 shadow-2xs space-y-4">
          <h2 className="text-lg font-bold text-slate-900">
            Mission: Accountable Civic Redressal for Pune Citizens
          </h2>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            <strong>NagarSetu</strong> is built specifically for the <strong>G-02 GovFix</strong> track: a Configurable Public-Institution Workflow Engine. We chose strictly the municipal grievance resolution track for <strong>Pune, Maharashtra, India</strong>.
          </p>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            In many civic portals, complaints vanish into a bureaucratic black box with no transparent deadlines, subjective prioritization, and untracked status changes. NagarSetu transforms this experience by coupling an accessible citizen intake interface with a strict, server-enforced workflow engine that enforces SLAs, records immutable audit trails, and automatically escalates neglected issues.
          </p>
        </section>

        {/* Five Architectural Pillars */}
        <section className="bg-white border border-slate-300 rounded-none p-6 shadow-2xs space-y-4">
          <h2 className="text-lg font-bold text-slate-900">
            Five Core Architectural Pillars
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-none bg-slate-50 border border-slate-200 space-y-1.5">
              <strong className="text-slate-900 font-bold block text-sm">
                1. Server-Enforced Workflow Engine
              </strong>
              <p className="text-slate-600 leading-relaxed">
                Rules are checked on the server (Prisma + SQLite), never in the UI alone. Transitions like <em>Submitted → Resolved</em> are mathematically refused without completing <em>Verified, Assigned, and In Progress</em>.
              </p>
            </div>

            <div className="p-4 rounded-none bg-slate-50 border border-slate-200 space-y-1.5">
              <strong className="text-slate-900 font-bold block text-sm">
                2. Automated SLA Deadlines & Escalation
              </strong>
              <p className="text-slate-600 leading-relaxed">
                A separate Node worker runs every minute to enforce deadlines. Missed deadlines raise priority (Normal → High → Critical) and trigger Level 1 and Level 2 supervisor escalation events.
              </p>
            </div>

            <div className="p-4 rounded-none bg-slate-50 border border-slate-200 space-y-1.5">
              <strong className="text-slate-900 font-bold block text-sm">
                3. Intelligent Duplicate Detection
              </strong>
              <p className="text-slate-600 leading-relaxed">
                Reports within 50m of the same subcategory are checked for similarity. Multiple citizen reports link to the same underlying physical issue, boosting its priority rather than creating cluttered duplicates.
              </p>
            </div>

            <div className="p-4 rounded-none bg-slate-50 border border-slate-200 space-y-1.5">
              <strong className="text-slate-900 font-bold block text-sm">
                4. Immutable Audit Trail & RBAC
              </strong>
              <p className="text-slate-600 leading-relaxed">
                Every state transition, assignment, deadline extension, and refused tampering attempt writes an immutable <code>AuditEvent</code> with actor stamps, before/after values, and the specific rule applied.
              </p>
            </div>

            <div className="p-4 rounded-none bg-slate-50 border border-slate-200 space-y-1.5 md:col-span-2">
              <strong className="text-slate-900 font-bold block text-sm">
                5. Location Privacy by Design
              </strong>
              <p className="text-slate-600 leading-relaxed">
                Public maps and APIs snap coordinates to a ~100m grid and expose generalized landmark names. Exact coordinates and private citizen records are strictly isolated to authorized municipal staff.
              </p>
            </div>
          </div>
        </section>

        {/* Demo Notice Disclaimer */}
        <section className="bg-amber-50 border-2 border-amber-400 rounded-none p-5 shadow-2xs space-y-2 text-xs">
          <div className="font-bold text-amber-950 uppercase tracking-wider">
             Demonstration & Prototype Disclosure
          </div>
          <p className="text-slate-700 leading-relaxed">
            NagarSetu is developed as an academic and hackathon engineering demonstration for G-02 GovFix. All seeded data, ward configurations, and SLA rules represent demonstration models and are not official Pune Municipal Corporation legal commitments.
          </p>
          <div className="pt-1">
            <Link
              href="/"
              className="text-[#0f2942] font-bold underline hover:text-amber-800"
            >
              ← Return to NagarSetu Homepage
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
