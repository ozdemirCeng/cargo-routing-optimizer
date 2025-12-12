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
  '#1976d2', // blue
  '#d32f2f', // red
  '#388e3c', // green
  '#f57c00', // orange
  '#7b1fa2', // purple
  '#0097a7', // cyan
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
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: CENTER,
      zoom: 10,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

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
      el.style.width = station.isHub ? '24px' : '16px';
      el.style.height = station.isHub ? '24px' : '16px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = station.isHub ? '#d32f2f' : '#1976d2';
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
      el.style.cursor = 'pointer';

      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
        <div style="padding: 4px;">
          <strong>${station.name}</strong>
          ${station.isHub ? '<br/><em>(Merkez Hub)</em>' : ''}
          ${station.cargoCount !== undefined ? `<br/>Kargo: ${station.cargoCount}` : ''}
          ${station.totalWeightKg !== undefined ? `<br/>Ağırlık: ${station.totalWeightKg} kg` : ''}
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
      ref={mapContainer}
      style={{
        width: '100%',
        height,
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    />
  );
}
