"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface Station {
  id: string;
  name: string;
  code?: string;
  latitude: number;
  longitude: number;
  isHub?: boolean;
  isActive?: boolean;
}

interface StationMapProps {
  stations: Station[];
  selectedStation: Station | null;
  onSelectStation: (station: Station | null) => void;
}

export default function StationMap({
  stations,
  selectedStation,
  onSelectStation,
}: StationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [loaded, setLoaded] = useState(false);

  // Kocaeli merkez koordinatları
  const CENTER: [number, number] = [29.9, 40.76];

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: CENTER,
      zoom: 10,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "bottom-right");

    map.current.on("load", () => {
      setLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update markers when stations change
  useEffect(() => {
    if (!map.current || !loaded) return;

    // Remove old markers that are not in new stations
    const stationIds = new Set(stations.map((s) => s.id));
    markers.current.forEach((marker, id) => {
      if (!stationIds.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    });

    // Add or update markers
    stations.forEach((station) => {
      const existingMarker = markers.current.get(station.id);

      if (existingMarker) {
        // Update position if needed
        existingMarker.setLngLat([station.longitude, station.latitude]);
      } else {
        // Create new marker
        const el = document.createElement("div");
        el.className = "station-marker";
        el.innerHTML = `
          <div class="relative cursor-pointer group">
            <div class="w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 ${
              station.isHub
                ? "bg-red-500 border-2 border-white"
                : "bg-emerald-500 border-2 border-white"
            }">
              <span class="material-symbols-rounded text-white text-lg">${station.isHub ? "warehouse" : "location_on"}</span>
            </div>
            <div class="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              ${station.name}
            </div>
          </div>
        `;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([station.longitude, station.latitude])
          .addTo(map.current!);

        el.addEventListener("click", () => {
          onSelectStation(station);
        });

        markers.current.set(station.id, marker);
      }
    });
  }, [stations, loaded, onSelectStation]);

  // Fly to selected station
  useEffect(() => {
    if (!map.current || !loaded || !selectedStation) return;

    map.current.flyTo({
      center: [selectedStation.longitude, selectedStation.latitude],
      zoom: 14,
      duration: 1000,
    });

    // Highlight selected marker
    markers.current.forEach((marker, id) => {
      const el = marker.getElement();
      if (id === selectedStation.id) {
        el.querySelector(".station-marker > div > div")?.classList.add(
          "ring-4",
          "ring-primary",
          "ring-offset-2"
        );
      } else {
        el.querySelector(".station-marker > div > div")?.classList.remove(
          "ring-4",
          "ring-primary",
          "ring-offset-2"
        );
      }
    });
  }, [selectedStation, loaded]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Map Controls Legend */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-4 text-xs border border-slate-700/50">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500 border border-white"></div>
          <span className="text-white">Merkez Depo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-emerald-500 border border-white"></div>
          <span className="text-white">Dağıtım Noktası</span>
        </div>
      </div>

      {/* Loading State */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
}
