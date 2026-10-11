"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CivicHeader } from "@/components/CivicHeader";
import { useI18n } from "@/lib/i18n/context";
import { STATUS_TRANSLATIONS } from "@/lib/i18n/dictionaries";
import {
  PMC_OFFICIAL_WEBSITE,
  NAGARSETU_TECH_SUPPORT,
  DEPARTMENT_CONTACTS,
} from "@/data/departmentContacts";

export default function HelpPage() {
  const { lang, t, tStatus } = useI18n();
  const [activeFaq, setActiveFaq] = useState<string | null>("register");

  const toggleFaq = (key: string) => {
    setActiveFaq((prev) => (prev === key ? null : key));
  };

  const statusList = [
    "SUBMITTED",
    "VERIFIED",
    "ASSIGNED",
    "IN_PROGRESS",
    "RESOLVED_AWAITING_VERIFICATION",
    "CLOSED",
    "REJECTED",
    "REOPENED",
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      <CivicHeader />

      <main className="max-w-5xl mx-auto w-full px-4 py-8 space-y-8 flex-1">
        {/* Banner */}
        <div className="bg-[#0f2942] text-white rounded-xl p-6 sm:p-8 shadow-sm border-l-8 border-amber-500 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold mb-1.5 inline-block">
              CITIZEN ASSISTANCE & SYSTEM DOCUMENTATION
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold">
              Help & Support Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Step-by-step guidance on registering, tracking, deadlines, reopening, and troubleshooting technical issues on NagarSetu.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/report"
              className="min-h-[44px] px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center shadow-2xs"
            >
              📢 Register Complaint →
            </Link>
            <Link
              href="/track"
              className="min-h-[44px] px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs sm:text-sm font-semibold flex items-center"
            >
              🔍 Track Status
            </Link>
          </div>
        </div>

        {/* Quick Jump Bar */}
        <nav
          aria-label="Help Sections Navigation"
          className="bg-white border border-slate-300 rounded-xl p-3 shadow-2xs flex flex-wrap gap-1.5 text-xs font-bold"
        >
          {[
            { id: "register", label: "1. How to Register" },
            { id: "categories", label: "2. Finding Categories" },
            { id: "track", label: "3. How to Track" },
            { id: "statuses", label: "4. Status Meanings" },
            { id: "deadlines", label: "5. Deadlines & Escalation" },
            { id: "reopen", label: "6. How to Reopen" },
            { id: "municipal", label: "7. Municipal Directory" },
            { id: "troubleshoot", label: "8. Technical Troubleshooting" },
          ].map((sec) => (
            <a
              key={sec.id}
              href={`#${sec.id}`}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#0f2942] hover:text-white transition text-slate-700"
            >
              {sec.label}
            </a>
          ))}
        </nav>

        {/* SECTION 1: HOW TO REGISTER */}
        <section
          id="register"
          className="bg-white border border-slate-300 rounded-xl p-6 shadow-2xs space-y-4"
        >
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>📢</span> 1. How to Register a Municipal Grievance
          </h2>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            NagarSetu provides a simple, structured 7-step wizard that ensures your complaint reaches the correct municipal department with actionable evidence and location metadata:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <strong className="text-slate-900 block font-bold">
                Step 1: Choose Category & Subcategory
              </strong>
              <p className="text-slate-600">
                Select from the 5 Pune municipal tracks. Preselected options are available from category links.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <strong className="text-slate-900 block font-bold">
                Step 2: Describe in Your Own Words
              </strong>
              <p className="text-slate-600">
                Write freely in Marathi, Hindi, or English (5–2000 chars). Your description is stored verbatim and never altered.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <strong className="text-slate-900 block font-bold">
                Step 3: Capture or Upload Evidence
              </strong>
              <p className="text-slate-600">
                Take an on-site photo with your phone camera or upload from gallery (JPG/PNG up to 10 MB, MP4 up to 30 MB).
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <strong className="text-slate-900 block font-bold">
                Step 4: Automatic Location & Time Check
              </strong>
              <p className="text-slate-600">
                Our dual client/server EXIF tool checks photo GPS and time. If GPS is missing, device location or map search is used.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <strong className="text-slate-900 block font-bold">
                Step 5: Interactive Pune Map Pin
              </strong>
              <p className="text-slate-600">
                Drag the red marker pin or search a Pune landmark to confirm the exact location. Never type raw coordinates.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <strong className="text-slate-900 block font-bold">
                Steps 6 & 7: SLA Review & Submission
              </strong>
              <p className="text-slate-600">
                Review estimated response/resolution deadlines and confirm submission with your citizen account.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 2: FINDING CATEGORIES */}
        <section
          id="categories"
          className="bg-white border border-slate-300 rounded-xl p-6 shadow-2xs space-y-3"
        >
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>🏷️</span> 2. Finding the Right Municipal Category
          </h2>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            Ensure your complaint is assigned directly to the responsible Pune ward officer by selecting the appropriate operational branch:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs pt-1">
            <Link
              href="/categories/waste-management-sanitation"
              className="p-3 rounded-lg border border-slate-200 hover:border-[#0f2942] bg-slate-50 hover:bg-white transition"
            >
              <div className="font-bold text-slate-900 text-sm">
                🗑️ Waste & Sanitation
              </div>
              <div className="text-slate-500 mt-1">
                Garbage collection, dustbins, dead animals, public toilets.
              </div>
            </Link>

            <Link
              href="/categories/roads-infrastructure"
              className="p-3 rounded-lg border border-slate-200 hover:border-[#0f2942] bg-slate-50 hover:bg-white transition"
            >
              <div className="font-bold text-slate-900 text-sm">
                🕳️ Roads & Infrastructure
              </div>
              <div className="text-slate-500 mt-1">
                Potholes, broken streetlights, manhole covers, footpaths.
              </div>
            </Link>

            <Link
              href="/categories/water-sewage"
              className="p-3 rounded-lg border border-slate-200 hover:border-[#0f2942] bg-slate-50 hover:bg-white transition"
            >
              <div className="font-bold text-slate-900 text-sm">
                💧 Water & Sewage
              </div>
              <div className="text-slate-500 mt-1">
                Contaminated water, pipe bursts, sewage overflow, supply cuts.
              </div>
            </Link>

            <Link
              href="/categories/civic-nuisance-public-safety"
              className="p-3 rounded-lg border border-slate-200 hover:border-[#0f2942] bg-slate-50 hover:bg-white transition"
            >
              <div className="font-bold text-slate-900 text-sm">
                ⚠️ Civic Nuisance & Safety
              </div>
              <div className="text-slate-500 mt-1">
                Stray animals, tree cutting, encroachments, abandoned cars.
              </div>
            </Link>

            <Link
              href="/categories/other"
              className="p-3 rounded-lg border border-slate-200 hover:border-[#0f2942] bg-slate-50 hover:bg-white transition"
            >
              <div className="font-bold text-slate-900 text-sm">
                📍 Other Municipal Issues
              </div>
              <div className="text-slate-500 mt-1">
                General civic matters handled by PMC administration.
              </div>
            </Link>
          </div>
        </section>

        {/* SECTION 3: HOW TO TRACK */}
        <section
          id="track"
          className="bg-white border border-slate-300 rounded-xl p-6 shadow-2xs space-y-3"
        >
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>🔍</span> 3. How to Track Your Complaint
          </h2>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            Every submission generates a unique reference ID in the format{" "}
            <code className="font-mono font-bold text-[#0f2942] bg-slate-100 px-1.5 py-0.5 rounded">
              NS-2026-XXXXXX
            </code>{" "}
            (Citizen Report ID) and{" "}
            <code className="font-mono font-bold text-[#0f2942] bg-slate-100 px-1.5 py-0.5 rounded">
              PMC-2026-XXXX
            </code>{" "}
            (Municipal Issue ID).
          </p>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="font-bold text-slate-900">
              Tracking Capabilities on NagarSetu:
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              <li>
                <strong>Public Tracking:</strong> Anyone with a reference ID can view the current status, deadline countdown, and public audit history.
              </li>
              <li>
                <strong>Citizen Owner Actions:</strong> When signed in as the reporting citizen, you can attach additional photos/progress notes, verify resolution satisfaction, and confirm closure.
              </li>
              <li>
                <strong>My Complaints:</strong> Access all grievances submitted under your account in one place via{" "}
                <Link href="/my-complaints" className="text-[#0f2942] font-bold underline">
                  My Complaints
                </Link>
                .
              </li>
            </ul>
          </div>
        </section>

        {/* SECTION 4: WHAT EACH STATUS MEANS */}
        <section
          id="statuses"
          className="bg-white border border-slate-300 rounded-xl p-6 shadow-2xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>🚦</span> 4. What Each Workflow Status Means
            </h2>
            <span className="text-xs text-slate-500">
              Available in English, Marathi, and Hindi
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {statusList.map((stKey) => {
              const trans = tStatus(stKey);
              return (
                <div
                  key={stKey}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#0f2942] text-white font-bold text-[11px]">
                      {trans.label}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {stKey}
                    </span>
                  </div>
                  <p className="text-slate-700 leading-relaxed font-medium">
                    {trans.explanation}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 5: DEADLINES & ESCALATION */}
        <section
          id="deadlines"
          className="bg-white border border-slate-300 rounded-xl p-6 shadow-2xs space-y-3"
        >
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>⏱️</span> 5. Deadlines, Overdue Flags & Automated Escalation
          </h2>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            NagarSetu is powered by a background scheduled worker (<code>worker/deadlineMonitor.ts</code>) running every minute that monitors municipal response commitments:
          </p>

          <div className="space-y-3 text-xs pt-1">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <strong className="text-slate-900 block font-bold mb-1">
                1. Initial Response SLA
              </strong>
              <p className="text-slate-600">
                Department officers must review and acknowledge the complaint within the configured response window (e.g. 12 to 24 hours depending on category severity).
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-300">
              <strong className="text-amber-950 block font-bold mb-1">
                2. Resolution SLA & Level 1 Escalation
              </strong>
              <p className="text-amber-900">
                If the resolution deadline expires while the issue is still active, the system automatically marks the issue as <strong>Overdue (🚨)</strong>, logs a <code>MISSED_DEADLINE</code> immutable audit event, raises priority from NORMAL to HIGH, and triggers a Level 1 Escalation notification directly to the department supervisor.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-300">
              <strong className="text-rose-950 block font-bold mb-1">
                3. Critical Escalation (Level 2)
              </strong>
              <p className="text-rose-900">
                If an overdue issue remains unresolved beyond a further configured threshold (or reaches 5 linked citizen reports), priority is escalated to CRITICAL and Level 2 escalation alerts are broadcast to municipal supervisors and administrators.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 6: HOW TO REOPEN */}
        <section
          id="reopen"
          className="bg-white border border-slate-300 rounded-xl p-6 shadow-2xs space-y-3"
        >
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>↺</span> 6. How to Reopen an Issue (7-Day Citizen Window)
          </h2>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            When a field officer marks an issue as <em>Resolved — Awaiting Verification</em>, you have an official 7-day window to verify the site:
          </p>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="font-bold text-slate-900">Official Reopening Rule:</div>
            <p className="text-slate-700 leading-relaxed">
              If the problem persists on-site (e.g. water leak returns after rain, pothole filler washes away), the citizen who originally reported the issue can click <strong>Request Reopening</strong> on their tracking page within 7 days. This transitions the issue to <code>REOPENED</code>, requiring supervisor reassignment and investigation.
            </p>
          </div>
        </section>

        {/* SECTION 7: MUNICIPAL CONTACTS PLACEHOLDER */}
        <section
          id="municipal"
          className="bg-white border border-slate-300 rounded-xl p-6 shadow-2xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>🏛️</span> 7. Official Municipal Directory (PMC)
            </h2>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
              Unverified Placeholder Data
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-3">
            <p className="text-slate-700 leading-relaxed">
              To preserve integrity, NagarSetu never invents or guesses municipal telephone extensions, ward office numbers, or working hours. For official Pune Municipal Corporation contact listings, please refer to the official PMC portal:
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href={PMC_OFFICIAL_WEBSITE}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-lg bg-[#0f2942] hover:bg-slate-800 text-white font-bold inline-flex items-center gap-1.5"
              >
                🌐 Open pmc.gov.in (Official Portal) →
              </a>
              <span className="text-[11px] text-slate-500">
                Official Pune Municipal Corporation Portal
              </span>
            </div>
          </div>
        </section>

        {/* SECTION 8: TECHNICAL SUPPORT TROUBLESHOOTING */}
        <section
          id="troubleshoot"
          className="bg-white border border-slate-300 rounded-xl p-6 shadow-2xs space-y-4"
        >
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>🛠️</span> 8. NagarSetu Technical Support & Troubleshooting
          </h2>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            Common technical troubleshooting guides for the NagarSetu web portal:
          </p>

          <div className="space-y-3 text-xs">
            {/* Login Problems */}
            <details className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <summary className="font-bold text-slate-900 cursor-pointer">
                🔑 Login or Account Problems
              </summary>
              <p className="mt-2 text-slate-600 leading-relaxed">
                Ensure you are using the registered email address. For hackathon demonstration accounts (e.g. Aarav Sharma, Sneha Apte), use the password <code>PuneDemo@2026</code> or the 1-click switcher in the top banner.
              </p>
            </details>

            {/* Website Errors */}
            <details className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <summary className="font-bold text-slate-900 cursor-pointer">
                🌐 Website Errors or Blank Pages
              </summary>
              <p className="mt-2 text-slate-600 leading-relaxed">
                NagarSetu is built on Next.js 15 App Router. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R) to clear stale cached scripts.
              </p>
            </details>

            {/* Failed Photo Uploads */}
            <details className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <summary className="font-bold text-slate-900 cursor-pointer">
                📸 Failed Photo or Video Uploads
              </summary>
              <p className="mt-2 text-slate-600 leading-relaxed">
                Photos must be JPG, PNG, or WEBP under 10 MB. Videos must be MP4 or WEBM under 30 MB. Uploaded files are stored securely in dedicated storage outside the public web root.
              </p>
            </details>

            {/* Camera Permission */}
            <details className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <summary className="font-bold text-slate-900 cursor-pointer">
                📷 Camera Access Denied
              </summary>
              <p className="mt-2 text-slate-600 leading-relaxed">
                If your mobile browser blocks the camera, use the &ldquo;Choose Existing Photo / Video&rdquo; button to pick a picture from your phone gallery.
              </p>
            </details>

            {/* GPS / Map Issues */}
            <details className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <summary className="font-bold text-slate-900 cursor-pointer">
                📍 GPS Coordinates Missing or Map Location Incorrect
              </summary>
              <p className="mt-2 text-slate-600 leading-relaxed">
                Many messaging apps strip EXIF GPS when sharing photos. You can easily click or drag the red marker pin on the Pune Leaflet map in Step 5 or search any Pune landmark (e.g. Kothrud Bus Stand, Swargate, Baner).
              </p>
            </details>

            {/* Speech Recognition */}
            <details className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <summary className="font-bold text-slate-900 cursor-pointer">
                🎤 Speech Recognition / Microphone Problems
              </summary>
              <p className="mt-2 text-slate-600 leading-relaxed">
                If voice input is unavailable in your browser, simply type your description in the text box. NagarSetu supports Marathi, Hindi, and English text input.
              </p>
            </details>

            {/* Submission Errors */}
            <details className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <summary className="font-bold text-slate-900 cursor-pointer">
                ⚠️ Submission Errors or Duplicate Alert
              </summary>
              <p className="mt-2 text-slate-600 leading-relaxed">
                If you receive a &ldquo;Duplicate Warning&rdquo;, the system detected a similar active complaint from your account within 50 metres. You can choose to track the existing issue, add new photos to it, or override and submit as a separate issue.
              </p>
            </details>

            {/* Can't Find My Complaint */}
            <details className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <summary className="font-bold text-slate-900 cursor-pointer">
                ❓ Can&apos;t Find My Registered Complaint
              </summary>
              <p className="mt-2 text-slate-600 leading-relaxed">
                Enter your exact Reference ID (e.g. <code>NS-2026-001001</code>) on the Track page. Alternatively, sign in to your citizen account and visit the <strong>My Complaints</strong> tab.
              </p>
            </details>
          </div>

          {/* Separate NagarSetu Support Section */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-300 space-y-2 text-xs">
            <div className="font-bold text-slate-900 uppercase">
              📞 Contact NagarSetu Technical Helpdesk
            </div>
            <p className="text-slate-600">
              {NAGARSETU_TECH_SUPPORT.disclaimer}
            </p>
            <div className="text-slate-700">
              Technical Support Email:{" "}
              <code className="font-mono text-slate-900 font-bold">
                {NAGARSETU_TECH_SUPPORT.supportEmail}
              </code>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
