"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cargosApi, stationsApi } from "@/lib/api";
import { scenarios, stationCodeMap, Scenario } from "@/lib/scenarios";
import Link from "next/link";

export default function ScenariosPage() {
  const queryClient = useQueryClient();
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(
    null
  );
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [clearExisting, setClearExisting] = useState(true);
  const [loadResult, setLoadResult] = useState<any>(null);

  // Stations query
  const { data: stationsData } = useQuery({
    queryKey: ["stations"],
    queryFn: () => stationsApi.getAll(),
  });

  // Get cargo summary for selected date
  const { data: summaryData, refetch: refetchSummary } = useQuery({
    queryKey: ["cargo-summary", selectedDate],
    queryFn: () => cargosApi.getSummary(selectedDate),
    enabled: !!selectedDate,
  });

  // Load scenario mutation
  const loadMutation = useMutation({
    mutationFn: (data: any) => cargosApi.loadScenario(data),
    onSuccess: (response) => {
      setLoadResult(response.data);
      queryClient.invalidateQueries({ queryKey: ["cargos"] });
      queryClient.invalidateQueries({ queryKey: ["cargo-summary"] });
      refetchSummary();
    },
    onError: (error: any) => {
      setLoadResult({
        success: false,
        error: error.response?.data?.message || "Bir hata oluştu",
      });
    },
  });

  // Clear cargos mutation
  const clearMutation = useMutation({
    mutationFn: (date: string) => cargosApi.clearByDate(date),
    onSuccess: (response) => {
      setLoadResult({
        success: true,
        cleared: true,
        deletedCount: response.data.deletedCount,
        date: response.data.date,
      });
      queryClient.invalidateQueries({ queryKey: ["cargos"] });
      queryClient.invalidateQueries({ queryKey: ["cargo-summary"] });
      refetchSummary();
    },
    onError: (error: any) => {
      setLoadResult({
        success: false,
        error: error.response?.data?.message || "Silme işlemi başarısız",
      });
    },
  });

  const handleClearCargos = () => {
    if (
      confirm(
        `${selectedDate} tarihindeki tüm bekleyen kargolar silinecek. Emin misiniz?`
      )
    ) {
      clearMutation.mutate(selectedDate);
    }
  };

  const handleLoadScenario = () => {
    if (!selectedScenario) return;

    const scenarioData = selectedScenario.data.map((item) => ({
      stationCode: stationCodeMap[item.station] || item.station,
      count: item.count,
      weight: item.weight,
    }));

    loadMutation.mutate({
      scenarioId: selectedScenario.id,
      scenarioName: selectedScenario.name,
      scheduledDate: selectedDate,
      data: scenarioData,
      clearExisting,
    });
  };

  const summary = summaryData?.data;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Senaryo Yönetimi</h1>
          <p className="text-slate-400 text-sm mt-1">
            Test senaryolarını yükleyin ve kargo verilerini oluşturun
          </p>
        </div>
        <Link
          href="/admin/plans"
          className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors"
        >
          <span className="material-symbols-rounded text-sm">route</span>
          Plan Oluştur
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Senaryo Seçimi */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tarih ve Seçenekler */}
          <div className="glass-panel p-6 rounded-xl">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="material-symbols-rounded text-blue-400">
                calendar_today
              </span>
              Yükleme Ayarları
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold text-sm mb-2">
                  Planlanan Tarih
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="glass-input w-full px-4 py-3 rounded-lg text-white"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearExisting}
                    onChange={(e) => setClearExisting(e.target.checked)}
                    className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-primary focus:ring-primary"
                  />
                  <span className="text-slate-300">
                    Mevcut bekleyen kargoları temizle
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Senaryo Kartları */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scenarios.map((scenario) => (
              <div
                key={scenario.id}
                onClick={() => setSelectedScenario(scenario)}
                className={`glass-panel p-5 rounded-xl cursor-pointer transition-all duration-300 ${
                  selectedScenario?.id === scenario.id
                    ? "border-2 border-primary shadow-lg shadow-primary/20"
                    : "hover:border-white/20"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold text-white">
                    {scenario.name}
                  </h3>
                  {selectedScenario?.id === scenario.id && (
                    <span className="material-symbols-rounded text-primary">
                      check_circle
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-sm mb-4">
                  {scenario.description}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Toplam Kargo</p>
                    <p className="text-xl font-bold text-white">
                      {scenario.totalCargos}
                    </p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Toplam Ağırlık</p>
                    <p className="text-xl font-bold text-white">
                      {scenario.totalWeight}{" "}
                      <span className="text-sm text-slate-500">kg</span>
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-white/5">
                  <p className="text-slate-500 text-xs">
                    {scenario.data.length} istasyon
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Yükle Butonu */}
          {selectedScenario && (
            <button
              onClick={handleLoadScenario}
              disabled={loadMutation.isPending}
              className="w-full py-4 bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loadMutation.isPending ? (
                <>
                  <span className="material-symbols-rounded animate-spin">
                    progress_activity
                  </span>
                  Yükleniyor...
                </>
              ) : (
                <>
                  <span className="material-symbols-rounded">upload</span>
                  {selectedScenario.name} Yükle
                </>
              )}
            </button>
          )}

          {/* Sonuç Mesajı */}
          {loadResult && (
            <div
              className={`p-4 rounded-xl ${
                loadResult.success
                  ? "bg-emerald-500/10 border border-emerald-500/30"
                  : "bg-red-500/10 border border-red-500/30"
              }`}
            >
              {loadResult.success ? (
                <div className="flex items-start gap-3">
                  <span className="material-symbols-rounded text-emerald-400">
                    check_circle
                  </span>
                  <div>
                    {loadResult.cleared ? (
                      <>
                        <p className="text-emerald-400 font-semibold">
                          Kargolar temizlendi!
                        </p>
                        <p className="text-slate-400 text-sm mt-1">
                          {loadResult.deletedCount} kargo silindi (
                          {loadResult.date})
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-emerald-400 font-semibold">
                          {loadResult.scenarioName} başarıyla yüklendi!
                        </p>
                        <p className="text-slate-400 text-sm mt-1">
                          {loadResult.createdCount} kargo oluşturuldu •{" "}
                          {loadResult.totalWeight} kg •{" "}
                          {loadResult.stationsUsed} istasyon
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <span className="material-symbols-rounded text-red-400">
                    error
                  </span>
                  <div>
                    <p className="text-red-400 font-semibold">Hata!</p>
                    <p className="text-slate-400 text-sm mt-1">
                      {loadResult.error}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Seçili Senaryo Detayları & Mevcut Durum */}
        <div className="space-y-6">
          {/* Seçili Senaryo Detayları */}
          {selectedScenario && (
            <div className="glass-panel p-5 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-rounded text-amber-400">
                  inventory_2
                </span>
                {selectedScenario.name} Detayları
              </h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {selectedScenario.data.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 px-3 bg-slate-800/30 rounded-lg"
                  >
                    <span className="text-slate-300 text-sm">
                      {item.station}
                    </span>
                    <div className="flex gap-4 text-sm">
                      <span className="text-white font-medium">
                        {item.count} kargo
                      </span>
                      <span className="text-slate-400">{item.weight} kg</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mevcut Kargo Durumu */}
          <div className="glass-panel p-5 rounded-xl">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="material-symbols-rounded text-emerald-400">
                analytics
              </span>
              {selectedDate} Kargo Durumu
            </h3>
            {summary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Toplam Kargo</p>
                    <p className="text-2xl font-bold text-white">
                      {summary.totalCargos}
                    </p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Toplam Ağırlık</p>
                    <p className="text-2xl font-bold text-white">
                      {summary.totalWeight?.toFixed(1)}{" "}
                      <span className="text-sm text-slate-500">kg</span>
                    </p>
                  </div>
                </div>
                {summary.byStation?.length > 0 && (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {summary.byStation.map((station: any) => (
                      <div
                        key={station.stationId}
                        className="flex items-center justify-between py-2 px-3 bg-slate-800/30 rounded-lg"
                      >
                        <span className="text-slate-300 text-sm">
                          {station.stationName}
                        </span>
                        <div className="flex gap-4 text-sm">
                          <span className="text-white font-medium">
                            {station.count}
                          </span>
                          <span className="text-slate-400">
                            {station.totalWeight?.toFixed(1)} kg
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Kargoları Temizle Butonu */}
                {summary.totalCargos > 0 && (
                  <button
                    onClick={handleClearCargos}
                    disabled={clearMutation.isPending}
                    className="w-full mt-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-medium rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {clearMutation.isPending ? (
                      <>
                        <span className="material-symbols-rounded animate-spin text-sm">
                          progress_activity
                        </span>
                        Siliniyor...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-rounded text-sm">
                          delete
                        </span>
                        Kargoları Temizle ({summary.totalCargos})
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">
                Bu tarihte henüz kargo yok
              </p>
            )}
          </div>

          {/* Kapasite Bilgisi */}
          <div className="glass-panel p-5 rounded-xl">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="material-symbols-rounded text-purple-400">
                local_shipping
              </span>
              Araç Kapasiteleri
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-slate-400 text-sm">Araç 1</span>
                <span className="text-white font-medium">500 kg</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-slate-400 text-sm">Araç 2</span>
                <span className="text-white font-medium">750 kg</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-slate-400 text-sm">Araç 3</span>
                <span className="text-white font-medium">1000 kg</span>
              </div>
              <div className="flex justify-between items-center py-2 pt-3 border-t border-white/10">
                <span className="text-slate-300 font-semibold">
                  Toplam Kapasite
                </span>
                <span className="text-primary font-bold">2250 kg</span>
              </div>
            </div>
            {selectedScenario && (
              <div className="mt-4 p-3 rounded-lg bg-slate-800/50">
                <p className="text-xs text-slate-400 mb-1">Kapasite Durumu</p>
                {selectedScenario.totalWeight <= 2250 ? (
                  <p className="text-emerald-400 text-sm">
                    ✓ Mevcut kapasiteye sığar
                  </p>
                ) : (
                  <p className="text-amber-400 text-sm">
                    ⚠ Ek araç kiralama gerekebilir (+
                    {(selectedScenario.totalWeight - 2250).toFixed(0)} kg)
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
