"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  Clock,
  AlertTriangle,
  Flame,
  CheckCircle2,
  XCircle,
  FileText,
  User,
  Users,
  Settings,
  Activity,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  Upload,
  Calendar,
  Layers,
  MapPin,
  Star,
  Check,
  AlertCircle,
  Copy,
  ChevronDown,
  Building,
  Lock,
} from "lucide-react";
import { CivicHeader } from "@/components/CivicHeader";
import NotificationBell from "@/components/staff/NotificationBell";
import { AiSuggestionPanel } from "@/components/staff/AiSuggestionPanel";
import { InvalidActionDemoPanel } from "@/components/staff/InvalidActionDemoPanel";
import PerformanceCharts from "@/components/staff/PerformanceCharts";
import DuplicateReviewQueue from "@/components/staff/DuplicateReviewQueue";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "CITIZEN" | "OFFICER" | "SUPERVISOR" | "ADMIN";
  departmentId: string | null;
  department?: { id: string; name: string; categoryId: string } | null;
  isDemo?: boolean;
}

interface IssueItem {
  id: string;
  publicRef: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  isOverdue: boolean;
  reportCount: number;
  latitude: number | null;
  longitude: number | null;
  publicLocationLabel: string;
  resolutionDeadline: string | null;
  responseDeadline: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  resolutionNote?: string | null;
  resolutionEvidencePath?: string | null;
  escalationLevel: number;
  createdAt: string;
  category: { id: string; name: string; slug: string; department?: { id: string; name: string } };
  subcategory?: { id: string; name: string } | null;
  assignedOfficer?: { id: string; name: string; email: string; role: string } | null;
  reports: Array<{
    id: string;
    description: string;
    latitude: number;
    longitude: number;
    submittedAt: string;
    citizen?: { id: string; name: string; email: string; phone?: string | null } | null;
    evidences: Array<{
      id: string;
      filePath: string;
      mimeType: string;
      caption?: string | null;
      exifLatitude?: number | null;
      exifLongitude?: number | null;
      exifCapturedAt?: string | null;
    }>;
  }>;
  escalationEvents: Array<{
    id: string;
    level: number;
    reason: string;
    createdAt: string;
    notifiedUser?: { name: string; email: string } | null;
  }>;
  deadlineChanges: Array<{
    id: string;
    oldDeadline: string;
    newDeadline: string;
    reason: string;
    createdAt: string;
    actor?: { name: string; email: string } | null;
  }>;
}

interface AllowedTransition {
  id: string;
  fromState: string;
  toState: string;
  allowedRoles: string[];
  requiresReason: boolean;
  sameDepartmentOnly: boolean;
}

interface AuditRecord {
  id: string;
  timestamp: string;
  actorType: string;
  actorLabel: string;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue: any;
  newValue: any;
  reason: string | null;
  ruleApplied: string | null;
  outcome: "ACCEPTED" | "REFUSED";
}

interface DepartmentOfficer {
  id: string;
  name: string;
  email: string;
}

export default function StaffPortalPage() {
  const router = useRouter();

  // Auth & Session
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<string>("queue");

  // Issues list
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [departmentOfficers, setDepartmentOfficers] = useState<DepartmentOfficer[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterSearch, setFilterSearch] = useState<string>("");

  // Selected issue for detail drawer
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<IssueItem | null>(null);
  const [issueDetailLoading, setIssueDetailLoading] = useState(false);
  const [allowedTransitions, setAllowedTransitions] = useState<AllowedTransition[]>([]);

  // Action Modals State
  const [actionTransition, setActionTransition] = useState<AllowedTransition | null>(null);
  const [actionReason, setActionReason] = useState<string>("");
  const [actionResolutionNote, setActionResolutionNote] = useState<string>("");
  const [resolutionPhotoFile, setResolutionPhotoFile] = useState<File | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Supervisor Reassignment Modal
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignOfficerId, setReassignOfficerId] = useState<string>("");
  const [reassignReason, setReassignReason] = useState<string>("");
  const [isSubmittingReassign, setIsSubmittingReassign] = useState(false);

  // Supervisor Deadline Change Modal
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [newDeadlineVal, setNewDeadlineVal] = useState<string>("");
  const [deadlineReason, setDeadlineReason] = useState<string>("");
  const [isSubmittingDeadline, setIsSubmittingDeadline] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilterOutcome, setAuditFilterOutcome] = useState<string>("ALL");
  const [auditFilterActor, setAuditFilterActor] = useState<string>("");
  const [auditFilterAction, setAuditFilterAction] = useState<string>("");

  // Admin Config State
  const [adminRules, setAdminRules] = useState<{
    deadlineRules: any[];
    priorityRules: any[];
    categories: any[];
    departments: any[];
  } | null>(null);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminWorkflow, setAdminWorkflow] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleFormData, setRuleFormData] = useState<{ [key: string]: any }>({});
  const [adminFeedback, setAdminFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Check auth session
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          // Default tab based on role
          if (data.user.role === "OFFICER") {
            setActiveTab("assigned");
          } else if (data.user.role === "SUPERVISOR") {
            setActiveTab("queue");
          } else if (data.user.role === "ADMIN") {
            setActiveTab("all_issues");
          }
        }
      } catch (err) {
        console.error("Auth check failed", err);
      } finally {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, []);

  // Fetch issues when tab or filters change
  const fetchStaffIssues = async () => {
    if (!user || user.role === "CITIZEN") return;
    setIssuesLoading(true);
    try {
      const assignedToMe = activeTab === "assigned";
      const overdueOnly = activeTab === "overdue";
      const escalatedOnly = activeTab === "escalated";

      const url = new URL("/api/staff/issues", window.location.origin);
      if (assignedToMe) url.searchParams.set("assignedToMe", "true");
      if (overdueOnly) url.searchParams.set("overdue", "true");
      if (escalatedOnly) url.searchParams.set("escalated", "true");
      if (filterStatus !== "ALL") url.searchParams.set("status", filterStatus);
      if (filterPriority !== "ALL") url.searchParams.set("priority", filterPriority);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.ok) {
        setIssues(data.issues || []);
        if (data.departmentOfficers) {
          setDepartmentOfficers(data.departmentOfficers);
        }
      }
    } catch (err) {
      console.error("Failed to load staff issues", err);
    } finally {
      setIssuesLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role !== "CITIZEN") {
      if (
        activeTab === "assigned" ||
        activeTab === "queue" ||
        activeTab === "all_issues" ||
        activeTab === "overdue" ||
        activeTab === "escalated"
      ) {
        fetchStaffIssues();
      } else if (activeTab === "audit") {
        fetchAuditLogs();
      } else if (activeTab === "rules" || activeTab === "workflow" || activeTab === "staff_mgmt") {
        fetchAdminData();
      }
    }
  }, [user, activeTab, filterStatus, filterPriority]);

  // Load single issue details & allowed transitions
  const loadIssueDetail = async (issueId: string) => {
    setSelectedIssueId(issueId);
    setIssueDetailLoading(true);
    setActionError(null);
    try {
      const [issueRes, transRes] = await Promise.all([
        fetch(`/api/issues/${issueId}`),
        fetch(`/api/issues/${issueId}/allowed-transitions`),
      ]);
      const issueData = await issueRes.json();
      const transData = await transRes.json();

      if (issueData.ok) {
        setSelectedIssue(issueData.issue);
      }
      if (transData.ok) {
        setAllowedTransitions(transData.allowedTransitions || []);
      }
    } catch (err) {
      console.error("Failed to load issue detail", err);
    } finally {
      setIssueDetailLoading(false);
    }
  };

  // Fetch Audit Logs
  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const url = new URL("/api/audit", window.location.origin);
      if (auditFilterOutcome !== "ALL") url.searchParams.set("outcome", auditFilterOutcome);
      if (auditFilterActor) url.searchParams.set("actor", auditFilterActor);
      if (auditFilterAction) url.searchParams.set("action", auditFilterAction);
      url.searchParams.set("limit", "100");

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.ok) {
        setAuditLogs(data.auditEvents || []);
      }
    } catch (err) {
      console.error("Failed to load audit logs", err);
    } finally {
      setAuditLoading(false);
    }
  };

  // Fetch Admin Data
  const fetchAdminData = async () => {
    if (user?.role !== "ADMIN") return;
    setAdminLoading(true);
    try {
      const [rulesRes, usersRes, wfRes] = await Promise.all([
        fetch("/api/admin/rules"),
        fetch("/api/admin/users"),
        fetch("/api/admin/workflow"),
      ]);
      const rulesData = await rulesRes.json();
      const usersData = await usersRes.json();
      const wfData = await wfRes.json();

      if (rulesData.ok) setAdminRules(rulesData);
      if (usersData.users) setAdminUsers(usersData.users);
      if (wfData.transitions) setAdminWorkflow(wfData.transitions);
    } catch (err) {
      console.error("Admin data fetch failed", err);
    } finally {
      setAdminLoading(false);
    }
  };

  // Quick 1-Click Demo Login Switcher
  const handleQuickDemoSwitch = async (email: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "PuneDemo@2026" }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (err) {
      console.error("Demo switch failed", err);
    }
  };

  // Execute Workflow Transition
  const handleExecuteTransition = async () => {
    if (!selectedIssue || !actionTransition) return;
    setIsSubmittingAction(true);
    setActionError(null);

    try {
      let resolutionEvidencePath: string | undefined = undefined;

      // If resolving and an after-photo is selected, upload it first
      if (actionTransition.toState === "RESOLVED_AWAITING_VERIFICATION" && resolutionPhotoFile) {
        const formData = new FormData();
        formData.append("file", resolutionPhotoFile);
        const upRes = await fetch("/api/evidence/upload", {
          method: "POST",
          body: formData,
        });
        const upData = await upRes.json();
        if (upRes.ok && upData.ok) {
          resolutionEvidencePath = upData.filePath || upData.fileName;
        } else {
          throw new Error(upData.error || "Failed to upload resolution proof photo.");
        }
      }

      const res = await fetch(`/api/issues/${selectedIssue.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toState: actionTransition.toState,
          reason: actionReason || undefined,
          resolutionNote: actionResolutionNote || undefined,
          resolutionEvidencePath,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setActionTransition(null);
        setActionReason("");
        setActionResolutionNote("");
        setResolutionPhotoFile(null);
        // Refresh detail and list
        await loadIssueDetail(selectedIssue.id);
        await fetchStaffIssues();
      } else {
        setActionError(data.error || "Server rejected workflow transition.");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to execute transition.");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Supervisor: Reassign Issue
  const handleReassign = async () => {
    if (!selectedIssue || !reassignOfficerId) return;
    setIsSubmittingReassign(true);
    try {
      const res = await fetch(`/api/issues/${selectedIssue.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          officerId: reassignOfficerId,
          reason: reassignReason || "Supervisor reassigned grievance to field officer",
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setShowReassignModal(false);
        setReassignReason("");
        await loadIssueDetail(selectedIssue.id);
        await fetchStaffIssues();
      } else {
        alert(data.error || "Reassignment failed.");
      }
    } catch (err: any) {
      alert(err.message || "Network error.");
    } finally {
      setIsSubmittingReassign(false);
    }
  };

  // Supervisor: Change Deadline
  const handleDeadlineChange = async () => {
    if (!selectedIssue || !newDeadlineVal || !deadlineReason) {
      alert("Please specify a revised deadline and a mandatory justification reason.");
      return;
    }
    setIsSubmittingDeadline(true);
    try {
      const res = await fetch(`/api/issues/${selectedIssue.id}/deadline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newDeadline: new Date(newDeadlineVal).toISOString(),
          reason: deadlineReason,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setShowDeadlineModal(false);
        setDeadlineReason("");
        await loadIssueDetail(selectedIssue.id);
        await fetchStaffIssues();
      } else {
        alert(data.error || "Deadline update rejected by server.");
      }
    } catch (err: any) {
      alert(err.message || "Network error.");
    } finally {
      setIsSubmittingDeadline(false);
    }
  };

  // Admin: Save Rule Change
  const handleSaveRule = async (type: "DEADLINE_RULE" | "PRIORITY_RULE", id: string) => {
    setAdminFeedback(null);
    try {
      const res = await fetch("/api/admin/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          id,
          data: ruleFormData[id] || {},
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setAdminFeedback({ type: "success", msg: "Rule updated and recorded in audit ledger!" });
        setEditingRuleId(null);
        await fetchAdminData();
      } else {
        setAdminFeedback({ type: "error", msg: data.error || "Failed to update rule." });
      }
    } catch (err: any) {
      setAdminFeedback({ type: "error", msg: err.message || "Network error." });
    }
  };

  // Calculate Officer KPI summary
  const officerKpis = {
    assigned: issues.filter((i) => i.assignedOfficer?.id === user?.id).length,
    dueSoon: issues.filter((i) => {
      if (!i.resolutionDeadline || i.isOverdue) return false;
      const hours = (new Date(i.resolutionDeadline).getTime() - Date.now()) / (1000 * 60 * 60);
      return hours > 0 && hours <= 24;
    }).length,
    overdue: issues.filter((i) => i.isOverdue).length,
    resolvedWeek: issues.filter((i) => {
      if (!i.resolvedAt) return false;
      const ms = Date.now() - new Date(i.resolvedAt).getTime();
      return ms <= 7 * 24 * 60 * 60 * 1000;
    }).length,
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
          <p className="text-slate-600 text-sm font-medium">Verifying municipal staff credentials...</p>
        </div>
      </div>
    );
  }

  // If not logged in, show login prompt
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <CivicHeader />
        <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl shadow-sm border border-slate-200 text-center">
          <Shield className="w-12 h-12 text-indigo-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900">Pune Municipal Staff Portal</h2>
          <p className="text-xs text-slate-500 mt-2 mb-6">
            Access restricted to verified Pune Municipal Corporation (PMC) field officers, department supervisors, and workflow administrators.
          </p>
          <Link
            href="/login?returnTo=/staff"
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition block text-center"
          >
            Log In to Staff Portal
          </Link>
        </div>
        <footer className="text-center py-6 text-xs text-slate-400">
          NagarSetu &bull; Pune Municipal Grievance Resolution Workflow Engine
        </footer>
      </div>
    );
  }

  // If user is a CITIZEN, strictly block staff view!
  if (user.role === "CITIZEN") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <CivicHeader />
        <div className="max-w-lg mx-auto my-16 p-8 bg-white rounded-2xl shadow-sm border border-rose-200 text-center">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6" />
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-rose-100 text-rose-700">
            Access Restricted
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-3">Citizen Role Detected</h2>
          <p className="text-xs text-slate-600 mt-2 mb-6">
            You are currently logged in as <strong className="text-slate-900">{user.email}</strong> with role <strong className="text-indigo-600">CITIZEN</strong>.
            The Staff Portal (/staff) is strictly restricted to Municipal Officers, Department Supervisors, and System Administrators.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/my-complaints"
              className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition"
            >
              Go to My Complaints
            </Link>
            <button
              onClick={() => handleQuickDemoSwitch("officer.roads@pune.gov.in")}
              className="px-5 py-2.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 transition"
            >
              Switch to Officer Demo Account
            </button>
          </div>
        </div>
        <footer className="text-center py-6 text-xs text-slate-400">
          NagarSetu &bull; Server-Enforced Role-Based Access Control
        </footer>
      </div>
    );
  }

  const roleColors = {
    OFFICER: "bg-blue-100 text-blue-800 border-blue-200",
    SUPERVISOR: "bg-purple-100 text-purple-800 border-purple-200",
    ADMIN: "bg-rose-100 text-rose-800 border-rose-200",
    CITIZEN: "bg-slate-100 text-slate-800 border-slate-200",
  };

  const priorityColors = {
    LOW: "bg-slate-100 text-slate-700 border-slate-200",
    NORMAL: "bg-blue-50 text-blue-700 border-blue-200",
    HIGH: "bg-amber-50 text-amber-700 border-amber-200",
    CRITICAL: "bg-rose-100 text-rose-800 border-rose-300 font-bold",
  };

  const statusColors: Record<string, string> = {
    SUBMITTED: "bg-slate-100 text-slate-700 border-slate-200",
    VERIFIED: "bg-blue-50 text-blue-700 border-blue-200",
    ASSIGNED: "bg-indigo-50 text-indigo-700 border-indigo-200",
    IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-200",
    RESOLVED_AWAITING_VERIFICATION: "bg-emerald-50 text-emerald-800 border-emerald-200",
    CLOSED: "bg-emerald-100 text-emerald-900 border-emerald-300",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
    REOPENED: "bg-amber-100 text-amber-800 border-amber-300",
  };

  // Filtered issues
  const filteredIssues = issues.filter((issue) => {
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      const match =
        issue.publicRef.toLowerCase().includes(q) ||
        issue.title.toLowerCase().includes(q) ||
        issue.publicLocationLabel.toLowerCase().includes(q) ||
        issue.category.name.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Main Staff Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Portal Label */}
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-700 to-indigo-500 text-white flex items-center justify-center font-bold text-base shadow-sm">
                  न
                </span>
                <span className="font-bold text-slate-900 text-base">NagarSetu</span>
              </Link>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Staff Portal
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${roleColors[user.role]}`}>
                  {user.role}
                </span>
                {user.department && (
                  <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    <Building className="w-3 h-3 text-slate-400" />
                    {user.department.name}
                  </span>
                )}
              </div>
            </div>

            {/* Right Controls: Demo Switcher & Notifications */}
            <div className="flex items-center gap-3">
              {/* Quick Demo Switcher */}
              <div className="hidden lg:flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
                <span className="text-[10px] font-bold text-slate-400 px-1 uppercase">Switch Demo:</span>
                <button
                  onClick={() => handleQuickDemoSwitch("officer.roads@pune.gov.in")}
                  className={`px-2 py-1 rounded-lg font-medium transition ${
                    user.email === "officer.roads@pune.gov.in"
                      ? "bg-white text-blue-700 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Roads Officer (FC Road, Potholes)"
                >
                  👷 Roads
                </button>
                <button
                  onClick={() => handleQuickDemoSwitch("officer.water@pune.gov.in")}
                  className={`px-2 py-1 rounded-lg font-medium transition ${
                    user.email === "officer.water@pune.gov.in"
                      ? "bg-white text-blue-700 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Water Officer (Kothrud water supply)"
                >
                  🚰 Water
                </button>
                <button
                  onClick={() => handleQuickDemoSwitch("supervisor.west@pune.gov.in")}
                  className={`px-2 py-1 rounded-lg font-medium transition ${
                    user.email === "supervisor.west@pune.gov.in"
                      ? "bg-white text-purple-700 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Supervisor West (Reassignment, Deadlines, Duplicates)"
                >
                  🛡️ Supervisor
                </button>
                <button
                  onClick={() => handleQuickDemoSwitch("admin@pune.gov.in")}
                  className={`px-2 py-1 rounded-lg font-medium transition ${
                    user.email === "admin@pune.gov.in"
                      ? "bg-white text-rose-700 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="PMC Admin (Rules, Config, Full audit)"
                >
                  ⚙️ Admin
                </button>
              </div>

              {/* Notification Bell */}
              <NotificationBell onSelectIssue={(id) => loadIssueDetail(id)} />

              {/* User Dropdown / Logout */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <span className="text-xs font-medium text-slate-700 hidden sm:inline truncate max-w-[120px]">
                  {user.name}
                </span>
                <Link
                  href="/api/auth/logout"
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 rounded hover:bg-rose-50 transition"
                >
                  Logout
                </Link>
              </div>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto py-2 border-t border-slate-100 text-xs">
            {/* Officer Tabs */}
            {user.role === "OFFICER" && (
              <>
                <button
                  onClick={() => setActiveTab("assigned")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                    activeTab === "assigned"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  My Assigned Queue ({officerKpis.assigned})
                </button>
                <button
                  onClick={() => setActiveTab("queue")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                    activeTab === "queue"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Department Complaints
                </button>
                <button
                  onClick={() => setActiveTab("audit")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                    activeTab === "audit"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Audit Trail
                </button>
              </>
            )}

            {/* Supervisor Tabs */}
            {user.role === "SUPERVISOR" && (
              <>
                <button
                  onClick={() => setActiveTab("queue")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                    activeTab === "queue"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Supervisory Queue (Overdue &amp; Escalations)
                </button>
                <button
                  onClick={() => setActiveTab("duplicates")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                    activeTab === "duplicates"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Duplicate Review
                </button>
                <button
                  onClick={() => setActiveTab("analytics")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                    activeTab === "analytics"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Performance Analytics
                </button>
                <button
                  onClick={() => setActiveTab("audit")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                    activeTab === "audit"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Audit Trail
                </button>
                <button
                  onClick={() => setActiveTab("demo_h")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                    activeTab === "demo_h"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100 text-rose-700"
                  }`}
                >
                  ⚠️ Scenario H Demo (Invalid Action)
                </button>
              </>
            )}

            {/* Admin Tabs */}
            {user.role === "ADMIN" && (
              <>
                <button
                  onClick={() => setActiveTab("all_issues")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                    activeTab === "all_issues"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  All Grievances
                </button>
                <button
                  onClick={() => setActiveTab("rules")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                    activeTab === "rules"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Rules &amp; SLAs
                </button>
                <button
                  onClick={() => setActiveTab("workflow")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                    activeTab === "workflow"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  State Machine
                </button>
                <button
                  onClick={() => setActiveTab("staff_mgmt")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                    activeTab === "staff_mgmt"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Staff Management
                </button>
                <button
                  onClick={() => setActiveTab("analytics")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                    activeTab === "analytics"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  City Analytics
                </button>
                <button
                  onClick={() => setActiveTab("audit")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                    activeTab === "audit"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Audit Trail
                </button>
                <button
                  onClick={() => setActiveTab("demo_h")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                    activeTab === "demo_h"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100 text-rose-700"
                  }`}
                >
                  ⚠️ Scenario H Demo
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        {/* OFFICER KPI SUMMARY CARDS */}
        {user.role === "OFFICER" && activeTab === "assigned" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Assigned to Me
              </span>
              <div className="text-2xl font-extrabold text-blue-600 mt-1">
                {officerKpis.assigned}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Active field queue</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Due Soon (&lt; 24h)
              </span>
              <div className="text-2xl font-extrabold text-amber-600 mt-1">
                {officerKpis.dueSoon}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Nearing SLA deadline</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Overdue (Breached)
              </span>
              <div className="text-2xl font-extrabold text-rose-600 mt-1">
                {officerKpis.overdue}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Requires immediate action</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Resolved This Week
              </span>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">
                {officerKpis.resolvedWeek}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Field closures verified</p>
            </div>
          </div>
        )}

        {/* ISSUES TABLE VIEW */}
        {(activeTab === "assigned" ||
          activeTab === "queue" ||
          activeTab === "all_issues" ||
          activeTab === "overdue" ||
          activeTab === "escalated") && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search reference, title, location..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="NORMAL">Normal</option>
                  <option value="LOW">Low</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="VERIFIED">Verified</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED_AWAITING_VERIFICATION">Resolved (Awaiting)</option>
                  <option value="CLOSED">Closed</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="REOPENED">Reopened</option>
                </select>

                <button
                  onClick={fetchStaffIssues}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition"
                  title="Refresh list"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Issues Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {issuesLoading ? (
                <div className="p-12 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                  <p className="text-xs">Loading grievance records from database...</p>
                </div>
              ) : filteredIssues.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  <p className="text-sm font-semibold text-slate-800">No complaints matching filter</p>
                  <p className="text-xs text-slate-400 mt-1">
                    All grievances in this view have been processed or moved.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[11px]">
                        <th className="py-3 px-4">Reference &amp; Title</th>
                        <th className="py-3 px-4">Category &amp; Department</th>
                        <th className="py-3 px-4">Priority</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Resolution Deadline</th>
                        <th className="py-3 px-4">Assigned Officer</th>
                        <th className="py-3 px-4 text-center">Reports</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredIssues.map((issue) => {
                        let deadlineLabel = "No deadline";
                        let isOverdue = issue.isOverdue;
                        if (issue.resolutionDeadline) {
                          const diffHours = Math.round(
                            (new Date(issue.resolutionDeadline).getTime() - Date.now()) / (1000 * 60 * 60)
                          );
                          if (diffHours < 0) {
                            deadlineLabel = `Overdue by ${Math.abs(diffHours)}h`;
                            isOverdue = true;
                          } else {
                            deadlineLabel = `${diffHours}h remaining`;
                          }
                        }

                        return (
                          <tr
                            key={issue.id}
                            className={`hover:bg-slate-50/80 transition cursor-pointer ${
                              selectedIssueId === issue.id ? "bg-indigo-50/40" : ""
                            }`}
                            onClick={() => loadIssueDetail(issue.id)}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-indigo-700">
                                  {issue.publicRef}
                                </span>
                                {issue.escalationLevel > 0 && (
                                  <span className="p-0.5 rounded bg-rose-100 text-rose-700" title={`Escalation Level ${issue.escalationLevel}`}>
                                    <Flame className="w-3.5 h-3.5" />
                                  </span>
                                )}
                              </div>
                              <p className="font-medium text-slate-800 line-clamp-1 max-w-xs mt-0.5">
                                {issue.title}
                              </p>
                              <span className="text-[10px] text-slate-400">
                                {issue.publicLocationLabel}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <span className="font-medium text-slate-700 block">
                                {issue.category.name}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {issue.subcategory?.name || issue.category.department?.name || "Municipal"}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full border text-[10px] uppercase font-semibold ${
                                  priorityColors[issue.priority as keyof typeof priorityColors] || "bg-slate-100"
                                }`}
                              >
                                {issue.priority}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full border text-[10px] uppercase font-semibold ${
                                  statusColors[issue.status] || "bg-slate-100"
                                }`}
                              >
                                {issue.status.replace(/_/g, " ")}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1">
                                <Clock
                                  className={`w-3.5 h-3.5 ${
                                    isOverdue ? "text-rose-600" : "text-slate-400"
                                  }`}
                                />
                                <span
                                  className={`font-medium ${
                                    isOverdue ? "text-rose-600 font-bold" : "text-slate-600"
                                  }`}
                                >
                                  {deadlineLabel}
                                </span>
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              {issue.assignedOfficer ? (
                                <span className="text-slate-700 font-medium">
                                  {issue.assignedOfficer.name}
                                </span>
                              ) : (
                                <span className="text-amber-600 italic">Unassigned</span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full font-bold">
                                {issue.reportCount}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  loadIssueDetail(issue.id);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
                              >
                                Inspect
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DUPLICATE REVIEW QUEUE TAB (SUPERVISOR) */}
        {activeTab === "duplicates" && <DuplicateReviewQueue />}

        {/* PERFORMANCE ANALYTICS TAB (SUPERVISOR / ADMIN) */}
        {activeTab === "analytics" && <PerformanceCharts />}

        {/* AUDIT LOG TAB (SHARED) */}
        {activeTab === "audit" && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Municipal Grievance Audit &amp; Governance Ledger
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Immutable record of every transition, deadline calculation, and permission refusal.
                  System automation processes are tagged with their rule names.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={auditFilterOutcome}
                  onChange={(e) => setAuditFilterOutcome(e.target.value)}
                  className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="ALL">All Outcomes</option>
                  <option value="ACCEPTED">ACCEPTED Only</option>
                  <option value="REFUSED">REFUSED (Violations) Only</option>
                </select>

                <input
                  type="text"
                  placeholder="Filter actor (e.g. system:deadline-monitor)..."
                  value={auditFilterActor}
                  onChange={(e) => setAuditFilterActor(e.target.value)}
                  className="text-xs px-3 py-2 rounded-lg border border-slate-200"
                />

                <button
                  onClick={fetchAuditLogs}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {auditLoading ? (
                <div className="p-12 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                  <p className="text-xs">Querying audit events...</p>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No audit events found matching filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[11px]">
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Actor</th>
                        <th className="py-3 px-4">Action</th>
                        <th className="py-3 px-4">Outcome</th>
                        <th className="py-3 px-4">Rule Applied</th>
                        <th className="py-3 px-4">Reason / Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map((log) => {
                        const isRefused = log.outcome === "REFUSED";
                        const isSystem = log.actorType === "SYSTEM" || log.actorLabel.startsWith("system:");

                        return (
                          <tr
                            key={log.id}
                            className={`hover:bg-slate-50/80 transition ${
                              isRefused ? "bg-rose-50/40" : ""
                            }`}
                          >
                            <td className="py-3 px-4 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                              {new Date(log.timestamp).toLocaleString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </td>

                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                                  isSystem
                                    ? "bg-slate-200 text-slate-800 font-mono"
                                    : "bg-blue-50 text-blue-700"
                                }`}
                              >
                                {log.actorLabel}
                              </span>
                            </td>

                            <td className="py-3 px-4 font-mono font-medium text-slate-800">
                              {log.action}
                            </td>

                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                                  isRefused
                                    ? "bg-rose-600 text-white"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {log.outcome}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                              {log.ruleApplied || "WorkflowEngine:Default"}
                            </td>

                            <td className="py-3 px-4 text-slate-700 max-w-md">
                              <p className={isRefused ? "text-rose-700 font-medium" : ""}>
                                {log.reason || "-"}
                              </p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DEMO SCENARIO H TAB */}
        {activeTab === "demo_h" && (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900">
              <strong>Judge &amp; Evaluator Demonstration Tool:</strong> This panel executes Scenario H.
              It verifies that the backend workflow engine rejects unauthorized or graph-skipping operations,
              and immutably records the refusal reason in the AuditEvent ledger.
            </div>
            <InvalidActionDemoPanel issues={issues} onAuditRefreshed={fetchAuditLogs} />
          </div>
        )}

        {/* ADMIN: RULES & SLAS TAB */}
        {activeTab === "rules" && adminRules && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-bold text-slate-900">
                DeadlineRules Configuration Engine
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure maximum permitted response and resolution hours per category and severity.
                Validation rule enforces response hours &le; resolution hours.
              </p>

              {adminFeedback && (
                <div
                  className={`mt-3 p-3 rounded-lg text-xs font-medium ${
                    adminFeedback.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  {adminFeedback.msg}
                </div>
              )}

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase text-[11px]">
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Subcategory</th>
                      <th className="py-2.5 px-3">Severity</th>
                      <th className="py-2.5 px-3">Response SLA</th>
                      <th className="py-2.5 px-3">Resolution SLA</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {adminRules.deadlineRules.map((rule) => {
                      const isEditing = editingRuleId === rule.id;
                      const formData = ruleFormData[rule.id] || {
                        responseHours: rule.responseHours,
                        resolutionHours: rule.resolutionHours,
                      };

                      return (
                        <tr key={rule.id}>
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            {rule.category?.name || "Global Default"}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {rule.subcategory?.name || "All Subcategories"}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                              {rule.severity}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {isEditing ? (
                              <input
                                type="number"
                                value={formData.responseHours}
                                onChange={(e) =>
                                  setRuleFormData((prev) => ({
                                    ...prev,
                                    [rule.id]: {
                                      ...formData,
                                      responseHours: Number(e.target.value),
                                    },
                                  }))
                                }
                                className="w-16 px-2 py-1 border rounded text-xs"
                              />
                            ) : (
                              <span>{rule.responseHours} hours</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {isEditing ? (
                              <input
                                type="number"
                                value={formData.resolutionHours}
                                onChange={(e) =>
                                  setRuleFormData((prev) => ({
                                    ...prev,
                                    [rule.id]: {
                                      ...formData,
                                      resolutionHours: Number(e.target.value),
                                    },
                                  }))
                                }
                                className="w-16 px-2 py-1 border rounded text-xs"
                              />
                            ) : (
                              <span>{rule.resolutionHours} hours</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleSaveRule("DEADLINE_RULE", rule.id)}
                                  className="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-semibold"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingRuleId(null)}
                                  className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingRuleId(rule.id);
                                  setRuleFormData((prev) => ({
                                    ...prev,
                                    [rule.id]: {
                                      responseHours: rule.responseHours,
                                      resolutionHours: rule.resolutionHours,
                                    },
                                  }));
                                }}
                                className="px-2.5 py-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                              >
                                Edit SLA
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Priority Escalation Rules */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-bold text-slate-900">
                PriorityRules &amp; Escalation Thresholds
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Automated threshold rules that raise grievance priority (NORMAL &rarr; HIGH &rarr; CRITICAL) based on report volume and missed deadlines.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase text-[11px]">
                      <th className="py-2.5 px-3">Rule Type</th>
                      <th className="py-2.5 px-3">Trigger Condition</th>
                      <th className="py-2.5 px-3">Resulting Priority</th>
                      <th className="py-2.5 px-3">Label</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {adminRules.priorityRules.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                          {p.ruleType}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          &ge; {p.threshold} {p.ruleType.includes("COUNT") ? "reports" : "hours overdue"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${priorityColors[p.resultingPriority as keyof typeof priorityColors]}`}>
                            {p.resultingPriority}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 italic">
                          {p.label}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ADMIN: WORKFLOW STATE MACHINE TAB */}
        {activeTab === "workflow" && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Workflow Transitions &amp; Role-Based Graph
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                State transitions permitted in the backend engine. An invariant prohibits deleting paths to CLOSED.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase text-[11px]">
                    <th className="py-2.5 px-3">From State</th>
                    <th className="py-2.5 px-3">To State</th>
                    <th className="py-2.5 px-3">Permitted Roles</th>
                    <th className="py-2.5 px-3">Requires Reason</th>
                    <th className="py-2.5 px-3">Dept Isolated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adminWorkflow.map((wf) => (
                    <tr key={wf.id}>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        {wf.fromState}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                        &rarr; {wf.toState}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex gap-1 flex-wrap">
                          {Array.isArray(wf.allowedRoles) &&
                            wf.allowedRoles.map((r: string) => (
                              <span
                                key={r}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${roleColors[r as keyof typeof roleColors]}`}
                              >
                                {r}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        {wf.requiresReason ? (
                          <span className="text-amber-700 font-semibold">Yes</span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {wf.sameDepartmentOnly ? (
                          <span className="text-emerald-700 font-semibold">Yes (Same Dept)</span>
                        ) : (
                          <span className="text-slate-400">Cross-dept</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ADMIN: STAFF MANAGEMENT TAB */}
        {activeTab === "staff_mgmt" && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Municipal Staff &amp; Department Accounts
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Manage field officers, supervisors, and department assignments.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase text-[11px]">
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Assigned Department</th>
                    <th className="py-2.5 px-3">Account Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adminUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{u.name}</td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{u.email}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${roleColors[u.role as keyof typeof roleColors]}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {u.department?.name || <span className="text-slate-400 italic">None / All</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        {u.isDemo ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-medium border border-amber-200">
                            Demo Account
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Standard</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ISSUE DETAIL DRAWER / MODAL */}
      {selectedIssueId && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto">
            {/* Drawer Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-indigo-300">
                    {selectedIssue?.publicRef || "Loading..."}
                  </span>
                  {selectedIssue?.escalationLevel && selectedIssue.escalationLevel > 0 ? (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-500 text-white flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5" /> Escalated (L{selectedIssue.escalationLevel})
                    </span>
                  ) : null}
                </div>
                <h3 className="text-sm font-semibold text-slate-200 mt-1 line-clamp-1">
                  {selectedIssue?.title}
                </h3>
              </div>

              <button
                onClick={() => {
                  setSelectedIssueId(null);
                  setSelectedIssue(null);
                  setActionTransition(null);
                }}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-6 space-y-6 flex-1">
              {issueDetailLoading || !selectedIssue ? (
                <div className="p-12 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                  <p className="text-xs">Loading complaint details &amp; evidence...</p>
                </div>
              ) : (
                <>
                  {/* Status & Priority Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider block">
                        Current Status
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusColors[selectedIssue.status]}`}>
                        {selectedIssue.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider block">
                        Priority
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${priorityColors[selectedIssue.priority as keyof typeof priorityColors]}`}>
                        {selectedIssue.priority}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider block">
                        Assigned Officer
                      </span>
                      <span className="text-xs font-semibold text-slate-800">
                        {selectedIssue.assignedOfficer?.name || "Unassigned"}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider block">
                        Resolution Deadline
                      </span>
                      <span className={`text-xs font-bold ${selectedIssue.isOverdue ? "text-rose-600" : "text-slate-800"}`}>
                        {selectedIssue.resolutionDeadline
                          ? new Date(selectedIssue.resolutionDeadline).toLocaleString("en-IN")
                          : "No SLA set"}
                      </span>
                    </div>
                  </div>

                  {/* Supervisor Controls: Reassign & Deadline Modification */}
                  {(user.role === "SUPERVISOR" || user.role === "ADMIN") && (
                    <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs">
                      <span className="font-semibold text-purple-900">Supervisor Actions:</span>
                      <button
                        onClick={() => setShowReassignModal(true)}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition"
                      >
                        Reassign Officer
                      </button>
                      <button
                        onClick={() => setShowDeadlineModal(true)}
                        className="px-3 py-1 bg-white hover:bg-purple-100 text-purple-700 border border-purple-300 rounded-lg font-semibold transition"
                      >
                        Modify Deadline SLA
                      </button>
                    </div>
                  )}

                  {/* Reassign Modal */}
                  {showReassignModal && (
                    <div className="p-4 bg-slate-100 rounded-xl border border-slate-300 space-y-3">
                      <h4 className="text-xs font-bold text-slate-900">Reassign Field Officer</h4>
                      <select
                        value={reassignOfficerId}
                        onChange={(e) => setReassignOfficerId(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                      >
                        <option value="">Select Department Officer...</option>
                        {departmentOfficers.map((off) => (
                          <option key={off.id} value={off.id}>
                            {off.name} ({off.email})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Mandatory reason for reassignment..."
                        value={reassignReason}
                        onChange={(e) => setReassignReason(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-slate-300"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setShowReassignModal(false)}
                          className="px-3 py-1 bg-white text-slate-700 rounded text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          disabled={!reassignOfficerId || isSubmittingReassign}
                          onClick={handleReassign}
                          className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-semibold disabled:opacity-50"
                        >
                          Confirm Reassignment
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Deadline Modal */}
                  {showDeadlineModal && (
                    <div className="p-4 bg-slate-100 rounded-xl border border-slate-300 space-y-3">
                      <h4 className="text-xs font-bold text-slate-900">Change Resolution Deadline</h4>
                      <p className="text-[11px] text-slate-500">
                        Current: {selectedIssue.resolutionDeadline ? new Date(selectedIssue.resolutionDeadline).toLocaleString("en-IN") : "None"}
                      </p>
                      <input
                        type="datetime-local"
                        value={newDeadlineVal}
                        onChange={(e) => setNewDeadlineVal(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-slate-300"
                      />
                      <input
                        type="text"
                        placeholder="Mandatory reason / justification for deadline revision..."
                        value={deadlineReason}
                        onChange={(e) => setDeadlineReason(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-slate-300"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setShowDeadlineModal(false)}
                          className="px-3 py-1 bg-white text-slate-700 rounded text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          disabled={!newDeadlineVal || !deadlineReason || isSubmittingDeadline}
                          onClick={handleDeadlineChange}
                          className="px-3 py-1 bg-purple-600 text-white rounded text-xs font-semibold disabled:opacity-50"
                        >
                          Save Revised Deadline
                        </button>
                      </div>
                    </div>
                  )}

                  {/* AI Suggestion Panel (Strict Draft Text Only, No Mutation Buttons) */}
                  <AiSuggestionPanel
                    issueId={selectedIssue.id}
                    issueRef={selectedIssue.publicRef}
                    categoryName={selectedIssue.category.name}
                    descriptions={selectedIssue.reports.map((r) => r.description)}
                    locationLabel={selectedIssue.publicLocationLabel || undefined}
                  />

                  {/* Linked Citizen Reports & Evidence Photos */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Linked Citizen Reports ({selectedIssue.reports.length})
                    </h4>
                    {selectedIssue.reports.map((report, idx) => (
                      <div
                        key={report.id}
                        className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">
                            Report #{idx + 1} &bull; {report.citizen?.name || "Anonymous Citizen"}
                          </span>
                          <span className="text-slate-400">
                            {new Date(report.submittedAt).toLocaleString("en-IN")}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 whitespace-pre-line">
                          {report.description}
                        </p>

                        {/* Location Badge */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                          <span>
                            Coordinates: {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                          </span>
                        </div>

                        {/* Evidences & EXIF warning */}
                        {report.evidences.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-slate-200">
                            <span className="text-[11px] font-bold text-slate-500 uppercase block">
                              Evidence Photos &amp; Metadata
                            </span>
                            <div className="grid grid-cols-2 gap-3">
                              {report.evidences.map((ev) => (
                                <div key={ev.id} className="space-y-1">
                                  <a
                                    href={ev.filePath}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block relative group overflow-hidden rounded-lg border border-slate-300"
                                  >
                                    <img
                                      src={ev.filePath}
                                      alt="Report evidence"
                                      className="w-full h-32 object-cover"
                                    />
                                    <span className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs transition">
                                      View Full Image
                                    </span>
                                  </a>

                                  {/* EXIF Warning */}
                                  <div className="p-2 bg-amber-50 rounded border border-amber-200 text-[10px] text-amber-800">
                                    <div className="flex items-center gap-1 font-bold">
                                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                                      Unverified Metadata Warning
                                    </div>
                                    <p className="mt-0.5">
                                      Camera EXIF: GPS ({ev.exifLatitude ?? "None"},{" "}
                                      {ev.exifLongitude ?? "None"}), Captured:{" "}
                                      {ev.exifCapturedAt
                                        ? new Date(ev.exifCapturedAt).toLocaleDateString("en-IN")
                                        : "Unknown"}
                                      . Timestamp and coordinates from device headers are unverified and not treated as legal proof.
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Allowed Transitions Action Panel */}
                  <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Workflow State Actions (Backend Enforced)
                      </h4>
                      <span className="text-[10px] text-indigo-300 font-mono">
                        GET /api/issues/[id]/allowed-transitions
                      </span>
                    </div>

                    {allowedTransitions.length === 0 ? (
                      <p className="text-xs text-slate-300 italic">
                        No state transitions currently permitted for your role and department on this complaint.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {allowedTransitions.map((tr) => (
                          <button
                            key={tr.id}
                            onClick={() => {
                              setActionTransition(tr);
                              setActionReason("");
                              setActionResolutionNote("");
                              setActionError(null);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                              actionTransition?.id === tr.id
                                ? "bg-white text-slate-900 shadow-md ring-2 ring-indigo-400"
                                : "bg-indigo-600 hover:bg-indigo-500 text-white"
                            }`}
                          >
                            Move to {tr.toState.replace(/_/g, " ")}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Active Transition Form */}
                    {actionTransition && (
                      <div className="p-4 bg-white/10 rounded-xl space-y-3 border border-white/20">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">
                            Action: Move to {actionTransition.toState.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] text-slate-300">
                            {actionTransition.requiresReason ? "Reason Mandatory" : "Reason Optional"}
                          </span>
                        </div>

                        {actionError && (
                          <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-lg text-xs text-rose-200">
                            {actionError}
                          </div>
                        )}

                        {actionTransition.toState === "RESOLVED_AWAITING_VERIFICATION" && (
                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-slate-200 block">
                              Resolution Note (Mandatory):
                            </label>
                            <textarea
                              rows={2}
                              value={actionResolutionNote}
                              onChange={(e) => setActionResolutionNote(e.target.value)}
                              placeholder="Describe work completed (e.g. Pothole filled with cold asphalt mix, leveled and compacted)..."
                              className="w-full text-xs p-2 rounded-lg bg-white/90 text-slate-900 placeholder-slate-400 focus:outline-none"
                            />

                            <label className="text-[11px] font-semibold text-slate-200 block mt-2">
                              Upload &ldquo;After&rdquo; Resolution Evidence Photo (Optional):
                            </label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => setResolutionPhotoFile(e.target.files?.[0] || null)}
                              className="text-xs text-slate-200 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
                            />
                          </div>
                        )}

                        <div>
                          <label className="text-[11px] font-semibold text-slate-200 block mb-1">
                            Officer Reason / Note:
                          </label>
                          <input
                            type="text"
                            value={actionReason}
                            onChange={(e) => setActionReason(e.target.value)}
                            placeholder={
                              actionTransition.requiresReason
                                ? "Mandatory justification for this state change..."
                                : "Optional workflow note..."
                            }
                            className="w-full text-xs p-2 rounded-lg bg-white/90 text-slate-900 placeholder-slate-400 focus:outline-none"
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            onClick={() => setActionTransition(null)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            disabled={isSubmittingAction}
                            onClick={handleExecuteTransition}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                          >
                            {isSubmittingAction ? "Verifying..." : "Execute State Transition"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
