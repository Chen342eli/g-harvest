import { useEffect, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "leaflet/dist/leaflet.css";
import type { Conference, Tier } from "@/lib/conferences";
import { coordsFor } from "@/lib/cityCoords";
import { ConferenceDetail } from "./ConferenceDetail";

const TIER_COLOR: Record<Tier, string> = {
  "Tier 1": "#10b981", // emerald-500
  "Tier 2": "#f59e0b", // amber-500
  "Tier 3": "#94a3b8", // slate-400
};

interface Props {
  conferences: Conference[];
}

export function MapView({ conferences }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const LRef = useRef<any>(null);

  // Initialize map once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
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
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      // Trigger render of markers now that map exists
      renderMarkers();
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderMarkers = () => {
    const L = LRef.current;
    if (!L || !layerRef.current) return;
    layerRef.current.clearLayers();

    // Group multiple conferences in the same city to offset them slightly.
    const byKey = new Map<string, number>();

    const bounds: [number, number][] = [];
    conferences.forEach((c) => {
      const base = coordsFor(c.city, c.country);
      if (!base) return;
      const key = `${c.city}|${c.country}`;
      const idx = byKey.get(key) ?? 0;
      byKey.set(key, idx + 1);
      // tiny radial offset so overlapping markers are still clickable
      const offset = idx === 0 ? [0, 0] : [
        Math.cos(idx * 1.3) * 0.35,
        Math.sin(idx * 1.3) * 0.35,
      ];
      const lat = base[0] + offset[0];
      const lng = base[1] + offset[1];
      bounds.push([lat, lng]);

      const isGap = c.tier === "Tier 1" && c.assignedReps.length === 0;
      const color = TIER_COLOR[c.tier];
      const html = `
        <div style="position:relative;width:22px;height:22px;">
          <div style="
            width:22px;height:22px;border-radius:9999px;
            background:${color};
            box-shadow:0 0 0 2px #fff, 0 1px 3px rgba(0,0,0,.35);
            display:flex;align-items:center;justify-content:center;
            color:#fff;font-weight:600;font-size:10px;font-family:ui-sans-serif,system-ui;
          ">${c.icpScore}</div>
          ${isGap ? `<div style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;border-radius:9999px;background:#dc2626;box-shadow:0 0 0 2px #fff;"></div>` : ""}
        </div>`;
      const icon = L.divIcon({
        html,
        className: "",
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const marker = L.marker([lat, lng], { icon });
      marker.bindPopup(renderToStaticMarkup(<ConferenceDetail conference={c} />), {
        maxWidth: 320,
        className: "conference-popup",
      });
      marker.addTo(layerRef.current);
    });

    if (bounds.length > 0 && mapRef.current) {
      try {
        mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 });
      } catch {
        /* noop */
      }
    }
  };

  // Re-render markers when filter results change
  useEffect(() => {
    renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conferences]);

  const missing = conferences.filter((c) => !coordsFor(c.city, c.country));

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div ref={containerRef} className="h-[600px] w-full" />
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: TIER_COLOR["Tier 1"] }} />
          Tier 1
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: TIER_COLOR["Tier 2"] }} />
          Tier 2
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: TIER_COLOR["Tier 3"] }} />
          Tier 3
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
