"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tripsApi, vehiclesApi } from "@/lib/api";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

const VEHICLE_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f97316", "#8b5cf6"];

interface Trip {
  id: string;
  vehicleId: string;
  vehicle?: {
    id: string;
    plateNumber: string;
    name: string;
  };
  planId?: string;
  planRoute?: {
    id: string;
    cargoCount: number;
    totalDistanceKm: number;
    totalCost: number;
    totalWeightKg: number;
    routeOrder: number;
    plan?: {
      id: string;
      planDate: string;
    };
  };
  status: string;
  startedAt?: string;
  endedAt?: string;
  totalDistanceKm?: number;
  totalLoadKg?: number;
  polyline?: string;
  waypoints?: Waypoint[];
  createdAt: string;
}

interface Waypoint {
  id: string;
  sequenceOrder: number;
  station?: {
    id: string;
    name: string;
    code?: string;
    latitude: number;
    longitude: number;
    isHub: boolean;
  };
}

interface Vehicle {
  id: string;
  plateNumber: string;
  name: string;
}

export default function TripsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    vehicleId: "",
    status: "",
    date: "",
  });
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [cargoModalTrip, setCargoModalTrip] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () =>
      vehiclesApi
        .getAll()
        .then((r) =>
          Array.isArray(r.data)
            ? r.data
            : Array.isArray((r.data as any)?.data)
              ? (r.data as any).data
              : []
        ),
  });

  // date filtresini planDate'e çevir
  const apiFilters = useMemo(() => {
    const { date, ...rest } = filters;
    if (date) {
      return {
        ...rest,
        planDate: date,
      };
    }
    return rest;
  }, [filters]);

  const {
    data: trips,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["trips", apiFilters],
    queryFn: () =>
      tripsApi
        .getAll(apiFilters)
        .then((r) =>
          Array.isArray(r.data)
            ? r.data
            : Array.isArray((r.data as any)?.data)
              ? (r.data as any).data
              : []
        ),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      tripsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
  });

  // Trip detayı için query (kargo bilgileri dahil)
  const { data: tripDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ["tripDetail", cargoModalTrip],
    queryFn: () => tripsApi.getById(cargoModalTrip!).then((r) => r.data),
    enabled: !!cargoModalTrip,
  });

  // Harita için trip detayı (polyline ve duraklar dahil)
  const { data: selectedTripDetail } = useQuery({
    queryKey: ["tripDetailMap", selectedTripId],
    queryFn: () => tripsApi.getById(selectedTripId!).then((r) => r.data),
    enabled: !!selectedTripId,
  });

  // Statistics
  const stats = useMemo(() => {
    if (!trips) return { active: 0, completed: 0, pending: 0 };
    const active = trips.filter((t: Trip) => t.status === "in_progress").length;
    const completed = trips.filter(
      (t: Trip) => t.status === "completed"
    ).length;
    const pending = trips.filter(
      (t: Trip) => t.status === "scheduled" || t.status === "pending"
    ).length;
    return { active, completed, pending };
  }, [trips]);

  // Pagination
  const paginatedTrips = useMemo(() => {
    if (!trips) return [];
    const start = (currentPage - 1) * rowsPerPage;
    return trips.slice(start, start + rowsPerPage);
  }, [trips, currentPage]);

  const totalPages = Math.ceil((trips?.length || 0) / rowsPerPage);

  const statusLabels: Record<string, string> = {
    pending: "Bekliyor",
    in_progress: "Yolda",
    completed: "Tamamlandı",
    cancelled: "İptal",
  };

  const statusStyles: Record<string, string> = {
    pending: "neon-badge-orange",
    in_progress: "neon-badge-blue",
    completed: "neon-badge-green",
    cancelled: "neon-badge-red",
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Map data - API'den gelen trip detayından polyline ve durakları al
  const mapStations = useMemo(() => {
    if (!selectedTripDetail?.planRoute?.routeDetails) return [];
    const details = selectedTripDetail.planRoute.routeDetails as any[];
    return details.map((s: any) => ({
      id: s.station_id || "",
      name: s.station_name || "",
      code: s.station_code || "",
      latitude: Number(s.latitude),
      longitude: Number(s.longitude),
      isHub: s.is_hub || false,
    }));
  }, [selectedTripDetail]);

  const mapRoutes = useMemo(() => {
    if (!selectedTripDetail?.planRoute?.routePolyline) return [];
    return [
      {
        vehicleId: selectedTripDetail.vehicleId,
        vehicleName: selectedTripDetail.vehicle?.plateNumber || "",
        color: VEHICLE_COLORS[0],
        polyline: selectedTripDetail.planRoute.routePolyline,
        stations: mapStations,
      },
    ];
  }, [selectedTripDetail, mapStations]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          <span className="text-slate-400 text-sm">Seferler yükleniyor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-auto p-1">
      {/* Header with Stats */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        {/* Decorative blur */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

        <div className="flex items-center gap-4 z-10">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            <span className="material-symbols-rounded text-[28px]">
              local_shipping
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Sefer Takip
            </h1>
            <p className="text-slate-400 text-sm">Operasyonel İzleme Paneli</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="flex flex-wrap gap-4 w-full md:w-auto z-10">
          <div className="glass-card rounded-xl p-3 pl-4 pr-6 flex items-center gap-3 min-w-[140px] hover:bg-slate-800/60 transition-colors cursor-default">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
              <span className="material-symbols-rounded text-[20px]">
                moving
              </span>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Aktif
              </div>
              <div className="text-xl font-bold text-white">{stats.active}</div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-3 pl-4 pr-6 flex items-center gap-3 min-w-[140px] hover:bg-slate-800/60 transition-colors cursor-default">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400">
              <span className="material-symbols-rounded text-[20px]">
                done_all
              </span>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Biten
              </div>
              <div className="text-xl font-bold text-white">
                {stats.completed}
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-3 pl-4 pr-6 flex items-center gap-3 min-w-[140px] hover:bg-slate-800/60 transition-colors cursor-default">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400">
              <span className="material-symbols-rounded text-[20px]">
                schedule
              </span>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Bekliyor
              </div>
              <div className="text-xl font-bold text-white">
                {stats.pending}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto flex-1">
          {/* Vehicle Filter */}
          <div className="relative group w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
              <span className="material-symbols-rounded text-[20px]">
                directions_car
              </span>
            </div>
            <select
              className="glass-input block w-full pl-10 pr-10 py-2.5 rounded-lg appearance-none cursor-pointer"
              value={filters.vehicleId}
              onChange={(e) => {
                setFilters({ ...filters, vehicleId: e.target.value });
                setCurrentPage(1);
              }}
            >
              <option value="" className="bg-slate-800">
                Tüm Araçlar
              </option>
              {((vehicles as Vehicle[]) || []).map((v) => (
                <option key={v.id} value={v.id} className="bg-slate-800">
                  {v.plateNumber}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
              <span className="material-symbols-rounded text-[20px]">
                expand_more
              </span>
            </div>
          </div>

          {/* Status Filter */}
          <div className="relative group w-full md:w-48">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
              <span className="material-symbols-rounded text-[20px]">
                filter_list
              </span>
            </div>
            <select
              className="glass-input block w-full pl-10 pr-10 py-2.5 rounded-lg appearance-none cursor-pointer"
              value={filters.status}
              onChange={(e) => {
                setFilters({ ...filters, status: e.target.value });
                setCurrentPage(1);
              }}
            >
              <option value="" className="bg-slate-800">
                Durum Seçiniz
              </option>
              <option value="pending" className="bg-slate-800">
                Bekliyor
              </option>
              <option value="in_progress" className="bg-slate-800">
                Yolda
              </option>
              <option value="completed" className="bg-slate-800">
                Tamamlandı
              </option>
              <option value="cancelled" className="bg-slate-800">
                İptal
              </option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
              <span className="material-symbols-rounded text-[20px]">
                expand_more
              </span>
            </div>
          </div>

          {/* Date Filter */}
          <div className="relative group w-full md:w-48">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
              <span className="material-symbols-rounded text-[20px]">
                calendar_today
              </span>
            </div>
            <input
              type="date"
              className="glass-input block w-full pl-10 pr-3 py-2.5 rounded-lg appearance-none [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              value={filters.date}
              onChange={(e) => {
                setFilters({ ...filters, date: e.target.value });
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Reset Filters Button */}
        <button
          onClick={() => {
            setFilters({ vehicleId: "", status: "", date: "" });
            setCurrentPage(1);
          }}
          className="w-full md:w-auto h-10 px-4 flex items-center justify-center gap-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-95"
          title="Filtreleri Sıfırla"
        >
          <span className="material-symbols-rounded">refresh</span>
          <span className="md:hidden">Sıfırla</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex gap-6 flex-1 min-h-[500px]">
        {/* Table */}
        <div
          className={`glass-panel rounded-2xl overflow-hidden flex flex-col ${selectedTrip ? "flex-1" : "w-full"}`}
        >
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-slate-800/30">
                  <th className="p-4 pl-6 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                    ID
                  </th>
                  <th className="p-4 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                    Araç Bilgisi
                  </th>
                  <th className="p-4 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                    Başlangıç
                  </th>
                  <th className="p-4 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                    Durum
                  </th>
                  <th className="p-4 pr-6 text-xs font-semibold tracking-wider text-slate-400 uppercase text-right">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-white/5">
                {paginatedTrips.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center py-12 text-slate-400"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="material-symbols-rounded text-[48px] opacity-50">
                          local_shipping
                        </span>
                        <span>Sefer bulunamadı</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedTrips.map((trip: Trip) => {
                    const firstStation =
                      trip.waypoints?.[0]?.station?.name || "-";
                    const lastStation =
                      trip.waypoints?.[trip.waypoints.length - 1]?.station
                        ?.name || "-";

                    return (
                      <tr
                        key={trip.id}
                        className="table-row-hover group transition-colors duration-200 cursor-pointer"
                        onClick={() => {
                          setSelectedTrip(trip);
                          setSelectedTripId(trip.id);
                        }}
                      >
                        <td className="p-4 pl-6 font-mono text-slate-500">
                          #TR-{trip.id.slice(-4).toUpperCase()}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-white">
                              {trip.vehicle?.plateNumber || "-"}
                            </span>
                            <span className="text-xs text-slate-400">
                              {trip.vehicle?.name || "-"}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-400">
                          {formatDate(
                            trip.planRoute?.plan?.planDate ||
                              trip.startedAt ||
                              trip.createdAt
                          )}
                        </td>
                        <td className="p-4">
                          <span
                            className={`${statusStyles[trip.status] || "neon-badge-blue"} px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5`}
                          >
                            {trip.status === "in_progress" && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                            )}
                            {statusLabels[trip.status] || trip.status}
                          </span>
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <div
                            className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setSelectedTrip(trip);
                                setSelectedTripId(trip.id);
                              }}
                              className="p-2 rounded-lg hover:bg-primary/20 hover:text-primary text-slate-400 transition-colors"
                              title="Harita"
                            >
                              <span className="material-symbols-rounded text-[20px]">
                                map
                              </span>
                            </button>
                            <button
                              onClick={() => setCargoModalTrip(trip.id)}
                              className="p-2 rounded-lg hover:bg-amber-500/20 hover:text-amber-400 text-slate-400 transition-colors"
                              title="Kargo Detayları"
                            >
                              <span className="material-symbols-rounded text-[20px]">
                                inventory_2
                              </span>
                            </button>
                            {trip.status === "pending" && (
                              <button
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    id: trip.id,
                                    status: "in_progress",
                                  })
                                }
                                className="p-2 rounded-lg hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition-colors"
                                title="Başlat"
                              >
                                <span className="material-symbols-rounded text-[20px]">
                                  play_arrow
                                </span>
                              </button>
                            )}
                            {trip.status === "in_progress" && (
                              <button
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    id: trip.id,
                                    status: "completed",
                                  })
                                }
                                className="p-2 rounded-lg hover:bg-green-500/20 text-slate-400 hover:text-green-400 transition-colors"
                                title="Bitir"
                              >
                                <span className="material-symbols-rounded text-[20px]">
                                  check_circle
                                </span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-white/10 bg-slate-800/20 flex items-center justify-between text-xs text-slate-400 mt-auto">
            <div>
              Toplam {trips?.length || 0} kayıttan{" "}
              {trips && trips.length > 0
                ? (currentPage - 1) * rowsPerPage + 1
                : 0}
              -{Math.min(currentPage * rowsPerPage, trips?.length || 0)} arası
              gösteriliyor
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-rounded text-[18px]">
                  chevron_left
                </span>
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                      currentPage === pageNum
                        ? "bg-primary/20 text-primary border border-primary/30 font-semibold"
                        : "hover:bg-white/5"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages || totalPages === 0}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-rounded text-[18px]">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Cargo Detail Modal */}
        {cargoModalTrip && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setCargoModalTrip(null)}
          >
            <div
              className="glass-panel rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                    <span className="material-symbols-rounded">
                      inventory_2
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Kargo Detayları</h3>
                    <p className="text-xs text-slate-400">
                      {tripDetail?.vehicle?.plateNumber || "Yükleniyor..."} -{" "}
                      {tripDetail?.vehicle?.name || ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCargoModalTrip(null)}
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                >
                  <span className="material-symbols-rounded">close</span>
                </button>
              </div>

              <div className="p-4 overflow-auto flex-1">
                {isLoadingDetail ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                  </div>
                ) : tripDetail?.planRoute?.cargos &&
                  tripDetail.planRoute.cargos.length > 0 ? (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="glass-card rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-white">
                          {tripDetail.planRoute.cargos.length}
                        </div>
                        <div className="text-xs text-slate-400">
                          Toplam Kargo
                        </div>
                      </div>
                      <div className="glass-card rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-white">
                          {Number(
                            tripDetail.planRoute.totalWeightKg || 0
                          ).toFixed(1)}{" "}
                          kg
                        </div>
                        <div className="text-xs text-slate-400">
                          Toplam Ağırlık
                        </div>
                      </div>
                      <div className="glass-card rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-emerald-400">
                          {Number(tripDetail.planRoute.totalCost || 0).toFixed(
                            2
                          )}{" "}
                          ₺
                        </div>
                        <div className="text-xs text-slate-400">
                          Rota Maliyeti
                        </div>
                      </div>
                    </div>

                    {/* Cargo List */}
                    <div className="space-y-2">
                      <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">
                        Kargolar ve Kullanıcılar
                      </div>
                      {tripDetail.planRoute.cargos.map(
                        (prc: any, index: number) => (
                          <div
                            key={prc.id || index}
                            className="glass-card rounded-xl p-3 flex items-center gap-4 hover:bg-slate-800/60 transition-colors"
                          >
                            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white truncate">
                                  {prc.cargo?.user?.fullName || "Bilinmiyor"}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                                  #
                                  {prc.cargo?.id?.slice(-6).toUpperCase() ||
                                    "-"}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-rounded text-[14px]">
                                    scale
                                  </span>
                                  {prc.cargo?.weightKg || 0} kg
                                </span>
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-rounded text-[14px]">
                                    location_on
                                  </span>
                                  {prc.cargo?.originStation?.name || "-"}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-emerald-400">
                                {(
                                  Number(prc.cargo?.weightKg || 0) * 0.5
                                ).toFixed(2)}{" "}
                                ₺
                              </div>
                              <div className="text-xs text-slate-500">
                                tahmini
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <span className="material-symbols-rounded text-[48px] opacity-50 mb-2">
                      inventory_2
                    </span>
                    <span>Bu seferde kargo bulunamadı</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Map Panel */}
        {selectedTrip && (
          <div className="glass-panel rounded-2xl overflow-hidden flex flex-col w-[500px] shrink-0">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white">
                  Sefer #{selectedTrip.id.slice(-4).toUpperCase()}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedTrip.vehicle?.plateNumber}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedTrip(null);
                  setSelectedTripId(null);
                }}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            {/* Waypoints - API'den gelen routeDetails kullan */}
            {selectedTripDetail?.planRoute?.routeDetails &&
              (selectedTripDetail.planRoute.routeDetails as any[]).length >
                0 && (
                <div className="p-4 border-b border-white/10">
                  <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">
                    Duraklar (
                    {
                      (selectedTripDetail.planRoute.routeDetails as any[])
                        .length
                    }{" "}
                    durak)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(selectedTripDetail.planRoute.routeDetails as any[]).map(
                      (stop: any, i: number) => (
                        <span
                          key={stop.station_id || i}
                          className={`px-2 py-1 rounded-lg text-xs border ${stop.is_hub ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-slate-800/50 text-slate-300 border-white/5"}`}
                        >
                          {i + 1}. {stop.station_name}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

            {/* Map */}
            <div className="flex-1 min-h-[400px]">
              <Map stations={mapStations} routes={mapRoutes} height="100%" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
