"use client";

import React from "react";
import Link from "next/link";
import { CivicHeader } from "@/components/CivicHeader";
import { useI18n } from "@/lib/i18n/context";
import {
  DEPARTMENT_CONTACTS,
  PMC_OFFICIAL_WEBSITE,
  NAGARSETU_TECH_SUPPORT,
} from "@/data/departmentContacts";
import { CATEGORIES_DATA } from "@/data/categoriesData";

export default function CategoriesIndexPage() {
  const { t, tCategory, tSubcategory } = useI18n();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      <CivicHeader />

      <main className="max-w-6xl mx-auto w-full px-4 py-8 space-y-8 flex-1">
        {/* Banner */}
        <div className="bg-[#0f2942] text-white rounded-none p-6 shadow-sm border-l-8 border-amber-500 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold mb-1.5 inline-block">
              PMC MUNICIPAL JURISDICTION TRACKS
            </span>
            <h1 className="text-2xl font-bold">Pune Grievance Categories</h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              NagarSetu is strictly configured for Pune Municipal Corporation (PMC) municipal issues. Explore each department track, subcategories, urgent safety guidance, and reporting instructions below.
            </p>
          </div>

          <Link
            href="/report"
            className="min-h-[44px] px-5 py-2.5 rounded-none bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center shadow-2xs"
          >
             {t("navReport")} →
          </Link>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CATEGORIES_DATA.map((cat) => {
            const contact = DEPARTMENT_CONTACTS[cat.slug];
            return (
              <div
                key={cat.slug}
                className="bg-white border border-slate-300 rounded-none p-6 shadow-2xs hover:border-[#0f2942] transition flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl p-2 rounded-none bg-slate-100 border border-slate-200">
                      {cat.emoji}
                    </span>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        {tCategory(cat.name)}
                      </h2>
                      <div className="text-xs text-slate-600 font-medium">
                        {cat.department}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    {cat.description}
                  </p>

                  {/* Complaint Types */}
                  <div>
                    <div className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                      Complaint Types Covered:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.subcategories.map((sub) => (
                        <span
                          key={sub}
                          className="px-2.5 py-1 rounded bg-slate-100 text-slate-800 text-xs font-medium border border-slate-200"
                        >
                          {tSubcategory(sub)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Urgent Safety Guidance */}
                  <div className="bg-amber-50 border border-amber-300 rounded-none p-3 text-xs text-amber-950 space-y-1">
                    <div className="font-bold flex items-center gap-1">
                       Urgent Safety Guidance:
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      {cat.safetyGuidance}
                    </p>
                  </div>

                  {/* Official Municipal Contacts Section */}
                  <div className="bg-slate-50 border border-slate-200 rounded-none p-3 text-xs space-y-1.5">
                    <div className="text-slate-700 font-bold flex items-center justify-between">
                      <span>Official PMC Ward / Office Contacts:</span>
                      <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-semibold">
                        Unverified
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 italic">
                      Direct telephone and ward office lines are not yet verified. Please consult the official Pune Municipal Corporation portal:
                    </div>
                    <div>
                      <a
                        href={PMC_OFFICIAL_WEBSITE}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#0f2942] underline font-bold text-xs inline-flex items-center gap-1 hover:text-amber-800"
                      >
                         Visit official PMC portal (pmc.gov.in) →
                      </a>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/report?category=${cat.slug}`}
                    className="min-h-[40px] px-4 py-2 rounded-none bg-[#0f2942] hover:bg-slate-800 text-white font-bold text-xs flex items-center"
                  >
                    Register in this Category →
                  </Link>
                  <Link
                    href={`/categories/${cat.slug}`}
                    className="min-h-[40px] px-3.5 py-2 rounded-none bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center"
                  >
                    Detailed Scope & Guidance
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Technical Support vs Municipal Notice */}
        <section className="bg-white border border-slate-300 rounded-none p-5 shadow-2xs space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            ℹ️ NagarSetu Portal Technical Support Notice
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            {NAGARSETU_TECH_SUPPORT.disclaimer} For technical assistance with website errors, account login, or photo uploads, visit our{" "}
            <Link href="/help" className="text-[#0f2942] underline font-bold">
              Help & Support Center
            </Link>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
