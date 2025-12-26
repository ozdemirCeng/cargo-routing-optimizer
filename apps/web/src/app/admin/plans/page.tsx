"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { plansApi, stationsApi, vehiclesApi } from "@/lib/api";
import dynamic from "next/dynamic";
import VehicleCard from "@/components/VehicleCard";

const RouteMap = dynamic(() => import("@/components/RouteMap"), { ssr: false });

const ROUTE_COLORS = [
  "#135bec",
  "#f97316",
  "#22c55e",
  "#a855f7",
  "#06b6d4",
  "#ec4899",
];

interface PlanRoute {
  id: string;
  vehicleId: string;
  vehicle?: {
    name: string;
    plateNumber: string;
    capacityKg: number;
  };
  routePolyline?: string;
  cargoCount: number;
  totalWeightKg: number;
  totalDistanceKm: number;
  totalCost: number;
  routeDetails?: {
    station_id: string;
    station_name: string;
    station_code: string;
    latitude: number;
    longitude: number;
    is_hub: boolean;
  }[];
}

interface Plan {
  id: string;
  planDate: string;
  problemType: string;
  status: string;
  vehiclesUsed: number;
  vehiclesRented: number;
  totalCargos: number;
  totalDistanceKm: number;
  totalCost: number;
  routes?: PlanRoute[];
}

export default function PlansPage() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [problemType, setProblemType] = useState("unlimited_vehicles");

  // Keep a default selected route so stop order is always visible on the map.
  useEffect(() => {
    const firstRouteId = selectedPlan?.routes?.[0]?.id || null;
    setSelectedRouteId(firstRouteId);
    setHoveredRouteId(firstRouteId);
  }, [selectedPlan?.id]);

  // Queries
  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: () =>
      plansApi
        .getAll()
        .then((r) => (Array.isArray(r.data) ? r.data : Array.isArray((r.data as any)?.data) ? (r.data as any).data : [])),
  });

  const { data: stationSummary } = useQuery({
    queryKey: ["station-summary", selectedDate],
    queryFn: () =>
      stationsApi
        .getSummary(selectedDate)
        .then((r) => (Array.isArray(r.data) ? r.data : Array.isArray((r.data as any)?.data) ? (r.data as any).data : [])),
  });

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () =>
      vehiclesApi
        .getAll()
        .then((r) => (Array.isArray(r.data) ? r.data : Array.isArray((r.data as any)?.data) ? (r.data as any).data : [])),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: plansApi.create,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      setSelectedPlan(response.data);
    },
  });

  const activateMutation = useMutation({
    mutationFn: plansApi.activate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: plansApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      setSelectedPlan(null);
    },
    onError: (error: any) => {
      alert(
        error?.response?.data?.message ||
          "Plan silinirken hata oluştu (aktif sefer olabilir)"
      );
    },
  });

  // Find plan for selected date
  const todayPlan = useMemo(() => {
    return plans?.find((p: Plan) => p.planDate.split("T")[0] === selectedDate);
  }, [plans, selectedDate]);

  // Map data
  const mapStations = useMemo(() => {
    if (!selectedPlan?.routes) return [];

    const stationMap = new Map();
    selectedPlan.routes.forEach((route) => {
      route.routeDetails?.forEach((stop) => {
        if (!stationMap.has(stop.station_id)) {
          stationMap.set(stop.station_id, {
            id: stop.station_id,
            name: stop.station_name,
            code: stop.station_code,
            latitude: stop.latitude,
            longitude: stop.longitude,
            isHub: stop.is_hub,
          });
        }
      });
    });
    return Array.from(stationMap.values());
  }, [selectedPlan]);

  const mapRoutes = useMemo(() => {
    if (!selectedPlan?.routes) return [];

    return selectedPlan.routes.map((route, idx) => ({
      id: route.id,
      vehicleId: route.vehicleId,
      vehicleName: route.vehicle?.name || `Araç ${idx + 1}`,
      plateNumber: route.vehicle?.plateNumber,
      color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
      polyline: route.routePolyline,
      status: route.cargoCount > 0 ? ("active" as const) : ("idle" as const),
      loadPercentage: route.vehicle?.capacityKg
        ? Math.round((route.totalWeightKg / route.vehicle.capacityKg) * 100)
        : 0,
      cost: route.totalCost,
      stops:
        route.routeDetails?.map((s, order) => ({
          order,
          stationId: s.station_id,
          label: s.station_code || s.station_name,
          latitude: s.latitude,
          longitude: s.longitude,
          isHub: s.is_hub,
        })) || [],
      stations:
        route.routeDetails?.map((s) => ({
          name: s.station_name,
          code: s.station_code,
        })) || [],
    }));
  }, [selectedPlan]);

  // Vehicle cards data
  const vehicleCards = useMemo(() => {
    if (!selectedPlan?.routes) return [];

    return selectedPlan.routes.map((route, idx) => {
      const loadPercentage = route.vehicle?.capacityKg
        ? Math.round((route.totalWeightKg / route.vehicle.capacityKg) * 100)
        : 0;

      const firstStation = route.routeDetails?.[0]?.station_name || "";
      const lastStation =
        route.routeDetails?.[route.routeDetails.length - 1]?.station_name || "";

      return {
        id: route.id,
        name: route.vehicle?.name || `Araç ${idx + 1}`,
        plateNumber: route.vehicle?.plateNumber || "N/A",
        status:
          loadPercentage > 80
            ? ("active" as const)
            : loadPercentage < 50
              ? ("warning" as const)
              : ("active" as const),
        route:
          firstStation && lastStation
            ? { from: firstStation, to: lastStation }
            : undefined,
        cost: Number(route.totalCost) || 0,
        loadPercentage,
        color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
      };
    });
  }, [selectedPlan]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalCargos =
      stationSummary?.reduce((sum: number, s: any) => sum + s.cargoCount, 0) ||
      0;
    const totalWeight =
      stationSummary?.reduce(
        (sum: number, s: any) => sum + s.totalWeightKg,
        0
      ) || 0;
    const activeStations =
      stationSummary?.filter((s: any) => s.cargoCount > 0).length || 0;

    return { totalCargos, totalWeight, activeStations };
  }, [stationSummary]);

  const handleStartPlanning = () => {
    createMutation.mutate({
      planDate: selectedDate,
      problemType,
    });
  };

  const getStatusInfo = () => {
    if (createMutation.isPending) {
      return {
        color: "text-yellow-400",
        bg: "bg-yellow-400",
        label: "Optimizing...",
      };
    }
    if (todayPlan?.status === "active") {
      return {
        color: "text-emerald-400",
        bg: "bg-emerald-500",
        label: "Active Plan",
      };
    }
    if (todayPlan?.status === "draft") {
      return {
        color: "text-blue-400",
        bg: "bg-blue-500",
        label: "Draft Ready",
      };
    }
    if (stats.totalCargos > 0) {
      return {
        color: "text-emerald-400",
        bg: "bg-emerald-500",
        label: "Ready to Optimize",
      };
    }
    return { color: "text-slate-400", bg: "bg-slate-500", label: "No Cargo" };
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="fixed inset-0 bg-background-dark text-white overflow-hidden">
      {/* Background Map */}
      <RouteMap
        stations={mapStations}
        routes={mapRoutes}
        onRouteHover={(id) => {
          if (!id) {
            setHoveredRouteId(null);
            return;
          }
          setHoveredRouteId(id);
          setSelectedRouteId(id);
        }}
        selectedRouteId={selectedRouteId}
      />

      {/* Top Control Bar */}
      <header className="absolute top-6 left-0 right-0 z-30 flex justify-center pointer-events-none px-6">
        <div className="pointer-events-auto flex items-center gap-1 p-1.5 bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl">
          {/* Date Picker */}
          <div className="flex items-center gap-3 px-4 py-2 hover:bg-white/5 rounded-xl transition-colors text-sm font-medium border-r border-white/5">
            <span className="material-symbols-rounded text-slate-400 text-[20px]">
              calendar_month
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-white focus:outline-none cursor-pointer"
            />
          </div>

          {/* Problem Type Select */}
          <div className="flex items-center gap-2 px-4 py-2 border-r border-white/5">
            <span className="material-symbols-rounded text-slate-400 text-[20px]">
              tune
            </span>
            <select
              value={problemType}
              onChange={(e) => setProblemType(e.target.value)}
              className="bg-transparent border-none text-sm text-white focus:outline-none cursor-pointer"
            >
              <option value="unlimited_vehicles" className="bg-slate-800">
                Sınırsız Araç
              </option>
              <option value="limited_vehicles" className="bg-slate-800">
                Belirli Araç
              </option>
            </select>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2 px-4 py-2 border-r border-white/5">
            <div className="relative flex h-3 w-3">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusInfo.bg} opacity-75`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${statusInfo.bg}`}
              ></span>
            </div>
            <span
              className={`text-xs font-semibold tracking-wide ${statusInfo.color} uppercase`}
            >
              {statusInfo.label}
            </span>
          </div>

          {/* Cargo Summary */}
          <div className="flex items-center gap-4 px-4 py-2 border-r border-white/5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-rounded text-slate-400 text-[18px]">
                inventory_2
              </span>
              <span className="text-white font-bold">{stats.totalCargos}</span>
              <span className="text-slate-400">kargo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-rounded text-slate-400 text-[18px]">
                scale
              </span>
              <span className="text-white font-bold">
                {stats.totalWeight.toFixed(0)}
              </span>
              <span className="text-slate-400">kg</span>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleStartPlanning}
            disabled={createMutation.isPending || stats.totalCargos === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-blue-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-blue-600/20 transition-all active:scale-95 ml-2"
          >
            {createMutation.isPending ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Optimizing...
              </>
            ) : (
              <>
                <span className="material-symbols-rounded text-[20px]">
                  play_arrow
                </span>
                Planlamayı Başlat
              </>
            )}
          </button>
        </div>
      </header>

      {/* Stats Panel (Top Right) */}
      {selectedPlan && (
        <div className="absolute top-6 right-6 z-30 w-80 bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Plan Özeti</h3>
            <button
              onClick={() => setSelectedPlan(null)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <span className="material-symbols-rounded text-[20px]">
                close
              </span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-1">Toplam Maliyet</p>
              <p className="text-xl font-bold text-primary">
                ₺{Number(selectedPlan.totalCost).toFixed(0)}
              </p>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-1">Toplam Mesafe</p>
              <p className="text-xl font-bold">
                {Number(selectedPlan.totalDistanceKm).toFixed(1)}{" "}
                <span className="text-sm text-slate-400">km</span>
              </p>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-1">Araç Sayısı</p>
              <p className="text-xl font-bold">{selectedPlan.vehiclesUsed}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-1">Kiralanan</p>
              <p className="text-xl font-bold text-orange-400">
                {selectedPlan.vehiclesRented}
              </p>
            </div>
          </div>

          {selectedPlan.status === "draft" && (
            <button
              onClick={() => activateMutation.mutate(selectedPlan.id)}
              disabled={activateMutation.isPending}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm transition-all"
            >
              <span className="material-symbols-rounded">check_circle</span>
              Planı Aktifleştir
            </button>
          )}
        </div>
      )}

      {/* Previous Plans List (Top Left) */}
      {plans && plans.length > 0 && !selectedPlan && (
        <div className="absolute top-24 left-6 bottom-[calc(1.5rem+320px+1.5rem)] z-40 w-72 bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
          <div className="px-4 py-3 border-b border-white/5 bg-white/5">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <span className="material-symbols-rounded text-[18px]">
                history
              </span>
              Geçmiş Planlar
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto glass-scroll">
            {plans.map((plan: Plan) => (
              <div
                key={plan.id}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0 group"
              >
                <button
                  onClick={() => setSelectedPlan(plan)}
                  className="flex items-center gap-3 flex-1"
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      plan.status === "active"
                        ? "bg-emerald-500"
                        : plan.status === "draft"
                          ? "bg-blue-500"
                          : plan.status === "completed"
                            ? "bg-slate-500"
                            : "bg-red-500"
                    }`}
                  />
                  <div className="text-left">
                    <p className="text-sm font-medium">
                      {new Date(plan.planDate).toLocaleDateString("tr-TR")}
                    </p>
                    <p className="text-xs text-slate-400">
                      {plan.vehiclesUsed} araç • {plan.totalCargos} kargo
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">
                    ₺{Number(plan.totalCost).toFixed(0)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        confirm("Bu planı silmek istediğinize emin misiniz?")
                      ) {
                        deleteMutation.mutate(plan.id);
                      }
                    }}
                    className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="Planı Sil"
                  >
                    <span className="material-symbols-rounded text-[18px]">
                      delete
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mission Control Panel (Bottom) */}
      <section className="absolute bottom-6 left-6 right-6 h-[320px] z-30 flex flex-col bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Panel Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-3">
            <span className="material-symbols-rounded text-primary">
              list_alt
            </span>
            <h3 className="text-lg font-bold tracking-tight">
              Planlanan Seferler
            </h3>
            <span className="bg-white/10 text-xs px-2 py-0.5 rounded-full text-slate-300">
              {vehicleCards.length} Aktif
            </span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden glass-scroll px-6 py-5 flex items-center gap-4">
          {vehicleCards.length > 0 ? (
            <>
              {vehicleCards.map((card) => (
                <VehicleCard
                  key={card.id}
                  vehicle={card}
                  color={card.color}
                  isSelected={selectedRouteId === card.id}
                  onHover={(hovered) =>
                    hovered ? setSelectedRouteId(card.id) : undefined
                  }
                />
              ))}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 border border-white/10">
                <span className="material-symbols-rounded text-slate-500 text-3xl">
                  route
                </span>
              </div>
              <h4 className="text-lg font-medium text-slate-300 mb-2">
                Henüz plan oluşturulmadı
              </h4>
              <p className="text-sm text-slate-500 max-w-md">
                Yukarıdaki tarih seçiciden bir tarih seçin ve &quot;Planlamayı
                Başlat&quot; butonuna tıklayarak optimizasyon sürecini başlatın.
              </p>
            </div>
          )}
          {/* Spacer for scroll padding */}
          <div className="min-w-[1px] h-full flex-shrink-0"></div>
        </div>
      </section>

      {/* Loading Overlay */}
      {plansLoading && (
        <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-slate-400">Planlar yükleniyor...</p>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {createMutation.isError && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 backdrop-blur-sm text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3">
          <span className="material-symbols-rounded">error</span>
          <span>
            {(createMutation.error as any)?.response?.data?.message ||
              "Plan oluşturulurken hata oluştu"}
          </span>
          <button
            onClick={() => createMutation.reset()}
            className="ml-2 p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <span className="material-symbols-rounded text-[18px]">close</span>
          </button>
        </div>
      )}
    </div>
  );
}
