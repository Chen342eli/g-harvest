import { useEffect, useRef } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { Conference, Tier } from "@/lib/conferences";
import { isCoverageGap } from "@/lib/conferences";
import { coordsFor } from "@/lib/cityCoords";

const TIER_COLOR: Record<Tier, string> = {
  "Tier 1": "#10b981",
  "Tier 2": "#f59e0b",
  "Tier 3": "#94a3b8",
};

const TIER_BG: Record<Tier, string> = {
  "Tier 1": "#d1fae5",
  "Tier 2": "#fef3c7",
  "Tier 3": "#f1f5f9",
};

const TIER_TEXT: Record<Tier, string> = {
  "Tier 1": "#065f46",
  "Tier 2": "#92400e",
  "Tier 3": "#334155",
};

const audienceFmt = new Intl.NumberFormat("en-US");

function escape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function dateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const yearFmt = new Intl.DateTimeFormat("en-US", { year: "numeric" });
  if (sameMonth) return `${monthFmt.format(s)}–${e.getDate()}, ${yearFmt.format(s)}`;
  return `${monthFmt.format(s)} – ${monthFmt.format(e)}, ${yearFmt.format(e)}`;
}

const STATUS_BG: Record<string, string> = {
  Going: "#dcfce7",
  Considering: "#e0f2fe",
  Passed: "#f4f4f5",
};
const STATUS_TEXT: Record<string, string> = {
  Going: "#166534",
  Considering: "#075985",
  Passed: "#52525b",
};

function popupHtml(c: Conference): string {
  const gap = isCoverageGap(c);
  const reps = c.assignedReps.length
    ? escape(c.assignedReps.join(", "))
    : `<span style="color:#64748b">Unassigned</span>`;
  return `
    <div style="font-family:ui-sans-serif,system-ui;color:#0f172a;width:240px;">
      <button type="button" data-action="open-in-table" data-id="${escape(c.id)}"
         style="background:none;border:0;padding:0;cursor:pointer;font:inherit;
                font-weight:600;color:#0f172a;display:inline-flex;align-items:center;gap:4px;text-align:left;">
         <span style="text-decoration:underline;text-decoration-color:rgba(15,23,42,.25);text-underline-offset:2px;">${escape(c.name)}</span>
         <span style="opacity:.6;font-size:11px;">→</span>
      </button>
      <div style="font-size:11px;color:#64748b;margin-top:2px;">${escape(c.city)}, ${escape(c.country)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">
        <span style="background:${TIER_BG[c.tier]};color:${TIER_TEXT[c.tier]};
          padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:500;">${c.tier}</span>
        <span style="background:${STATUS_BG[c.status]};color:${STATUS_TEXT[c.status]};
          padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:500;">${escape(c.status)}</span>
        <span style="background:#f1f5f9;color:#0f172a;
          padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;">Score ${c.icpScore}</span>
        ${gap ? `<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:500;">Coverage gap</span>` : ""}
      </div>
      <table style="margin-top:8px;font-size:11px;border-collapse:collapse;">
        <tr><td style="color:#64748b;padding-right:8px;">Dates</td><td>${escape(dateRange(c.startDate, c.endDate))}</td></tr>
        <tr><td style="color:#64748b;padding-right:8px;">Vertical</td><td>${escape(c.vertical)}</td></tr>
        <tr><td style="color:#64748b;padding-right:8px;">Audience</td><td>${audienceFmt.format(c.estimatedAudienceSize)}</td></tr>
        <tr><td style="color:#64748b;padding-right:8px;vertical-align:top;">Reps</td><td>${reps}</td></tr>
        ${c.sourceUrl ? `<tr><td style="color:#64748b;padding-right:8px;">Website</td><td><a href="${escape(c.sourceUrl)}" target="_blank" rel="noreferrer" style="color:#2563eb;text-decoration:underline;">Open ↗</a></td></tr>` : ""}
      </table>
    </div>`;
}

function ensureLeafletCss() {
  if (typeof document === "undefined") return;
  const add = (id: string, href: string) => {
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  };
  add("leaflet-css", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
  add("leaflet-mc-css", "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css");
  add("leaflet-mc-default-css", "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css");
}

function ensureMarkerClusterScript(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if ((window as any).L?.MarkerClusterGroup) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById("leaflet-mc-script") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "leaflet-mc-script";
    script.src = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

interface Props {
  conferences: Conference[];
  onOpenInTable?: (id: string) => void;
}

const CITY_EXPAND_MIN_ZOOM = 5;
const CITY_AUTO_EXPAND_ZOOM = 8;

function locationKey(c: Conference) {
  return `${c.city.trim().toLowerCase()}|${c.country.trim().toLowerCase()}`;
}

export function MapView({ conferences, onOpenInTable }: Props) {
  return (
    <ClientOnly fallback={<MapFallback />}>
      <MapViewClient conferences={conferences} onOpenInTable={onOpenInTable} />
    </ClientOnly>
  );
}

function MapViewClient({ conferences, onOpenInTable }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const expandedLayerRef = useRef<any>(null);
  const expandedLocationKeysRef = useRef<Set<string>>(new Set());
  const renderMarkersRef = useRef<(fitToData?: boolean) => void>(() => {});
  const LRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    ensureLeafletCss();
    (async () => {
      const L = (await import("leaflet")).default;
      (window as any).L = L;
      await ensureMarkerClusterScript();
      if (cancelled || !containerRef.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(containerRef.current, {
        center: [25, 10],
        zoom: 2,
        worldCopyJump: true,
        scrollWheelZoom: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(map);
      layerRef.current = (L as any).markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: false,
        zoomToBoundsOnClick: false,
        maxClusterRadius: 40,
      });
      expandedLayerRef.current = L.layerGroup().addTo(map);

      // First click keeps the broad cluster behavior, then reveals same-city
      // events as separate score markers around the city label on the next level.
      layerRef.current.on("clusterclick", (a: any) => {
        const cluster = a.layer;
        const children = cluster.getAllChildMarkers();
        const byLocation = new Map<string, any[]>();
        children.forEach((m: any) => {
          const key = m.__locationKey;
          if (!key) return;
          byLocation.set(key, [...(byLocation.get(key) ?? []), m]);
        });
        byLocation.forEach((markers, key) => {
          if (markers.length > 1) expandedLocationKeysRef.current.add(key);
        });

        const pts = children.map((m: any) => m.getLatLng());
        if (byLocation.size === 1) {
          const target = pts[0];
          const targetZoom = Math.max(map.getZoom() + 2, CITY_AUTO_EXPAND_ZOOM);
          map.once("moveend", () => renderMarkersRef.current(false));
          map.setView(target, targetZoom, { animate: true });
          window.setTimeout(() => renderMarkersRef.current(false), 80);
          return;
        }
        const b = L.latLngBounds(pts);
        map.once("moveend", () => renderMarkersRef.current(false));
        map.fitBounds(b, { padding: [80, 80], maxZoom: CITY_AUTO_EXPAND_ZOOM });
        window.setTimeout(() => renderMarkersRef.current(false), 80);
      });
      map.on("zoomend", () => renderMarkersRef.current(false));
      map.addLayer(layerRef.current);
      mapRef.current = map;
      renderMarkersRef.current(true);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
        expandedLayerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderMarkers = (fitToData = true) => {
    const L = LRef.current;
    if (!L || !layerRef.current || !expandedLayerRef.current) return;
    layerRef.current.clearLayers();
    expandedLayerRef.current.clearLayers();

    const bounds: [number, number][] = [];
    const byLocation = new Map<string, { base: [number, number]; items: Conference[] }>();

    conferences.forEach((c) => {
      const base = coordsFor(c.city, c.country);
      if (!base) return;
      const key = locationKey(c);
      const current = byLocation.get(key);
      if (current) current.items.push(c);
      else byLocation.set(key, { base, items: [c] });
      bounds.push(base);
    });

    const addConferenceMarker = (c: Conference, lat: number, lng: number, targetLayer: any) => {
      const gap = isCoverageGap(c);
      const going = c.status === "Going";
      const color = TIER_COLOR[c.tier];
      const ringShadow = going
        ? "box-shadow:0 0 0 2px #fff, 0 0 0 4px #16a34a, 0 1px 4px rgba(0,0,0,.35);"
        : "box-shadow:0 0 0 2px #fff, 0 1px 3px rgba(0,0,0,.35);";
      const size = going ? 26 : 22;
      const html = `
        <div style="position:relative;width:${size}px;height:${size}px;">
          <div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};
            ${ringShadow}
            display:flex;align-items:center;justify-content:center;
            color:#fff;font-weight:600;font-size:10px;font-family:ui-sans-serif,system-ui;">${c.icpScore}</div>
          ${gap ? `<div style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;border-radius:9999px;background:#dc2626;box-shadow:0 0 0 2px #fff;"></div>` : ""}
        </div>`;
      const icon = L.divIcon({ html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
      const marker = L.marker([lat, lng], { icon });
      marker.__locationKey = locationKey(c);
      marker.bindPopup(popupHtml(c), { maxWidth: 320 });
      targetLayer.addLayer(marker);
    };

    byLocation.forEach(({ base, items }) => {
      const [lat, lng] = base;
      const map = mapRef.current;
      const isExpanded =
        items.length > 1 &&
        expandedLocationKeysRef.current.has(locationKey(items[0])) &&
        map &&
        map.getZoom() >= CITY_EXPAND_MIN_ZOOM;

      if (!isExpanded) {
        items.forEach((c) => addConferenceMarker(c, lat, lng, layerRef.current));
        return;
      }

      const labelIcon = L.divIcon({
        html: `<div style="white-space:nowrap;border-radius:9999px;background:rgba(15,23,42,.82);color:#fff;padding:3px 9px;font:600 11px ui-sans-serif,system-ui;box-shadow:0 1px 4px rgba(0,0,0,.25);">${escape(items[0].city)}</div>`,
        className: "",
        iconSize: [90, 22],
        iconAnchor: [45, 11],
      });
      expandedLayerRef.current.addLayer(L.marker([lat, lng], { icon: labelIcon, interactive: false }));

      const center = map.latLngToLayerPoint([lat, lng]);
      const radius = Math.max(34, Math.min(58, 28 + items.length * 5));
      items.forEach((c, index) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / items.length;
        const point = center.add([Math.cos(angle) * radius, Math.sin(angle) * radius]);
        const pos = map.layerPointToLatLng(point);
        addConferenceMarker(c, pos.lat, pos.lng, expandedLayerRef.current);
      });
    });

    if (fitToData && bounds.length > 0 && mapRef.current) {
      try {
        mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 });
      } catch {
        /* noop */
      }
    }
  };

  renderMarkersRef.current = renderMarkers;

  useEffect(() => {
    expandedLocationKeysRef.current = new Set(
      [...expandedLocationKeysRef.current].filter((key) => conferences.some((c) => locationKey(c) === key)),
    );
    renderMarkers(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conferences]);

  const missing = conferences.filter((c) => !coordsFor(c.city, c.country));

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div ref={containerRef} className="h-[600px] w-full" />
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <Legend color={TIER_COLOR["Tier 1"]} label="Tier 1" />
        <Legend color={TIER_COLOR["Tier 2"]} label="Tier 2" />
        <Legend color={TIER_COLOR["Tier 3"]} label="Tier 3" />
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-full bg-slate-400"
            style={{ boxShadow: "0 0 0 1.5px #fff, 0 0 0 3px #16a34a" }}
          />
          Going (confirmed)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white" />
          Coverage gap
        </div>
        {missing.length > 0 && (
          <div className="ml-auto text-amber-700">
            {missing.length} conference{missing.length === 1 ? "" : "s"} missing map coordinates
          </div>
        )}
      </div>
    </div>
  );
}

function MapFallback() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex h-[600px] w-full items-center justify-center text-sm text-muted-foreground">
        Loading map…
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />
      {label}
    </div>
  );
}
