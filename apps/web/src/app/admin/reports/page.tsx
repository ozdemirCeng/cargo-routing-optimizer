"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { dashboardApi, plansApi } from "@/lib/api";
import { useSearchParams } from "next/navigation";

function formatCurrency(v: number) {
  return `₺${Number(v || 0).toLocaleString("tr-TR", {
    maximumFractionDigits: 0,
  })}`;
}

function normalizeProblemType(t: string) {
  return t === "limited_vehicles" ? "limited_vehicles_max_count" : t;
}

function problemTypeLabel(t: string) {
  switch (normalizeProblemType(t)) {
    case "unlimited_vehicles":
      return "Sınırsız";
    case "limited_vehicles_max_count":
      return "Belirli (Max Adet)";
    case "limited_vehicles_max_weight":
      return "Belirli (Max Kg)";
    default:
      return t;
  }
}

function safeArray<T = any>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (Array.isArray(data?.data)) return data.data as T[];
  return [];
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminReportsPage() {
  const searchParams = useSearchParams();
  const initialPlanId = searchParams.get("planId");

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    initialPlanId || null
  );

  // Plans list
  const { data: plansRaw, isLoading: plansLoading } = useQuery({
    queryKey: ["reports", "plans"],
    queryFn: () =>
      plansApi
        .getAll()
        .then((r) => (Array.isArray(r.data) ? r.data : (r.data as any)?.data ?? r.data)),
    staleTime: 20000,
    retry: 2,
  });

  const plans = useMemo(() => safeArray<any>(plansRaw), [plansRaw]);

  // Default select latest plan if none selected
  useEffect(() => {
    if (selectedPlanId) return;
    if (!plans || plans.length === 0) return;
    setSelectedPlanId(String(plans[0].id));
  }, [plans, selectedPlanId]);

  // Plan detail
  const { data: planDetailRaw } = useQuery({
    queryKey: ["reports", "plan-detail", selectedPlanId],
    queryFn: () => plansApi.getById(String(selectedPlanId)).then((r) => r.data),
    enabled: !!selectedPlanId,
    staleTime: 20000,
    retry: 2,
  });

  const plan = planDetailRaw as any;

  // Cost analysis (vehicle aggregation)
  const { data: costAnalysis } = useQuery({
    queryKey: ["reports", "cost-analysis", selectedPlanId],
    queryFn: () => dashboardApi.getCostAnalysis(String(selectedPlanId)).then((r) => r.data),
    enabled: !!selectedPlanId,
    staleTime: 20000,
    retry: 2,
  });

  const vehicleCosts = useMemo(
    () => safeArray<any>(costAnalysis?.vehicleCosts),
    [costAnalysis]
  );

  const planStats = useMemo(() => {
    if (!plan) return null;
    const totalCost = Number(plan.totalCost || 0);
    const totalDistanceKm = Number(plan.totalDistanceKm || 0);
    const totalCargos = Number(plan.totalCargos || 0);
    const totalWeightKg = Number(plan.totalWeightKg || 0);
    const vehiclesUsed = Number(plan.vehiclesUsed || 0);
    const vehiclesRented = Number(plan.vehiclesRented || 0);

    const costPerCargo = totalCargos ? totalCost / totalCargos : 0;
    const costPerKm = totalDistanceKm ? totalCost / totalDistanceKm : 0;
    const costPerKg = totalWeightKg ? totalCost / totalWeightKg : 0;

    // Optimizer meta (if present)
    const optimizerSelected = plan.optimizerResult?.algorithm_info?.selected;
    const unassignedCount =
      plan.optimizerResult?.summary?.unassigned_cargos ??
      plan.optimizerResult?.summary?.unassignedCargos ??
      plan.optimizerResult?.unassigned?.length ??
      0;

    return {
      totalCost,
      totalDistanceKm,
      totalCargos,
      totalWeightKg,
      vehiclesUsed,
      vehiclesRented,
      costPerCargo,
      costPerKm,
      costPerKg,
      optimizerSelected,
      unassignedCount: Number(unassignedCount || 0),
    };
  }, [plan]);

  const stationBreakdown = useMemo(() => {
    // Aggregate from routeDetails in plan.routes
    const routes = safeArray<any>(plan?.routes);
    const map = new Map<
      string,
      {
        stationId: string;
        stationName: string;
        stationCode: string;
        totalCargoCount: number;
        totalWeightKg: number;
        vehicles: Set<string>;
      }
    >();

    for (const r of routes) {
      const vehicleName = r?.vehicle?.name || r?.vehicleName || "Araç";
      const details = safeArray<any>(r?.routeDetails);
      for (const stop of details) {
        if (!stop || stop.is_hub) continue;
        const stationId = String(stop.station_id);
        const existing =
          map.get(stationId) ||
          {
            stationId,
            stationName: String(stop.station_name || ""),
            stationCode: String(stop.station_code || ""),
            totalCargoCount: 0,
            totalWeightKg: 0,
            vehicles: new Set<string>(),
          };

        existing.totalCargoCount += Number(stop.cargo_count || 0);
        existing.totalWeightKg += Number(stop.weight_kg || 0);
        existing.vehicles.add(vehicleName);
        map.set(stationId, existing);
      }
    }

    return Array.from(map.values())
      .map((x) => ({
        stationId: x.stationId,
        stationName: x.stationName,
        stationCode: x.stationCode,
        totalCargoCount: x.totalCargoCount,
        totalWeightKg: x.totalWeightKg,
        vehicles: Array.from(x.vehicles),
      }))
      .sort((a, b) => b.totalWeightKg - a.totalWeightKg);
  }, [plan]);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">
            Plan Analiz Raporu
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Seçilen plan için maliyet, rota, kapasite ve istasyon kırılımı
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <Link
            href="/admin/plans"
            className="px-4 py-2 rounded-xl bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary text-sm font-bold transition-colors"
          >
            Planlar →
          </Link>
          <button
            type="button"
            disabled={!plan?.optimizerResult}
            onClick={() =>
              downloadTextFile(
                `plan-${String(plan?.id).slice(0, 8)}-optimizer.json`,
                JSON.stringify(plan.optimizerResult, null, 2)
              )
            }
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Ham optimizer çıktısını indir"
          >
            Optimizer JSON indir
          </button>
        </div>
      </div>

      <div className="glass-panel p-5 rounded-2xl border border-white/10">
        <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div>
            <div className="text-sm text-slate-400 font-semibold">Plan Seç</div>
            <div className="text-xs text-slate-500 mt-1">
              Tarih • Problem tipi • Durum
            </div>
          </div>

          <div className="flex-1 md:max-w-[720px]">
            <select
              value={selectedPlanId || ""}
              onChange={(e) => setSelectedPlanId(e.target.value || null)}
              className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none"
            >
              {plansLoading && (
                <option value="" className="bg-slate-900">
                  Planlar yükleniyor...
                </option>
              )}
              {!plansLoading && plans.length === 0 && (
                <option value="" className="bg-slate-900">
                  Plan yok — önce Planlar’dan plan üret
                </option>
              )}
              {plans.map((p: any) => (
                <option key={p.id} value={p.id} className="bg-slate-900">
                  {new Date(p.planDate).toLocaleDateString("tr-TR")} •{" "}
                  {problemTypeLabel(p.problemType)} • {p.status} • #
                  {String(p.id).slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {plan && planStats ? (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
            <div className="glass-panel p-5 rounded-2xl">
              <div className="text-xs text-slate-400">Toplam Maliyet</div>
              <div className="text-2xl font-extrabold text-white mt-1 tabular-nums">
                {formatCurrency(planStats.totalCost)}
              </div>
            </div>
            <div className="glass-panel p-5 rounded-2xl">
              <div className="text-xs text-slate-400">Toplam Mesafe</div>
              <div className="text-2xl font-extrabold text-white mt-1 tabular-nums">
                {planStats.totalDistanceKm.toFixed(1)}{" "}
                <span className="text-slate-400 text-sm font-semibold">km</span>
              </div>
            </div>
            <div className="glass-panel p-5 rounded-2xl">
              <div className="text-xs text-slate-400">Kargo</div>
              <div className="text-2xl font-extrabold text-white mt-1 tabular-nums">
                {planStats.totalCargos}
              </div>
            </div>
            <div className="glass-panel p-5 rounded-2xl">
              <div className="text-xs text-slate-400">Yük</div>
              <div className="text-2xl font-extrabold text-white mt-1 tabular-nums">
                {planStats.totalWeightKg.toFixed(0)}{" "}
                <span className="text-slate-400 text-sm font-semibold">kg</span>
              </div>
            </div>
            <div className="glass-panel p-5 rounded-2xl">
              <div className="text-xs text-slate-400">Maliyet/Kargo</div>
              <div className="text-2xl font-extrabold text-white mt-1 tabular-nums">
                ₺{planStats.costPerCargo.toFixed(1)}
              </div>
            </div>
            <div className="glass-panel p-5 rounded-2xl">
              <div className="text-xs text-slate-400">Maliyet/Km</div>
              <div className="text-2xl font-extrabold text-white mt-1 tabular-nums">
                ₺{planStats.costPerKm.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="glass-panel p-5 rounded-2xl">
            <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
              <div>
                <div className="text-white font-extrabold">
                  {problemTypeLabel(plan.problemType)} •{" "}
                  {new Date(plan.planDate).toLocaleDateString("tr-TR")}
                </div>
                <div className="text-slate-400 text-sm mt-1">
                  Durum: <span className="text-slate-200">{plan.status}</span> •
                  Araç:{" "}
                  <span className="text-slate-200">
                    {planStats.vehiclesUsed} (+{planStats.vehiclesRented} kiralık)
                  </span>{" "}
                  • Taşınamayan:{" "}
                  <span className="text-slate-200">{planStats.unassignedCount}</span>
                </div>
              </div>
              {planStats.optimizerSelected ? (
                <div className="text-xs text-slate-400">
                  Seçilen strateji:{" "}
                  <span className="text-slate-200 font-semibold">
                    {String(planStats.optimizerSelected.strategy || "")}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Vehicle breakdown */}
          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold text-white">
                Araç Bazlı Maliyet / Yük
              </h2>
              <div className="text-sm text-slate-400">
                {vehicleCosts.length} araç
              </div>
            </div>

            {vehicleCosts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-slate-400 border-b border-white/10">
                      <th className="py-3 pr-4 font-semibold">Araç</th>
                      <th className="py-3 pr-4 font-semibold">Kargo</th>
                      <th className="py-3 pr-4 font-semibold">Yük</th>
                      <th className="py-3 pr-4 font-semibold">Mesafe</th>
                      <th className="py-3 pr-4 font-semibold">Doluluk</th>
                      <th className="py-3 pr-4 font-semibold">Maliyet</th>
                      <th className="py-3 pr-4 font-semibold">Kullanıcı</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-white/5">
                    {vehicleCosts.map((v: any) => (
                      <tr key={v.vehicleId} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 pr-4 text-white font-bold">
                          {v.vehicleName}{" "}
                          {v.isRented ? (
                            <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              Kiralık
                            </span>
                          ) : null}
                          <div className="text-xs text-slate-500 font-mono">
                            {v.plateNumber}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-slate-200 tabular-nums">
                          {Number(v.cargoCount || 0)}
                        </td>
                        <td className="py-3 pr-4 text-slate-200 tabular-nums">
                          {Number(v.totalWeightKg || 0).toFixed(0)} kg
                        </td>
                        <td className="py-3 pr-4 text-slate-200 tabular-nums">
                          {Number(v.totalDistanceKm || 0).toFixed(1)} km
                        </td>
                        <td className="py-3 pr-4 text-slate-200 tabular-nums">
                          %{Math.round(Number(v.capacityUtilization || 0))}
                        </td>
                        <td className="py-3 pr-4 text-white font-extrabold tabular-nums">
                          {formatCurrency(Number(v.totalCost || 0))}
                        </td>
                        <td className="py-3 pr-4 text-slate-300">
                          <div className="flex flex-wrap gap-1.5">
                            {(v.users || []).slice(0, 3).map((u: any) => (
                              <span
                                key={u.id}
                                className="text-[11px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-slate-200"
                                title={u.email}
                              >
                                {u.name}
                              </span>
                            ))}
                            {(v.users || []).length > 3 ? (
                              <span className="text-[11px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400">
                                +{(v.users || []).length - 3}
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-slate-500 text-sm">
                Bu plan için araç verisi bulunamadı.
              </div>
            )}
          </div>

          {/* Station breakdown */}
          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold text-white">
                İstasyon Bazlı Kırılım
              </h2>
              <div className="text-sm text-slate-400">
                {stationBreakdown.length} istasyon
              </div>
            </div>

            {stationBreakdown.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-slate-400 border-b border-white/10">
                      <th className="py-3 pr-4 font-semibold">İstasyon</th>
                      <th className="py-3 pr-4 font-semibold">Kargo</th>
                      <th className="py-3 pr-4 font-semibold">Yük</th>
                      <th className="py-3 pr-4 font-semibold">Araçlar</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-white/5">
                    {stationBreakdown.slice(0, 20).map((s) => (
                      <tr key={s.stationId} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 pr-4 text-white font-bold">
                          {s.stationCode}{" "}
                          <span className="text-slate-400 font-normal ml-2">
                            {s.stationName}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-slate-200 tabular-nums">
                          {s.totalCargoCount}
                        </td>
                        <td className="py-3 pr-4 text-slate-200 tabular-nums">
                          {s.totalWeightKg.toFixed(0)} kg
                        </td>
                        <td className="py-3 pr-4 text-slate-300">
                          {s.vehicles.join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {stationBreakdown.length > 20 ? (
                  <div className="text-slate-500 text-xs mt-3">
                    İlk 20 istasyon gösteriliyor (ağırlığa göre).
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-slate-500 text-sm">
                Bu plan için istasyon kırılımı bulunamadı.
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="glass-panel p-6 rounded-2xl text-slate-400">
          Plan seçince analiz raporu burada görünecek.
        </div>
      )}
    </div>
  );
}


