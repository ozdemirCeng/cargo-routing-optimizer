"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { stationsApi, cargosApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

// MapLibre'yi client-side only olarak import et
const CargoRequestMap = dynamic(() => import("@/components/CargoRequestMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
    </div>
  ),
});

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

interface StationSummary {
  stationId: string;
  stationName: string;
  stationCode: string;
  latitude: number;
  longitude: number;
  isHub: boolean;
  cargoCount: number;
  totalWeightKg: number;
}

// Her istasyonun maksimum kapasitesi (kg cinsinden) - gerçek değerler
const STATION_MAX_CAPACITY_KG = 500;

export default function NewCargoPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    originStationId: "",
    weightKg: "",
    cargoCount: "1",
    description: "",
    scheduledDate: "",
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const { data: stations, isLoading: stationsLoading } = useQuery({
    queryKey: ["stations"],
    queryFn: () =>
      stationsApi
        .getAll()
        .then((r) => (Array.isArray(r.data) ? r.data : Array.isArray((r.data as any)?.data) ? (r.data as any).data : [])),
  });

  // Seçili tarih için istasyon özet bilgilerini çek (gerçek doluluk verileri)
  const scheduledDateStr = formData.scheduledDate || tomorrowStr;
  const { data: stationSummary } = useQuery({
    queryKey: ["station-summary", scheduledDateStr],
    queryFn: () =>
      stationsApi
        .getSummary(scheduledDateStr)
        .then((r) => (Array.isArray(r.data) ? r.data : Array.isArray((r.data as any)?.data) ? (r.data as any).data : [])),
    enabled: !!scheduledDateStr,
  });

  const createMutation = useMutation({
    mutationFn: cargosApi.create,
    onSuccess: () => {
      router.push("/user");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      originStationId: formData.originStationId,
      cargoCount: Math.max(1, parseInt(formData.cargoCount || "1", 10) || 1),
      weightKg: parseFloat(formData.weightKg),
      description: formData.description,
      scheduledDate: formData.scheduledDate || tomorrowStr,
    });
  };

  // Hub olmayan istasyonları filtrele
  const availableStations = useMemo(
    () => (Array.isArray(stations) ? stations.filter((s: Station) => !s.isHub) : []),
    [stations]
  );

  const selectedStation = useMemo(
    () => availableStations.find((s) => s.id === formData.originStationId),
    [availableStations, formData.originStationId]
  );

  const handleStationSelect = useCallback((station: Station) => {
    if (!station.isHub) {
      setFormData((prev) => ({ ...prev, originStationId: station.id }));
    }
  }, []);

  // Gerçek doluluk oranını hesapla (API'den gelen verilerle)
  const stationCapacityInfo = useMemo(() => {
    if (!selectedStation) return null;
    
    // stationSummary henüz yüklenmediyse varsayılan değerler dön
    if (!stationSummary) {
      return { percentage: 0, cargoCount: 0, totalWeightKg: 0 };
    }
    
    const summary = (stationSummary as StationSummary[]).find(
      (s) => s.stationId === selectedStation.id
    );
    
    if (!summary) return { percentage: 0, cargoCount: 0, totalWeightKg: 0 };
    
    const percentage = Math.min(
      Math.round((summary.totalWeightKg / STATION_MAX_CAPACITY_KG) * 100),
      100
    );
    
    return {
      percentage,
      cargoCount: summary.cargoCount,
      totalWeightKg: summary.totalWeightKg,
    };
  }, [selectedStation, stationSummary]);

  // Tahmini teslimat süresini hesapla (seçilen tarihe göre)
  const estimatedDelivery = useMemo(() => {
    const selectedDate = new Date(formData.scheduledDate || tomorrowStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    
    const diffTime = selectedDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1) return "1 İş Günü";
    if (diffDays <= 3) return `${diffDays} İş Günü`;
    return `${diffDays} Gün`;
  }, [formData.scheduledDate, tomorrowStr]);

  return (
    <div className="h-full w-full flex flex-col lg:flex-row gap-4 px-6 pb-4 min-h-0">
      {/* Sol Panel - Form */}
      <div className="w-full lg:w-[42%] lg:h-full glass-dark border border-slate-700/50 flex flex-col relative z-20 rounded-3xl overflow-hidden">
        <div className="lg:h-full lg:min-h-0 lg:overflow-y-auto px-7 pt-6 pb-3">
          <div className="w-full max-w-md mx-auto min-h-full flex flex-col">
            <div className="flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <span className="material-symbols-rounded text-emerald-400 text-xl">
                    local_shipping
                  </span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">
                    Yeni Kargo Talebi
                  </h1>
                  <p className="text-xs text-slate-300">
                    Teslimat detaylarını girin
                  </p>
                </div>
              </div>

              {/* Error Alert */}
              {createMutation.isError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <span className="material-symbols-rounded text-red-400 text-lg">
                    error
                  </span>
                  <p className="text-xs text-red-400">
                    {(createMutation.error as any)?.response?.data?.message ||
                      "Kargo oluşturulurken hata oluştu"}
                  </p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Station Select */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-300 text-xs font-medium ml-1">
                Teslim İstasyonu
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                  <span className="material-symbols-rounded text-slate-200 group-focus-within:text-emerald-400 transition-colors text-lg">
                    location_on
                  </span>
                </div>
                <select
                  value={formData.originStationId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      originStationId: e.target.value,
                    })
                  }
                  disabled={stationsLoading}
                  style={{ WebkitAppearance: "none", MozAppearance: "none", appearance: "none" }}
                  className="w-full h-10 bg-slate-800/50 bg-none border border-slate-700/50 text-white text-sm rounded-lg pl-10 pr-8 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none appearance-none transition-all hover:bg-slate-800 cursor-pointer"
                  required
                >
                  <option value="" disabled>
                    {stationsLoading
                      ? "Yükleniyor..."
                      : "Lütfen Teslim İstasyonunu Seçin"}
                  </option>
                  {availableStations.map((station) => (
                    <option key={station.id} value={station.id}>
                      {station.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="material-symbols-rounded text-slate-300 text-lg">
                    expand_more
                  </span>
                </div>
              </div>
            </div>

            {/* Cargo Count & Weight */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-slate-300 text-xs font-medium ml-1">
                  Kargo Adedi
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <span className="material-symbols-rounded text-slate-200 group-focus-within:text-emerald-400 transition-colors text-lg">
                      inventory_2
                    </span>
                  </div>
                  <input
                    type="number"
                    placeholder="1"
                    min="1"
                    value={formData.cargoCount}
                    onChange={(e) =>
                      setFormData({ ...formData, cargoCount: e.target.value })
                    }
                    className="w-full h-10 bg-slate-800/50 border border-slate-700/50 text-white text-sm rounded-lg pl-10 pr-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all hover:bg-slate-800 placeholder:text-slate-600"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-300 text-xs font-medium ml-1">
                  Toplam Ağırlık (kg)
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <span className="material-symbols-rounded text-slate-200 group-focus-within:text-emerald-400 transition-colors text-lg">
                      scale
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="0.0"
                    min="0.1"
                    value={formData.weightKg}
                    onChange={(e) =>
                      setFormData({ ...formData, weightKg: e.target.value })
                    }
                    className="w-full h-10 bg-slate-800/50 border border-slate-700/50 text-white text-sm rounded-lg pl-10 pr-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all hover:bg-slate-800 placeholder:text-slate-600"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Scheduled Date */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-300 text-xs font-medium ml-1">
                Planlı Tarih
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                  <span className="material-symbols-rounded text-slate-200 group-focus-within:text-emerald-400 transition-colors text-lg">
                    calendar_month
                  </span>
                </div>
                <input
                  type="date"
                  value={formData.scheduledDate || tomorrowStr}
                  min={tomorrowStr}
                  onChange={(e) =>
                    setFormData({ ...formData, scheduledDate: e.target.value })
                  }
                  className="w-full h-10 bg-slate-800/50 border border-slate-700/50 text-white text-sm rounded-lg pl-10 pr-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all hover:bg-slate-800"
                />
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-300 text-xs font-medium ml-1">
                Açıklama (opsiyonel)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Kargo hakkında not ekleyin..."
                rows={4}
                className="w-full min-h-[112px] bg-slate-800/50 border border-slate-700/50 text-white text-sm rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all hover:bg-slate-800 placeholder:text-slate-600 resize-none"
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 h-10 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-1"
              >
                <span className="material-symbols-rounded text-lg">arrow_back</span>
                İptal
              </button>
              <button
                type="submit"
                disabled={
                  createMutation.isPending ||
                  !formData.originStationId ||
                  !formData.weightKg
                }
                className="flex-[2] h-10 bg-gradient-to-r from-emerald-500 to-teal-600 hover:shadow-lg hover:shadow-emerald-500/20 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transform hover:-translate-y-0.5 disabled:transform-none transition-all duration-200 flex items-center justify-center gap-1 group"
              >
                {createMutation.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                ) : (
                  <>
                    <span>Talebi Oluştur</span>
                    <span className="material-symbols-rounded text-lg group-hover:translate-x-1 transition-transform">
                      send
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>

            </div>

            {/* Info Box - İstasyon Bilgisi */}
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <span className="material-symbols-rounded text-emerald-400 text-lg flex-shrink-0">
                info
              </span>
              <div className="flex flex-col gap-1">
                {selectedStation && stationCapacityInfo ? (
                  <>
                    <p className="text-xs text-slate-200">
                      <span className="text-white font-semibold">{selectedStation.name}</span>
                      {" "}→{" "}
                      <span className="text-emerald-400 font-semibold">{stationCapacityInfo.cargoCount}</span> kargo,{" "}
                      <span className="text-emerald-400 font-semibold">{stationCapacityInfo.totalWeightKg.toFixed(1)} kg</span>
                      {" "}| Doluluk:{" "}
                      <span className={`font-semibold ${stationCapacityInfo.percentage < 50 ? "text-emerald-400" : stationCapacityInfo.percentage < 80 ? "text-amber-400" : "text-red-400"}`}>
                        %{stationCapacityInfo.percentage}
                      </span>
                      {" "}| Teslimat:{" "}
                      <span className="text-white font-semibold">{estimatedDelivery}</span>
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-300">
                    Haritadan veya listeden bir <span className="text-emerald-400 font-medium">teslim istasyonu</span> seçin.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sağ Panel - Harita */}
      <div className="hidden lg:block flex-1 min-h-0 relative rounded-3xl overflow-hidden border border-slate-300/50">
        {stations && (
          <div className="absolute inset-0">
            <CargoRequestMap
              stations={stations}
              selectedStationId={formData.originStationId}
              onStationSelect={handleStationSelect}
            />
          </div>
        )}
      </div>
    </div>
  );
}
