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

  // Track added route indices for cleanup
  const addedRouteIndicesRef = useRef<number[]>([]);
  // Map route.id to layer index for reordering
  const routeIdToIndexRef = useRef<Map<string, number>>(new Map());

  // Rota çizgileri - sadece routes değiştiğinde yeniden çiz
  useEffect(() => {
    if (!map.current || !loaded) return;

    // Eski layerları temizle - önce tüm layer'ları sil, sonra source'ları
    // Dinamik olarak eklenen tüm rotaları temizle (100'e kadar destekle)
    const maxRoutes = Math.max(
      100,
      addedRouteIndicesRef.current.length,
      routes.length
    );
    for (let i = 0; i < maxRoutes; i++) {
      // Önce layer'ları sil (sıra önemli: outline source'u kullanıyor)
      if (map.current?.getLayer(`route-outline-${i}`)) {
        map.current.removeLayer(`route-outline-${i}`);
      }
      if (map.current?.getLayer(`route-line-${i}`)) {
        map.current.removeLayer(`route-line-${i}`);
      }
    }
    // Sonra source'ları sil
    for (let i = 0; i < maxRoutes; i++) {
      if (map.current?.getSource(`route-line-${i}`)) {
        map.current.removeSource(`route-line-${i}`);
      }
    }

    // Track current indices
    addedRouteIndicesRef.current = [];
    routeIdToIndexRef.current.clear();

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

      // Use color from route object (passed from parent)
      const color = route.color;

      const sourceId = `route-line-${idx}`;

      // Track this index for cleanup and reordering
      addedRouteIndicesRef.current.push(idx);
      routeIdToIndexRef.current.set(route.id, idx);

      map.current?.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates },
        },
      });

      // Dış çerçeve (koyu) - başlangıçta normal opacity
      map.current?.addLayer({
        id: `route-outline-${idx}`,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#1a1a2e",
          "line-width": 7,
          "line-opacity": 0.8,
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
          "line-width": 4,
          "line-opacity": 1,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    });
  }, [routes, loaded]);

  // Seçili rota değişince: paint özelliklerini güncelle ve layer'ı en üste taşı
  useEffect(() => {
    if (!map.current || !loaded) return;

    const hasSelection = !!selectedRouteId;
    const selectedIdx = selectedRouteId
      ? routeIdToIndexRef.current.get(selectedRouteId)
      : undefined;

    // Tüm rotaların opacity ve width'ini güncelle
    addedRouteIndicesRef.current.forEach((idx) => {
      const isSelected = idx === selectedIdx;
      const opacity = hasSelection && !isSelected ? 0.25 : 1;

      // Outline layer
      if (map.current?.getLayer(`route-outline-${idx}`)) {
        map.current.setPaintProperty(
          `route-outline-${idx}`,
          "line-opacity",
          opacity * 0.8
        );
        map.current.setPaintProperty(
          `route-outline-${idx}`,
          "line-width",
          isSelected ? 10 : 7
        );
      }

      // Main line layer
      if (map.current?.getLayer(`route-line-${idx}`)) {
        map.current.setPaintProperty(
          `route-line-${idx}`,
          "line-opacity",
          opacity
        );
        map.current.setPaintProperty(
          `route-line-${idx}`,
          "line-width",
          isSelected ? 6 : 4
        );
      }
    });

    // Seçili rotayı en üste taşı (moveLayer)
    if (selectedIdx !== undefined) {
      // Önce outline'ı en üste, sonra line'ı (line en üstte olmalı)
      if (map.current?.getLayer(`route-outline-${selectedIdx}`)) {
        map.current.moveLayer(`route-outline-${selectedIdx}`);
      }
      if (map.current?.getLayer(`route-line-${selectedIdx}`)) {
        map.current.moveLayer(`route-line-${selectedIdx}`);
      }
    }
  }, [selectedRouteId, loaded, routes]);

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
      // Use color from route object (passed from parent)
      const color = route.color;

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
        // Durak numaraları
        const hasSelection = !!selectedRouteId;

        // Seçili rotayı bul
        const selectedData = data.find(
          (d) => selectedRouteId === routes[d.routeIdx]?.id
        );

        if (hasSelection && selectedData) {
          // Seçili rota varsa sadece onu göster
          el.innerHTML = `
            <div style="
              width: 36px;
              height: 36px;
              background: ${selectedData.color};
              border: 3px solid white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 16px;
              font-weight: 900;
              color: white;
              box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            ">${selectedData.order}</div>
          `;
        } else if (!hasSelection) {
          // Seçim yoksa: tek bir özet marker göster
          // En düşük sıra numaralı rotanın rengini kullan
          data.sort((a, b) => a.order - b.order);
          const primary = data[0];
          const extraCount = data.length - 1;

          el.innerHTML = `
            <div style="position: relative;">
              <div style="
                width: 32px;
                height: 32px;
                background: ${primary.color};
                border: 3px solid white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: 900;
                color: white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              ">${primary.order}</div>
              ${
                extraCount > 0
                  ? `
                <div style="
                  position: absolute;
                  top: -6px;
                  right: -6px;
                  width: 18px;
                  height: 18px;
                  background: #1a1a2e;
                  border: 2px solid white;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 10px;
                  font-weight: 700;
                  color: white;
                ">+${extraCount}</div>
              `
                  : ""
              }
            </div>
          `;
        } else {
          // Seçim var ama bu durakta seçili rota yok - soluk göster
          data.sort((a, b) => a.order - b.order);
          const primary = data[0];

          el.innerHTML = `
            <div style="
              width: 24px;
              height: 24px;
              background: ${primary.color};
              border: 2px solid white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 11px;
              font-weight: 700;
              color: white;
              box-shadow: 0 2px 6px rgba(0,0,0,0.2);
              opacity: 0.4;
            ">${primary.order}</div>
          `;
        }
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
