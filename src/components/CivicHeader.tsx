"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import {
  LANGUAGE_LABELS,
  SupportedLanguage,
} from "@/lib/i18n/dictionaries";
import {
  EmblemOfIndia,
  MaharashtraSeal,
  PmcLogo,
  IndianFlag,
  SearchIcon,
  CalendarIcon,
  AccessibilityIcon,
} from "@/components/GovIcons";

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "CITIZEN" | "OFFICER" | "SUPERVISOR" | "ADMIN";
  department?: { name: string } | null;
}

const QUICK_DEMO_ACCOUNTS = [
  { label: "Citizen (Aarav)", email: "aarav.sharma@citizen.in" },
  { label: "Citizen (Sneha)", email: "sneha.apte@citizen.in" },
  { label: "Roads Officer", email: "officer.roads@pune.gov.in" },
  { label: "Water Officer", email: "officer.water@pune.gov.in" },
  { label: "Supervisor West", email: "supervisor.west@pune.gov.in" },
  { label: "PMC Admin", email: "admin@pune.gov.in" },
];

export function CivicHeader({
  onAuthChange,
}: {
  onAuthChange?: (user: SessionUser | null) => void;
}) {
  const { lang, setLang, t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCategory, setSearchCategory] = useState("all");
  const [fontSizeOffset, setFontSizeOffset] = useState<number>(0);

  const loadSession = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || null);
        onAuthChange?.(data.user || null);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadSession();
  }, [pathname]);

  const handleQuickSwitch = async (email: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "PuneDemo@2026" }),
    });
    if (res.ok) {
      await loadSession();
      router.refresh();
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    onAuthChange?.(null);
    router.refresh();
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const query = searchQuery.trim();
    if (query.toUpperCase().startsWith("PMC-") || query.toUpperCase().startsWith("NS-")) {
      router.push(`/track?ref=${encodeURIComponent(query.toUpperCase())}`);
    } else {
      router.push(`/report?q=${encodeURIComponent(query)}`);
    }
  };

  const changeFontSize = (delta: number) => {
    setFontSizeOffset((prev) => {
      const next = Math.max(-2, Math.min(4, prev + delta));
      if (typeof document !== "undefined") {
        document.documentElement.style.fontSize = next === 0 ? "" : `${16 + next}px`;
      }
      return next;
    });
  };

  const navItems = [
    { href: "/", label: lang === "mr" ? "मुख्य पृष्ठ" : "Home" },
    { href: "/report", label: lang === "mr" ? "तक्रार नोंदवा" : "Lodge Grievance" },
    { href: "/track", label: lang === "mr" ? "तक्रार स्थिती" : "Track Status" },
    { href: "/map", label: lang === "mr" ? "थेट प्रभाग नकाशा" : "Live Ward Map" },
    { href: "/categories", label: lang === "mr" ? "तक्रार वर्गवारी" : "Grievance Categories" },
    { href: "/scorecard", label: lang === "mr" ? "सेवा हमी व कामगिरी" : "Citizen Charter & SLA" },
    ...(user && user.role !== "CITIZEN"
      ? [{ href: "/staff", label: lang === "mr" ? "अधिकारी पोर्टल" : "Officer Portal" }]
      : []),
    ...(user && user.role === "CITIZEN"
      ? [{ href: "/my-complaints", label: lang === "mr" ? "माझ्या तक्रारी" : "My Complaints" }]
      : []),
    { href: "/help", label: lang === "mr" ? "मदत व तक्रार निवारण" : "Help & FAQ" },
    { href: "/about", label: lang === "mr" ? "पोर्टल बद्दल" : "About NagarSetu" },
  ];

  return (
    <header className="w-full bg-white text-slate-800 border-b border-slate-300 shadow-sm z-40">
      {/* 1. National Tricolor Strip */}
      <div className="h-1 w-full flex">
        <div className="h-full w-1/3 bg-[#FF9933]" />
        <div className="h-full w-1/3 bg-white" />
        <div className="h-full w-1/3 bg-[#138808]" />
      </div>

      {/* 2. Top Government Utility Bar (india.gov.in / Maharashtra Government standard) */}
      <div className="bg-[#f1f5f9] border-b border-slate-300 px-4 py-1 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* Official Entity Title */}
          <div className="flex items-center gap-2 text-slate-700 font-semibold">
            <IndianFlag className="h-3.5 w-5 shrink-0 border border-slate-300" />
            <span className="text-slate-900 font-bold">
              महाराष्ट्र शासन • GOVERNMENT OF MAHARASHTRA
            </span>
            <span className="hidden md:inline text-slate-400">|</span>
            <span className="hidden md:inline text-slate-700">
              पुणे महानगरपालिका (PMC)
            </span>
          </div>

          {/* Accessibility & Utility Tools */}
          <div className="flex items-center gap-3 text-[11px] text-slate-700 font-medium">
            <a
              href="#main-content"
              className="hidden lg:inline hover:underline text-slate-700"
            >
              Skip to main content
            </a>
            <span className="hidden lg:inline text-slate-300">|</span>

            {/* Font Resize (A- / A / A+) */}
            <div className="flex items-center border border-slate-300 bg-white">
              <button
                type="button"
                onClick={() => changeFontSize(-1)}
                title="Decrease Font Size"
                className="px-1.5 py-0.5 hover:bg-slate-100 text-[10px] font-bold border-r border-slate-200"
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => changeFontSize(0)}
                title="Normal Font Size"
                className="px-1.5 py-0.5 hover:bg-slate-100 text-[10px] font-bold border-r border-slate-200"
              >
                A
              </button>
              <button
                type="button"
                onClick={() => changeFontSize(1)}
                title="Increase Font Size"
                className="px-1.5 py-0.5 hover:bg-slate-100 text-[10px] font-bold"
              >
                A+
              </button>
            </div>

            <span className="text-slate-300">|</span>

            {/* Language Selector (अ/A) */}
            <div className="flex items-center gap-1">
              <span className="font-bold text-slate-900 text-xs">अ/A</span>
              <select
                aria-label="Select Portal Language"
                value={lang}
                onChange={(e) => setLang(e.target.value as SupportedLanguage)}
                className="bg-white text-slate-900 border border-slate-300 px-1.5 py-0.5 text-xs font-semibold rounded-none focus:outline-none focus:ring-1 focus:ring-[#c31a26]"
              >
                {(Object.keys(LANGUAGE_LABELS) as SupportedLanguage[]).map((code) => (
                  <option key={code} value={code}>
                    {LANGUAGE_LABELS[code]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Official Portal Header Bar (White with Ashoka Emblem, Title, Search, and PMC/Maha Seals) */}
      <div className="bg-white px-4 py-3 border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Emblem & Portal Branding */}
          <Link href="/" className="flex items-center gap-3.5 focus:outline-none shrink-0">
            <EmblemOfIndia className="h-14 w-auto text-slate-800 shrink-0" />
            <div className="border-l border-slate-300 pl-3.5">
              <div className="text-xl sm:text-2xl font-black tracking-tight text-[#0f3b60] leading-tight font-serif">
                नगरसेतू <span className="text-slate-500 font-sans font-normal text-base sm:text-lg">| NagarSetu</span>
              </div>
              <div className="text-xs sm:text-sm font-bold text-[#c31a26]">
                पुणे महानगरपालिका नागरी तक्रार निवारण प्रणाली
              </div>
              <div className="text-[11px] text-slate-600 font-medium">
                Pune Municipal Grievance Redressal Portal • GovFix G-02
              </div>
            </div>
          </Link>

          {/* Central Search Bar (Modeled exactly on india.gov.in / National Portal style) */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex-1 max-w-xl min-w-[280px] hidden md:flex items-stretch border border-slate-300 bg-white"
          >
            <div className="relative flex-1 flex items-center">
              <span className="pl-3 pr-1 text-slate-400">
                <SearchIcon className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === "mr"
                    ? "तक्रार क्रमांक (PMC-XXXX), प्रभाग, किंवा रस्ता शोधा..."
                    : "Search Grievance Reference, Ward Office, Road, Water leak..."
                }
                className="w-full py-2 px-2 text-xs text-slate-900 focus:outline-none"
              />
            </div>
            <select
              value={searchCategory}
              onChange={(e) => setSearchCategory(e.target.value)}
              aria-label="Filter Search by Category"
              className="bg-slate-50 text-slate-700 text-xs border-l border-slate-300 px-2 py-2 focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="roads">Roads</option>
              <option value="water">Water & Sewage</option>
              <option value="waste">Solid Waste</option>
              <option value="nuisance">Civic Safety</option>
            </select>
            <button
              type="submit"
              className="bg-[#c31a26] hover:bg-[#a61520] text-white px-5 text-xs font-bold uppercase tracking-wider rounded-none transition"
            >
              Search
            </button>
          </form>

          {/* Right Government Seals (Maharashtra & PMC Crest) */}
          <div className="hidden lg:flex items-center gap-3 shrink-0">
            <PmcLogo className="h-12 w-auto" />
            <MaharashtraSeal className="h-13 w-auto" />
          </div>
        </div>
      </div>

      {/* 4. Primary Navigation Bar (Official Deep Navy #0f3057 with Sharp Rectangular Tabs) */}
      <nav className="bg-[#0f3057] text-white">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between">
          <ul className="flex flex-wrap items-center text-xs font-bold uppercase tracking-wide">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block px-3.5 py-3 transition rounded-none border-b-2 ${
                      active
                        ? "bg-[#092240] text-white border-[#c31a26]"
                        : "text-slate-200 hover:bg-[#1a4473] hover:text-white border-transparent"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* User Auth or Quick Login Badge */}
          <div className="py-1.5 flex items-center gap-2 text-xs">
            {user ? (
              <div className="flex items-center gap-2 bg-[#092240] px-3 py-1.5 border border-slate-600">
                <span className="text-[11px] text-amber-300 font-bold uppercase">
                  {user.role}
                </span>
                <span className="text-white font-medium text-xs hidden sm:inline">
                  {user.name || user.email}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="ml-2 text-slate-300 hover:text-white underline text-[11px] font-bold"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Link
                  href="/login"
                  className="bg-[#c31a26] hover:bg-[#a61520] text-white px-3 py-1.5 text-xs font-bold uppercase rounded-none transition"
                >
                  Officer / Citizen Login
                </Link>

                {/* Quick Role Switcher for Hackathon Evaluation (Sharp Edge) */}
                <div className="hidden xl:flex items-center gap-1 pl-2 border-l border-slate-600">
                  <span className="text-[10px] text-slate-300 uppercase font-bold">
                    Demo Role:
                  </span>
                  <select
                    aria-label="Quick Switch Evaluation Account"
                    onChange={(e) => e.target.value && handleQuickSwitch(e.target.value)}
                    defaultValue=""
                    className="bg-[#092240] text-white border border-slate-500 text-[11px] py-1 px-1.5 rounded-none focus:outline-none"
                  >
                    <option value="" disabled>
                      Select Role...
                    </option>
                    {QUICK_DEMO_ACCOUNTS.map((acc) => (
                      <option key={acc.email} value={acc.email}>
                        {acc.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Search Bar */}
      <div className="md:hidden bg-slate-100 p-2 border-b border-slate-300">
        <form onSubmit={handleSearchSubmit} className="flex">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Reference ID (PMC-XXXX) or Issue..."
            className="flex-1 py-1.5 px-3 text-xs border border-slate-300 rounded-none bg-white"
          />
          <button
            type="submit"
            className="bg-[#c31a26] text-white px-3 py-1.5 text-xs font-bold rounded-none"
          >
            Search
          </button>
        </form>
      </div>
    </header>
  );
}
