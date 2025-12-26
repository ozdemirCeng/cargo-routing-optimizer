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
  stops?: Array<{
    order: number;
    stationId?: string;
    label?: string;
    latitude: number;
    longitude: number;
    isHub?: boolean;
  }>;
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

function resolveRouteColor(color: string | undefined, fallbackIndex: number) {
  if (!color) return COLOR_LIST[fallbackIndex % COLOR_LIST.length];
  if (color in ROUTE_COLORS) return ROUTE_COLORS[color as keyof typeof ROUTE_COLORS];
  return color;
}

function createBriefPopup(options: {
  map: maplibregl.Map;
  lngLat: [number, number];
  html: string;
  offset?: number;
  durationMs?: number;
}) {
  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: options.offset ?? 16,
    className: "route-hover-label",
  })
    .setLngLat(options.lngLat)
    .setHTML(options.html)
    .addTo(options.map);

  const timeout = window.setTimeout(
    () => popup.remove(),
    options.durationMs ?? 1200
  );

  return {
    remove: () => {
      window.clearTimeout(timeout);
      popup.remove();
    },
  };
}

export default function RouteMap({
  stations,
  routes,
  onRouteHover,
  selectedRouteId,
}: RouteMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const stopMarkers = useRef<maplibregl.Marker[]>([]);
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

          // Bring hovered route to front so it doesn't stay underneath.
          try {
            const glowId = `route-glow-${idx}`;
            if (map.current.getLayer(glowId)) map.current.moveLayer(glowId);
            if (map.current.getLayer(layerId)) map.current.moveLayer(layerId);
          } catch {
            // ignore (layer ordering is best-effort)
          }
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

      // Brief label on hover: station name + (if known) stop order
      let activeHover: { remove: () => void } | null = null;

      const getBestStopOrder = () => {
        if (/umuttepe/i.test(station.name)) return null;

        const allOrders: number[] = [];
        for (const r of routes) {
          const s = r.stops?.find((st) => st.stationId && st.stationId === station.id);
          if (typeof s?.order === "number") allOrders.push(s.order + 1);
        }

        const distinct = Array.from(new Set(allOrders));
        // If multiple routes have different orders for this station, don't show any number
        // to avoid confusing collisions.
        if (distinct.length > 1) return null;

        const preferred = selectedRouteId
          ? routes.find((r) => r.id === selectedRouteId)
          : null;
        const preferredStop = preferred?.stops?.find(
          (s) => s.stationId && s.stationId === station.id
        );
        if (preferredStop) return preferredStop.order + 1;

        if (distinct.length === 1) return distinct[0];
        return null;
      };

      el.addEventListener("mouseenter", () => {
        if (!map.current) return;
        activeHover?.remove();
        const order = getBestStopOrder();
        const html = `
          <div class="bg-white text-slate-900 px-2.5 py-1.5 rounded-md text-xs font-semibold">
            ${station.name}${order ? ` • ${order}` : ""}
          </div>
        `;
        activeHover = createBriefPopup({
          map: map.current,
          lngLat: [station.longitude, station.latitude],
          html,
          offset: 14,
          durationMs: 1200,
        });
      });

      el.addEventListener("mouseleave", () => {
        activeHover?.remove();
        activeHover = null;
      });

      markers.current.push(marker);
    });
  }, [stations, routes, selectedRouteId, loaded]);

  // Numbered stop markers (all routes)
  useEffect(() => {
    if (!map.current || !loaded) return;

    stopMarkers.current.forEach((m) => m.remove());
    stopMarkers.current = [];

    const renderedNameOnlyStops = new Set<string>();

    const resolveStopDisplayName = (stop: NonNullable<Route["stops"]>[number]) => {
      if (stop.label) return stop.label;
      if (stop.stationId) {
        const st = stations.find((s) => s.id === stop.stationId);
        if (st?.name) return st.name;
      }
      return null;
    };

    const isNameOnlyStop = (stop: NonNullable<Route["stops"]>[number]) => {
      const name = resolveStopDisplayName(stop);
      return !!name && /umuttepe/i.test(name);
    };

    routes.forEach((route, routeIndex) => {
      if (!route.stops || route.stops.length === 0) return;

      const sortedStops = [...route.stops].sort((a, b) => a.order - b.order);
      const routeColor = resolveRouteColor(route.color, routeIndex);

      for (const stop of sortedStops) {
        const displayName = resolveStopDisplayName(stop);
        const shouldNameOnly = isNameOnlyStop(stop);
        if (shouldNameOnly) {
          const key = stop.stationId
            ? `station:${stop.stationId}`
            : `coord:${stop.longitude.toFixed(6)},${stop.latitude.toFixed(6)}`;

          // Render only one marker for this name-only stop to avoid overlapping numbers.
          if (renderedNameOnlyStops.has(key)) continue;
          renderedNameOnlyStops.add(key);

          const el = document.createElement("div");
          el.className = "route-stop-nameonly-marker";
          el.style.zIndex = "3";

          el.innerHTML = `
            <div class="px-2.5 py-1.5 rounded-md bg-white text-slate-900 text-xs font-semibold shadow-xl border border-white/30">
              ${displayName ?? ""}
            </div>
          `;

          const marker = new maplibregl.Marker({ element: el, anchor: "center" })
            .setLngLat([stop.longitude, stop.latitude])
            .addTo(map.current!);

          stopMarkers.current.push(marker);
          continue;
        }

        const el = document.createElement("div");
        el.className = "route-stop-order-marker";
        el.style.zIndex = "2";
        const number = stop.order + 1;

        el.innerHTML = `
          <div class="relative">
            <div
              class="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-extrabold shadow-xl border border-white/30"
              style="background:${routeColor};color:#ffffff"
            >
              ${number}
            </div>
          </div>
        `;

        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([stop.longitude, stop.latitude])
          .addTo(map.current!);

        // Optional brief label on hover (no black card)
        if (displayName) {
          let activeHover: { remove: () => void } | null = null;
          el.addEventListener("mouseenter", () => {
            if (!map.current) return;
            activeHover?.remove();
            const html = `
              <div class="bg-white text-slate-900 px-2.5 py-1.5 rounded-md text-xs font-semibold">
                ${number}. ${displayName}
              </div>
            `;
            activeHover = createBriefPopup({
              map: map.current,
              lngLat: [stop.longitude, stop.latitude],
              html,
              offset: 16,
              durationMs: 1200,
            });
          });
          el.addEventListener("mouseleave", () => {
            activeHover?.remove();
            activeHover = null;
          });
        }

        stopMarkers.current.push(marker);
      }
    });
  }, [routes, loaded]);

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

        .route-hover-label .maplibregl-popup-content {
          background: transparent;
          padding: 0;
          box-shadow: none;
        }
        .route-hover-label .maplibregl-popup-tip {
          display: none;
        }
      `}</style>
    </div>
  );
}
