'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import polyline from '@mapbox/polyline';

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

interface Route {
  vehicleId: string;
  vehicleName: string;
  color: string;
  polyline?: string;
  stations: Station[];
}

interface MapProps {
  stations: Station[];
  routes?: Route[];
  selectedRoute?: string | null;
  onStationClick?: (station: Station) => void;
  height?: string;
}

const VEHICLE_COLORS = [
  '#135bec', // blue
  '#f97316', // orange
  '#22c55e', // green
  '#a855f7', // purple
  '#06b6d4', // cyan
  '#ec4899', // pink
];

export default function Map({
  stations,
  routes = [],
  selectedRoute,
  onStationClick,
  height = '500px',
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Kocaeli merkez koordinatları
  const CENTER: [number, number] = [29.9, 40.76];

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: CENTER,
      zoom: 10,
      attributionControl: false,
    });

    map.current.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'bottom-right'
    );

    map.current.on('load', () => {
      setLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Stations markers
  useEffect(() => {
    if (!map.current || !loaded) return;

    // Eski marker'ları temizle
    markers.current.forEach((m) => m.remove());
    markers.current = [];

    // Yeni marker'ları ekle
    stations.forEach((station) => {
      const el = document.createElement('div');
      el.className = 'station-marker';
      el.style.cursor = 'pointer';

      if (station.isHub) {
        el.innerHTML = `
          <div class="relative">
            <div class="absolute inset-0 bg-white rounded-full animate-ping opacity-30"></div>
            <div class="w-5 h-5 rounded-full bg-white border-2 border-white shadow-[0_0_15px_rgba(255,255,255,0.8)]"></div>
          </div>
        `;
        el.style.width = '20px';
        el.style.height = '20px';
      } else {
        el.innerHTML = `
          <div class="w-3 h-3 rounded-full bg-white/80 border-2 border-primary shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
        `;
        el.style.width = '12px';
        el.style.height = '12px';
      }

      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 15,
        className: 'kargo-map-popup',
      }).setHTML(`
        <div class="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider">
          ${station.name}
          ${station.isHub ? '<div class="mt-1 text-[10px] font-semibold opacity-80">Merkez Depo</div>' : ''}
          ${station.cargoCount !== undefined ? `<div class="mt-1 text-[10px] font-semibold opacity-80">Kargo: ${station.cargoCount}</div>` : ''}
          ${station.totalWeightKg !== undefined ? `<div class="mt-1 text-[10px] font-semibold opacity-80">Ağırlık: ${station.totalWeightKg} kg</div>` : ''}
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([station.longitude, station.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      el.addEventListener('click', () => {
        onStationClick?.(station);
      });

      markers.current.push(marker);
    });
  }, [stations, loaded, onStationClick]);

  // Routes polylines
  useEffect(() => {
    if (!map.current || !loaded) return;

    // Eski route layer'larını temizle
    routes.forEach((_, idx) => {
      const layerId = `route-${idx}`;
      const sourceId = `route-source-${idx}`;
      if (map.current?.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current?.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
    });

    // Yeni route'ları çiz
    routes.forEach((route, idx) => {
      if (!route.polyline) return;

      try {
        // Polyline'ları decode et ve birleştir
        const polylines = route.polyline.split(';').filter(Boolean);
        const allCoords: [number, number][] = [];

        polylines.forEach((pl) => {
          const decoded = polyline.decode(pl);
          decoded.forEach(([lat, lng]) => {
            allCoords.push([lng, lat]);
          });
        });

        if (allCoords.length === 0) return;

        const sourceId = `route-source-${idx}`;
        const layerId = `route-${idx}`;
        const color = route.color || VEHICLE_COLORS[idx % VEHICLE_COLORS.length];

        map.current?.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: allCoords,
            },
          },
        });

        map.current?.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': color,
            'line-width': selectedRoute === route.vehicleId ? 6 : 4,
            'line-opacity': selectedRoute && selectedRoute !== route.vehicleId ? 0.3 : 0.8,
          },
        });
      } catch (e) {
        console.error('Polyline decode error:', e);
      }
    });
  }, [routes, loaded, selectedRoute]);

  return (
    <div
      style={{
        width: '100%',
        height,
        borderRadius: '8px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      <style jsx global>{`
        .kargo-map-popup .maplibregl-popup-content {
          background: transparent;
          padding: 0;
          box-shadow: none;
        }
        .kargo-map-popup .maplibregl-popup-tip {
          display: none;
        }
        .maplibregl-ctrl-group {
          background: rgba(15, 23, 42, 0.8) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          backdrop-filter: blur(8px);
        }
        .maplibregl-ctrl-group button {
          background: transparent !important;
        }
        .maplibregl-ctrl-group button:hover {
          background: rgba(255, 255, 255, 0.1) !important;
        }
        .maplibregl-ctrl-group button + button {
          border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
        .maplibregl-ctrl button.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon,
        .maplibregl-ctrl button.maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon {
          filter: invert(1);
        }
      `}</style>
    </div>
  );
}
