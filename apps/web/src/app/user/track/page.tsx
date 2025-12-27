"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { cargosApi } from "@/lib/api";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

const VEHICLE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

function TrackCargoContent() {
  const searchParams = useSearchParams();
  const [cargoId, setCargoId] = useState(searchParams.get("id") || "");
  const [searchId, setSearchId] = useState(searchParams.get("id") || "");

  const {
    data: cargo,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["cargo", searchId],
    queryFn: () => cargosApi.getById(searchId).then((r) => r.data),
    enabled: !!searchId,
  });

  const { data: route, isLoading: routeLoading } = useQuery({
    queryKey: ["cargo-route", searchId],
    queryFn: () => cargosApi.getRoute(searchId).then((r) => r.data),
    enabled:
      !!searchId &&
      !!cargo &&
      ["assigned", "in_transit"].includes(cargo?.status),
  });

  const handleSearch = () => {
    setSearchId(cargoId);
  };

  const statusLabels: Record<string, string> = {
    pending: "Bekliyor",
    assigned: "Araca Atandı",
    in_transit: "Yolda",
    delivered: "Teslim Edildi",
    cancelled: "İptal",
  };

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    assigned: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    in_transit: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    delivered: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  const statusSteps = ["pending", "assigned", "in_transit", "delivered"];
  const activeStep = statusSteps.indexOf(cargo?.status || "pending");

  // Harita verileri
  const routeStations = Array.isArray((route as any)?.stations)
    ? ((route as any).stations as any[])
    : [];
  const mapStations = routeStations
    .map((s: any) => {
      const latitude = Number(s.latitude);
      const longitude = Number(s.longitude);

      const cargoCountRaw =
        s.cargoCount === null || s.cargoCount === undefined
          ? undefined
          : Number(s.cargoCount);
      const cargoCount = Number.isFinite(cargoCountRaw)
        ? cargoCountRaw
        : undefined;

      const totalWeightRaw =
        s.totalWeightKg === null || s.totalWeightKg === undefined
          ? undefined
          : Number(s.totalWeightKg);
      const totalWeightKg = Number.isFinite(totalWeightRaw)
        ? totalWeightRaw
        : undefined;

      return {
        id: String(s.id),
        name: String(s.name ?? ""),
        code: String(s.code ?? ""),
        latitude,
        longitude,
        isHub: Boolean(s.isHub),
        cargoCount,
        totalWeightKg,
      };
    })
    .filter(
      (s: any) =>
        Number.isFinite(s.latitude) &&
        Number.isFinite(s.longitude) &&
        // (0,0) genelde invalid; Unknown istasyonlar haritada gozukmesin
        !(s.latitude === 0 && s.longitude === 0)
    );

  const mapRoutes = route
    ? [
        {
          vehicleId: route.vehicleId,
          vehicleName: route.vehicleName,
          color: VEHICLE_COLORS[0],
          polyline: route.polyline,
          stations: mapStations,
        },
      ]
    : [];

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Search Card */}
      <div className="glass-dark rounded-2xl p-6 flex-shrink-0">
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <span className="material-symbols-rounded absolute left-4 top-1/2 -translate-y-1/2 text-slate-200">
              search
            </span>
            <input
              type="text"
              value={cargoId}
              onChange={(e) => setCargoId(e.target.value)}
              placeholder="Kargo ID veya Takip Kodu girin..."
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full h-14 bg-slate-800/50 border border-slate-700/50 text-white rounded-xl pl-12 pr-4 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
            />
          </div>
          <button
            onClick={handleSearch}
            className="h-14 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/20 transition-all font-medium flex items-center gap-2"
          >
            <span className="material-symbols-rounded">search</span>
            Ara
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="glass-dark rounded-2xl p-6 flex items-center gap-4 border border-red-500/30 bg-red-500/10">
          <span className="material-symbols-rounded text-red-400 text-2xl">
            error
          </span>
          <p className="text-red-400">
            Kargo bulunamadı veya bu kargoya erişim yetkiniz yok.
          </p>
        </div>
      )}

      {/* Cargo Details */}
      {cargo && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
          {/* Cargo Info Card */}
          <div className="glass-dark rounded-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-700/50">
              <h2 className="text-lg font-bold text-white">Kargo Bilgileri</h2>
            </div>

            <div className="p-6 flex-1 overflow-auto">
              {/* Status Stepper */}
              <div className="mb-8">
                <div className="flex items-center justify-between relative">
                  {/* Progress Line */}
                  <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-700">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                      style={{
                        width: `${(activeStep / (statusSteps.length - 1)) * 100}%`,
                      }}
                    />
                  </div>

                  {statusSteps.map((step, index) => (
                    <div
                      key={step}
                      className="flex flex-col items-center relative z-10"
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          index <= activeStep
                            ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
                            : "bg-slate-700 text-slate-200"
                        }`}
                      >
                        {index < activeStep ? (
                          <span className="material-symbols-rounded text-lg">
                            check
                          </span>
                        ) : (
                          <span className="text-sm font-bold">{index + 1}</span>
                        )}
                      </div>
                      <span
                        className={`mt-2 text-xs font-medium ${
                          index <= activeStep
                            ? "text-emerald-400"
                            : "text-slate-200"
                        }`}
                      >
                        {statusLabels[step]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-xs text-slate-200 mb-1">Takip Kodu</p>
                  <p className="text-white font-mono font-bold">
                    {cargo.trackingCode}
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-xs text-slate-200 mb-1">Durum</p>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border ${statusColors[cargo.status]}`}
                  >
                    {statusLabels[cargo.status]}
                  </span>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-xs text-slate-200 mb-1">Teslim Noktası</p>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-rounded text-emerald-500 text-lg">
                      location_on
                    </span>
                    <p className="text-white">
                      {cargo.originStation?.name || "-"}
                    </p>
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-xs text-slate-200 mb-1">Ağırlık</p>
                  <p className="text-white font-semibold">
                    {Number(cargo.weightKg).toFixed(1)} kg
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-xs text-slate-200 mb-1">Planlanan Tarih</p>
                  <p className="text-white">
                    {cargo.scheduledDate
                      ? new Date(cargo.scheduledDate).toLocaleDateString(
                          "tr-TR"
                        )
                      : "-"}
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-xs text-slate-200 mb-1">Oluşturulma</p>
                  <p className="text-white">
                    {new Date(cargo.createdAt).toLocaleDateString("tr-TR")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Route Map Card */}
          <div className="glass-dark rounded-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-700/50">
              <h2 className="text-lg font-bold text-white">Araç Rotası</h2>
            </div>

            <div className="flex-1 p-6">
              {routeLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
                </div>
              ) : route ? (
                <div className="h-full flex flex-col gap-4">
                  {/* Route Info */}
                  <div className="flex items-center gap-6 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-rounded text-emerald-500">
                        local_shipping
                      </span>
                      <span className="text-sm text-white">
                        Araç:{" "}
                        <span className="font-semibold text-white">
                          {route.vehicleName}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-rounded text-emerald-500">
                        straighten
                      </span>
                      <span className="text-sm text-white">
                        Mesafe:{" "}
                        <span className="font-semibold text-white">
                          {route.totalDistanceKm?.toFixed(1)} km
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Map */}
                  <div className="flex-1 rounded-xl overflow-hidden">
                    <Map
                      stations={mapStations}
                      routes={mapRoutes}
                      height="100%"
                    />
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                    <span className="material-symbols-rounded text-3xl text-slate-200">
                      {cargo.status === "pending"
                        ? "schedule"
                        : cargo.status === "delivered"
                          ? "check_circle"
                          : "info"}
                    </span>
                  </div>
                  <p className="text-slate-200">
                    {cargo.status === "pending"
                      ? "Kargonuz henüz bir araca atanmadı."
                      : cargo.status === "delivered"
                        ? "Kargonuz başarıyla teslim edildi."
                        : "Rota bilgisi bulunamadı."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && !cargo && (
        <div className="flex-1 glass-dark rounded-2xl flex flex-col items-center justify-center text-center p-8">
          <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
            <span className="material-symbols-rounded text-4xl text-slate-200">
              package_2
            </span>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Kargo Takip</h3>
          <p className="text-slate-200 max-w-md">
            Yukarıdaki arama kutusuna kargo ID veya takip kodunu girerek
            kargonuzun durumunu sorgulayabilirsiniz.
          </p>
        </div>
      )}
    </div>
  );
}

export default function TrackCargoPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      }
    >
      <TrackCargoContent />
    </Suspense>
  );
}
