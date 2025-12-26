"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cargosApi, stationsApi, usersApi } from "@/lib/api";

interface Cargo {
  id: string;
  trackingCode: string;
  userId?: string;
  user?: {
    id: string;
    fullName: string;
    email: string;
  };
  originStationId: string;
  originStation?: {
    id: string;
    name: string;
  };
  weightKg: number;
  status: string;
  description?: string;
  scheduledDate?: string;
  createdAt: string;
}

interface Station {
  id: string;
  name: string;
  isHub: boolean;
}

interface User {
  id: string;
  fullName: string;
  email: string;
}

interface CargoForm {
  originStationId: string;
  userId: string;
  weightKg: string;
  description: string;
  scheduledDate: string;
}

export default function CargosPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCargo, setEditingCargo] = useState<Cargo | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [filters, setFilters] = useState({
    status: "",
    stationId: "",
    date: "",
  });
  const [formData, setFormData] = useState<CargoForm>({
    originStationId: "",
    userId: "",
    weightKg: "",
    description: "",
    scheduledDate: "",
  });

  const { data: cargos, isLoading } = useQuery({
    queryKey: ["cargos", filters],
    queryFn: () => cargosApi.getAll(filters).then((r) => r.data),
  });

  const { data: stations } = useQuery({
    queryKey: ["stations"],
    queryFn: () => stationsApi.getAll().then((r) => r.data),
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: cargosApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cargos"] });
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CargoForm & { weightKg: number }>;
    }) => cargosApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cargos"] });
      handleCloseDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: cargosApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cargos"] });
    },
  });

  // Non-hub stations for cargo delivery
  const stationsList = useMemo(() => {
    const value: any = stations;
    if (Array.isArray(value)) return value as Station[];
    if (Array.isArray(value?.data)) return value.data as Station[];
    return [] as Station[];
  }, [stations]);

  const nonHubStations = useMemo(() => {
    return stationsList.filter((s) => !s.isHub);
  }, [stationsList]);

  // Filter and paginate cargos
  const filteredCargos = useMemo(() => {
    if (!cargos) return [];
    return cargos.filter(
      (c: Cargo) =>
        c.trackingCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.user?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.user?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [cargos, searchTerm]);

  const paginatedCargos = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredCargos.slice(start, start + rowsPerPage);
  }, [filteredCargos, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredCargos.length / rowsPerPage);

  // Statistics
  const stats = useMemo(() => {
    if (!cargos) return { total: 0, pending: 0, inTransit: 0, delivered: 0 };
    const pending = cargos.filter(
      (c: Cargo) => c.status === "pending" || c.status === "assigned"
    ).length;
    const inTransit = cargos.filter(
      (c: Cargo) => c.status === "in_transit"
    ).length;
    const delivered = cargos.filter(
      (c: Cargo) => c.status === "delivered"
    ).length;
    return {
      total: cargos.length,
      pending,
      inTransit,
      delivered,
    };
  }, [cargos]);

  const handleOpenDialog = (cargo?: Cargo) => {
    if (cargo) {
      setEditingCargo(cargo);
      setFormData({
        originStationId: cargo.originStationId,
        userId: cargo.userId || "",
        weightKg: cargo.weightKg.toString(),
        description: cargo.description || "",
        scheduledDate: cargo.scheduledDate?.split("T")[0] || "",
      });
    } else {
      setEditingCargo(null);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setFormData({
        originStationId: "",
        userId: "",
        weightKg: "",
        description: "",
        scheduledDate: tomorrow.toISOString().split("T")[0],
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCargo(null);
    setFormData({
      originStationId: "",
      userId: "",
      weightKg: "",
      description: "",
      scheduledDate: "",
    });
  };

  const handleSubmit = () => {
    const data: any = {
      originStationId: formData.originStationId,
      weightKg: parseFloat(formData.weightKg),
      description: formData.description,
      scheduledDate: formData.scheduledDate,
    };

    if (formData.userId) {
      data.userId = formData.userId;
    }

    if (editingCargo) {
      updateMutation.mutate({ id: editingCargo.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Bu kargoyu silmek istediğinizden emin misiniz?")) {
      deleteMutation.mutate(id);
    }
  };

  const statusLabels: Record<string, string> = {
    pending: "Bekliyor",
    assigned: "Atandı",
    in_transit: "Yolda",
    delivered: "Teslim Edildi",
    cancelled: "İptal",
  };

  const statusStyles: Record<string, string> = {
    pending: "badge-blue",
    assigned: "badge-blue",
    in_transit: "badge-orange",
    delivered: "badge-green",
    cancelled: "badge-red",
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.split(" ");
    return parts.length >= 2
      ? parts[0].charAt(0).toUpperCase() + parts[1].charAt(0).toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-blue-500/20 text-blue-400 border-blue-500/30",
      "bg-purple-500/20 text-purple-400 border-purple-500/30",
      "bg-teal-500/20 text-teal-400 border-teal-500/30",
      "bg-pink-500/20 text-pink-400 border-pink-500/30",
      "bg-orange-500/20 text-orange-400 border-orange-500/30",
      "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    ];
    if (!name) return colors[0];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} dk önce`;
    if (diffHours < 24) return `${diffHours} sa önce`;
    return `${diffDays} gün önce`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          <span className="text-slate-400 text-sm">Kargolar yükleniyor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4 md:p-6">
      {/* Main Content Panel */}
      <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden relative">
        {/* Panel Header */}
        <div className="p-6 pb-2 flex items-center justify-between border-b border-white/5">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Kargo Yönetimi
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Sipariş takibi ve durum yönetimi
            </p>
          </div>
          <button
            onClick={() => handleOpenDialog()}
            className="btn-primary-glow text-white px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all transform hover:translate-y-[-1px] hover:shadow-lg"
          >
            <span className="material-symbols-rounded">add</span>
            Yeni Kargo
          </button>
        </div>

        {/* Filters */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-3 relative">
            <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1 uppercase tracking-wider">
              Durum
            </label>
            <div className="relative">
              <select
                className="w-full pl-4 pr-10 py-2.5 rounded-lg text-sm glass-input appearance-none cursor-pointer focus:ring-1 focus:ring-primary"
                value={filters.status}
                onChange={(e) => {
                  setFilters({ ...filters, status: e.target.value });
                  setCurrentPage(1);
                }}
              >
                <option value="" className="bg-slate-800 text-gray-300">
                  Tüm Durumlar
                </option>
                <option value="pending" className="bg-slate-800 text-gray-300">
                  Bekliyor
                </option>
                <option value="assigned" className="bg-slate-800 text-gray-300">
                  Atandı
                </option>
                <option
                  value="in_transit"
                  className="bg-slate-800 text-gray-300"
                >
                  Yolda
                </option>
                <option
                  value="delivered"
                  className="bg-slate-800 text-gray-300"
                >
                  Teslim Edildi
                </option>
              </select>
              <svg
                className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
          <div className="md:col-span-3 relative">
            <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1 uppercase tracking-wider">
              İstasyon
            </label>
            <div className="relative">
              <select
                className="w-full pl-4 pr-10 py-2.5 rounded-lg text-sm glass-input appearance-none cursor-pointer focus:ring-1 focus:ring-primary"
                value={filters.stationId}
                onChange={(e) => {
                  setFilters({ ...filters, stationId: e.target.value });
                  setCurrentPage(1);
                }}
              >
                <option value="" className="bg-slate-800 text-gray-300">
                  Tüm İstasyonlar
                </option>
                {nonHubStations.map((s) => (
                  <option
                    key={s.id}
                    value={s.id}
                    className="bg-slate-800 text-gray-300"
                  >
                    {s.name}
                  </option>
                ))}
              </select>
              <svg
                className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
          <div className="md:col-span-3 relative">
            <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1 uppercase tracking-wider">
              Tarih
            </label>
            <div className="relative">
              <input
                type="date"
                className="w-full pl-4 pr-4 py-2.5 rounded-lg text-sm glass-input focus:ring-1 focus:ring-primary [&::-webkit-calendar-picker-indicator]:invert-[0.6]"
                value={filters.date}
                onChange={(e) => {
                  setFilters({ ...filters, date: e.target.value });
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
          <div className="md:col-span-3 relative">
            <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1 uppercase tracking-wider">
              Ara
            </label>
            <div className="relative">
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm glass-input placeholder-gray-500 focus:ring-1 focus:ring-primary"
                placeholder="Takip No, Müşteri..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 material-symbols-rounded text-[20px]">
                search
              </span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 pb-2">
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 font-semibold">Takip Kodu</th>
                <th className="px-4 py-3 font-semibold">Kullanıcı</th>
                <th className="px-4 py-3 font-semibold">İstasyon</th>
                <th className="px-4 py-3 font-semibold text-center">Ağırlık</th>
                <th className="px-4 py-3 font-semibold">Tarih</th>
                <th className="px-4 py-3 font-semibold">Durum</th>
                <th className="px-4 py-3 font-semibold text-center">
                  Oluşturulma
                </th>
                <th className="px-4 py-3 font-semibold text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {paginatedCargos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <span className="material-symbols-rounded text-[48px] opacity-50">
                        inventory_2
                      </span>
                      <span>Kargo bulunamadı</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCargos.map((cargo: Cargo) => (
                  <tr
                    key={cargo.id}
                    className="bg-slate-800/40 glass-table-row group"
                  >
                    <td className="px-4 py-4 rounded-l-lg font-mono">
                      <a
                        className="link-track flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                        href="#"
                      >
                        <span className="material-symbols-rounded text-[16px]">
                          qr_code_2
                        </span>
                        {cargo.trackingCode}
                      </a>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs border ${getAvatarColor(cargo.user?.fullName || "")}`}
                        >
                          {getInitials(cargo.user?.fullName || "Misafir")}
                        </div>
                        <div>
                          <div className="font-medium text-white">
                            {cargo.user?.fullName || "Misafir"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {cargo.user?.email || "-"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-300">
                      {cargo.originStation?.name || "-"}
                    </td>
                    <td className="px-4 py-4 text-center text-gray-400 font-mono">
                      {Number(cargo.weightKg).toFixed(1)} kg
                    </td>
                    <td className="px-4 py-4 text-gray-400">
                      {cargo.scheduledDate
                        ? new Date(cargo.scheduledDate).toLocaleDateString(
                            "tr-TR"
                          )
                        : "-"}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`badge-pill ${statusStyles[cargo.status] || "badge-blue"}`}
                      >
                        {statusLabels[cargo.status] || cargo.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center text-gray-500 text-xs">
                      {formatTimeAgo(cargo.createdAt)}
                    </td>
                    <td className="px-4 py-4 rounded-r-lg text-right">
                      <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                          title="Görüntüle"
                        >
                          <span className="material-symbols-rounded text-[18px]">
                            visibility
                          </span>
                        </button>
                        {cargo.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleOpenDialog(cargo)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-blue-400 transition-colors"
                              title="Düzenle"
                            >
                              <span className="material-symbols-rounded text-[18px]">
                                edit
                              </span>
                            </button>
                            <button
                              onClick={() => handleDelete(cargo.id)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors"
                              title="Sil"
                            >
                              <span className="material-symbols-rounded text-[18px]">
                                delete
                              </span>
                            </button>
                          </>
                        )}
                        <button
                          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                          title="Daha fazla"
                        >
                          <span className="material-symbols-rounded text-[18px]">
                            more_vert
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-white/5 flex items-center justify-between bg-black/10">
          <div className="text-xs text-gray-400">
            <span className="font-semibold text-white">
              {filteredCargos.length > 0
                ? (currentPage - 1) * rowsPerPage + 1
                : 0}
            </span>{" "}
            -{" "}
            <span className="font-semibold text-white">
              {Math.min(currentPage * rowsPerPage, filteredCargos.length)}
            </span>{" "}
            /{" "}
            <span className="font-semibold text-white">
              {filteredCargos.length}
            </span>{" "}
            kayıt gösteriliyor
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 mr-2">Rows per page:</span>
            <select
              className="bg-black/20 border border-white/10 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-primary"
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <div className="flex items-center gap-1 ml-4">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 disabled:opacity-50 transition-colors"
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
                    className={`h-8 w-8 flex items-center justify-center rounded-lg text-xs transition-colors ${
                      currentPage === pageNum
                        ? "bg-primary text-white shadow-neon-blue font-medium"
                        : "hover:bg-white/10 text-gray-400"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              {totalPages > 5 && currentPage < totalPages - 2 && (
                <>
                  <span className="text-gray-500 px-1">...</span>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 text-xs transition-colors"
                  >
                    {totalPages}
                  </button>
                </>
              )}
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages || totalPages === 0}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 disabled:opacity-50 transition-colors"
              >
                <span className="material-symbols-rounded text-[18px]">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dialog Modal */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleCloseDialog}
          ></div>

          {/* Modal */}
          <div className="relative bg-slate-900/40 backdrop-blur-2xl rounded-2xl w-full max-w-lg mx-4 shadow-2xl border border-white/10 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <span className="material-symbols-rounded text-blue-400">
                    {editingCargo ? "edit" : "add_box"}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {editingCargo ? "Kargo Düzenle" : "Yeni Kargo"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingCargo
                      ? "Kargo bilgilerini güncelleyin"
                      : "Yeni kargo kaydı oluşturun"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseDialog}
                className="h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Error Alert */}
              {(createMutation.isError || updateMutation.isError) && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                  <span className="material-symbols-rounded">error</span>
                  <span className="text-sm">
                    {(createMutation.error as any)?.response?.data?.message ||
                      (updateMutation.error as any)?.response?.data?.message ||
                      "İşlem sırasında hata oluştu"}
                  </span>
                </div>
              )}

              {/* User Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Kullanıcı (Opsiyonel)
                </label>
                <div className="relative">
                  <select
                    className="w-full pl-4 pr-10 py-3 rounded-xl glass-input appearance-none cursor-pointer"
                    value={formData.userId}
                    onChange={(e) =>
                      setFormData({ ...formData, userId: e.target.value })
                    }
                  >
                    <option value="" className="bg-slate-800">
                      Misafir
                    </option>
                    {((users as User[]) || []).map((u) => (
                      <option key={u.id} value={u.id} className="bg-slate-800">
                        {u.fullName} ({u.email})
                      </option>
                    ))}
                  </select>
                  <svg
                    className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none w-4 h-4 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              {/* Station Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Teslim Noktası <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <select
                    className="w-full pl-4 pr-10 py-3 rounded-xl glass-input appearance-none cursor-pointer"
                    value={formData.originStationId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        originStationId: e.target.value,
                      })
                    }
                    required
                  >
                    <option value="" className="bg-slate-800">
                      Seçiniz...
                    </option>
                    {nonHubStations.map((s) => (
                      <option key={s.id} value={s.id} className="bg-slate-800">
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none w-4 h-4 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              {/* Weight Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Ağırlık (kg) <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    className="w-full pl-10 pr-4 py-3 rounded-xl glass-input"
                    placeholder="0.0"
                    value={formData.weightKg}
                    onChange={(e) =>
                      setFormData({ ...formData, weightKg: e.target.value })
                    }
                    min="0.1"
                    step="0.1"
                    required
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-rounded">
                    scale
                  </span>
                </div>
              </div>

              {/* Date Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Planlanan Tarih
                </label>
                <div className="relative">
                  <input
                    type="date"
                    className="w-full pl-10 pr-4 py-3 rounded-xl glass-input [&::-webkit-calendar-picker-indicator]:invert-[0.6]"
                    value={formData.scheduledDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        scheduledDate: e.target.value,
                      })
                    }
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-rounded">
                    calendar_today
                  </span>
                </div>
              </div>

              {/* Description Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Açıklama
                </label>
                <textarea
                  className="w-full px-4 py-3 rounded-xl glass-input resize-none"
                  placeholder="Kargo açıklaması..."
                  rows={3}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
              <button
                onClick={handleCloseDialog}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  !formData.originStationId ||
                  !formData.weightKg
                }
                className="btn-primary-glow px-6 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>İşleniyor...</span>
                  </>
                ) : editingCargo ? (
                  <>
                    <span className="material-symbols-rounded text-[18px]">
                      check
                    </span>
                    <span>Güncelle</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-rounded text-[18px]">
                      add
                    </span>
                    <span>Oluştur</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
