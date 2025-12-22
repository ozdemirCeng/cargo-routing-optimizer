"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { stationsApi } from "@/lib/api";
import dynamic from "next/dynamic";

// Dynamically import Map component (no SSR)
const StationMap = dynamic(() => import("@/components/StationMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-2xl">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  ),
});

interface Station {
  id: string;
  name: string;
  code?: string;
  latitude: number;
  longitude: number;
  address?: string;
  isHub?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export default function StationsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    latitude: "",
    longitude: "",
    address: "",
  });

  // Fetch stations
  const {
    data: stations = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["stations"],
    queryFn: () => stationsApi.getAll().then((r) => r.data),
  });

  // Create station mutation
  const createMutation = useMutation({
    mutationFn: stationsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stations"] });
      handleCloseModal();
    },
  });

  // Update station mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      stationsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stations"] });
      setSelectedStation(null);
      setEditMode(false);
    },
  });

  // Delete station mutation
  const deleteMutation = useMutation({
    mutationFn: stationsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stations"] });
      setSelectedStation(null);
    },
  });

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditMode(false);
    setFormData({
      name: "",
      code: "",
      latitude: "",
      longitude: "",
      address: "",
    });
  };

  const handleOpenAddModal = () => {
    setFormData({
      name: "",
      code: "",
      latitude: "",
      longitude: "",
      address: "",
    });
    setEditMode(false);
    setShowAddModal(true);
  };

  const handleEditStation = () => {
    if (selectedStation) {
      setFormData({
        name: selectedStation.name,
        code: selectedStation.code || "",
        latitude: String(selectedStation.latitude),
        longitude: String(selectedStation.longitude),
        address: selectedStation.address || "",
      });
      setEditMode(true);
      setShowAddModal(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      code:
        formData.code.toUpperCase() ||
        formData.name.substring(0, 3).toUpperCase(),
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      address: formData.address,
    };

    if (editMode && selectedStation) {
      updateMutation.mutate({ id: selectedStation.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDeleteStation = () => {
    if (
      selectedStation &&
      confirm("Bu istasyonu silmek istediğinize emin misiniz?")
    ) {
      deleteMutation.mutate(selectedStation.id);
    }
  };

  const filteredStations = stations.filter(
    (station: Station) =>
      station.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (station.code &&
        station.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Bugün";
    if (diffDays === 1) return "Dün";
    if (diffDays < 7) return `${diffDays} gün önce`;
    return date.toLocaleDateString("tr-TR");
  };

  return (
    <div className="relative h-full">
      {/* Search Bar - Top Center */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 w-full max-w-lg px-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-12 pl-12 pr-4 rounded-xl bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-slate-400 shadow-xl text-sm"
              placeholder="İstasyon adı veya kod ile ara..."
            />
            <span className="material-symbols-rounded absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              search
            </span>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="w-12 h-12 rounded-xl bg-primary hover:bg-blue-600 text-white shadow-xl flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-rounded">add</span>
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden">
        <StationMap
          stations={filteredStations}
          selectedStation={selectedStation}
          onSelectStation={setSelectedStation}
        />
      </div>

      {/* Station List - Bottom Left */}
      <div className="absolute bottom-4 left-4 z-20 w-80">
        <div className="glass rounded-2xl shadow-xl max-h-64 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-700/50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">İstasyonlar</h3>
            <span className="text-xs text-slate-300">
              {filteredStations.length} adet
            </span>
          </div>
          <div className="overflow-y-auto flex-1 max-h-48">
            {isLoading ? (
              <div className="p-4 text-center text-slate-300">
                Yükleniyor...
              </div>
            ) : filteredStations.length === 0 ? (
              <div className="p-4 text-center text-slate-300">
                İstasyon bulunamadı
              </div>
            ) : (
              filteredStations.map((station: Station) => (
                <div
                  key={station.id}
                  onClick={() => setSelectedStation(station)}
                  className={`p-3 cursor-pointer transition-colors border-b border-slate-200/20 dark:border-slate-700/30 last:border-0 ${
                    selectedStation?.id === station.id
                      ? "bg-primary/10 dark:bg-primary/20"
                      : "hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        station.isHub
                          ? "bg-red-500/20 text-red-500"
                          : "bg-emerald-500/20 text-emerald-500"
                      }`}
                    >
                      <span className="material-symbols-rounded text-lg">
                        {station.isHub ? "warehouse" : "location_on"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {station.name}
                      </p>
                      <p className="text-xs text-slate-300">
                        {station.code || "-"}
                      </p>
                    </div>
                    {station.isActive !== false && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Station Details Panel - Right Side */}
      {selectedStation && (
        <aside className="absolute top-0 right-0 bottom-0 w-96 rounded-2xl glass shadow-2xl flex flex-col z-30 transition-transform duration-300">
          <div className="p-5 flex items-center justify-between border-b border-slate-700/50">
            <h2 className="text-lg font-bold text-white">İstasyon Detayları</h2>
            <button
              onClick={() => setSelectedStation(null)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <span className="material-symbols-rounded">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Station Header */}
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  selectedStation.isHub
                    ? "bg-red-500/10 dark:bg-red-500/20 text-red-500"
                    : "bg-blue-500/10 dark:bg-blue-500/20 text-primary"
                }`}
              >
                <span className="material-symbols-rounded text-2xl">
                  {selectedStation.isHub ? "warehouse" : "storefront"}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white leading-tight">
                  {selectedStation.name}
                </h3>
                <p className="text-sm text-slate-300 mt-1">
                  {selectedStation.isHub ? "Merkez Depo" : "Dağıtım Noktası"}
                </p>
              </div>
            </div>

            {/* Station Info Grid */}
            <div className="grid gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  KOD
                </span>
                <div className="text-white font-medium font-mono">
                  {selectedStation.code || "-"}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  KOORDİNATLAR
                </span>
                <div className="text-white font-mono text-xs">
                  Lat: {Number(selectedStation.latitude).toFixed(6)}, Long:{" "}
                  {Number(selectedStation.longitude).toFixed(6)}
                </div>
              </div>

              {selectedStation.address && (
                <div className="space-y-1">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    ADRES
                  </span>
                  <div className="text-white">{selectedStation.address}</div>
                </div>
              )}

              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  DURUM
                </span>
                <div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      selectedStation.isActive !== false
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30"
                        : "bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-400 border-slate-200 dark:border-slate-500/30"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        selectedStation.isActive !== false
                          ? "bg-emerald-500"
                          : "bg-slate-500"
                      }`}
                    ></span>
                    {selectedStation.isActive !== false ? "Aktif" : "Pasif"}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  SON GÜNCELLEME
                </span>
                <div className="text-white">
                  {formatDate(selectedStation.updatedAt)}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleEditStation}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-colors border border-primary/20"
              >
                <span className="material-symbols-rounded text-lg">edit</span>
                Düzenle
              </button>
              <button
                onClick={handleDeleteStation}
                disabled={deleteMutation.isPending}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-medium transition-colors border border-red-500/20 disabled:opacity-50"
              >
                <span className="material-symbols-rounded text-lg">delete</span>
                {deleteMutation.isPending ? "Siliniyor..." : "Sil"}
              </button>
            </div>

            <div className="h-px bg-slate-200/30 dark:bg-slate-700/50 w-full"></div>

            {/* Operation Info */}
            <div>
              <h4 className="text-sm font-bold text-white mb-3">
                Konum Bilgisi
              </h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-sm text-white">
                  <span className="material-symbols-rounded text-primary text-lg mt-0.5">
                    pin_drop
                  </span>
                  <div>
                    <span className="block text-slate-400 text-xs">
                      Enlem (Latitude)
                    </span>
                    {Number(selectedStation.latitude).toFixed(6)}°
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm text-white">
                  <span className="material-symbols-rounded text-primary text-lg mt-0.5">
                    explore
                  </span>
                  <div>
                    <span className="block text-slate-400 text-xs">
                      Boylam (Longitude)
                    </span>
                    {Number(selectedStation.longitude).toFixed(6)}°
                  </div>
                </div>
              </div>
            </div>

            {/* Map Preview */}
            <div className="p-4 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/30">
              <a
                href={`https://www.google.com/maps?q=${selectedStation.latitude},${selectedStation.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-primary hover:text-blue-600 font-medium transition-colors"
              >
                <span className="material-symbols-rounded">open_in_new</span>
                Google Maps&apos;te Aç
              </a>
            </div>
          </div>
        </aside>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleCloseModal}
          ></div>
          <div className="relative glass rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                {editMode ? "İstasyon Düzenle" : "Yeni İstasyon Ekle"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">
                  İstasyon Adı *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-600 focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-slate-400"
                  placeholder="Gebze Dağıtım Merkezi"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">
                  Kod
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-600 focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-slate-400 font-mono"
                  placeholder="GBZ"
                  maxLength={10}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">
                    Enlem (Latitude) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.latitude}
                    onChange={(e) =>
                      setFormData({ ...formData, latitude: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-600 focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-slate-400"
                    placeholder="40.8027"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">
                    Boylam (Longitude) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.longitude}
                    onChange={(e) =>
                      setFormData({ ...formData, longitude: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-600 focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-slate-400"
                    placeholder="29.4306"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">
                  Adres
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-600 focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-slate-400 resize-none"
                  placeholder="Gebze, Kocaeli"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-600 text-slate-200 hover:bg-slate-700 font-medium transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  className="flex-1 px-4 py-3 rounded-xl bg-primary hover:bg-blue-600 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Kaydediliyor...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-rounded text-lg">
                        save
                      </span>
                      {editMode ? "Güncelle" : "Kaydet"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
