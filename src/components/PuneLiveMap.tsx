"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import { useI18n } from "@/lib/i18n/context";

export interface PublicIssue {
  id: string;
  publicRef: string;
  category: { id: string; name: string; emoji: string };
  subcategory: { id: string; name: string } | null;
  status: string;
  priority: "NORMAL" | "HIGH" | "CRITICAL";
  isOverdue: boolean;
  reportCount: number;
  publicLocationLabel: string;
  latitude: number;
  longitude: number;
  submittedAt: string;
  responseDeadline: string;
  resolutionDeadline: string;
  resolvedAt: string | null;
  closedAt: string | null;
  isDemo: boolean;
}

const CATEGORY_EMOJIS: Record<string, string> = {
  "Waste Management & Sanitation": "",
  "Roads & Infrastructure": "",
  "Water & Sewage": "",
  "Civic Nuisance & Public Safety": "",
  Other: "",
};

export default function PuneLiveMap({
  initialIssues = [],
  onDataRefresh,
  height = "520px",
}: {
  initialIssues?: PublicIssue[];
  onDataRefresh?: () => void;
  height?: string;
}) {
  const { t, tCategory, tSubcategory, tStatus } = useI18n();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const markersLayerRef = useRef<import("leaflet").LayerGroup | null>(null);

  const [issues, setIssues] = useState<PublicIssue[]>(initialIssues);
  const [loading, setLoading] = useState(false);
  const [lastStreamEvent, setLastStreamEvent] = useState<string | null>(null);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterPriority, setFilterPriority] = useState<string>("ALL");
  const [filterOverdue, setFilterOverdue] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [heatmapMode, setHeatmapMode] = useState<boolean>(false);

  // Selected issue modal / details card
  const [selectedIssue, setSelectedIssue] = useState<PublicIssue | null>(null);

  // Fetch public issues from GET /api/public/issues
  const fetchPublicIssues = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory !== "ALL") params.set("categoryId", filterCategory);
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      if (filterPriority !== "ALL") params.set("priority", filterPriority);
      if (filterOverdue) params.set("overdue", "true");

      const res = await fetch(`/api/public/issues?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues || []);
      }
    } catch {
      // offline or error
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterStatus, filterPriority, filterOverdue]);

  useEffect(() => {
    fetchPublicIssues();
  }, [fetchPublicIssues]);

  // Connect to live SSE stream GET /api/stream
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/stream");
      eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.type && parsed.type !== "ping") {
            setLastStreamEvent(
              `Live event: ${parsed.type.replace(/_/g, " ")} (${new Date(
                parsed.timestamp
              ).toLocaleTimeString()})`
            );
            fetchPublicIssues();
            onDataRefresh?.();
          }
        } catch {
          // ignore keepalive
        }
      };
    } catch {
      // SSE not supported
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [fetchPublicIssues, onDataRefresh]);

  // Initialize Leaflet map
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current || mapInstanceRef.current) return;
      const L = await import("leaflet");
      if (!isMounted || !mapContainerRef.current) return;

      // Pune Central Municipal Area
      const map = L.map(mapContainerRef.current, {
        center: [18.5204, 73.8567],
        zoom: 12,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors • Pune Municipal Corporation',
        maxZoom: 19,
      }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
      markersLayerRef.current = markersLayer;
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
      }
    };
  }, []);

  // Update map markers when issues, search query, or heatmapMode changes
  useEffect(() => {
    async function updateMarkers() {
      if (!mapInstanceRef.current || !markersLayerRef.current) return;
      const L = await import("leaflet");

      markersLayerRef.current.clearLayers();

      const filteredIssues = issues.filter((iss) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          iss.publicRef.toLowerCase().includes(q) ||
          iss.publicLocationLabel.toLowerCase().includes(q) ||
          iss.category.name.toLowerCase().includes(q) ||
          (iss.subcategory?.name.toLowerCase().includes(q) ?? false)
        );
      });

      filteredIssues.forEach((issue) => {
        let deptBadge = "PMC";
        const catNameLower = issue.category.name.toLowerCase();
        if (catNameLower.includes("road")) deptBadge = "RD";
        else if (catNameLower.includes("water") || catNameLower.includes("sewage")) deptBadge = "WT";
        else if (catNameLower.includes("waste") || catNameLower.includes("sanitation")) deptBadge = "SW";
        else if (catNameLower.includes("safety") || catNameLower.includes("nuisance")) deptBadge = "SF";
        else deptBadge = "GN";

        // Priority ring colours:
        // Normal -> green (#16a34a), High -> orange (#ea580c), Critical -> red (#dc2626)
        const ringBorderColor =
          issue.priority === "CRITICAL"
            ? "#dc2626"
            : issue.priority === "HIGH"
            ? "#ea580c"
            : "#16a34a";

        const ringBgColor =
          issue.priority === "CRITICAL"
            ? "#dc2626"
            : issue.priority === "HIGH"
            ? "#ea580c"
            : "#16a34a";

        const isOverdue = issue.isOverdue;
        const pulseEffect = isOverdue
          ? `animation: nagarsetu-pulse 1.8s infinite; box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7);`
          : `box-shadow: 0 2px 4px rgba(0,0,0,0.3);`;

        const markerHtml = `
          <div style="position:relative; width:34px; height:34px; cursor:pointer;">
            <style>
              @keyframes nagarsetu-pulse {
                0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.75); }
                70% { box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); }
                100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
              }
            </style>
            <div style="
              width:34px;
              height:34px;
              border-radius:2px;
              background:${ringBgColor};
              border: 2px solid #ffffff;
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:12px;
              font-weight:900;
              color:#ffffff;
              font-family:sans-serif;
              letter-spacing:0.5px;
              ${pulseEffect}
            ">
              <span>${deptBadge}</span>
            </div>
            ${
              isOverdue
                ? `<span style="position:absolute;top:-4px;right:-4px;background:#000000;color:white;font-size:8px;font-weight:900;padding:1px 3px;border:1px solid white;">!</span>`
                : ""
            }
          </div>
        `;

        const icon = L.divIcon({
          className: "nagarsetu-public-marker",
          html: markerHtml,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
          popupAnchor: [0, -20],
        });

        const marker = L.marker([issue.latitude, issue.longitude], {
          icon,
        });

        // Popup with STRICTLY PUBLIC data only (NO personal names, emails, phones, or raw EXIF)
        const st = tStatus(issue.status);
        const popupContent = `
          <div style="font-family: inherit; font-size:12px; line-height:1.4; min-width: 230px; color:#0f172a;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; gap:4px;">
              <strong style="font-family:monospace; color:#0f2942; font-size:13px;">${issue.publicRef}</strong>
              <span style="font-size:10px; font-weight:bold; background:${
                issue.priority === "CRITICAL"
                  ? "#fee2e2; color:#991b1b"
                  : issue.priority === "HIGH"
                  ? "#ffedd5; color:#9a3412"
                  : "#dcfce7; color:#166534"
              }; padding:2px 6px; border-radius:4px;">${issue.priority}</span>
            </div>
            <div style="font-weight:bold; margin-bottom:2px; color:#1e293b;">
              [${deptBadge}] ${issue.category.name} ${
          issue.subcategory ? `— ${issue.subcategory.name}` : ""
        }
            </div>
            <div style="color:#475569; font-size:11px; margin-bottom:6px;">
               ${issue.publicLocationLabel}
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:6px;">
              <span style="background:#0f2942; color:#ffffff; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:9999px;">
                ${st.label}
              </span>
              ${
                issue.isOverdue
                  ? `<span style="background:#dc2626; color:#ffffff; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:4px;"> Overdue</span>`
                  : ""
              }
              <span style="background:#f1f5f9; color:#334155; font-size:10px; padding:2px 6px; border-radius:4px;">
                 ${issue.reportCount} linked report(s)
              </span>
            </div>
            <div style="color:#64748b; font-size:10px; margin-bottom:8px;">
              Reported: ${new Date(issue.submittedAt).toLocaleDateString()}
            </div>
            <div style="border-top:1px solid #e2e8f0; padding-top:6px; display:flex; justify-content:space-between; align-items:center;">
              <a href="/track/${issue.publicRef}" style="color:#0f2942; font-weight:bold; font-size:11px; text-decoration:underline;">
                Track Status & Timeline →
              </a>
              <span style="font-size:9px; background:#fef3c7; color:#92400e; padding:1px 4px; border-radius:3px;">Demo data</span>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);

        marker.on("click", () => {
          setSelectedIssue(issue);
        });

        markersLayerRef.current?.addLayer(marker);
      });
    }

    updateMarkers();
  }, [issues, searchQuery, heatmapMode, tStatus]);

  return (
    <div className="bg-white border border-slate-300 rounded-none overflow-hidden shadow-sm flex flex-col">
      {/* Live Map Control Bar & Filters */}
      <div className="p-3 bg-[#0f3057] text-white flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#c31a26]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-white uppercase tracking-wide">
            Pune Municipal Ward Live GIS Map
          </span>
          <span className="text-[11px] font-bold bg-[#c31a26] text-white px-2 py-0.5 rounded-none">
            {issues.length} Active Complaints
          </span>
          {lastStreamEvent && (
            <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-none animate-pulse">
              LIVE: {lastStreamEvent}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Priority Ring Legend */}
          <div className="hidden sm:flex items-center gap-2 bg-[#092240] px-2.5 py-1 rounded-none border border-slate-600">
            <span className="text-slate-300 font-medium">Priority Codes:</span>
            <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
              <span className="h-2.5 w-2.5 border border-white bg-emerald-500 rounded-none"></span>{" "}
              Normal
            </span>
            <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
              <span className="h-2.5 w-2.5 border border-white bg-amber-500 rounded-none"></span>{" "}
              High
            </span>
            <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
              <span className="h-2.5 w-2.5 border border-white bg-rose-600 rounded-none"></span>{" "}
              Critical
            </span>
            <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
              [!] Overdue
            </span>
          </div>

          <button
            type="button"
            onClick={fetchPublicIssues}
            disabled={loading}
            className="min-h-[32px] px-3 py-1 rounded-none bg-[#c31a26] hover:bg-[#a61520] text-white font-bold text-xs uppercase"
          >
            {loading ? "Refreshing..." : "Refresh Map"}
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="p-2.5 bg-slate-100 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search box */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Pune area, reference ID, or department..."
            className="min-h-[34px] px-3 py-1 rounded-none border border-slate-300 bg-white text-slate-900 w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-[#c31a26]"
          />

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            aria-label="Filter by Category"
            className="min-h-[34px] px-2 py-1 rounded-none border border-slate-300 bg-white text-slate-900 font-medium"
          >
            <option value="ALL">All Categories</option>
            <option value="cmg02waste000100010001">Solid Waste & Sanitation</option>
            <option value="cmg02roads000200020002">Roads & Infrastructure</option>
            <option value="cmg02water000300030003">Water Supply & Drainage</option>
            <option value="cmg02nuis000400040004">Civic Safety & Encroachment</option>
            <option value="cmg02other000500050005">General Administration</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter by Status"
            className="min-h-[34px] px-2 py-1 rounded-none border border-slate-300 bg-white text-slate-900 font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="VERIFIED">Verified</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED_AWAITING_VERIFICATION">
              Resolved (Awaiting Verification)
            </option>
            <option value="CLOSED">Closed</option>
            <option value="REOPENED">Reopened</option>
          </select>

          {/* Priority Filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            aria-label="Filter by Priority"
            className="min-h-[34px] px-2 py-1 rounded-none border border-slate-300 bg-white text-slate-900 font-medium"
          >
            <option value="ALL">All Priorities</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>

          {/* Overdue checkbox */}
          <label className="flex items-center gap-1.5 cursor-pointer font-bold text-rose-900 bg-rose-50 px-2.5 py-1.5 rounded-none border border-rose-300">
            <input
              type="checkbox"
              checked={filterOverdue}
              onChange={(e) => setFilterOverdue(e.target.checked)}
              className="rounded-none text-rose-600 focus:ring-rose-500"
            />
            <span>Overdue Only</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-600 bg-white border border-slate-300 px-2 py-1 rounded-none">
            Privacy Snapped (~100m Grid)
          </span>
        </div>
      </div>

      {/* Map Container */}
      <div
        ref={mapContainerRef}
        style={{ height, width: "100%" }}
        className="relative z-10"
      />

      {/* Bottom Info Bar / Selected Marker Card */}
      {selectedIssue && (
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm text-[#0f2942]">
                {selectedIssue.publicRef}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#0f2942] text-white text-[10px] font-bold">
                {tStatus(selectedIssue.status).label}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedIssue.priority === "CRITICAL"
                    ? "bg-rose-600 text-white"
                    : selectedIssue.priority === "HIGH"
                    ? "bg-amber-500 text-slate-950"
                    : "bg-slate-200 text-slate-800"
                }`}
              >
                {selectedIssue.priority}
              </span>
              {selectedIssue.isOverdue && (
                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 text-[10px] font-bold animate-pulse">
                   OVERDUE
                </span>
              )}
            </div>
            <div className="text-xs text-slate-800 font-semibold">
              {CATEGORY_EMOJIS[selectedIssue.category.name] || ""}{" "}
              {tCategory(selectedIssue.category.name)} —{" "}
              {selectedIssue.subcategory
                ? tSubcategory(selectedIssue.subcategory.name)
                : "General"}{" "}
              •  {selectedIssue.publicLocationLabel}
            </div>
            <div className="text-[11px] text-slate-500">
               {selectedIssue.reportCount} linked citizen report(s) •
              Reported: {new Date(selectedIssue.submittedAt).toLocaleString()} •
              Target SLA:{" "}
              {new Date(selectedIssue.resolutionDeadline).toLocaleString()}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/track/${selectedIssue.publicRef}`}
              className="min-h-[38px] px-4 py-1.5 rounded-none bg-[#0f2942] hover:bg-slate-800 text-white font-bold text-xs flex items-center"
            >
              Track Complaint Details →
            </Link>
            <button
              type="button"
              onClick={() => setSelectedIssue(null)}
              className="min-h-[38px] px-2.5 py-1.5 rounded-none bg-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
