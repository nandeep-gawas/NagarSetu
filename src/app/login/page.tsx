"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CivicHeader } from "@/components/CivicHeader";
import { useI18n } from "@/lib/i18n/context";

const DEMO_USERS = [
  {
    name: "Aarav Sharma (Citizen — Kothrud)",
    email: "aarav.sharma@citizen.in",
    role: "CITIZEN",
  },
  {
    name: "Sneha Apte (Citizen — Baner)",
    email: "sneha.apte@citizen.in",
    role: "CITIZEN",
  },
  {
    name: "Vikram Deshmukh (Roads Officer)",
    email: "officer.roads@pune.gov.in",
    role: "OFFICER",
  },
  {
    name: "Priya Joshi (Water Officer)",
    email: "officer.water@pune.gov.in",
    role: "OFFICER",
  },
  {
    name: "Rajesh Kulkarni (Supervisor West)",
    email: "supervisor.west@pune.gov.in",
    role: "SUPERVISOR",
  },
  {
    name: "Anjali Nimbalkar (PMC Admin)",
    email: "admin@pune.gov.in",
    role: "ADMIN",
  },
];

function LoginContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/report";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("aarav.sharma@citizen.in");
  const [password, setPassword] = useState("PuneDemo@2026");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "login"
          ? { email, password }
          : { name, email, password, phone: phone || undefined };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Authentication failed.");
        setLoading(false);
        return;
      }
      const role = data.user?.role;
      let targetPath = returnTo;
      if (!searchParams.get("returnTo")) {
        targetPath = role === "CITIZEN" ? "/my-complaints" : "/staff";
      } else if (targetPath === "/staff" && role === "CITIZEN") {
        targetPath = "/my-complaints";
      }
      router.push(targetPath);
      router.refresh();
    } catch {
      setError("Network error while signing in.");
      setLoading(false);
    }
  };

  const quickLogin = async (demoEmail: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: demoEmail, password: "PuneDemo@2026" }),
      });
      const data = await res.json();
      if (res.ok) {
        const role = data.user?.role;
        let targetPath = returnTo;
        if (!searchParams.get("returnTo")) {
          targetPath = role === "CITIZEN" ? "/my-complaints" : "/staff";
        } else if (targetPath === "/staff" && role === "CITIZEN") {
          targetPath = "/my-complaints";
        }
        router.push(targetPath);
        router.refresh();
      } else {
        setError(data.error || "Quick demo login failed.");
        setLoading(false);
      }
    } catch {
      setError("Network error.");
      setLoading(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white border border-slate-300 rounded-none shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12">
        {/* Left Form Column */}
        <div className="md:col-span-7 p-6 sm:p-8 border-b md:border-b-0 md:border-r border-slate-200">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-amber-100 text-amber-900 text-xs font-bold mb-3">
             Pune Municipal Corporation • Citizen & Staff Portal
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {mode === "login"
              ? t("navLogin")
              : "Register New Pune Citizen Account"}
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Sign in to submit complaints, upload evidence, track your grievances,
            and confirm resolutions. Your saved complaint draft in progress will
            be preserved.
          </p>

          <div className="flex gap-2 mt-4 border-b border-slate-200 pb-3">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`min-h-[40px] px-4 py-1.5 rounded-none text-xs font-bold transition ${
                mode === "login"
                  ? "bg-[#0f2942] text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Existing Account Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setEmail("");
                setPassword("");
                setError(null);
              }}
              className={`min-h-[40px] px-4 py-1.5 rounded-none text-xs font-bold transition ${
                mode === "register"
                  ? "bg-[#0f2942] text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              New Citizen Sign-Up
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 p-3 rounded-none bg-rose-50 border border-rose-300 text-rose-900 text-xs font-semibold"
            >
               {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-4 space-y-4">
            {mode === "register" && (
              <div>
                <label
                  htmlFor="login-name"
                  className="block text-xs font-bold text-slate-800 mb-1"
                >
                  Full Name *
                </label>
                <input
                  id="login-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Rohan Deshpande"
                  className="w-full min-h-[44px] px-3 py-2 rounded-none border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0f2942]"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-bold text-slate-800 mb-1"
              >
                Email Address *
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="citizen@example.com"
                className="w-full min-h-[44px] px-3 py-2 rounded-none border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0f2942]"
              />
            </div>

            {mode === "register" && (
              <div>
                <label
                  htmlFor="login-phone"
                  className="block text-xs font-bold text-slate-800 mb-1"
                >
                  Mobile Number (Optional, Pune)
                </label>
                <input
                  id="login-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98XXXXXXXX"
                  className="w-full min-h-[44px] px-3 py-2 rounded-none border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0f2942]"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-bold text-slate-800 mb-1"
              >
                Password *
              </label>
              <input
                id="login-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-none border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0f2942]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[46px] px-4 py-2.5 rounded-none bg-[#0f2942] hover:bg-slate-800 text-white font-bold text-sm transition disabled:opacity-50"
            >
              {loading
                ? "Signing in..."
                : mode === "login"
                ? "Sign In & Continue"
                : "Create Citizen Account & Continue"}
            </button>
          </form>
        </div>

        {/* Right Quick Demo Switcher Column */}
        <div className="md:col-span-5 bg-slate-50 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
               1-Click Hackathon Demo Accounts
            </h2>
            <p className="text-xs text-slate-600 mt-1 mb-4">
              Click any seeded account below to sign in immediately and return to{" "}
              <code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-800">
                {returnTo}
              </code>
              :
            </p>

            <div className="space-y-2">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.email}
                  type="button"
                  disabled={loading}
                  onClick={() => quickLogin(u.email)}
                  className="w-full text-left p-3 rounded-none bg-white hover:bg-amber-50 border border-slate-300 hover:border-amber-500 transition flex items-center justify-between gap-2 shadow-2xs"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      {u.name}
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono">
                      {u.email}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                    {u.role}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 text-[11px] text-slate-600">
            All demo accounts use password{" "}
            <code className="font-mono font-bold text-slate-900">
              PuneDemo@2026
            </code>
            . Session is stored in an HTTP-only cookie.
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <CivicHeader />
      <Suspense
        fallback={
          <div className="max-w-4xl mx-auto p-8 text-sm text-slate-600">
            Loading login portal...
          </div>
        }
      >
        <LoginContent />
      </Suspense>
    </div>
  );
}
