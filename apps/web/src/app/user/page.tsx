"use client";

import { useQuery } from "@tanstack/react-query";
import { cargosApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UserDashboard() {
  const router = useRouter();

  const { data: cargos, isLoading } = useQuery({
    queryKey: ["my-cargos"],
    queryFn: () => cargosApi.getAll().then((r) => r.data),
  });

  const statusLabels: Record<string, string> = {
    pending: "Bekliyor",
    assigned: "Atandı",
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

  const statusIcons: Record<string, string> = {
    pending: "schedule",
    assigned: "assignment_turned_in",
    in_transit: "local_shipping",
    delivered: "check_circle",
    cancelled: "cancel",
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-shrink-0">
        <div className="glass rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <span className="material-symbols-rounded text-emerald-400 text-2xl">
              inventory_2
            </span>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">
              {cargos?.length || 0}
            </p>
            <p className="text-sm text-slate-300">Toplam Kargo</p>
          </div>
        </div>
        <div className="glass rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <span className="material-symbols-rounded text-amber-400 text-2xl">
              schedule
            </span>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">
              {cargos?.filter((c: any) => c.status === "pending").length || 0}
            </p>
            <p className="text-sm text-slate-300">Bekleyen</p>
          </div>
        </div>
        <div className="glass rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <span className="material-symbols-rounded text-purple-400 text-2xl">
              local_shipping
            </span>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">
              {cargos?.filter((c: any) => c.status === "in_transit").length ||
                0}
            </p>
            <p className="text-sm text-slate-300">Yolda</p>
          </div>
        </div>
        <div className="glass rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <span className="material-symbols-rounded text-emerald-400 text-2xl">
              check_circle
            </span>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">
              {cargos?.filter((c: any) => c.status === "delivered").length || 0}
            </p>
            <p className="text-sm text-slate-300">Teslim Edildi</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 glass rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Kargolarım</h1>
            <p className="text-sm text-slate-300 mt-1">
              Tüm kargo siparişlerinizi buradan takip edebilirsiniz
            </p>
          </div>
        </div>

        {/* Table or Empty State */}
        <div className="flex-1 overflow-auto p-6">
          {cargos?.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                <span className="material-symbols-rounded text-4xl text-slate-500">
                  package_2
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Henüz kargonuz bulunmuyor
              </h3>
              <p className="text-slate-300 mb-6 max-w-sm">
                İlk kargo talebinizi oluşturmak için aşağıdaki butona tıklayın
              </p>
              <Link
                href="/user/new-cargo"
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/20 transition-all font-medium"
              >
                <span className="material-symbols-rounded">add</span>
                İlk Kargonuzu Oluşturun
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-200">
                      Takip Kodu
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-200">
                      Teslim Noktası
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-200">
                      Ağırlık
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-200">
                      Planlanan Tarih
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-200">
                      Durum
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-200">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cargos?.map((cargo: any) => (
                    <tr
                      key={cargo.id}
                      className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <span className="font-mono text-sm font-medium text-white">
                          {cargo.trackingCode}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-rounded text-emerald-500 text-lg">
                            location_on
                          </span>
                          <span className="text-sm text-slate-100">
                            {cargo.originStation?.name || "-"}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-slate-100">
                          {Number(cargo.weightKg).toFixed(1)} kg
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-slate-100">
                          {cargo.scheduledDate
                            ? new Date(cargo.scheduledDate).toLocaleDateString(
                                "tr-TR"
                              )
                            : "-"}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${statusColors[cargo.status]}`}
                        >
                          <span className="material-symbols-rounded text-sm">
                            {statusIcons[cargo.status]}
                          </span>
                          {statusLabels[cargo.status]}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <button
                          onClick={() =>
                            router.push(`/user/track?id=${cargo.id}`)
                          }
                          disabled={
                            !["assigned", "in_transit"].includes(cargo.status)
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        >
                          <span className="material-symbols-rounded text-lg">
                            location_searching
                          </span>
                          Takip Et
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
