"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { CivicHeader } from "@/components/CivicHeader";
import { useI18n } from "@/lib/i18n/context";

const PuneLiveMap = dynamic(() => import("@/components/PuneLiveMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[520px] w-full rounded-xl border border-slate-300 bg-slate-100 flex items-center justify-center text-xs text-slate-600 font-medium">
      📍 Loading interactive Pune OpenStreetMap...
    </div>
  ),
});

export interface StatsData {
  totalComplaints: number;
  resolved: number;
  inProgress: number;
  overdue: number;
  resolutionRate: number;
  onTimeResolutionRate: number;
  isDemoData: boolean;
  demoDataNotice: string;
}

interface Department {
  id: string;
  name: string;
  categoryId: string;
}

interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
}

interface Category {
  id: string;
  name: string;
  emoji: string;
  description: string | null;
  subcategories: Subcategory[];
  department: Department | null;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: "CITIZEN" | "OFFICER" | "SUPERVISOR" | "ADMIN";
  departmentId?: string | null;
  department?: Department | null;
  isDemo?: boolean;
}

interface EvidenceItem {
  id: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  caption: string | null;
  exifLatitude: number | null;
  exifLongitude: number | null;
  exifCapturedAt: string | null;
  uploadedAt: string;
}

interface ReportItem {
  id: string;
  referenceId: string;
  description: string;
  language: string;
  latitude: number;
  longitude: number;
  submittedAt: string;
  idempotencyKey: string;
  citizen: { id: string; name: string; email: string };
  evidences: EvidenceItem[];
}

interface IssueItem {
  id: string;
  publicRef: string;
  categoryId: string;
  subcategoryId: string | null;
  status: string;
  priority: "NORMAL" | "HIGH" | "CRITICAL";
  isOverdue: boolean;
  latitude: number;
  longitude: number;
  publicLocationLabel: string;
  responseDeadline: string;
  resolutionDeadline: string;
  originalResolutionDeadline: string;
  reportCount: number;
  assignedOfficerId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  isDemo: boolean;
  category: Category;
  subcategory: Subcategory | null;
  assignedOfficer: UserInfo | null;
  reports: ReportItem[];
  escalationEvents: {
    id: string;
    level: number;
    reason: string;
    createdAt: string;
    notifiedUser: { name: string; email: string };
  }[];
  deadlineChanges: {
    id: string;
    oldDeadline: string;
    newDeadline: string;
    reason: string;
    createdAt: string;
    actor: { name: string; email: string };
  }[];
}

interface WorkflowTransitionRule {
  id: string;
  fromState: string;
  toState: string;
  allowedRoles: string[];
  requiresReason: boolean;
  sameDepartmentOnly: boolean;
}

interface DeadlineRuleItem {
  id: string;
  categoryId: string;
  subcategoryId: string | null;
  severity: string;
  responseHours: number;
  resolutionHours: number;
  label: string;
  category: { name: string; emoji: string };
  subcategory: { name: string } | null;
}

interface PriorityRuleItem {
  id: string;
  ruleType: string;
  threshold: number;
  resultingPriority: string;
  label: string;
}

interface AuditEventItem {
  id: string;
  timestamp: string;
  actorType: "USER" | "SYSTEM";
  actorId: string | null;
  actorLabel: string;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue: unknown;
  newValue: unknown;
  reason: string | null;
  ruleApplied: string | null;
  outcome: "ACCEPTED" | "REFUSED";
}

const ALL_STATUSES = [
  "SUBMITTED",
  "VERIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED_AWAITING_VERIFICATION",
  "CLOSED",
  "REJECTED",
  "REOPENED",
];

const PUNE_PRESETS = [
  { label: "Paud Road, Kothrud Depot, Kothrud", lat: 18.5074, lng: 73.8077 },
  { label: "Magarpatta South Gate, Hadapsar", lat: 18.5089, lng: 73.9259 },
  { label: "JM Road Corner, Shivajinagar", lat: 18.5314, lng: 73.8446 },
  { label: "Balewadi High Street Link Road, Baner", lat: 18.559, lng: 73.7868 },
  { label: "Datta Mandir Chowk, Viman Nagar", lat: 18.5679, lng: 73.9143 },
  { label: "EON IT Park Phase 1 Road, Kharadi", lat: 18.5515, lng: 73.9348 },
  { label: "Jedhe Chowk Flyover Ramp, Swargate", lat: 18.5018, lng: 73.8636 },
  { label: "Goodluck Chowk, Deccan Gymkhana", lat: 18.5167, lng: 73.8415 },
];

export default function NagarSetuApp() {
  const [viewMode, setViewMode] = useState<"portal" | "console">("portal");
  const [stats, setStats] = useState<StatsData | null>(null);

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "report" | "rules" | "audit"
  >("dashboard");

  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [notifications, setNotifications] = useState<
    { id: string; message: string; createdAt: string }[]
  >([]);

  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transitions, setTransitions] = useState<WorkflowTransitionRule[]>([]);
  const [allowedForUser, setAllowedForUser] = useState<
    WorkflowTransitionRule[]
  >([]);
  const [demoUsers, setDemoUsers] = useState<UserInfo[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<IssueItem | null>(null);

  // Filters
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterOverdue, setFilterOverdue] = useState(false);

  // Transition state
  const [targetState, setTargetState] = useState("VERIFIED");
  const [transitionReason, setTransitionReason] = useState("");
  const [transitionFeedback, setTransitionFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Deadline change state
  const [newDeadlineInput, setNewDeadlineInput] = useState("");
  const [deadlineReasonInput, setDeadlineReasonInput] = useState("");

  // Auth modal
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  // Report submission form
  const [repCategoryId, setRepCategoryId] = useState("");
  const [repSubcategoryId, setRepSubcategoryId] = useState("");
  const [repLocationLabel, setRepLocationLabel] = useState(
    PUNE_PRESETS[0].label
  );
  const [repLat, setRepLat] = useState(PUNE_PRESETS[0].lat);
  const [repLng, setRepLng] = useState(PUNE_PRESETS[0].lng);
  const [repDescription, setRepDescription] = useState("");
  const [repLanguage, setRepLanguage] = useState("en");
  const [repCaption, setRepCaption] = useState("");
  const [repIdempotencyKey, setRepIdempotencyKey] = useState(
    `idem-${Date.now()}`
  );
  const [repResult, setRepResult] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Rules & Audit
  const [deadlineRules, setDeadlineRules] = useState<DeadlineRuleItem[]>([]);
  const [priorityRules, setPriorityRules] = useState<PriorityRuleItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>([]);
  const [auditFilterOutcome, setAuditFilterOutcome] = useState("");
  const [auditError, setAuditError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const data = await res.json();
      setCurrentUser(data.user);
      setNotifications(data.notifications || []);
    }
  }, []);

  const fetchIssues = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterCategory) params.set("categoryId", filterCategory);
    if (filterStatus) params.set("status", filterStatus);
    if (filterPriority) params.set("priority", filterPriority);
    if (filterOverdue) params.set("overdue", "true");

    const res = await fetch(`/api/issues?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setIssues(data.issues || []);
      setCategories(data.categories || []);
      setTransitions(data.transitions || []);
      setDemoUsers(data.demoUsers || []);

      if (data.categories?.length > 0 && !repCategoryId) {
        setRepCategoryId(data.categories[0].id);
        if (data.categories[0].subcategories?.length > 0) {
          setRepSubcategoryId(data.categories[0].subcategories[0].id);
        }
      }

      if (selectedIssue) {
        const updatedSelected = (data.issues || []).find(
          (i: IssueItem) => i.id === selectedIssue.id
        );
        if (updatedSelected) setSelectedIssue(updatedSelected);
      } else if (data.issues?.length > 0) {
        setSelectedIssue(data.issues[0]);
      }
    }
  }, [
    filterCategory,
    filterStatus,
    filterPriority,
    filterOverdue,
    repCategoryId,
    selectedIssue,
  ]);

  const fetchRules = useCallback(async () => {
    const res = await fetch("/api/rules");
    if (res.ok) {
      const data = await res.json();
      setDeadlineRules(data.deadlineRules || []);
      setPriorityRules(data.priorityRules || []);
    }
  }, []);

  const fetchAudit = useCallback(async () => {
    setAuditError(null);
    const params = new URLSearchParams();
    if (auditFilterOutcome) params.set("outcome", auditFilterOutcome);
    const res = await fetch(`/api/audit?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setAuditEvents(data.auditEvents || []);
    } else {
      const errData = await res.json();
      setAuditError(errData.error || "Access refused by requireRole guard.");
      setAuditEvents([]);
    }
  }, [auditFilterOutcome]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // offline/dev fallback
    }
  }, []);

  useEffect(() => {
    fetchSession();
    fetchIssues();
    fetchRules();
    fetchStats();
  }, [fetchSession, fetchIssues, fetchRules, fetchStats]);

  useEffect(() => {
    if (activeTab === "audit") {
      fetchAudit();
    }
  }, [activeTab, fetchAudit, currentUser]);

  useEffect(() => {
    if (!selectedIssue) {
      setAllowedForUser([]);
      return;
    }
    fetch(`/api/issues/${selectedIssue.id}/allowed-transitions`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setAllowedForUser(d.allowedTransitions || []);
      })
      .catch(() => setAllowedForUser([]));
  }, [selectedIssue, currentUser]);

  const handleQuickDemoLogin = async (email: string) => {
    setTransitionFeedback(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "PuneDemo@2026" }),
    });
    if (res.ok) {
      await fetchSession();
      if (activeTab === "audit") fetchAudit();
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
    setNotifications([]);
    if (activeTab === "audit") fetchAudit();
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const endpoint =
      authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload =
      authMode === "login"
        ? { email: authEmail, password: authPassword }
        : {
            name: authName,
            email: authEmail,
            password: authPassword,
            phone: authPhone,
          };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setAuthError(data.error || "Authentication failed");
      return;
    }
    setAuthMode(null);
    setAuthEmail("");
    setAuthPassword("");
    setAuthName("");
    await fetchSession();
  };

  const handleTransition = async (toStateOverride?: string) => {
    if (!selectedIssue) return;
    setTransitionFeedback(null);
    const chosenState = toStateOverride || targetState;

    const res = await fetch(`/api/issues/${selectedIssue.id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toState: chosenState,
        reason: transitionReason,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setTransitionFeedback({
        type: "error",
        text: `[${res.status} REFUSED — Logged to AuditEvent] ${data.error}`,
      });
    } else {
      setTransitionFeedback({
        type: "success",
        text: `[ACCEPTED] Transitioned ${selectedIssue.publicRef} → ${chosenState}`,
      });
      setTransitionReason("");
      await fetchIssues();
      await fetchSession();
    }
  };

  const handleDeadlineUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue) return;
    setTransitionFeedback(null);
    const res = await fetch(`/api/issues/${selectedIssue.id}/deadline`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newDeadline: newDeadlineInput,
        reason: deadlineReasonInput,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setTransitionFeedback({
        type: "error",
        text: `[${res.status} REFUSED] ${data.error}`,
      });
    } else {
      setTransitionFeedback({
        type: "success",
        text: `Updated resolution deadline for ${selectedIssue.publicRef} (original deadline preserved).`,
      });
      setDeadlineReasonInput("");
      await fetchIssues();
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRepResult(null);
    const res = await fetch("/api/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: repCategoryId,
        subcategoryId: repSubcategoryId || null,
        description: repDescription,
        language: repLanguage,
        latitude: Number(repLat),
        longitude: Number(repLng),
        publicLocationLabel: repLocationLabel,
        idempotencyKey: repIdempotencyKey,
        evidence: repCaption
          ? {
              filePath: `/uploads/citizen-photo-${Date.now()}.jpg`,
              mimeType: "image/jpeg",
              sizeBytes: 284120,
              caption: repCaption,
              exifLatitude: Number(repLat),
              exifLongitude: Number(repLng),
              exifCapturedAt: new Date().toISOString(),
            }
          : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setRepResult({
        type: "error",
        text: `[${res.status}] ${data.error}`,
      });
      return;
    }

    if (data.deduplicatedRequest) {
      setRepResult({
        type: "success",
        text: `Idempotency Key matched! Returned existing Report ${data.report.referenceId} without creating duplicate records.`,
      });
    } else if (data.mergedIntoExistingIssue) {
      setRepResult({
        type: "success",
        text: `Duplicate Detected (${data.distanceMeters}m away)! Linked new Report ${data.report.referenceId} to existing Issue ${data.issue.publicRef} (Report Count: ${data.issue.reportCount}, Priority: ${data.issue.priority}).`,
      });
    } else {
      setRepResult({
        type: "success",
        text: `Created new Issue ${data.issue.publicRef} & Citizen Report ${data.report.referenceId}!`,
      });
    }

    setRepIdempotencyKey(`idem-${Date.now()}`);
    await fetchIssues();
  };

  const handleRuleUpdate = async (
    type: "DEADLINE" | "PRIORITY",
    id: string,
    payload: {
      responseHours?: number;
      resolutionHours?: number;
      threshold?: number;
    }
  ) => {
    const res = await fetch("/api/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, ...payload }),
    });
    if (res.ok) {
      await fetchRules();
    } else {
      const err = await res.json();
      alert(err.error || "Failed to update rule");
    }
  };

  const totalOverdue = issues.filter((i) => i.isOverdue).length;
  const totalCritical = issues.filter((i) => i.priority === "CRITICAL").length;
  const totalReports = issues.reduce((acc, i) => acc + i.reportCount, 0);

  const { t, tCategory } = useI18n();
  const selectedCategoryObj = categories.find((c) => c.id === repCategoryId);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <CivicHeader
        onAuthChange={() => {
          fetchSession();
          fetchIssues();
        }}
      />

      {viewMode === "portal" ? (
        <div className="flex-1 flex flex-col space-y-10 pb-12">
          {/* Citizen Portal Launchpad Banner */}
          <section
            aria-label="Citizen Grievance Portal Quick Actions"
            className="bg-amber-50 border-b border-amber-300 px-4 py-2.5"
          >
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-amber-950 flex items-center gap-1">
                  🏛️ Pune Municipal Grievance Resolution Track
                </span>
                <span className="hidden sm:inline text-amber-500">•</span>
                <span className="text-amber-900 hidden md:inline">
                  Tagline: <em>&ldquo;Your Complaint. Our Accountability. Pune&rsquo;s Progress.&rdquo;</em>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode("console")}
                  className="px-3 py-1.5 rounded-lg bg-[#0f2942] hover:bg-slate-800 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition border border-amber-400/40 shadow-2xs"
                >
                  ⚡ Open Evaluator & Staff Console →
                </button>
              </div>
            </div>
          </section>

          {/* Hero Section */}
          <section className="max-w-7xl mx-auto w-full px-4 pt-2">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f2942] via-[#13385c] to-slate-900 text-white p-6 sm:p-10 shadow-xl border-t-4 border-amber-500">
              <div className="max-w-3xl space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-bold uppercase tracking-wider">
                  <span>🏛️ Pune Municipal Corporation (PMC) Grievance Track</span>
                </div>
                <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                  Your Complaint. Our Accountability.{" "}
                  <span className="text-amber-400">Pune&rsquo;s Progress.</span>
                </h1>
                <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                  A transparent, server-enforced municipal workflow engine for Pune citizens and administration. Built with 250m spatial duplicate detection, non-skippable role-guarded state transitions, background SLA deadline escalation, and an immutable audit trail.
                </p>

                {/* Primary Action Buttons */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <Link
                    href="/report"
                    className="min-h-[48px] px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition"
                  >
                    📢 Report a Municipal Complaint →
                  </Link>
                  <a
                    href="#live-map"
                    className="min-h-[48px] px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 flex items-center gap-2 backdrop-blur-xs transition"
                  >
                    🗺️ Explore Pune Live Map
                  </a>
                  <Link
                    href="/track"
                    className="min-h-[48px] px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 flex items-center gap-2 backdrop-blur-xs transition"
                  >
                    🔍 Track a Complaint
                  </Link>
                  <Link
                    href="/scorecard"
                    className="min-h-[48px] px-5 py-3 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 font-bold text-sm border border-indigo-400/30 flex items-center gap-2 transition"
                  >
                    📊 Public Scorecard
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Real-time Statistics Strip computed from actual database via GET /api/stats */}
          <section className="max-w-7xl mx-auto w-full px-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    📊 Pune Municipal Redressal Performance Strip
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live metrics computed from physical Issues across all 5 municipal departments.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-purple-100 text-purple-800 font-bold text-[11px] border border-purple-200">
                    Demo data (demonstration prototype figures, not official PMC commitments)
                  </span>
                </div>
              </div>

              {/*
                NagarSetu Redressal Performance Calculation Rules:
                - resolution rate = resolved (RESOLVED_AWAITING_VERIFICATION or CLOSED) ÷ eligible complaints × 100
                - on-time rate = resolved on or before the applicable deadline ÷ eligible resolved × 100
                - eligible complaints EXCLUDE REJECTED / invalid complaints
                - count physical Issues (not duplicate Reports) so duplicate citizen complaints do not inflate numbers
              */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Total Complaints
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {stats?.totalComplaints ?? issues.length}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Eligible physical issues (excl. rejected)
                  </div>
                </div>

                <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
                  <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
                    Resolved Complaints
                  </div>
                  <div className="text-2xl font-black text-emerald-700 mt-1">
                    {stats?.resolved ?? 0}
                  </div>
                  <div className="text-[10px] text-emerald-600 mt-0.5">
                    Awaiting verification / closed
                  </div>
                </div>

                <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-200">
                  <div className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider">
                    In Progress
                  </div>
                  <div className="text-2xl font-black text-blue-700 mt-1">
                    {stats?.inProgress ?? 0}
                  </div>
                  <div className="text-[10px] text-blue-600 mt-0.5">
                    Assigned or undergoing work
                  </div>
                </div>

                <div className="bg-rose-50/80 p-3.5 rounded-xl border border-rose-200">
                  <div className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider">
                    SLA Overdue
                  </div>
                  <div className="text-2xl font-black text-rose-600 mt-1">
                    {stats?.overdue ?? totalOverdue}
                  </div>
                  <div className="text-[10px] text-rose-500 mt-0.5">
                    Past resolution deadline
                  </div>
                </div>

                <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-200">
                  <div className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
                    Resolution Rate
                  </div>
                  <div className="text-2xl font-black text-amber-700 mt-1">
                    {stats?.resolutionRate ?? 0}%
                  </div>
                  <div className="text-[10px] text-amber-700 mt-0.5">
                    Resolved ÷ eligible complaints
                  </div>
                </div>

                <div className="bg-indigo-50/80 p-3.5 rounded-xl border border-indigo-200">
                  <div className="text-[11px] font-semibold text-indigo-800 uppercase tracking-wider">
                    On-Time SLA Rate
                  </div>
                  <div className="text-2xl font-black text-indigo-700 mt-1">
                    {stats?.onTimeResolutionRate ?? 0}%
                  </div>
                  <div className="text-[10px] text-indigo-600 mt-0.5">
                    Resolved within SLA deadline
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Interactive Pune Live Map Section (Leaflet + OpenStreetMap) */}
          <section id="live-map" className="max-w-7xl mx-auto w-full px-4 space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    🗺️ Interactive Live Grievance Map (Leaflet + OpenStreetMap)
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Centred on Pune (18.5204°N, 73.8567°E). Citizen privacy is protected via ~100m grid coordinate snapping (<code>GET /api/public/issues</code>). Urgency is indicated with priority rings (Green/Normal, Orange/High, Red/Critical) and pulsing overdue halos.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href="/map"
                    className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300 transition"
                  >
                    Open Full-Screen Map →
                  </Link>
                </div>
              </div>

              {/* Embedded Interactive Pune Live Map with SSE live stream updates */}
              <PuneLiveMap height="560px" onDataRefresh={fetchStats} />
            </div>
          </section>

          {/* Five Municipal Complaint Categories */}
          <section className="max-w-7xl mx-auto w-full px-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Municipal Grievance Categories
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Select a category to lodge a new complaint or view reporting guidance and municipal department details.
                </p>
              </div>
              <Link
                href="/categories"
                className="text-xs font-bold text-[#0f2942] hover:underline"
              >
                View All Categories & Safety Guidance →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((cat) => {
                const slug = cat.name
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/(^-|-$)/g, "");

                return (
                  <div
                    key={cat.id}
                    className="bg-white rounded-xl border border-slate-200 hover:border-amber-400 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-3xl">{cat.emoji}</span>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            {tCategory(cat.name)}
                          </h3>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {cat.department?.name || "Pune Municipal Corporation"}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {cat.description ||
                          `Report and resolve ${cat.name.toLowerCase()} issues across Pune municipal wards.`}
                      </p>

                      <div className="flex flex-wrap gap-1 pt-1">
                        {cat.subcategories?.slice(0, 3).map((sub) => (
                          <span
                            key={sub.id}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200"
                          >
                            {sub.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <Link
                        href={`/report?category=${slug}`}
                        className="px-3 py-1.5 rounded-lg bg-[#0f2942] hover:bg-slate-800 text-white font-bold text-xs transition"
                      >
                        Report in this Category →
                      </Link>
                      <Link
                        href={`/categories/${slug}`}
                        className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold"
                      >
                        Guidance
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* How NagarSetu Works: Workflow Engine Pillars */}
          <section className="max-w-7xl mx-auto w-full px-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
              <div className="text-center max-w-2xl mx-auto space-y-1">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                  How NagarSetu Works: A Server-Enforced Engine
                </h2>
                <p className="text-xs text-slate-600">
                  Built to solve civic accountability bottlenecks with automated rules, spatial intelligence, and strict SLAs.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm">
                    1
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Citizen Intake & Evidence
                  </h3>
                  <p className="text-xs text-slate-600">
                    A clean 7-step wizard with camera capture, photo validation, and dual browser + server EXIF coordinate extraction.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm">
                    2
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    250m Spatial Deduplication
                  </h3>
                  <p className="text-xs text-slate-600">
                    Reports within 250m are linked to existing issues automatically, preventing staff queue flooding while elevating urgency.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm">
                    3
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Server-Enforced SLAs
                  </h3>
                  <p className="text-xs text-slate-600">
                    Non-skippable transitions with role guards. Background deadline monitor automatically raises priority and alerts supervisors.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm">
                    4
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Public Verification & Audit
                  </h3>
                  <p className="text-xs text-slate-600">
                    7-day citizen reopen window upon resolution. Every accepted action and refused attempt is immutably logged to AuditEvent.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Evaluator & Staff Console Callout */}
          <section className="max-w-7xl mx-auto w-full px-4 pb-8">
            <div className="bg-gradient-to-r from-slate-900 via-[#0f2942] to-slate-900 text-white rounded-2xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6 border-l-8 border-amber-500 shadow-lg">
              <div className="max-w-2xl space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  ⚡ Evaluator & Staff Workspace
                </span>
                <h3 className="text-xl font-bold text-white">
                  Test Internal Staff Workflows, RBAC & Immutable Audit Logs
                </h3>
                <p className="text-xs text-slate-300">
                  Switch to the Staff Console to log in with 1-click demo accounts (Officer Roads, Supervisor Waste, Admin), execute state transitions, simulate illegal skips to test refusal audit events, adjust SLA deadlines, and inspect real-time escalation events.
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setViewMode("console")}
                  className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 transition hover:scale-105"
                >
                  Open Staff Workflow Console →
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          {/* Evaluator Return Bar */}
          <div className="bg-slate-900 text-white px-4 py-2.5 border-b border-slate-800">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-400">⚡ Evaluator & Staff Workflow Engine Console</span>
                <span className="text-slate-400 hidden sm:inline">| Test RBAC guards, state machine edges, supervisor deadline modifications & audit logs</span>
              </div>
              <button
                type="button"
                onClick={() => setViewMode("portal")}
                className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
              >
                ← Return to Public Civic Portal
              </button>
            </div>
          </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <nav className="flex gap-1 py-2">
            {[
              {
                id: "dashboard",
                label: `🗺️ Live Pune Issues & Workflow (${issues.length})`,
              },
              {
                id: "report",
                label: "📢 Report Municipal Issue (Citizen Intake)",
              },
              {
                id: "rules",
                label: "⚙️ Configurable Rules Engine (SLA & Priority)",
              },
              {
                id: "audit",
                label: "🛡️ Immutable Audit Trail & RBAC Logs",
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {notifications.length > 0 && (
            <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full truncate max-w-md">
              🔔 Latest: {notifications[0].message}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto w-full px-4 py-6 flex-1">
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* KPI Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">
                  Active & Historical Pune Issues
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {issues.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Across 5 PMC Municipal Departments
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm">
                <div className="text-xs text-rose-600 font-semibold">
                  Overdue SLA Breaches
                </div>
                <div className="text-2xl font-bold text-rose-600 mt-1">
                  {totalOverdue}
                </div>
                <div className="text-[11px] text-rose-500 mt-1">
                  Auto-escalated by Deadline Monitor
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
                <div className="text-xs text-amber-700 font-semibold">
                  Critical Priority Issues
                </div>
                <div className="text-2xl font-bold text-amber-600 mt-1">
                  {totalCritical}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Triggered by &ge;5 reports or &ge;24h overdue
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-sm">
                <div className="text-xs text-indigo-700 font-semibold">
                  Total Linked Citizen Reports
                </div>
                <div className="text-2xl font-bold text-indigo-600 mt-1">
                  {totalReports}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Deduplicated within 250m radius
                </div>
              </div>
            </div>

            {/* Filters + Interactive Pune Map */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-slate-800">
                  📍 Pune Municipal Grievance Live Coordinate Map & Filters
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                  >
                    <option value="">All 5 Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                  >
                    <option value="">All Statuses</option>
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                  >
                    <option value="">All Priorities</option>
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="NORMAL">NORMAL</option>
                  </select>

                  <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterOverdue}
                      onChange={(e) => setFilterOverdue(e.target.checked)}
                    />
                    <span className="font-medium text-rose-700">
                      Overdue Only
                    </span>
                  </label>
                </div>
              </div>

              {/* Pune Spatial Coordinate Plot (Lat 18.44..18.61, Lng 73.75..73.95) */}
              <div className="relative h-56 w-full rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 overflow-hidden border border-slate-700 p-3">
                <div className="absolute top-2 left-3 text-[11px] text-slate-300 font-mono">
                  PUNE MUNICIPAL GRID (18.44°N–18.61°N, 73.75°E–73.95°E) • Click
                  any pin to inspect issue
                </div>
                <div className="absolute bottom-2 right-3 flex items-center gap-3 text-[11px] text-slate-300">
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block"></span>{" "}
                    Critical / Overdue
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block"></span>{" "}
                    High Priority
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 inline-block"></span>{" "}
                    Normal / Resolved
                  </span>
                </div>

                {issues.map((issue) => {
                  const topPct = Math.min(
                    90,
                    Math.max(12, ((18.61 - issue.latitude) / 0.17) * 85)
                  );
                  const leftPct = Math.min(
                    94,
                    Math.max(5, ((issue.longitude - 73.75) / 0.2) * 90)
                  );
                  const isSelected = selectedIssue?.id === issue.id;
                  const pinColor =
                    issue.priority === "CRITICAL" || issue.isOverdue
                      ? "bg-rose-500 border-white"
                      : issue.priority === "HIGH"
                        ? "bg-amber-400 border-slate-900"
                        : "bg-emerald-400 border-slate-900";

                  return (
                    <button
                      key={issue.id}
                      onClick={() => {
                        setSelectedIssue(issue);
                        setTransitionFeedback(null);
                      }}
                      style={{ top: `${topPct}%`, left: `${leftPct}%` }}
                      title={`${issue.publicRef}: ${issue.publicLocationLabel} (${issue.status})`}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition transform ${pinColor} ${
                        isSelected
                          ? "h-5 w-5 ring-4 ring-amber-300 scale-125 z-20"
                          : "h-3.5 w-3.5 hover:scale-125 z-10"
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Master-Detail Grid: Issue List + Selected Issue Workflow Inspector */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Issue List */}
              <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[760px]">
                <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Pune Grievances ({issues.length})
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Sorted by Overdue & Recency
                  </span>
                </div>
                <div className="divide-y divide-slate-100 overflow-y-auto">
                  {issues.map((item) => {
                    const active = selectedIssue?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedIssue(item);
                          setTransitionFeedback(null);
                        }}
                        className={`w-full text-left p-3.5 transition hover:bg-slate-50 ${
                          active
                            ? "bg-amber-50/70 border-l-4 border-amber-500"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-slate-800">
                            {item.category.emoji} {item.publicRef}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {item.isOverdue && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-600 text-white">
                                OVERDUE
                              </span>
                            )}
                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                item.priority === "CRITICAL"
                                  ? "bg-rose-100 text-rose-800"
                                  : item.priority === "HIGH"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {item.priority}
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {item.status}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs font-semibold text-slate-900 mt-1">
                          {item.subcategory?.name || item.category.name}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5 truncate">
                          📍 {item.publicLocationLabel}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                          <span>👥 {item.reportCount} citizen report(s)</span>
                          <span>
                            SLA:{" "}
                            {new Date(item.resolutionDeadline).toLocaleString()}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Issue Detail & Server-Enforced Workflow Engine */}
              <div className="lg:col-span-7 space-y-4">
                {selectedIssue ? (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-400">
                            {selectedIssue.publicRef}
                          </span>
                          {selectedIssue.isDemo && (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold">
                              DEMO DATA (isDemo=true)
                            </span>
                          )}
                          {selectedIssue.isOverdue && (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-rose-600 text-white font-bold">
                              ⏰ SLA OVERDUE
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mt-1.5">
                          {selectedIssue.category.emoji}{" "}
                          {selectedIssue.category.name} —{" "}
                          {selectedIssue.subcategory?.name}
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          📍 {selectedIssue.publicLocationLabel} (
                          {selectedIssue.latitude.toFixed(4)}°N,{" "}
                          {selectedIssue.longitude.toFixed(4)}°E)
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg inline-block">
                          Status: {selectedIssue.status}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Priority:{" "}
                          <strong className="text-slate-800">
                            {selectedIssue.priority}
                          </strong>{" "}
                          • Reports:{" "}
                          <strong className="text-slate-800">
                            {selectedIssue.reportCount}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Deadlines & Assignment Metadata */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
                      <div>
                        <span className="text-slate-500 block">
                          Response Deadline
                        </span>
                        <strong className="text-slate-800">
                          {new Date(
                            selectedIssue.responseDeadline
                          ).toLocaleString()}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">
                          Resolution Deadline
                        </span>
                        <strong
                          className={
                            selectedIssue.isOverdue
                              ? "text-rose-600"
                              : "text-slate-800"
                          }
                        >
                          {new Date(
                            selectedIssue.resolutionDeadline
                          ).toLocaleString()}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">
                          Assigned PMC Officer
                        </span>
                        <strong className="text-slate-800">
                          {selectedIssue.assignedOfficer
                            ? `${selectedIssue.assignedOfficer.name}`
                            : "Unassigned"}
                        </strong>
                      </div>
                    </div>

                    {/* Server-Enforced Workflow State Machine Action Box */}
                    <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                          ⚡ Server-Enforced Workflow Engine
                        </h4>
                        <span className="text-[11px] text-slate-300">
                          Acting as:{" "}
                          <strong>
                            {currentUser
                              ? `${currentUser.role} (${currentUser.email})`
                              : "Unauthenticated (will return 401 REFUSED)"}
                          </strong>
                        </span>
                      </div>

                      {/* Transitions allowed for CURRENT logged-in user (from GET /api/issues/[id]/allowed-transitions) */}
                      <div className="text-xs text-slate-300 space-y-1.5">
                        <div>
                          Allowed right now for current actor:{" "}
                          {allowedForUser.length === 0 ? (
                            <span className="text-slate-400 italic">
                              None for current role/department (use Test
                              Selector below to verify server refusal + REFUSED
                              AuditEvent)
                            </span>
                          ) : (
                            allowedForUser.map((t) => (
                              <button
                                key={t.id}
                                onClick={() => {
                                  setTargetState(t.toState);
                                  handleTransition(t.toState);
                                }}
                                className="inline-flex items-center gap-1 mr-2 mb-1 px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 font-semibold transition"
                              >
                                ✓ Move to {t.toState}
                                {t.requiresReason ? " (*reason required)" : ""}
                              </button>
                            ))
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          All state graph edges from{" "}
                          <code className="text-amber-300">
                            {selectedIssue.status}
                          </code>
                          :{" "}
                          {transitions
                            .filter((t) => t.fromState === selectedIssue.status)
                            .map(
                              (t) =>
                                `${t.toState} [${(t.allowedRoles as string[]).join("/")}]`
                            )
                            .join(" • ") || "Terminal state"}
                        </div>
                      </div>

                      {/* Custom / Test Any Transition (including illegal ones to verify AuditEvent REFUSED) */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-slate-800">
                        <div className="sm:col-span-4">
                          <label className="text-[10px] text-slate-400 block mb-1">
                            Target State (Test Valid or Refused)
                          </label>
                          <select
                            value={targetState}
                            onChange={(e) => setTargetState(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                          >
                            {ALL_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-5">
                          <label className="text-[10px] text-slate-400 block mb-1">
                            Transition Reason (Required for REJECTED / REOPENED)
                          </label>
                          <input
                            type="text"
                            value={transitionReason}
                            onChange={(e) =>
                              setTransitionReason(e.target.value)
                            }
                            placeholder="e.g., Field inspection completed / Reopened by citizen"
                            className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                        <div className="sm:col-span-3 flex items-end">
                          <button
                            onClick={() => handleTransition()}
                            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-1.5 px-3 rounded transition"
                          >
                            Execute Transition
                          </button>
                        </div>
                      </div>

                      {transitionFeedback && (
                        <div
                          className={`p-2.5 rounded text-xs font-medium ${
                            transitionFeedback.type === "success"
                              ? "bg-emerald-950/90 text-emerald-300 border border-emerald-500/40"
                              : "bg-rose-950/90 text-rose-300 border border-rose-500/40"
                          }`}
                        >
                          {transitionFeedback.text}
                        </div>
                      )}
                    </div>

                    {/* Supervisor Deadline Adjustment */}
                    <form
                      onSubmit={handleDeadlineUpdate}
                      className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2"
                    >
                      <div className="text-xs font-bold text-slate-700">
                        📅 Supervisor Deadline Modification (Preserves{" "}
                        <code>originalResolutionDeadline</code>:{" "}
                        {new Date(
                          selectedIssue.originalResolutionDeadline
                        ).toLocaleDateString()}
                        )
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <input
                          type="datetime-local"
                          value={newDeadlineInput}
                          onChange={(e) => setNewDeadlineInput(e.target.value)}
                          className="sm:col-span-4 border border-slate-300 rounded px-2 py-1 text-xs"
                          required
                        />
                        <input
                          type="text"
                          value={deadlineReasonInput}
                          onChange={(e) =>
                            setDeadlineReasonInput(e.target.value)
                          }
                          placeholder="Reason for deadline extension (required)"
                          className="sm:col-span-5 border border-slate-300 rounded px-2 py-1 text-xs"
                          required
                        />
                        <button
                          type="submit"
                          className="sm:col-span-3 bg-slate-800 text-white text-xs font-semibold rounded px-3 py-1 hover:bg-slate-700"
                        >
                          Update Deadline
                        </button>
                      </div>
                    </form>

                    {/* Linked Citizen Reports & Evidence */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        📋 Linked Citizen Reports (
                        {selectedIssue.reports.length})
                      </h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {selectedIssue.reports.map((rep) => (
                          <div
                            key={rep.id}
                            className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-indigo-700">
                                {rep.referenceId}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                Citizen: {rep.citizen.name} • Server Timestamp:{" "}
                                {new Date(rep.submittedAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-slate-800">{rep.description}</p>
                            <div className="text-[11px] text-slate-400 flex flex-wrap gap-3">
                              <span>Lang: {rep.language}</span>
                              <span>IdempotencyKey: {rep.idempotencyKey}</span>
                            </div>
                            {rep.evidences.map((ev) => (
                              <div
                                key={ev.id}
                                className="mt-1.5 p-2 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center justify-between"
                              >
                                <span>
                                  📷 <strong>{ev.filePath}</strong> —{" "}
                                  {ev.caption || "Evidence attachment"}
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-950 font-semibold">
                                  EXIF UNVERIFIED (
                                  {ev.exifLatitude?.toFixed(3)},{" "}
                                  {ev.exifLongitude?.toFixed(3)})
                                </span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                    Select a Pune grievance issue from the list or map to
                    inspect.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Citizen Report Submission */}
        {activeTab === "report" && (
          <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                📢 Submit a Pune Municipal Grievance Report
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Reports within 250m of an active issue in the same category are
                automatically linked via Duplicate Detection, incrementing{" "}
                <code>reportCount</code> and evaluating{" "}
                <code>PriorityRule</code> thresholds.
              </p>
            </div>

            <form onSubmit={handleReportSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    1. Municipal Category (5 Exact Categories)
                  </label>
                  <select
                    value={repCategoryId}
                    onChange={(e) => {
                      const newCatId = e.target.value;
                      setRepCategoryId(newCatId);
                      const cat = categories.find((c) => c.id === newCatId);
                      setRepSubcategoryId(cat?.subcategories?.[0]?.id || "");
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    2. Subcategory
                  </label>
                  <select
                    value={repSubcategoryId}
                    onChange={(e) => setRepSubcategoryId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  >
                    {selectedCategoryObj?.subcategories.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  3. Pune Locality Preset (or customize coordinates below)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PUNE_PRESETS.map((p) => (
                    <button
                      type="button"
                      key={p.label}
                      onClick={() => {
                        setRepLocationLabel(p.label);
                        setRepLat(p.lat);
                        setRepLng(p.lng);
                      }}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[11px]"
                    >
                      📍 {p.label.split(", ").pop()}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={repLocationLabel}
                    onChange={(e) => setRepLocationLabel(e.target.value)}
                    placeholder="Pune Location Label"
                    className="border border-slate-300 rounded-lg px-3 py-2"
                    required
                  />
                  <input
                    type="number"
                    step="0.0001"
                    value={repLat}
                    onChange={(e) => setRepLat( parseFloat(e.target.value) )}
                    className="border border-slate-300 rounded-lg px-3 py-2"
                    required
                  />
                  <input
                    type="number"
                    step="0.0001"
                    value={repLng}
                    onChange={(e) => setRepLng( parseFloat(e.target.value) )}
                    className="border border-slate-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  4. Grievance Description
                </label>
                <textarea
                  rows={3}
                  value={repDescription}
                  onChange={(e) => setRepDescription(e.target.value)}
                  placeholder="Describe the municipal problem in detail..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Language
                  </label>
                  <select
                    value={repLanguage}
                    onChange={(e) => setRepLanguage(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="en">English (en)</option>
                    <option value="mr">Marathi (mr)</option>
                    <option value="hi">Hindi (hi)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Evidence Photo Caption (EXIF Unverified)
                  </label>
                  <input
                    type="text"
                    value={repCaption}
                    onChange={(e) => setRepCaption(e.target.value)}
                    placeholder="Optional photo evidence caption"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Idempotency Key (Unique)
                  </label>
                  <input
                    type="text"
                    value={repIdempotencyKey}
                    onChange={(e) => setRepIdempotencyKey(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg transition"
              >
                Submit Citizen Grievance Report
              </button>
            </form>

            {repResult && (
              <div
                className={`p-3 rounded-lg text-xs font-medium ${
                  repResult.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {repResult.text}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Configurable Rules Engine */}
        {activeTab === "rules" && (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-amber-950">
                  ⚖️ Demonstration Rules, Not Official PMC Standards
                </h2>
                <p className="text-xs text-amber-800 mt-0.5">
                  All DeadlineRules, PriorityRules, and WorkflowTransitions are
                  stored in SQLite and evaluated dynamically at runtime (not
                  hardcoded). Supervisors and Admins can edit SLA hours &
                  thresholds below.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Deadline Rules */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">
                  ⏱️ Editable DeadlineRules ({deadlineRules.length})
                </h3>
                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto text-xs">
                  {deadlineRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="py-2.5 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">
                          {rule.category.emoji}{" "}
                          {rule.subcategory?.name ||
                            `${rule.category.name} (Category Default)`}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {rule.label}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600">
                          Resp: <strong>{rule.responseHours}h</strong> | Res:{" "}
                          <strong>{rule.resolutionHours}h</strong>
                        </span>
                        <button
                          onClick={() =>
                            handleRuleUpdate("DEADLINE", rule.id, {
                              resolutionHours: Math.max(
                                6,
                                rule.resolutionHours - 6
                              ),
                            })
                          }
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[11px]"
                        >
                          -6h SLA
                        </button>
                        <button
                          onClick={() =>
                            handleRuleUpdate("DEADLINE", rule.id, {
                              resolutionHours: rule.resolutionHours + 6,
                            })
                          }
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[11px]"
                        >
                          +6h SLA
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Priority Rules */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">
                  🚨 Editable PriorityRules ({priorityRules.length})
                </h3>
                <div className="divide-y divide-slate-100 text-xs">
                  {priorityRules.map((pRule) => (
                    <div
                      key={pRule.id}
                      className="py-3 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-mono font-bold text-indigo-700">
                          {pRule.ruleType} &ge; {pRule.threshold}{" "}
                          {pRule.ruleType === "REPORT_COUNT"
                            ? "reports"
                            : "hours overdue"}{" "}
                          → {pRule.resultingPriority}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {pRule.label}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() =>
                            handleRuleUpdate("PRIORITY", pRule.id, {
                              threshold: Math.max(0, pRule.threshold - 1),
                            })
                          }
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[11px]"
                        >
                          -1
                        </button>
                        <button
                          onClick={() =>
                            handleRuleUpdate("PRIORITY", pRule.id, {
                              threshold: pRule.threshold + 1,
                            })
                          }
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[11px]"
                        >
                          +1
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Audit Trail */}
        {activeTab === "audit" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  🛡️ Immutable Server AuditEvent Log (Protected by{" "}
                  <code>requireRole([&apos;OFFICER&apos;, &apos;SUPERVISOR&apos;, &apos;ADMIN&apos;])</code>)
                </h2>
                <p className="text-xs text-slate-500">
                  Records every ACCEPTED state transition and every REFUSED
                  authentication, role guard, or workflow violation.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <select
                  value={auditFilterOutcome}
                  onChange={(e) => setAuditFilterOutcome(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                >
                  <option value="">All Outcomes (ACCEPTED + REFUSED)</option>
                  <option value="ACCEPTED">ACCEPTED Only</option>
                  <option value="REFUSED">REFUSED Only (Security & SLA)</option>
                </select>
                <button
                  onClick={fetchAudit}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold"
                >
                  Refresh
                </button>
              </div>
            </div>

            {auditError ? (
              <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium">
                🔒 <strong>{auditError}</strong> — Your refused attempt was just
                logged to <code>AuditEvent</code> with{" "}
                <code>outcome = REFUSED</code>! Switch to an Officer,
                Supervisor, or Admin demo account in the top bar to inspect it.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                      <th className="p-2.5">Server Timestamp</th>
                      <th className="p-2.5">Outcome</th>
                      <th className="p-2.5">Actor</th>
                      <th className="p-2.5">Action & Entity</th>
                      <th className="p-2.5">Reason & Rule Applied</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditEvents.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(ev.timestamp).toLocaleString()}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              ev.outcome === "ACCEPTED"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {ev.outcome}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-[11px]">
                          <span className="font-semibold text-slate-700">
                            [{ev.actorType}]
                          </span>{" "}
                          {ev.actorLabel}
                        </td>
                        <td className="p-2.5">
                          <div className="font-semibold text-slate-900">
                            {ev.action}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {ev.entityType} {ev.entityId ? `#${ev.entityId.slice(0, 8)}` : ""}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <div className="text-slate-800">{ev.reason}</div>
                          {ev.ruleApplied && (
                            <div className="text-[11px] text-indigo-600 font-mono">
                              Rule: {ev.ruleApplied}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
        </div>
      )}

      {/* Auth Modal */}
      {authMode && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {authMode === "login"
                  ? "Sign In to NagarSetu"
                  : "Citizen Self-Registration"}
              </h3>
              <button
                onClick={() => setAuthMode(null)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                ✕ Close
              </button>
            </div>
            <form onSubmit={handleAuthSubmit} className="space-y-3 text-xs">
              {authMode === "register" && (
                <>
                  <div>
                    <label className="block font-semibold mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full border border-slate-300 rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">
                      Phone (Optional)
                    </label>
                    <input
                      type="text"
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                      className="w-full border border-slate-300 rounded px-3 py-2"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2"
                  required
                />
              </div>
              {authError && (
                <div className="p-2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                  {authError}
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-slate-900 text-white font-bold py-2 rounded"
              >
                {authMode === "login" ? "Login" : "Register Citizen Account"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
