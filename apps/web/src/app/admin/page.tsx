"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi, stationsApi, tripsApi } from "@/lib/api";
import Link from "next/link";

// KPI Card Component
function KPICard({
  title,
  value,
  unit,
  icon,
  iconBg,
  iconColor,
  change,
  changeType,
  changeLabel,
  progress,
  progressLabel,
  extra,
}: {
  title: string;
  value: string | number;
  unit?: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  change?: number;
  changeType?: "up" | "down";
  changeLabel?: string;
  progress?: number;
  progressLabel?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="glass-panel p-6 rounded-xl flex flex-col justify-between h-[160px] group hover:border-primary/30 transition-all duration-300">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-300 text-sm font-semibold mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-white tracking-tight">
            {value}
            {unit && (
              <span className="text-lg text-slate-500 font-normal ml-1">
                {unit}
              </span>
            )}
          </h3>
        </div>
        <div className={`p-2 ${iconBg} rounded-lg`}>
          <span className={`material-symbols-rounded ${iconColor}`}>
            {icon}
          </span>
        </div>
      </div>

      {change !== undefined && (
        <div className="flex items-center gap-2 mt-4">
          <span
            className={`flex items-center text-xs font-bold px-2 py-1 rounded ${
              changeType === "down"
                ? "text-emerald-400 bg-emerald-500/10"
                : "text-emerald-400 bg-emerald-500/10"
            }`}
          >
            <span className="material-symbols-rounded text-[14px] mr-1">
              {changeType === "down" ? "arrow_downward" : "arrow_upward"}
            </span>
            {change}%
          </span>
          <span className="text-slate-400 text-xs">{changeLabel}</span>
        </div>
      )}

      {progress !== undefined && (
        <div className="mt-4">
          <div className="w-full bg-slate-700/50 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-right text-xs text-slate-400 mt-1">
            {progressLabel}
          </p>
        </div>
      )}

      {extra}
    </div>
  );
}

// Bar Chart Component
function BarChart({
  data,
}: {
  data: {
    label: string;
    sublabel: string;
    value: number;
  }[];
}) {
  const maxValue = Math.max(...data.map((d) => d.value));

  return (
    <div className="flex-1 flex items-end justify-center gap-8 md:gap-16 px-4 md:px-12 pb-4 relative">
      {/* Grid Lines */}
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-10 opacity-20 z-0">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={`border-t ${i === 4 ? "border-slate-500" : "border-dashed border-slate-400"} w-full h-0`}
          />
        ))}
      </div>

      {data.map((item, idx) => (
        <div
          key={idx}
          className="relative group w-16 md:w-24 flex flex-col justify-end h-full z-10"
        >
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap bg-slate-900/95 border border-primary/40 opacity-0 group-hover:opacity-100 transition-all duration-200 font-medium backdrop-blur-sm">
            ₺{item.value.toLocaleString("tr-TR")}
          </div>
          <div
            className="w-full rounded-lg relative overflow-hidden transition-all duration-300 cursor-pointer bg-gradient-to-t from-blue-600 to-blue-500 group-hover:from-blue-500 group-hover:to-blue-400 group-hover:scale-105 group-hover:-translate-y-1"
            style={{ height: `${(item.value / maxValue) * 100}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-white/10" />
            <div className="absolute inset-x-0 top-0 h-px bg-white/40" />
            <div className="absolute inset-y-0 left-0 w-px bg-white/20" />
            <div className="absolute inset-y-0 right-0 w-px bg-black/20" />
          </div>
          <div className="mt-4 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-400 group-hover:text-blue-300 transition-colors">
              {item.label}
            </p>
            <p className="text-[10px] mt-1 text-slate-500 group-hover:text-slate-400 transition-colors">
              {item.sublabel}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Donut Chart Component
function DonutChart({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: { value: number; color: string; label: string }[];
  centerValue: string;
  centerLabel: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  let currentOffset = 0;
  const circumference = 2 * Math.PI * 40; // radius = 40

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative">
      <div className="relative h-56 w-56">
        <svg
          className="transform -rotate-90 w-full h-full"
          viewBox="0 0 100 100"
        >
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="transparent"
            stroke="#1e293b"
            strokeWidth="12"
          />
          {segments.map((segment, idx) => {
            const dashLength = (segment.value / total) * circumference;
            const offset = currentOffset;
            currentOffset += dashLength;
            return (
              <circle
                key={idx}
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke={segment.color}
                strokeWidth="12"
                strokeDasharray={`${dashLength} ${circumference}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                className="hover:opacity-80 transition-opacity cursor-pointer"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-white">{centerValue}</span>
          <span className="text-[10px] uppercase text-slate-500 font-medium tracking-wide">
            {centerLabel}
          </span>
        </div>
      </div>

      <div className="w-full mt-8 flex justify-center gap-6">
        {segments.map((segment, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            <div>
              <p className="text-xs text-slate-400 font-medium">
                {segment.label}
              </p>
              <p className="text-xs font-bold text-white">%{segment.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    completed: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      label: "Tamamlandı",
    },
    in_progress: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      label: "Devam Ediyor",
    },
    scheduled: {
      bg: "bg-blue-500/10",
      text: "text-blue-400",
      label: "Planlandı",
    },
    pending: {
      bg: "bg-slate-500/10",
      text: "text-slate-400",
      label: "Bekliyor",
    },
  };
  const c = config[status] || config.pending;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text} border border-current/20`}
    >
      {c.label}
    </span>
  );
}

export default function AdminDashboard() {
  // Queries with retry and stale time
  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => dashboardApi.getSummary().then((r) => r.data),
    staleTime: 30000, // 30 seconds
    retry: 2,
  });

  const { data: trips } = useQuery({
    queryKey: ["recent-trips"],
    queryFn: () => tripsApi.getAll({ limit: 5 }).then((r) => r.data),
    staleTime: 30000,
    retry: 2,
  });

  const { data: costAnalysis } = useQuery({
    queryKey: ["cost-analysis"],
    queryFn: () => dashboardApi.getCostAnalysis().then((r) => r.data),
    staleTime: 30000,
    retry: 2,
  });

  // Calculate stats from real data
  const stats = useMemo(() => {
    const totalCost = summary?.totalCostToday || 0;
    const totalDistance = summary?.totalDistanceToday || 0;
    const vehiclesUsed = summary?.vehiclesUsed || 0;
    const totalVehicles = summary?.totalVehicles || 0;
    const avgLoad = summary?.avgLoadPercentage || 0;

    return { totalCost, totalDistance, vehiclesUsed, totalVehicles, avgLoad };
  }, [summary]);

  // Bar chart data from cost analysis - use real scenario data
  const barChartData = useMemo(() => {
    if (
      !costAnalysis ||
      !costAnalysis.vehicleCosts ||
      costAnalysis.vehicleCosts.length === 0
    ) {
      // Show message when no data
      return [
        {
          label: "Veri Yok",
          sublabel: "Plan oluşturun",
          value: 0,
          highlight: true,
        },
      ];
    }

    // Show vehicle costs from real data
    return costAnalysis.vehicleCosts.map((v: any, idx: number) => ({
      label: v.vehicleName || `Araç ${idx + 1}`,
      sublabel: v.plateNumber || "",
      value: v.totalCost || 0,
    }));
  }, [costAnalysis]);

  // Donut chart segments from real vehicle utilization data - only show used vehicles
  const donutSegments = useMemo(() => {
    const colors = ["#8b5cf6", "#06b6d4", "#ec4899", "#f59e0b", "#10b981"];

    if (summary?.vehicleUtilization && summary.vehicleUtilization.length > 0) {
      // Filter only used vehicles (utilization > 0)
      const usedVehicles = summary.vehicleUtilization.filter(
        (v: any) => v.isUsed && v.utilization > 0
      );

      if (usedVehicles.length > 0) {
        return usedVehicles.map((v: any, idx: number) => ({
          value: v.utilization || 1,
          color: colors[idx % colors.length],
          label: v.vehicleName || `Araç ${idx + 1}`,
        }));
      }
    }

    // Fallback when no data
    return [{ value: 1, color: "#8b5cf6", label: "Veri Yok" }];
  }, [summary]);

  // Show loading only on initial load, not on refetch
  if (summaryLoading && !summary) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-slate-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (summaryError && !summary) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <span className="material-symbols-rounded text-red-400 text-3xl">
              error
            </span>
          </div>
          <div>
            <p className="text-white font-medium mb-1">Veriler yüklenemedi</p>
            <p className="text-slate-400 text-sm">
              Lütfen sayfayı yenileyin veya daha sonra tekrar deneyin
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 overflow-y-auto h-full">
      <div className="max-w-[1600px] mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Analytics Dashboard
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-12 gap-6">
          {/* Row 1: KPI Cards */}
          <div className="col-span-1 md:col-span-1 lg:col-span-1 xl:col-span-3">
            <KPICard
              title="Toplam Maliyet"
              value={`₺${stats.totalCost.toLocaleString("tr-TR")}`}
              icon="trending_down"
              iconBg="bg-emerald-500/10"
              iconColor="text-emerald-400"
              change={12}
              changeType="down"
              changeLabel="geçen haftaya göre"
            />
          </div>

          <div className="col-span-1 md:col-span-1 lg:col-span-1 xl:col-span-3">
            <KPICard
              title="Toplam Mesafe"
              value={stats.totalDistance.toFixed(0)}
              unit="km"
              icon="route"
              iconBg="bg-blue-500/10"
              iconColor="text-blue-400"
              progress={75}
              progressLabel="aylık limitin %75'i"
            />
          </div>

          <div className="col-span-1 md:col-span-1 lg:col-span-1 xl:col-span-3">
            <KPICard
              title="Kullanılan Araç"
              value={`${stats.vehiclesUsed}`}
              unit={`/${stats.totalVehicles}`}
              icon="local_shipping"
              iconBg="bg-amber-500/10"
              iconColor="text-amber-400"
              extra={
                <div className="flex -space-x-2 mt-4">
                  {summary?.vehicleUtilization
                    ?.filter((v: any) => v.isUsed)
                    .slice(0, 3)
                    .map((v: any, idx: number) => (
                      <div
                        key={v.vehicleId}
                        className="h-8 w-8 rounded-full border-2 border-[#1e293b] bg-slate-700 flex items-center justify-center text-xs text-white"
                        title={`${v.vehicleName} - %${v.utilization}`}
                      >
                        {v.vehicleName?.replace("Araç ", "") || idx + 1}
                      </div>
                    ))}
                  {stats.totalVehicles - stats.vehiclesUsed > 0 && (
                    <div className="h-8 w-8 rounded-full border-2 border-[#1e293b] bg-slate-800 flex items-center justify-center text-xs text-slate-400">
                      +{stats.totalVehicles - stats.vehiclesUsed}
                    </div>
                  )}
                </div>
              }
            />
          </div>

          <div className="col-span-1 md:col-span-1 lg:col-span-1 xl:col-span-3">
            <KPICard
              title="Ortalama Doluluk"
              value={`%${stats.avgLoad}`}
              icon="inventory_2"
              iconBg="bg-purple-500/10"
              iconColor="text-purple-400"
              change={4}
              changeType="up"
              changeLabel="optimizasyon etkisi"
            />
          </div>

          {/* Row 2: Charts */}
          {/* Bar Chart */}
          <div className="glass-panel p-6 rounded-xl col-span-1 md:col-span-2 lg:col-span-4 xl:col-span-7 flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Senaryo Maliyet Analizi
                </h2>
                <p className="text-slate-400 text-sm">
                  Optimizasyon modelleri ile mevcut durum karşılaştırması
                </p>
              </div>
            </div>
            <BarChart data={barChartData} />
          </div>

          {/* Donut Chart */}
          <div className="glass-panel p-6 rounded-xl col-span-1 md:col-span-2 lg:col-span-4 xl:col-span-5 flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                Araç Kapasite Kullanımı
              </h2>
              <button className="text-slate-400 hover:text-white">
                <span className="material-symbols-rounded text-[20px]">
                  more_vert
                </span>
              </button>
            </div>
            <DonutChart
              segments={donutSegments}
              centerValue={`${stats.avgLoad}%`}
              centerLabel="Ort. Yük"
            />
          </div>

          {/* Row 3: Recent Operations Table */}
          <div className="glass-panel rounded-xl col-span-1 md:col-span-2 lg:col-span-4 xl:col-span-12 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Son Operasyonlar</h2>
              <Link
                href="/admin/trips"
                className="text-sm text-primary hover:text-blue-400 font-medium"
              >
                Tümünü Görüntüle
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/40 text-slate-400 text-xs uppercase tracking-wider border-b border-white/5">
                    <th className="p-4 font-medium">Sefer ID</th>
                    <th className="p-4 font-medium">Araç</th>
                    <th className="p-4 font-medium">Rota</th>
                    <th className="p-4 font-medium">Maliyet</th>
                    <th className="p-4 font-medium text-right">Durum</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-white/5">
                  {trips && trips.length > 0 ? (
                    trips.slice(0, 5).map((trip: any) => (
                      <tr
                        key={trip.id}
                        className="hover:bg-slate-800/30 transition-colors group"
                      >
                        <td className="p-4 font-medium text-white group-hover:text-primary transition-colors">
                          #{trip.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded bg-slate-700 flex items-center justify-center text-[10px] text-white">
                              {trip.vehicle?.name?.replace("Araç ", "") || "V"}
                            </div>
                            <span className="text-slate-300">
                              {trip.vehicle?.name || "Araç"}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-300">
                          <div className="flex items-center gap-2">
                            <span>{trip.planRoute?.cargoCount || 0} kargo</span>
                            <span className="material-symbols-rounded text-slate-600 text-[14px]">
                              arrow_forward
                            </span>
                            <span>
                              {Number(
                                trip.planRoute?.totalDistanceKm || 0
                              ).toFixed(1)}{" "}
                              km
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-white font-medium">
                          ₺
                          {Number(
                            trip.planRoute?.totalCost || trip.actualCost || 0
                          ).toFixed(2)}
                        </td>
                        <td className="p-4 text-right">
                          <StatusBadge status={trip.status} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    // No trips message
                    <tr>
                      <td
                        colSpan={6}
                        className="p-8 text-center text-slate-400"
                      >
                        Henüz sefer bulunmuyor. Plan oluşturup aktif ettiğinizde
                        seferler burada görünecek.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
