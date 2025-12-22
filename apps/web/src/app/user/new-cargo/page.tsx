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
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
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
    queryFn: () => stationsApi.getAll().then((r) => r.data),
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
      weightKg: parseFloat(formData.weightKg),
      description: formData.description,
      scheduledDate: formData.scheduledDate || tomorrowStr,
    });
  };

  // Hub olmayan istasyonları filtrele
  const availableStations = useMemo(
    () => (stations?.filter((s: Station) => !s.isHub) || []) as Station[],
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

  // Tahmini kapasite (demo amaçlı random)
  const stationCapacity = useMemo(() => {
    if (!selectedStation) return null;
    // Demo: Her istasyon için sabit bir doluluk yüzdesi
    const capacities: Record<string, number> = {
      gebze: 45,
      izmit: 62,
      darica: 35,
      basiskele: 28,
      cayirova: 55,
      derince: 40,
      dilovasi: 30,
      golcuk: 48,
      kandira: 22,
      karamursel: 38,
      kartepe: 52,
      korfez: 44,
    };
    return (
      capacities[selectedStation.code.toLowerCase()] ||
      Math.floor(Math.random() * 60) + 20
    );
  }, [selectedStation]);

  return (
    <div className="h-[calc(100vh-64px)] w-full overflow-hidden flex flex-col lg:flex-row bg-background-dark">
      {/* Sol Panel - Form */}
      <div className="w-full lg:w-[40%] h-full bg-slate-900/95 border-r border-white/5 flex flex-col justify-center px-8 sm:px-12 py-8 overflow-y-auto relative z-20 shadow-2xl">
        <div className="w-full max-w-md mx-auto flex flex-col gap-8">
          {/* Header */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 mb-1">
              <div className="bg-primary/20 p-2 rounded-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-6 h-6 text-primary"
                >
                  <path d="M3.375 4.5C2.339 4.5 1.5 5.34 1.5 6.375V13.5h12V6.375c0-1.036-.84-1.875-1.875-1.875h-8.25zM13.5 15h-12v2.625c0 1.035.84 1.875 1.875 1.875h.375a3 3 0 116 0h3a.75.75 0 00.75-.75V15z" />
                  <path d="M8.25 19.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0zM15.75 6.75a.75.75 0 00-.75.75v11.25c0 .087.015.17.042.248a3 3 0 015.958.464c.853-.175 1.5-.935 1.5-1.838V13.5a3 3 0 00-3-3h-3V7.5a.75.75 0 00-.75-.75z" />
                  <path d="M19.5 19.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Yeni Kargo Talebi
              </h1>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              Lütfen teslimat detaylarını giriniz ve haritadan istasyon
              seçiminizi doğrulayınız.
            </p>
          </div>

          {/* Error Alert */}
          {createMutation.isError && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5 text-red-500"
              >
                <path
                  fillRule="evenodd"
                  d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm text-red-400">
                {(createMutation.error as any)?.response?.data?.message ||
                  "Kargo oluşturulurken hata oluştu"}
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Station Select */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-300 text-sm font-medium ml-1">
                Teslim İstasyonu
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors"
                  >
                    <path
                      fillRule="evenodd"
                      d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
                      clipRule="evenodd"
                    />
                  </svg>
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
                  className="w-full h-14 bg-slate-800/70 border border-slate-700/50 text-white text-base rounded-xl pl-12 pr-10 focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none transition-all shadow-lg hover:bg-slate-800 cursor-pointer"
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
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5 text-slate-500"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12.53 16.28a.75.75 0 01-1.06 0l-7.5-7.5a.75.75 0 011.06-1.06L12 14.69l6.97-6.97a.75.75 0 111.06 1.06l-7.5 7.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Cargo Count & Weight */}
            <div className="grid grid-cols-2 gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-slate-300 text-sm font-medium ml-1">
                  Kargo Adedi
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors"
                    >
                      <path d="M3.375 3C2.339 3 1.5 3.84 1.5 4.875v.75c0 1.036.84 1.875 1.875 1.875h17.25c1.035 0 1.875-.84 1.875-1.875v-.75C22.5 3.839 21.66 3 20.625 3H3.375z" />
                      <path
                        fillRule="evenodd"
                        d="M3.087 9l.54 9.176A3 3 0 006.62 21h10.757a3 3 0 002.995-2.824L20.913 9H3.087zm6.163 3.75A.75.75 0 0110 12h4a.75.75 0 010 1.5h-4a.75.75 0 01-.75-.75z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <input
                    type="number"
                    placeholder="1"
                    min="1"
                    value={formData.cargoCount}
                    onChange={(e) =>
                      setFormData({ ...formData, cargoCount: e.target.value })
                    }
                    className="w-full h-14 bg-slate-800/70 border border-slate-700/50 text-white text-base rounded-xl pl-12 pr-4 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all hover:bg-slate-800 placeholder:text-slate-600"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-slate-300 text-sm font-medium ml-1">
                  Toplam Ağırlık (kg)
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12 2.25a.75.75 0 01.75.75v.756a49.106 49.106 0 019.152 1 .75.75 0 01-.152 1.485h-1.918l2.474 10.124a.75.75 0 01-.375.84A6.723 6.723 0 0118.75 18a6.723 6.723 0 01-3.181-.795.75.75 0 01-.375-.84l2.474-10.124H12.75v13.28c1.293.076 2.534.343 3.697.776a.75.75 0 01-.262 1.453h-8.37a.75.75 0 01-.262-1.453c1.162-.433 2.404-.7 3.697-.776V6.24H6.332l2.474 10.124a.75.75 0 01-.375.84A6.723 6.723 0 015.25 18a6.723 6.723 0 01-3.181-.795.75.75 0 01-.375-.84L4.168 6.241H2.25a.75.75 0 01-.152-1.485 49.105 49.105 0 019.152-1V3a.75.75 0 01.75-.75z"
                        clipRule="evenodd"
                      />
                    </svg>
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
                    className="w-full h-14 bg-slate-800/70 border border-slate-700/50 text-white text-base rounded-xl pl-12 pr-4 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all hover:bg-slate-800 placeholder:text-slate-600"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Scheduled Date */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-300 text-sm font-medium ml-1">
                Planlanan Tarih
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors"
                  >
                    <path d="M12.75 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM7.5 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM8.25 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM9.75 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM10.5 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM12.75 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM14.25 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM15 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM16.5 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM15 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM16.5 13.5a.75.75 0 100-1.5.75.75 0 000 1.5z" />
                    <path
                      fillRule="evenodd"
                      d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <input
                  type="date"
                  value={formData.scheduledDate || tomorrowStr}
                  min={tomorrowStr}
                  onChange={(e) =>
                    setFormData({ ...formData, scheduledDate: e.target.value })
                  }
                  className="w-full h-14 bg-slate-800/70 border border-slate-700/50 text-white text-base rounded-xl pl-12 pr-4 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all hover:bg-slate-800"
                />
              </div>
              <p className="text-xs text-slate-500 ml-1">
                En erken yarın için kargo oluşturabilirsiniz
              </p>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-300 text-sm font-medium ml-1">
                Açıklama (opsiyonel)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Kargo hakkında not ekleyin..."
                rows={2}
                className="w-full bg-slate-800/70 border border-slate-700/50 text-white text-base rounded-xl p-4 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all hover:bg-slate-800 placeholder:text-slate-600 resize-none"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 h-14 bg-slate-700 hover:bg-slate-600 text-white text-base font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={
                  createMutation.isPending ||
                  !formData.originStationId ||
                  !formData.weightKg
                }
                className="flex-[2] h-14 bg-primary hover:bg-primary/90 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-base font-bold rounded-xl shadow-lg shadow-primary/30 transform hover:-translate-y-0.5 disabled:transform-none transition-all duration-200 flex items-center justify-center gap-2 group"
              >
                {createMutation.isPending ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                ) : (
                  <>
                    <span>Talebi Oluştur</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                    >
                      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Info Box - Station Info */}
          {selectedStation && stationCapacity && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/10 border border-primary/20 animate-fade-in">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5 text-primary mt-0.5 flex-shrink-0"
              >
                <path
                  fillRule="evenodd"
                  d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex flex-col gap-1">
                <p className="text-xs text-slate-300 leading-snug">
                  Seçilen{" "}
                  <span className="text-white font-semibold">
                    {selectedStation.name}
                  </span>{" "}
                  istasyonunun doluluk oranı{" "}
                  <span
                    className={`font-semibold ${
                      stationCapacity < 50
                        ? "text-green-400"
                        : "text-yellow-400"
                    }`}
                  >
                    %{stationCapacity}
                  </span>{" "}
                  seviyesindedir.
                </p>
                <p className="text-xs text-slate-400">
                  Tahmini teslimat süresi:{" "}
                  <span className="text-white">1 İş Günü</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sağ Panel - Harita */}
      <div className="hidden lg:block flex-1 relative bg-slate-900 overflow-hidden">
        {stations && (
          <CargoRequestMap
            stations={stations}
            selectedStationId={formData.originStationId}
            onStationSelect={handleStationSelect}
          />
        )}
      </div>
    </div>
  );
}
