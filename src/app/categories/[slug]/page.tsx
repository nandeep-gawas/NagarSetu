"use client";

import React, { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CivicHeader } from "@/components/CivicHeader";
import { useI18n } from "@/lib/i18n/context";
import { CATEGORIES_DATA } from "@/data/categoriesData";
import {
  DEPARTMENT_CONTACTS,
  PMC_OFFICIAL_WEBSITE,
  NAGARSETU_TECH_SUPPORT,
} from "@/data/departmentContacts";

export default function CategoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { t, tCategory, tSubcategory } = useI18n();

  const category = CATEGORIES_DATA.find((c) => c.slug === slug);
  if (!category) {
    notFound();
  }

  const contact = DEPARTMENT_CONTACTS[slug] || {
    department: category.department,
    categorySlug: slug,
    phone: null,
    email: null,
    website: null,
    workingHours: null,
    source: null,
    lastVerified: null,
    officialPmcUrl: PMC_OFFICIAL_WEBSITE,
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      <CivicHeader />

      <main className="max-w-4xl mx-auto w-full px-4 py-8 space-y-6 flex-1">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-xs text-slate-600 flex items-center gap-1.5">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span>/</span>
          <Link href="/categories" className="hover:underline">
            Categories
          </Link>
          <span>/</span>
          <span className="font-bold text-slate-900">{category.name}</span>
        </nav>

        {/* Hero Card */}
        <div className="bg-[#0f2942] text-white rounded-none p-6 sm:p-8 shadow-sm border-l-8 border-amber-500 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-4xl p-2 rounded-none bg-slate-800 border border-slate-700">
              {category.emoji}
            </span>
            <div>
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                PMC Department Track
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold">
                {tCategory(category.name)}
              </h1>
              <div className="text-xs text-slate-300 font-medium mt-0.5">
                {category.department}
              </div>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed pt-2">
            {category.description}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-3">
            <Link
              href={`/report?category=${category.slug}`}
              className="min-h-[44px] px-6 py-2.5 rounded-none bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center shadow-2xs"
            >
               Register a Complaint in this Category →
            </Link>
            <Link
              href="/track"
              className="min-h-[44px] px-4 py-2.5 rounded-none bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs sm:text-sm font-semibold flex items-center"
            >
               Track an Existing Complaint
            </Link>
          </div>
        </div>

        {/* Subcategories (Complaint Types) */}
        <div className="bg-white border border-slate-300 rounded-none p-6 shadow-2xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
             Specific Issues Handled Under This Category
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {category.subcategories.map((sub, idx) => (
              <div
                key={sub}
                className="p-3.5 rounded-none bg-slate-50 border border-slate-200 flex items-start gap-3"
              >
                <span className="h-6 w-6 rounded-full bg-[#0f2942] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {tSubcategory(sub)}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Municipal action workflow assigned to {category.department}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reporting Guidance & Photo Instructions */}
        <div className="bg-white border border-slate-300 rounded-none p-6 shadow-2xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
             Best Practices for Registering This Complaint
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-none bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                 1. Clear Photo Evidence
              </div>
              <p className="text-slate-600 leading-relaxed">
                Capture the problem clearly with visible landmarks in the background (e.g. shop signboards, road dividers, chowk names) to assist municipal field teams.
              </p>
            </div>

            <div className="p-4 rounded-none bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                 2. Accurate Pune Location
              </div>
              <p className="text-slate-600 leading-relaxed">
                If taking a photo on-site, ensure camera location is enabled or confirm the marker pin on our interactive Pune map in Step 5.
              </p>
            </div>

            <div className="p-4 rounded-none bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                ⏱️ 3. SLA & Escalation
              </div>
              <p className="text-slate-600 leading-relaxed">
                Once registered, NagarSetu automatically enforces municipal resolution deadlines with automatic supervisor escalation if overdue.
              </p>
            </div>
          </div>
        </div>

        {/* Urgent Safety Guidance */}
        <div className="bg-amber-50 border-2 border-amber-400 rounded-none p-5 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-amber-950 font-bold text-sm uppercase tracking-wider">
             Urgent Safety Notice & Precautions
          </div>
          <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
            {category.safetyGuidance}
          </p>
          <p className="text-[11px] text-amber-900 font-medium pt-1">
            Note: In life-threatening emergencies, alert nearby citizens and contact official emergency public services immediately. NagarSetu manages municipal grievance redressal workflows.
          </p>
        </div>

        {/* Official Department Contacts Section */}
        <div className="bg-white border border-slate-300 rounded-none p-6 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
                 Official Department Ward & Office Directory
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {category.department} • Pune Municipal Corporation
              </p>
            </div>
            <span className="px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
              Unverified Placeholder
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-none p-4 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
              <div>
                <span className="font-semibold text-slate-500">Official Office Phone:</span>{" "}
                <span className="italic text-slate-500 font-medium">
                  {contact.phone ?? "Not yet verified"}
                </span>
              </div>
              <div>
                <span className="font-semibold text-slate-500">Department Email:</span>{" "}
                <span className="italic text-slate-500 font-medium">
                  {contact.email ?? "Not yet verified"}
                </span>
              </div>
              <div>
                <span className="font-semibold text-slate-500">Public Office Hours:</span>{" "}
                <span className="italic text-slate-500 font-medium">
                  {contact.workingHours ?? "Not yet verified"}
                </span>
              </div>
              <div>
                <span className="font-semibold text-slate-500">Verification Source:</span>{" "}
                <span className="italic text-slate-500 font-medium">
                  {contact.source ?? "Pending official PMC publication"}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-slate-600">
                To consult verified municipal telephone lines and ward office addresses, visit the official PMC portal:
              </span>
              <a
                href={PMC_OFFICIAL_WEBSITE}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded bg-[#0f2942] text-white font-bold text-xs hover:bg-slate-800 transition inline-flex items-center gap-1"
              >
                 Open pmc.gov.in (Official Website) →
              </a>
            </div>
          </div>
        </div>

        {/* NagarSetu Technical Support Box */}
        <div className="bg-slate-50 border border-slate-300 rounded-none p-5 space-y-2 text-xs">
          <div className="font-bold text-slate-900 uppercase">
             NagarSetu Portal Technical Support
          </div>
          <p className="text-slate-600 leading-relaxed">
            {NAGARSETU_TECH_SUPPORT.disclaimer}
          </p>
          <div className="pt-1 flex items-center gap-3">
            <Link
              href="/help"
              className="text-[#0f2942] font-bold underline hover:text-amber-800"
            >
              Visit Help & Support Troubleshooting →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
