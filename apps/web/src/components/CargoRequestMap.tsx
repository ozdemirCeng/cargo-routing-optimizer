"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface Station {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  isHub?: boolean;
  cargoCount?: number;
  totalWeightKg?: number;
}

interface CargoRequestMapProps {
  stations: Station[];
  selectedStationId: string | null;
  onStationSelect: (station: Station) => void;
}

export default function CargoRequestMap({
  stations,
  selectedStationId,
  onStationSelect,
}: CargoRequestMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [loaded, setLoaded] = useState(false);

  // Kocaeli merkez koordinatları
  const CENTER: [number, number] = [29.9, 40.76];

  // Light style for voyager
  const lightStyle = {
    version: 8,
    sources: {
      "osm-tiles": {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
          "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
          "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        ],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [
      {
        id: "osm-tiles-layer",
        type: "raster",
        source: "osm-tiles",
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  } as maplibregl.StyleSpecification;

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: lightStyle,
      center: CENTER,
      zoom: 10,
    });

    map.current.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );

    map.current.on("load", () => {
      setLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Create custom marker element
  const createMarkerElement = useCallback(
    (station: Station, isSelected: boolean) => {
      const el = document.createElement("div");
      el.className = "custom-marker";
      el.innerHTML = `
        <div class="marker-container ${isSelected ? "selected" : ""} ${station.isHub ? "hub" : ""}">
          ${isSelected ? '<div class="ping-ring"></div>' : ""}
          <div class="marker-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-10 h-10">
              <path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
            </svg>
          </div>
          ${
            isSelected
              ? `
            <div class="marker-label">
              <span class="station-name">${station.name}</span>
              <span class="status-dot"></span>
            </div>
          `
              : ""
          }
        </div>
      `;
      el.style.cursor = "pointer";
      return el;
    },
    []
  );

  // Station markers
  useEffect(() => {
    if (!map.current || !loaded) return;

    // Clear old markers
    markers.current.forEach((marker) => marker.remove());
    markers.current.clear();

    // Add new markers
    stations.forEach((station) => {
      const isSelected = station.id === selectedStationId;
      const el = createMarkerElement(station, isSelected);

      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([station.longitude, station.latitude])
        .addTo(map.current!);

      el.addEventListener("click", () => {
        if (!station.isHub) {
          onStationSelect(station);
        }
      });

      markers.current.set(station.id, marker);

      // Fly to selected station
      if (isSelected && map.current) {
        map.current.flyTo({
          center: [station.longitude, station.latitude],
          zoom: 12,
          duration: 1000,
        });
      }
    });
  }, [
    stations,
    loaded,
    selectedStationId,
    onStationSelect,
    createMarkerElement,
  ]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Zoom Controls Custom Styling */}
      <style jsx global>{`
        .maplibregl-ctrl-group {
          background: rgba(30, 41, 59, 0.9) !important;
          border: 1px solid rgba(71, 85, 105, 0.5) !important;
          border-radius: 0.5rem !important;
          overflow: hidden;
          backdrop-filter: blur(8px);
        }

        .maplibregl-ctrl-group button {
          background: transparent !important;
          border: none !important;
          width: 40px !important;
          height: 40px !important;
        }

        .maplibregl-ctrl-group button:hover {
          background: rgba(51, 65, 85, 0.8) !important;
        }

        .maplibregl-ctrl-group button + button {
          border-top: 1px solid rgba(71, 85, 105, 0.5) !important;
        }

        .maplibregl-ctrl-group button span {
          filter: invert(1);
        }

        /* Custom Marker Styles */
        .custom-marker {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .marker-container {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .marker-container .marker-icon {
          color: #64748b;
          transition: all 0.3s ease;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
        }

        .marker-container .marker-icon svg {
          width: 36px;
          height: 36px;
        }

        .marker-container:hover .marker-icon {
          color: #135bec;
          transform: scale(1.1);
        }

        .marker-container.hub .marker-icon {
          color: #dc2626;
        }

        .marker-container.selected .marker-icon {
          color: #135bec;
          filter: drop-shadow(0 0 12px rgba(19, 91, 236, 0.8));
        }

        .marker-container.selected .marker-icon svg {
          width: 48px;
          height: 48px;
        }

        .ping-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: rgba(19, 91, 236, 0.3);
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        @keyframes ping {
          75%,
          100% {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
          }
        }

        .marker-label {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-bottom: 8px;
          padding: 6px 12px;
          background: rgba(30, 41, 59, 0.95);
          border: 1px solid rgba(19, 91, 236, 0.5);
          border-radius: 6px;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 8px;
          animation: bounce 1s infinite;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        @keyframes bounce {
          0%,
          100% {
            transform: translateX(-50%) translateY(0);
          }
          50% {
            transform: translateX(-50%) translateY(-4px);
          }
        }

        .station-name {
          color: white;
          font-size: 14px;
          font-weight: 500;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          background: #22c55e;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>

      {/* Legend */}
      <div className="absolute bottom-6 right-6 bg-slate-800/90 backdrop-blur-md border border-slate-700 rounded-lg p-3 shadow-lg z-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(19,91,236,0.8)]" />
          <span className="text-xs font-medium text-gray-300">
            Seçili İstasyon
          </span>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 rounded-full bg-red-600" />
          <span className="text-xs font-medium text-gray-400">Merkez Hub</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-slate-500" />
          <span className="text-xs font-medium text-gray-400">
            Diğer İstasyonlar
          </span>
        </div>
      </div>
    </div>
  );
}
