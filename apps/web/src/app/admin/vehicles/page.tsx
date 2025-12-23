'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehiclesApi } from '@/lib/api';

interface VehicleForm {
  plateNumber: string;
  name: string;
  capacityKg: string;
  isActive: boolean;
}

interface Vehicle {
  id: string;
  plateNumber: string;
  name: string;
  capacityKg: number;
  isActive: boolean;
  status: string;
  createdAt: string;
}

export default function VehiclesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [formData, setFormData] = useState<VehicleForm>({
    plateNumber: '',
    name: '',
    capacityKg: '',
    isActive: true,
  });

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => vehiclesApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: vehiclesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { plateNumber: string; name: string; capacityKg: number; isActive: boolean } }) =>
      vehiclesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      handleCloseDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: vehiclesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });

  // Filter and paginate vehicles
  const filteredVehicles = useMemo(() => {
    if (!vehicles) return [];
    return vehicles.filter((v: Vehicle) =>
      v.plateNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false
    );
  }, [vehicles, searchTerm]);

  const paginatedVehicles = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredVehicles.slice(start, start + itemsPerPage);
  }, [filteredVehicles, currentPage]);

  const totalPages = Math.ceil(filteredVehicles.length / itemsPerPage);

  // Statistics
  const stats = useMemo(() => {
    if (!vehicles) return { total: 0, active: 0, passive: 0 };
    const active = vehicles.filter((v: Vehicle) => v.isActive).length;
    return {
      total: vehicles.length,
      active,
      passive: vehicles.length - active,
    };
  }, [vehicles]);

  const handleOpenDialog = (vehicle?: Vehicle) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setFormData({
        plateNumber: vehicle.plateNumber,
        name: vehicle.name,
        capacityKg: vehicle.capacityKg.toString(),
        isActive: vehicle.isActive,
      });
    } else {
      setEditingVehicle(null);
      setFormData({ plateNumber: '', name: '', capacityKg: '', isActive: true });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingVehicle(null);
    setFormData({ plateNumber: '', name: '', capacityKg: '', isActive: true });
  };

  const handleSubmit = () => {
    const data = {
      plateNumber: formData.plateNumber,
      name: formData.name || `Araç (${formData.capacityKg} kg)`,
      capacityKg: parseFloat(formData.capacityKg),
      isActive: formData.isActive,
    };

    if (editingVehicle) {
      updateMutation.mutate({ id: editingVehicle.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Bu aracı silmek istediğinizden emin misiniz?')) {
      deleteMutation.mutate(id);
    }
  };

  const getInitials = (plateNumber: string) => {
    if (!plateNumber) return '??';
    const parts = plateNumber.split(' ');
    return parts.length >= 2 ? parts[0].charAt(0) + parts[1].charAt(0) : plateNumber.substring(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          <span className="text-slate-400 text-sm">Araçlar yükleniyor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-auto p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Ana Sayfa</span>
            <span className="material-symbols-rounded text-[12px]">chevron_right</span>
            <span className="text-primary">Araç Filosu</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Araç Yönetimi</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <input
              type="text"
              className="w-64 pl-10 pr-4 py-2.5 rounded-full text-sm glass-input placeholder:text-slate-500 focus:w-72 transition-all"
              placeholder="Plaka ara..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 material-symbols-rounded text-[18px] group-focus-within:text-primary transition-colors">
              search
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Vehicles */}
        <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-rounded text-[80px] text-slate-200">local_shipping</span>
          </div>
          <div className="flex items-center gap-4 mb-2">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <span className="material-symbols-rounded text-blue-400">directions_car</span>
            </div>
            <span className="text-sm font-medium text-slate-400 uppercase tracking-wide">Toplam Araç</span>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-white">{stats.total}</h3>
          </div>
          <div className="h-1 w-full bg-slate-700/50 rounded-full mt-4 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"
              style={{ width: '100%' }}
            ></div>
          </div>
        </div>

        {/* Active Vehicles */}
        <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-rounded text-[80px] text-slate-200">near_me</span>
          </div>
          <div className="flex items-center gap-4 mb-2">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <span className="material-symbols-rounded text-emerald-400">moving</span>
            </div>
            <span className="text-sm font-medium text-slate-400 uppercase tracking-wide">Aktif Araçlar</span>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-white">{stats.active}</h3>
            <span className="text-sm text-slate-500">/ {stats.total}</span>
          </div>
          <div className="h-1 w-full bg-slate-700/50 rounded-full mt-4 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"
              style={{ width: stats.total > 0 ? `${(stats.active / stats.total) * 100}%` : '0%' }}
            ></div>
          </div>
        </div>

        {/* Passive Vehicles */}
        <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-rounded text-[80px] text-slate-200">garage_home</span>
          </div>
          <div className="flex items-center gap-4 mb-2">
            <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
              <span className="material-symbols-rounded text-orange-400">power_settings_new</span>
            </div>
            <span className="text-sm font-medium text-slate-400 uppercase tracking-wide">Pasif Araçlar</span>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-white">{stats.passive}</h3>
          </div>
          <div className="h-1 w-full bg-slate-700/50 rounded-full mt-4 overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.5)]"
              style={{ width: stats.total > 0 ? `${(stats.passive / stats.total) * 100}%` : '0%' }}
            ></div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {deleteMutation.isError && (
        <div className="glass-card rounded-xl p-4 border-red-500/30 bg-red-500/10">
          <div className="flex items-center gap-3 text-red-400">
            <span className="material-symbols-rounded">error</span>
            <span>Araç silinirken hata oluştu</span>
          </div>
        </div>
      )}

      {/* Vehicle List */}
      <div className="glass-panel rounded-2xl flex-1 flex flex-col overflow-hidden">
        <div className="p-5 flex items-center justify-between border-b border-white/5">
          <h3 className="text-lg font-semibold text-white">Araç Listesi</h3>
          <div className="flex gap-3">
            <button
              onClick={() => handleOpenDialog()}
              className="px-4 py-2 rounded-lg btn-primary-glow text-white text-sm font-bold flex items-center gap-2"
            >
              <span className="material-symbols-rounded text-[20px]">add</span>
              Yeni Araç Ekle
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="glass-table-header sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">Plaka</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">Kapasite</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">Oluşturulma</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">Durum</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-white/5">
              {paginatedVehicles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-3">
                      <span className="material-symbols-rounded text-[48px] text-slate-600">directions_car</span>
                      <span>Henüz araç bulunmuyor</span>
                      <button
                        onClick={() => handleOpenDialog()}
                        className="mt-2 px-4 py-2 rounded-lg btn-primary-glow text-white text-sm font-medium flex items-center gap-2"
                      >
                        <span className="material-symbols-rounded text-[18px]">add</span>
                        İlk aracı ekle
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedVehicles.map((vehicle: Vehicle) => (
                  <tr key={vehicle.id} className="glass-table-row group">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-white">
                          {getInitials(vehicle.plateNumber)}
                        </div>
                        <div>
                          <div className="font-mono font-bold text-white text-base">{vehicle.plateNumber}</div>
                          <div className="text-xs text-slate-500">{vehicle.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-slate-300">{Number(vehicle.capacityKg).toLocaleString('tr-TR')} kg</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-slate-400">
                        {new Date(vehicle.createdAt).toLocaleDateString('tr-TR')}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {vehicle.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium status-badge-active">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 animate-pulse"></span>
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium status-badge-passive">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>
                          Pasif
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenDialog(vehicle)}
                          className="p-1.5 rounded-lg hover:bg-blue-500/20 hover:text-blue-400 text-slate-400 transition-colors"
                        >
                          <span className="material-symbols-rounded text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(vehicle.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 hover:text-red-400 text-slate-400 transition-colors"
                        >
                          <span className="material-symbols-rounded text-[18px]">delete</span>
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
        {filteredVehicles.length > 0 && (
          <div className="p-4 border-t border-white/5 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Toplam <span className="text-white font-semibold">{filteredVehicles.length}</span> araçtan{' '}
              <span className="text-white font-semibold">
                {(currentPage - 1) * itemsPerPage + 1}-
                {Math.min(currentPage * itemsPerPage, filteredVehicles.length)}
              </span>{' '}
              arası gösteriliyor
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 rounded-lg border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-rounded text-[16px]">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum: number;
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
                    className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs transition-colors ${
                      currentPage === pageNum
                        ? 'bg-primary text-white font-bold shadow-lg shadow-blue-500/20'
                        : 'border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 rounded-lg border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-rounded text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={handleCloseDialog}
          ></div>
          <div className="relative w-full max-w-xl glass-panel rounded-2xl overflow-hidden shadow-2xl animate-fade-in border border-white/10">
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                  <span className="material-symbols-rounded text-[20px]">directions_car</span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  {editingVehicle ? 'Araç Düzenle' : 'Yeni Araç Ekle'}
                </h3>
              </div>
              <button
                onClick={handleCloseDialog}
                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-rounded text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-5 bg-slate-900/40">
              {/* Error Message */}
              {(createMutation.isError || updateMutation.isError) && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="flex items-center gap-3 text-red-400">
                    <span className="material-symbols-rounded">error</span>
                    <span>
                      {(createMutation.error as Error)?.message ||
                        (updateMutation.error as Error)?.message ||
                        'İşlem sırasında hata oluştu'}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Plaka *
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 rounded-lg text-sm glass-input font-mono placeholder:text-slate-600 focus:text-white uppercase"
                    placeholder="Örn: 41 ABC 123"
                    value={formData.plateNumber}
                    onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Kapasite (kg) *
                  </label>
                  <input
                    type="number"
                    className="w-full px-4 py-2.5 rounded-lg text-sm glass-input placeholder:text-slate-600 focus:text-white"
                    placeholder="1000"
                    value={formData.capacityKg}
                    onChange={(e) => setFormData({ ...formData, capacityKg: e.target.value })}
                    min={100}
                    step={50}
                  />
                  <p className="text-xs text-slate-500 mt-1">Önerilen: 500, 750, 1000 kg</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Araç Adı
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 rounded-lg text-sm glass-input placeholder:text-slate-600 focus:text-white"
                  placeholder="Örn: Ford Transit 1000kg"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              {editingVehicle && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Durum
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isActive: true })}
                      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        formData.isActive
                          ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                          : 'glass-input text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        <span className="material-symbols-rounded text-[18px]">check_circle</span>
                        Aktif
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isActive: false })}
                      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        !formData.isActive
                          ? 'bg-orange-500/20 border border-orange-500/30 text-orange-400'
                          : 'glass-input text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        <span className="material-symbols-rounded text-[18px]">cancel</span>
                        Pasif
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-white/10 bg-slate-900/60 flex items-center justify-end gap-3">
              <button
                onClick={handleCloseDialog}
                className="px-5 py-2.5 rounded-lg text-slate-400 hover:text-white text-sm font-medium hover:bg-white/5 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending || !formData.plateNumber || !formData.capacityKg}
                className="px-6 py-2.5 rounded-lg text-white text-sm font-bold flex items-center gap-2 btn-primary-glow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>İşleniyor...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-rounded text-[18px]">check</span>
                    <span>{editingVehicle ? 'Güncelle' : 'Oluştur'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .glass-input {
          background-color: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.9);
          transition: all 0.2s ease-in-out;
        }
        .glass-input:focus {
          border-color: #135bec;
          box-shadow: 0 0 0 1px #135bec, 0 0 0 4px rgba(19, 91, 236, 0.15);
          background-color: rgba(15, 23, 42, 0.95);
          outline: none;
        }
        .glass-card {
          background: linear-gradient(145deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.4) 100%);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          transition: all 0.3s ease;
        }
        .glass-card:hover {
          border-color: rgba(19, 91, 236, 0.3);
          background: linear-gradient(145deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.5) 100%);
          transform: translateY(-2px);
          box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.3);
        }
        .glass-panel {
          background-color: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.2);
        }
        .glass-table-row {
          background-color: rgba(15, 23, 42, 0.4);
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          transition: all 0.2s ease;
        }
        .glass-table-row:hover {
          background-color: rgba(30, 41, 59, 0.6);
          border-color: rgba(19, 91, 236, 0.2);
        }
        .glass-table-header {
          background-color: rgba(15, 23, 42, 0.8);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .status-badge-active {
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #34d399;
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.1);
        }
        .status-badge-passive {
          background: rgba(148, 163, 184, 0.15);
          border: 1px solid rgba(148, 163, 184, 0.3);
          color: #94a3b8;
        }
        .btn-primary-glow {
          background: linear-gradient(135deg, #135bec 0%, #0d4abf 100%);
          box-shadow: 0 0 15px rgba(19, 91, 236, 0.4);
          transition: all 0.3s ease;
        }
        .btn-primary-glow:hover:not(:disabled) {
          box-shadow: 0 0 25px rgba(19, 91, 236, 0.6);
          transform: translateY(-1px);
          filter: brightness(1.1);
        }
      `}</style>
    </div>
  );
}
