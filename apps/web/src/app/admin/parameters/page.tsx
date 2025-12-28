"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { parametersApi } from "@/lib/api";

interface Parameters {
  cost_per_km: number;
  rental_cost_500kg: number;
  rental_capacity_kg: number;
  default_capacity_small: number;
  default_capacity_medium: number;
  default_capacity_large: number;
  max_working_hours: number;
  average_speed_kmh: number;
}

export default function ParametersPage() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Parameters>({
    cost_per_km: 1,
    rental_cost_500kg: 200,
    rental_capacity_kg: 500,
    default_capacity_small: 500,
    default_capacity_medium: 750,
    default_capacity_large: 1000,
    max_working_hours: 8,
    average_speed_kmh: 50,
  });

  const {
    data: parameters,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["parameters"],
    queryFn: async () => {
      const rows = await parametersApi.getAll().then((r) => r.data as any[]);
      const map: Record<string, number> = {};
      for (const row of rows) {
        map[String(row.paramKey)] = Number(row.paramValue);
      }
      return map;
    },
  });

  useEffect(() => {
    if (parameters) {
      setFormData({
        cost_per_km: (parameters as any).cost_per_km || 1,
        rental_cost_500kg: (parameters as any).rental_cost_500kg || 200,
        rental_capacity_kg: (parameters as any).rental_capacity_kg || 500,
        default_capacity_small:
          (parameters as any).default_capacity_small || 500,
        default_capacity_medium:
          (parameters as any).default_capacity_medium || 750,
        default_capacity_large:
          (parameters as any).default_capacity_large || 1000,
        max_working_hours: (parameters as any).max_working_hours || 8,
        average_speed_kmh: (parameters as any).average_speed_kmh || 50,
      });
    }
  }, [parameters]);

  const updateMutation = useMutation({
    mutationFn: parametersApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parameters"] });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData as unknown as Record<string, number>);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          <span className="text-slate-400 text-sm">
            Parametreler yükleniyor...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative p-4">
      {/* Decorative blurs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full mix-blend-screen filter blur-3xl opacity-30"></div>
        <div className="absolute top-40 -left-20 w-80 h-80 bg-purple-600/10 rounded-full mix-blend-screen filter blur-3xl opacity-20"></div>
      </div>

      {/* Alerts */}
      {updateMutation.isSuccess && (
        <div className="mb-3 flex items-center gap-2 p-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 relative z-10">
          <span className="material-symbols-rounded text-[16px]">
            check_circle
          </span>
          <span className="text-xs font-medium">
            Parametreler başarıyla güncellendi
          </span>
        </div>
      )}

      {updateMutation.isError && (
        <div className="mb-3 flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 relative z-10">
          <span className="material-symbols-rounded text-[16px]">error</span>
          <span className="text-xs font-medium">
            Parametreler güncellenirken hata oluştu
          </span>
        </div>
      )}

      {/* Main Grid */}
      <form
        onSubmit={handleSubmit}
        className="flex-1 flex flex-col relative z-10"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
          {/* Maliyet Parametreleri */}
          <div className="glass-panel p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 border border-slate-700/50">
                <span className="material-symbols-rounded text-emerald-400 text-[18px]">
                  payments
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white">
                Maliyet Parametreleri
              </h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Kilometre Başı Maliyet
                </label>
                <div className="relative">
                  <input
                    type="number"
                    className="block w-full rounded-lg bg-slate-800/80 border border-slate-700/50 text-white text-sm py-2.5 pl-3 pr-16 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={formData.cost_per_km}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        cost_per_km: parseFloat(e.target.value) || 0,
                      })
                    }
                    min={0}
                    step={0.1}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500 text-xs font-semibold">
                    TL / km
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Araç Kiralama Maliyeti
                </label>
                <div className="relative">
                  <input
                    type="number"
                    className="block w-full rounded-lg bg-slate-800/80 border border-slate-700/50 text-white text-sm py-2.5 pl-3 pr-16 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={formData.rental_cost_500kg}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rental_cost_500kg: parseFloat(e.target.value) || 0,
                      })
                    }
                    min={0}
                    step={10}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500 text-xs font-semibold">
                    TL / gün
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Araç Kapasiteleri */}
          <div className="glass-panel p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 border border-slate-700/50">
                <span className="material-symbols-rounded text-amber-400 text-[18px]">
                  local_shipping
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white">
                Araç Kapasiteleri
              </h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Küçük Araç Kapasitesi
                </label>
                <div className="relative">
                  <input
                    type="number"
                    className="block w-full rounded-lg bg-slate-800/80 border border-slate-700/50 text-white text-sm py-2.5 pl-3 pr-12 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={formData.default_capacity_small}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        default_capacity_small: parseFloat(e.target.value) || 0,
                      })
                    }
                    min={100}
                    step={50}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500 text-xs font-semibold">
                    kg
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Orta Araç Kapasitesi
                </label>
                <div className="relative">
                  <input
                    type="number"
                    className="block w-full rounded-lg bg-slate-800/80 border border-slate-700/50 text-white text-sm py-2.5 pl-3 pr-12 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={formData.default_capacity_medium}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        default_capacity_medium:
                          parseFloat(e.target.value) || 0,
                      })
                    }
                    min={100}
                    step={50}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500 text-xs font-semibold">
                    kg
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Büyük Araç Kapasitesi
                </label>
                <div className="relative">
                  <input
                    type="number"
                    className="block w-full rounded-lg bg-slate-800/80 border border-slate-700/50 text-white text-sm py-2.5 pl-3 pr-12 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={formData.default_capacity_large}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        default_capacity_large: parseFloat(e.target.value) || 0,
                      })
                    }
                    min={100}
                    step={50}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500 text-xs font-semibold">
                    kg
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Kiralık Araç Kapasitesi
                </label>
                <div className="relative">
                  <input
                    type="number"
                    className="block w-full rounded-lg bg-slate-800/80 border border-slate-700/50 text-white text-sm py-2.5 pl-3 pr-12 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={formData.rental_capacity_kg}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rental_capacity_kg: parseFloat(e.target.value) || 0,
                      })
                    }
                    min={100}
                    step={50}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500 text-xs font-semibold">
                    kg
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Operasyon Parametreleri */}
          <div className="glass-panel p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 border border-slate-700/50">
                <span className="material-symbols-rounded text-purple-400 text-[18px]">
                  settings_applications
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white">
                Operasyon Parametreleri
              </h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Maksimum Çalışma Saati
                </label>
                <div className="relative">
                  <input
                    type="number"
                    className="block w-full rounded-lg bg-slate-800/80 border border-slate-700/50 text-white text-sm py-2.5 pl-3 pr-14 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={formData.max_working_hours}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        max_working_hours: parseFloat(e.target.value) || 0,
                      })
                    }
                    min={1}
                    max={12}
                    step={1}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500 text-xs font-semibold">
                    Saat
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Ortalama Hız
                </label>
                <div className="relative">
                  <input
                    type="number"
                    className="block w-full rounded-lg bg-slate-800/80 border border-slate-700/50 text-white text-sm py-2.5 pl-3 pr-20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={formData.average_speed_kmh}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        average_speed_kmh: parseFloat(e.target.value) || 0,
                      })
                    }
                    min={10}
                    max={120}
                    step={5}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500 text-xs font-semibold">
                    km/saat
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end mt-4">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)] hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.7)] transition-all duration-300 transform active:scale-95 border border-blue-400/30 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {updateMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Kaydediliyor...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-rounded text-[18px] group-hover:rotate-12 transition-transform">
                  save
                </span>
                <span>Kaydet</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
