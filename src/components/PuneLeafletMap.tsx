"use client";

import React, { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { useI18n } from "@/lib/i18n/context";

export interface PuneLocationSelection {
  latitude: number;
  longitude: number;
  publicLocationLabel: string;
}

const PUNE_LANDMARKS: { name: string; lat: number; lng: number }[] = [
  { name: "Kothrud Bus Stand, Paud Road, Kothrud, Pune", lat: 18.5074, lng: 73.8077 },
  { name: "JM Road Corner, Shivajinagar, Pune", lat: 18.5314, lng: 73.8446 },
  { name: "Balewadi High Street Link Road, Baner, Pune", lat: 18.559, lng: 73.7868 },
  { name: "Magarpatta South Gate, Hadapsar, Pune", lat: 18.5089, lng: 73.9259 },
  { name: "Datta Mandir Chowk, Viman Nagar, Pune", lat: 18.5679, lng: 73.9143 },
  { name: "EON IT Park Road, Kharadi, Pune", lat: 18.5515, lng: 73.9348 },
  { name: "Jedhe Chowk Flyover, Swargate, Pune", lat: 18.5018, lng: 73.8636 },
  { name: "Goodluck Chowk, Deccan Gymkhana, Pune", lat: 18.5167, lng: 73.8415 },
  { name: "ITI Road, Aundh, Pune", lat: 18.558, lng: 73.8075 },
  { name: "Katraj Dairy Chowk, Katraj, Pune", lat: 18.4529, lng: 73.8652 },
];

export function findNearestPuneLandmark(lat: number, lng: number): string {
  let best = PUNE_LANDMARKS[0];
  let bestDist = Infinity;
  for (const lm of PUNE_LANDMARKS) {
    const d = Math.hypot(lm.lat - lat, lm.lng - lng);
    if (d < bestDist) {
      bestDist = d;
      best = lm;
    }
  }
  if (bestDist < 0.025) {
    return `Near ${best.name}`;
  }
  return `Pune Municipal Area (${best.name.split(", ").slice(-2).join(", ")})`;
}

export default function PuneLeafletMap({
  latitude,
  longitude,
  publicLocationLabel,
  onLocationChange,
}: {
  latitude: number;
  longitude: number;
  publicLocationLabel: string;
  onLocationChange: (loc: PuneLocationSelection) => void;
}) {
  const { t } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<
    { display_name: string; lat: number; lon: number }[]
  >([]);

  const resolveAddressForCoords = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=en`,
        { headers: { Accept: "application/json" } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.display_name) {
          const shortName = String(data.display_name)
            .split(",")
            .slice(0, 4)
            .join(",")
            .trim();
          onLocationChange({
            latitude: lat,
            longitude: lng,
            publicLocationLabel: shortName,
          });
          return;
        }
      }
    } catch {
      // Offline or Nominatim blocked — use offline Pune landmark resolver
    }
    onLocationChange({
      latitude: lat,
      longitude: lng,
      publicLocationLabel: findNearestPuneLandmark(lat, lng),
    });
  };

  useEffect(() => {
    let isMounted = true;

    async function initLeaflet() {
      if (!mapContainerRef.current || mapInstanceRef.current) return;
      const L = await import("leaflet");
      if (!isMounted || !mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: 14,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors • Pune Municipal Corporation',
        maxZoom: 19,
      }).addTo(map);

      // Custom high-contrast civic SVG pin icon
      const pinIcon = L.divIcon({
        className: "nagarsetu-map-pin",
        html: `<div style="width:32px;height:32px;background:#dc2626;border:3px solid #ffffff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 8px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;"><div style="width:10px;height:10px;background:#ffffff;border-radius:50%;"></div></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      const marker = L.marker([latitude, longitude], {
        draggable: true,
        icon: pinIcon,
      }).addTo(map);

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        resolveAddressForCoords(pos.lat, pos.lng);
      });

      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        resolveAddressForCoords(e.latlng.lat, e.latlng.lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
    }

    initLeaflet();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Keep marker & map center synchronized when props change (e.g. from EXIF or Landmark selection)
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
      mapInstanceRef.current.setView([latitude, longitude], 15);
    }
  }, [latitude, longitude]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchResults([]);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
        `${q}, Pune, Maharashtra, India`
      )}&limit=5`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setSearchResults(
            data.map((item: { display_name: string; lat: string; lon: string }) => ({
              display_name: item.display_name,
              lat: parseFloat(item.lat),
              lon: parseFloat(item.lon),
            }))
          );
          setSearching(false);
          return;
        }
      }
    } catch {
      // Fallback to local Pune landmarks match when offline
    }

    const localMatches = PUNE_LANDMARKS.filter((lm) =>
      lm.name.toLowerCase().includes(q.toLowerCase())
    );
    const list = localMatches.length > 0 ? localMatches : PUNE_LANDMARKS.slice(0, 4);
    setSearchResults(
      list.map((lm) => ({
        display_name: lm.name,
        lat: lm.lat,
        lon: lm.lng,
      }))
    );
    setSearching(false);
  };

  return (
    <div className="space-y-4">
      {/* Nominatim Search Bar */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="flex-1 min-h-[44px] border-2 border-slate-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-[#0f2942]"
        />
        <button
          type="submit"
          disabled={searching}
          className="min-h-[44px] px-5 py-2 rounded-lg bg-[#0f2942] hover:bg-slate-800 text-white font-bold text-sm transition"
        >
          {searching ? "..." : `🔍 ${t("btnSearchMap")}`}
        </button>
      </form>

      {/* Search Results Dropdown */}
      {searchResults.length > 0 && (
        <div className="bg-white border-2 border-slate-300 rounded-lg divide-y divide-slate-200 shadow-sm">
          {searchResults.map((r, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onLocationChange({
                  latitude: r.lat,
                  longitude: r.lon,
                  publicLocationLabel: r.display_name
                    .split(",")
                    .slice(0, 4)
                    .join(",")
                    .trim(),
                });
                setSearchResults([]);
              }}
              className="w-full text-left px-3.5 py-2.5 text-xs sm:text-sm hover:bg-amber-50 font-medium text-slate-800 flex items-center gap-2"
            >
              <span>📍</span>
              <span>{r.display_name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Quick Pune Ward / Landmark Chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-slate-600 mr-1">
          Pune Wards:
        </span>
        {PUNE_LANDMARKS.map((lm) => (
          <button
            key={lm.name}
            type="button"
            onClick={() =>
              onLocationChange({
                latitude: lm.lat,
                longitude: lm.lng,
                publicLocationLabel: lm.name,
              })
            }
            className="min-h-[34px] px-2.5 py-1 rounded-md bg-slate-100 hover:bg-amber-100 text-slate-800 border border-slate-300 text-xs font-medium transition"
          >
            📍 {lm.name.split(",")[0]}
          </button>
        ))}
      </div>

      {/* Interactive Leaflet Map Container */}
      <div className="rounded-xl overflow-hidden border-2 border-slate-300 shadow-sm bg-slate-100">
        <div
          ref={mapContainerRef}
          className="h-80 w-full z-10"
          aria-label="Interactive Pune OpenStreetMap"
        />
      </div>

      {/* Editable Nearby Landmark / Street Label (Never asks for raw lat/lng!) */}
      <div className="bg-slate-50 border border-slate-300 rounded-lg p-3.5 space-y-1.5">
        <label
          htmlFor="public-location-label-input"
          className="block text-xs font-bold text-slate-700"
        >
          {t("selectedLocationLabel")}
        </label>
        <input
          id="public-location-label-input"
          type="text"
          value={publicLocationLabel}
          onChange={(e) =>
            onLocationChange({
              latitude,
              longitude,
              publicLocationLabel: e.target.value,
            })
          }
          className="w-full min-h-[42px] border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white font-medium text-slate-900 focus:outline-none focus:border-[#0f2942]"
        />
      </div>
    </div>
  );
}
