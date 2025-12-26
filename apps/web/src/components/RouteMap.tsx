"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import polyline from "@mapbox/polyline";

interface Station {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  isHub?: boolean;
}

interface Route {
  id: string;
  vehicleId: string;
  vehicleName: string;
  plateNumber?: string;
  color: string;
  polyline?: string;
  status: "active" | "warning" | "idle";
  loadPercentage: number;
  cost: number;
  stations: { name: string; code: string }[];
}

interface RouteMapProps {
  stations: Station[];
  routes: Route[];
  onRouteHover?: (routeId: string | null) => void;
  selectedRouteId?: string | null;
}

const ROUTE_COLORS = {
  blue: "#135bec",
  orange: "#f97316",
  green: "#22c55e",
  purple: "#a855f7",
  cyan: "#06b6d4",
  pink: "#ec4899",
};

const COLOR_LIST = Object.values(ROUTE_COLORS);

export default function RouteMap({
  stations,
  routes,
  onRouteHover,
  selectedRouteId,
}: RouteMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Kocaeli merkez koordinatları
  const CENTER: [number, number] = [29.9, 40.76];

  // User tarafındaki harita ile aynı: CARTO Voyager (light, okunabilir)
  const voyagerStyle = {
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
        paint: {
          "raster-opacity": 0.95,
        },
      },
    ],
  } as maplibregl.StyleSpecification;

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: voyagerStyle,
      center: CENTER,
      zoom: 10,
      attributionControl: false,
    });

    map.current.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right"
    );

    map.current.on("load", () => {
      setLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Draw routes
  useEffect(() => {
    if (!map.current || !loaded) return;

    // Remove existing route layers
    routes.forEach((_, idx) => {
      const layerId = `route-${idx}`;
      const glowLayerId = `route-glow-${idx}`;
      if (map.current?.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current?.getLayer(glowLayerId)) {
        map.current.removeLayer(glowLayerId);
      }
      if (map.current?.getSource(layerId)) {
        map.current.removeSource(layerId);
      }
    });

    // Add route lines
    routes.forEach((route, idx) => {
      if (!route.polyline) return;

      // Optimizer output stores polylines as semicolon-separated OSRM segments.
      // Decode and concatenate segments safely.
      const segments = route.polyline.split(";").filter(Boolean);
      const coordinates: [number, number][] = [];

      for (const segment of segments) {
        try {
          const decoded = polyline.decode(segment);
          for (let i = 0; i < decoded.length; i++) {
            const [lat, lng] = decoded[i];
            const point: [number, number] = [lng, lat];

            // Avoid duplicating the join point between consecutive segments.
            const last = coordinates[coordinates.length - 1];
            if (last && last[0] === point[0] && last[1] === point[1]) continue;

            coordinates.push(point);
          }
        } catch (e) {
          console.error("Polyline decode error:", e);
        }
      }

      if (coordinates.length < 2) return;

      const layerId = `route-${idx}`;
      const color = route.color || COLOR_LIST[idx % COLOR_LIST.length];
      const isSelected = selectedRouteId === route.id;

      map.current?.addSource(layerId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: { routeId: route.id },
          geometry: {
            type: "LineString",
            coordinates,
          },
        },
      });

      // Glow effect layer
      map.current?.addLayer({
        id: `route-glow-${idx}`,
        type: "line",
        source: layerId,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": color,
          "line-width": isSelected ? 12 : 8,
          "line-opacity": 0.3,
          "line-blur": 4,
        },
      });

      // Main route line
      map.current?.addLayer({
        id: layerId,
        type: "line",
        source: layerId,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": color,
          "line-width": isSelected ? 4 : 3,
          "line-opacity": isSelected ? 1 : 0.8,
          "line-dasharray": route.status === "idle" ? [2, 2] : [1, 0],
        },
      });

      // Hover events
      map.current?.on("mouseenter", layerId, () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = "pointer";
        }
        onRouteHover?.(route.id);
      });

      map.current?.on("mouseleave", layerId, () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = "";
        }
        onRouteHover?.(null);
      });
    });
  }, [routes, loaded, selectedRouteId, onRouteHover]);

  // Station markers
  useEffect(() => {
    if (!map.current || !loaded) return;

    // Clear existing markers
    markers.current.forEach((m) => m.remove());
    markers.current = [];

    // Add station markers
    stations.forEach((station) => {
      const el = document.createElement("div");
      el.className = "route-station-marker";

      if (station.isHub) {
        // Hub marker - larger with glow
        el.innerHTML = `
          <div class="relative">
            <div class="absolute inset-0 bg-white rounded-full animate-ping opacity-30"></div>
            <div class="w-5 h-5 rounded-full bg-white border-2 border-white shadow-[0_0_15px_rgba(255,255,255,0.8)]"></div>
          </div>
        `;
        el.style.width = "20px";
        el.style.height = "20px";
      } else {
        // Regular station marker
        el.innerHTML = `
          <div class="w-3 h-3 rounded-full bg-white/80 border-2 border-primary shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
        `;
        el.style.width = "12px";
        el.style.height = "12px";
      }

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([station.longitude, station.latitude])
        .addTo(map.current!);

      // Popup with station name
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 15,
        className: "route-popup",
      }).setHTML(`
        <div class="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider">
          ${station.name}
        </div>
      `);

      el.addEventListener("mouseenter", () => {
        popup
          .setLngLat([station.longitude, station.latitude])
          .addTo(map.current!);
      });

      el.addEventListener("mouseleave", () => {
        popup.remove();
      });

      markers.current.push(marker);
    });
  }, [stations, loaded]);

  return (
    <div className="absolute inset-0 z-0">
      <div ref={mapContainer} className="w-full h-full" />

      <style jsx global>{`
        .route-popup .maplibregl-popup-content {
          background: transparent;
          padding: 0;
          box-shadow: none;
        }
        .route-popup .maplibregl-popup-tip {
          display: none;
        }
      `}</style>
    </div>
  );
}
