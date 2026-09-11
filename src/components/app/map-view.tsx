"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

export interface MapPoint {
  lat: number;
  lng: number;
  label: string;
}

// Leaflet's default marker icon references relative image paths that break
// under bundling — the standard fix is pointing them at the same package
// version's files on a CDN instead of trying to get the bundler to resolve
// node_modules assets, since these only ever load in the browser at
// runtime, not at build time.
const ICON_BASE = "https://unpkg.com/leaflet@1.9.4/dist/images";
L.Icon.Default.mergeOptions({
  iconRetinaUrl: `${ICON_BASE}/marker-icon-2x.png`,
  iconUrl: `${ICON_BASE}/marker-icon.png`,
  shadowUrl: `${ICON_BASE}/marker-shadow.png`,
});

const KENYA_CENTER: [number, number] = [-0.0236, 37.9062];

/** Free OpenStreetMap tiles, no API key — spec §61's map requirement
 * without a paid Maps provider. Renders a marker per point with a popup
 * label; auto-fits bounds when there's at least one point. */
export function MapView({ points, height = 320 }: { points: MapPoint[]; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(KENYA_CENTER, 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = points.map((p) => L.marker([p.lat, p.lng]).bindPopup(p.label).addTo(map));

    if (points.length > 0) {
      map.fitBounds(
        L.latLngBounds(points.map((p) => [p.lat, p.lng])),
        { padding: [30, 30], maxZoom: 14 },
      );
    }
  }, [points]);

  return <div ref={containerRef} style={{ height }} className="w-full rounded-xl border border-line" />;
}
