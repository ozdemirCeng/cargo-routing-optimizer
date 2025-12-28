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

// Belirgin ve farklı renkler
const ROUTE_COLORS = [
  "#e63946", // kırmızı
  "#2a9d8f", // turkuaz
  "#e9c46a", // sarı
  "#264653", // koyu mavi
  "#f4a261", // turuncu
  "#9b5de5", // mor
];

export default function RouteMap({
  stations,
  routes,
  onRouteHover,
  selectedRouteId,
}: RouteMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hoveredStation, setHoveredStation] = useState<string | null>(null);

  const CENTER: [number, number] = [29.9, 40.76];

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

  // Harita başlat
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

    map.current.on("load", () => setLoaded(true));

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Rota çizgileri
  useEffect(() => {
    if (!map.current || !loaded) return;

    // Eski layer/source'ları temizle - tüm route layer'larını kapsa
    const style = map.current.getStyle();
    if (style?.layers) {
      for (const layer of style.layers) {
        if (
          layer.id.startsWith("route-outline-") ||
          layer.id.startsWith("route-line-")
        ) {
          if (map.current.getLayer(layer.id)) {
            map.current.removeLayer(layer.id);
          }
        }
      }
    }
    if (style?.sources) {
      for (const sourceId of Object.keys(style.sources)) {
        if (sourceId.startsWith("route-line-")) {
          if (map.current.getSource(sourceId)) {
            map.current.removeSource(sourceId);
          }
        }
      }
    }

    routes.forEach((route, idx) => {
      if (!route.polyline) return;

      const segments = route.polyline.split(";").filter(Boolean);
      const coordinates: [number, number][] = [];

      for (const segment of segments) {
        try {
          const decoded = polyline.decode(segment);
          for (const [lat, lng] of decoded) {
            const point: [number, number] = [lng, lat];
            const last = coordinates[coordinates.length - 1];
            if (last && last[0] === point[0] && last[1] === point[1]) continue;
            coordinates.push(point);
          }
        } catch {}
      }

      if (coordinates.length < 2) return;

      const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
      const isSelected = selectedRouteId === route.id;
      const hasSelection = !!selectedRouteId;
      const opacity = hasSelection && !isSelected ? 0.25 : 1;

      const sourceId = `route-line-${idx}`;

      map.current?.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates },
        },
      });

      // Dış çerçeve (koyu)
      map.current?.addLayer({
        id: `route-outline-${idx}`,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#1a1a2e",
          "line-width": isSelected ? 10 : 7,
          "line-opacity": opacity * 0.8,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });

      // Ana çizgi
      map.current?.addLayer({
        id: `route-line-${idx}`,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": color,
          "line-width": isSelected ? 6 : 4,
          "line-opacity": opacity,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    });
  }, [routes, loaded, selectedRouteId]);

  // Durak markerları
  useEffect(() => {
    if (!map.current || !loaded) return;

    // Eski markerları temizle
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Durak bilgilerini topla: koordinat -> [{routeIdx, order}]
    type StopData = { routeIdx: number; order: number; color: string };
    const stopMap = new Map<
      string,
      {
        coords: [number, number];
        data: StopData[];
        name: string;
        isHub: boolean;
      }
    >();

    routes.forEach((route, routeIdx) => {
      if (!route.stops) return;
      const color = ROUTE_COLORS[routeIdx % ROUTE_COLORS.length];

      route.stops.forEach((stop) => {
        const key = `${stop.latitude.toFixed(5)},${stop.longitude.toFixed(5)}`;

        if (!stopMap.has(key)) {
          // İsim bul
          let name = stop.label || "";
          if (!name && stop.stationId) {
            const st = stations.find((s) => s.id === stop.stationId);
            name = st?.name || "";
          }

          stopMap.set(key, {
            coords: [stop.longitude, stop.latitude],
            data: [],
            name,
            isHub: !!stop.isHub,
          });
        }

        if (!stop.isHub) {
          stopMap.get(key)!.data.push({
            routeIdx,
            order: stop.order + 1,
            color,
          });
        }
      });
    });

    // Her durak için marker oluştur
    Array.from(stopMap.entries()).forEach(([key, info]) => {
      const { coords, data, name, isHub } = info;

      const el = document.createElement("div");
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.gap = "3px";
      el.style.cursor = "pointer";

      if (isHub) {
        // HUB marker - büyük beyaz daire
        el.innerHTML = `
          <div style="
            width: 48px;
            height: 48px;
            background: white;
            border: 4px solid #1a1a2e;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          ">
            <div style="text-align: center;">
              <div style="font-size: 11px; font-weight: 900; color: #1a1a2e;">HUB</div>
            </div>
          </div>
        `;
      } else if (data.length === 0) {
        // Boş durak - küçük gri nokta
        el.innerHTML = `
          <div style="
            width: 12px;
            height: 12px;
            background: rgba(255,255,255,0.7);
            border: 2px solid rgba(0,0,0,0.3);
            border-radius: 50%;
          "></div>
        `;
      } else {
        // Durak numaraları - her araç için bir numara
        const hasSelection = !!selectedRouteId;

        data.sort((a, b) => a.routeIdx - b.routeIdx);

        const numbersHtml = data
          .map((d) => {
            const isSelected = selectedRouteId === routes[d.routeIdx]?.id;
            const opacity = hasSelection && !isSelected ? 0.3 : 1;

            return `
            <div style="
              width: 32px;
              height: 32px;
              background: ${d.color};
              border: 3px solid white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 14px;
              font-weight: 900;
              color: white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              opacity: ${opacity};
            ">${d.order}</div>
          `;
          })
          .join("");

        el.innerHTML = numbersHtml;
      }

      // Hover için tooltip
      el.addEventListener("mouseenter", () => {
        if (name) setHoveredStation(key);
      });
      el.addEventListener("mouseleave", () => {
        setHoveredStation(null);
      });

      el.dataset.stationKey = key;
      el.dataset.stationName = name;

      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat(coords)
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [routes, stations, loaded, selectedRouteId]);

  // Hover tooltip
  useEffect(() => {
    if (!hoveredStation || !map.current) return;

    const markerEl = markersRef.current.find(
      (m) =>
        (m.getElement() as HTMLElement).dataset?.stationKey === hoveredStation
    );
    if (!markerEl) return;

    const name = (markerEl.getElement() as HTMLElement).dataset?.stationName;
    if (!name) return;

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 20,
      className: "station-tooltip",
    })
      .setLngLat(markerEl.getLngLat())
      .setHTML(
        `<div style="background: #1a1a2e; color: white; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600;">${name}</div>`
      )
      .addTo(map.current);

    return () => {
      popup.remove();
    };
  }, [hoveredStation]);

  return (
    <div className="absolute inset-0 z-0">
      <div ref={mapContainer} className="w-full h-full" />

      <style jsx global>{`
        .station-tooltip .maplibregl-popup-content {
          background: transparent;
          padding: 0;
          box-shadow: none;
        }
        .station-tooltip .maplibregl-popup-tip {
          display: none;
        }
      `}</style>
    </div>
  );
}
