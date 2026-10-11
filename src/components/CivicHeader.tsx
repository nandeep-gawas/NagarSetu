"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import {
  LANGUAGE_LABELS,
  SupportedLanguage,
} from "@/lib/i18n/dictionaries";

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

  const navItems = [
    { href: "/", label: "🏛️ Home" },
    { href: "/map", label: "🗺️ Explore Live Map" },
    { href: "/report", label: `📢 ${t("navReport")}` },
    { href: "/track", label: `🔍 ${t("navTrack")}` },
    ...(user && user.role !== "CITIZEN"
      ? [{ href: "/staff", label: "⚡ Staff Portal" }]
      : []),
    ...(user && user.role === "CITIZEN"
      ? [{ href: "/my-complaints", label: "📋 My Complaints" }]
      : []),
    { href: "/categories", label: "📁 Categories" },
    { href: "/scorecard", label: "📊 Scorecard" },
    { href: "/help", label: "❓ Help & Support" },
    { href: "/about", label: "ℹ️ About" },
  ];

  return (
    <header className="bg-[#0f2942] text-white border-b-4 border-amber-600 sticky top-0 z-40 shadow-sm">
      {/* Top Official Banner */}
      <div className="bg-[#091b2c] border-b border-slate-700/80 px-4 py-1.5 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-200 font-medium">
            <span>🇮🇳 महाराष्ट्र शासन • पुणे महानगरपालिका (PMC)</span>
            <span className="hidden sm:inline text-slate-400">|</span>
            <span className="hidden sm:inline text-amber-300">
              {t("tagline")}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Persistent Language Selector */}
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="civic-lang-select"
                className="text-slate-300 font-medium"
              >
                🌐 {t("langLabel")}:
              </label>
              <select
                id="civic-lang-select"
                aria-label="Select Portal Language"
                value={lang}
                onChange={(e) => setLang(e.target.value as SupportedLanguage)}
                className="bg-slate-800 text-white border border-slate-600 rounded px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {(Object.keys(LANGUAGE_LABELS) as SupportedLanguage[]).map(
                  (code) => (
                    <option key={code} value={code}>
                      {LANGUAGE_LABELS[code]}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Portal Bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded-lg"
        >
          <div className="h-11 w-11 rounded-lg bg-amber-500 text-slate-950 font-black flex items-center justify-center text-lg shadow-sm border border-amber-300">
            PMC
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight text-white">
              {t("portalTitle")}
            </div>
            <div className="text-xs text-slate-300">
              G-02 GovFix • Municipal Grievance Redressal System
            </div>
          </div>
        </Link>

        {/* Primary Navigation Links */}
        <nav
          aria-label="Primary Civic Navigation"
          className="flex flex-wrap items-center gap-1.5"
        >
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`min-h-[42px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center transition focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                  active
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-slate-100 hover:bg-slate-800/80 border border-transparent hover:border-slate-600"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Authenticated User / Login Action */}
        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2.5 bg-slate-800/90 border border-slate-600 rounded-lg px-3 py-1.5">
              <div className="text-right">
                <div className="text-xs font-bold text-white flex items-center gap-1.5 justify-end">
                  <span>{user.name.split(" (")[0]}</span>
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 font-bold">
                    {user.role}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300">{user.email}</div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="min-h-[36px] px-2.5 py-1 rounded bg-rose-700 hover:bg-rose-600 text-white text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {t("navLogout")}
              </button>
            </div>
          ) : (
            <Link
              href={`/login?returnTo=${encodeURIComponent(pathname || "/report")}`}
              className="min-h-[42px] px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center transition focus:outline-none focus:ring-2 focus:ring-white"
            >
              🔐 {t("navLogin")}
            </Link>
          )}
        </div>
      </div>

      {/* Quick Demo Switcher Bar for Hackathon Evaluation */}
      <div className="bg-[#0b1f33] border-t border-slate-700/80 px-4 py-1.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-300 font-medium mr-1">
            ⚡ Demo Role Switch:
          </span>
          {QUICK_DEMO_ACCOUNTS.map((acc) => {
            const isCurrent = user?.email === acc.email;
            return (
              <button
                key={acc.email}
                type="button"
                onClick={() => handleQuickSwitch(acc.email)}
                className={`px-2.5 py-1 rounded border text-[11px] font-medium transition ${
                  isCurrent
                    ? "bg-amber-400 text-slate-950 border-amber-300 font-bold"
                    : "bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700"
                }`}
              >
                {acc.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
